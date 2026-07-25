import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { hostsInNetwork, parseShellyInfo, type LocalNetwork, type ShellyDevice } from './shelly.model';

/**
 * Zeit pro Host. Nicht belegte Adressen antworten gar nicht – dieser Wert bestimmt
 * also im Wesentlichen die Scan-Dauer.
 */
const PROBE_TIMEOUT_MS = 300;

/**
 * Gleichzeitige Anfragen. Höhere Werte sind auf Android riskant (Limits bei
 * Dateideskriptoren und im WLAN-Stack). 254 Hosts / 32 × 300 ms ≈ 2,5 s im schlechtesten Fall.
 */
const CONCURRENCY = 32;

export interface ScanProgress {
  done: number;
  total: number;
}

/** Findet Shelly-Geräte im lokalen Netz. Rein lesend (REQUIREMENTS §8). */
@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  /** Aktive IPv4-Netze dieses Rechners – ermittelt vom Rust-Command. */
  listLocalNetworks(): Promise<LocalNetwork[]> {
    return invoke<LocalNetwork[]>('list_local_networks');
  }

  /**
   * Scannt ein Netz nach Shelly-Geräten.
   *
   * Gefundene Geräte werden über `onFound` sofort gemeldet, damit die UI sie anzeigen
   * kann, während der Scan noch läuft.
   */
  async scanNetwork(
    network: LocalNetwork,
    callbacks: {
      onFound?: (device: ShellyDevice) => void;
      onProgress?: (progress: ScanProgress) => void;
    } = {},
  ): Promise<ShellyDevice[]> {
    const hosts = hostsInNetwork(network.ip, network.prefixLen).filter((host) => host !== network.ip);
    const total = hosts.length;
    const found: ShellyDevice[] = [];

    let nextIndex = 0;
    let done = 0;

    // Feste Anzahl paralleler "Arbeiter", die sich aus derselben Host-Liste bedienen.
    // Das hält die Zahl offener Verbindungen konstant, statt 254 Requests auf einmal
    // loszuschicken.
    const worker = async (): Promise<void> => {
      while (nextIndex < hosts.length) {
        const host = hosts[nextIndex++];
        const device = await this.probe(host);
        done++;

        if (device) {
          found.push(device);
          callbacks.onFound?.(device);
        }
        callbacks.onProgress?.({ done, total });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

    // Die Arbeiter sind unterschiedlich schnell – für eine stabile Anzeige sortieren.
    return found.sort((a, b) => compareIpv4(a.ip, b.ip));
  }

  /** Fragt eine einzelne Adresse ab. `null` = kein (erkennbares) Shelly. */
  private async probe(ip: string): Promise<ShellyDevice | null> {
    try {
      const response = await fetch(`http://${ip}/shelly`, {
        method: 'GET',
        // connectTimeout deckt nur den Verbindungsaufbau ab; das AbortSignal begrenzt
        // zusätzlich die Gesamtdauer, falls ein Gerät die Verbindung annimmt und dann
        // nicht antwortet.
        connectTimeout: PROBE_TIMEOUT_MS,
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });

      if (!response.ok) {
        return null;
      }
      return parseShellyInfo(ip, await response.json());
    } catch {
      // Timeout, geschlossener Port, kein JSON – für den Scan alles gleichbedeutend
      // mit "hier ist nichts".
      return null;
    }
  }
}

function compareIpv4(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return 0;
}

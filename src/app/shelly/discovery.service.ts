import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { hostsInNetwork, parseShellyInfo, type LocalNetwork, type ScanRange, type ShellyDevice } from './shelly.model';

/**
 * Zeit pro Host im eigenen Netz. Nicht belegte Adressen antworten gar nicht – dieser Wert
 * bestimmt also im Wesentlichen die Scan-Dauer.
 */
const LOCAL_TIMEOUT_MS = 300;

/**
 * Zeit pro Host über eine Route (VPN-Tunnel, Subnet-Router). Ein Round-Trip durch einen
 * Tunnel dauert deutlich länger als im LAN; mit 300 ms fällt ein erreichbares Gerät
 * schlicht ins Timeout und taucht nie auf.
 */
const ROUTED_TIMEOUT_MS = 1000;

/**
 * Gleichzeitige Anfragen. Höhere Werte sind auf Android riskant (Limits bei
 * Dateideskriptoren und im WLAN-Stack). 254 Hosts / 32 × 300 ms ≈ 2,5 s im schlechtesten Fall.
 */
const LOCAL_CONCURRENCY = 32;

/**
 * Über einen Tunnel weniger parallel: Der Verkehr läuft durch einen einzigen
 * Userspace-Prozess, viele gleichzeitige Verbindungen erhöhen dort vor allem die Verluste.
 */
const ROUTED_CONCURRENCY = 16;

export interface ScanProgress {
  done: number;
  total: number;
}

/** Stellschrauben eines Scans – hängen davon ab, wie das Ziel erreicht wird. */
export interface ScanSettings {
  timeoutMs: number;
  concurrency: number;
}

/**
 * Vorgaben für einen Scan. `directlyAttached` kommt aus `isDirectlyAttached()`: Liegt das
 * Ziel in einem Netz dieses Rechners, gelten die schnellen LAN-Werte, sonst die
 * geduldigeren für den Weg über eine Route.
 */
export function scanSettingsFor(directlyAttached: boolean): ScanSettings {
  return directlyAttached
    ? { timeoutMs: LOCAL_TIMEOUT_MS, concurrency: LOCAL_CONCURRENCY }
    : { timeoutMs: ROUTED_TIMEOUT_MS, concurrency: ROUTED_CONCURRENCY };
}

/** Findet Shelly-Geräte im lokalen Netz. Rein lesend (REQUIREMENTS §8). */
@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  /** Aktive IPv4-Netze dieses Rechners – ermittelt vom Rust-Command. */
  listLocalNetworks(): Promise<LocalNetwork[]> {
    return invoke<LocalNetwork[]>('list_local_networks');
  }

  /**
   * Scannt einen Adressbereich nach Shelly-Geräten.
   *
   * Gefundene Geräte werden über `onFound` sofort gemeldet, damit die UI sie anzeigen
   * kann, während der Scan noch läuft.
   */
  async scanRange(
    range: ScanRange,
    options: {
      onFound?: (device: ShellyDevice) => void;
      onProgress?: (progress: ScanProgress) => void;
      settings?: ScanSettings;
    } = {},
  ): Promise<ShellyDevice[]> {
    const { timeoutMs, concurrency } = options.settings ?? scanSettingsFor(true);
    // Die eigene Adresse wird mitgefragt: Bei einem beliebigen Bereich ist sie nicht
    // zwangsläufig bekannt, und eine Anfrage mehr fällt nicht ins Gewicht.
    const hosts = hostsInNetwork(range.network, range.prefixLen);
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
        const device = await this.probe(host, timeoutMs);
        done++;

        if (device) {
          found.push(device);
          options.onFound?.(device);
        }
        options.onProgress?.({ done, total });
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));

    // Die Arbeiter sind unterschiedlich schnell – für eine stabile Anzeige sortieren.
    return found.sort((a, b) => compareIpv4(a.ip, b.ip));
  }

  /** Fragt eine einzelne Adresse ab. `null` = kein (erkennbares) Shelly. */
  private async probe(ip: string, timeoutMs: number): Promise<ShellyDevice | null> {
    try {
      const response = await fetch(`http://${ip}/shelly`, {
        method: 'GET',
        // connectTimeout deckt nur den Verbindungsaufbau ab; das AbortSignal begrenzt
        // zusätzlich die Gesamtdauer, falls ein Gerät die Verbindung annimmt und dann
        // nicht antwortet.
        connectTimeout: timeoutMs,
        signal: AbortSignal.timeout(timeoutMs),
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

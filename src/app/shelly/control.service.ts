import { Injectable } from '@angular/core';
import { fetch } from '@tauri-apps/plugin-http';
import type { ShellyDevice } from './shelly.model';
import {
  parseDeviceStatus,
  statusUrl,
  switchUrl,
  type DeviceStatus,
  type SwitchAction,
} from './status.model';

/**
 * Zeitlimit für Status und Schaltbefehle.
 *
 * Deutlich großzügiger als beim Sweep (300 bzw. 1000 ms): Dort geht es darum, 254 nicht
 * belegte Adressen zügig abzuhaken, der Timeout bestimmt die Scan-Dauer. Hier ist das
 * Gerät bekannt und antwortet – Geduld kostet nichts, ein Abbruch dagegen viel, weil bei
 * einem Schaltbefehl offen bliebe, ob er angekommen ist.
 */
const DEVICE_TIMEOUT_MS = 5000;

/**
 * Was schiefgegangen ist – als Code, nicht als Satz.
 *
 * Der Grund: Der fertige Text hinge an der Sprache, die beim Fehlschlag gerade
 * eingestellt war, und bliebe nach einem Sprachwechsel stehen. Übersetzt wird deshalb
 * erst beim Anzeigen (REQUIREMENTS §4.6); die Codes entsprechen den `error.*`-Schlüsseln.
 */
export type DeviceErrorCode = 'unreachable' | 'locked' | 'badJson' | 'badStatus' | 'http';

/**
 * Fehler eines einzelnen Geräts.
 *
 * Wird pro Gerät angezeigt, nie global: Ein nicht erreichbares Gerät darf die Liste nicht
 * unbrauchbar machen.
 */
export class DeviceError extends Error {
  readonly code: DeviceErrorCode;

  /** Werte für die Platzhalter des Textes, etwa der HTTP-Status. */
  readonly params: Record<string, string | number>;

  constructor(code: DeviceErrorCode, params: Record<string, string | number> = {}) {
    // Als Meldung dient der Code selbst: Angezeigt wird er nie, er landet nur in
    // Stacktraces – ein deutscher Satz wäre dort keine bessere Auskunft.
    super(code);
    this.name = 'DeviceError';
    this.code = code;
    this.params = params;
  }

  /**
   * Gerät verlangt eine Anmeldung. Solange die Geräte-Auth nicht gebaut ist
   * (REQUIREMENTS §4.3), sind Aktionen gesperrt – das ist etwas anderes als ein Fehler.
   */
  get locked(): boolean {
    return this.code === 'locked';
  }
}

/**
 * Liest den Zustand von Shelly-Geräten und schaltet Relais.
 *
 * Der erste schreibende Zugriff der App – ausschließlich auf expliziten Nutzerklick
 * (REQUIREMENTS §8). Eigener Service statt direkter Importe in der Komponente, damit die
 * Tauri-Zugriffe im Test per DI ersetzbar sind (REQUIREMENTS §3.1).
 */
@Injectable({ providedIn: 'root' })
export class ControlService {
  /** Ist-Zustand eines Geräts. Wirft `DeviceError`, wenn die Abfrage nicht klappt. */
  async getStatus(device: ShellyDevice): Promise<DeviceStatus> {
    const response = await this.send(statusUrl(device));

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new DeviceError('badJson');
    }

    const status = parseDeviceStatus(device.generation, data);
    if (!status) {
      throw new DeviceError('badStatus');
    }
    return status;
  }

  /**
   * Schaltet einen Relais-Kanal. Wirft `DeviceError`, wenn der Befehl nicht ankommt.
   *
   * Die Antwort wird verworfen: Sie meldet den *vorherigen* Zustand (`was_on`). Der neue
   * gehört frisch abgefragt (REQUIREMENTS §4.2, kein optimistisches UI).
   */
  async setSwitch(device: ShellyDevice, channelId: number, action: SwitchAction): Promise<void> {
    await this.send(switchUrl(device, channelId, action));
  }

  /** Eine Anfrage an ein bekanntes Gerät; übersetzt jeden Fehlschlag in `DeviceError`. */
  private async send(url: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        // connectTimeout deckt nur den Verbindungsaufbau ab; das AbortSignal begrenzt
        // zusätzlich die Gesamtdauer, falls das Gerät annimmt und dann nicht antwortet.
        connectTimeout: DEVICE_TIMEOUT_MS,
        signal: AbortSignal.timeout(DEVICE_TIMEOUT_MS),
      });
    } catch {
      // Timeout, Gerät aus, kein Netz – für die Anzeige alles dasselbe.
      throw new DeviceError('unreachable');
    }

    if (response.status === 401) {
      // Passwortschutz kann auch nach dem Scan eingeschaltet worden sein. Nicht als
      // anonymen Fehler verschlucken, sondern als „gesperrt" kennzeichnen.
      throw new DeviceError('locked');
    }
    if (!response.ok) {
      throw new DeviceError('http', { status: response.status });
    }
    return response;
  }
}

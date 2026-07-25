/**
 * Ist-Zustand eines Shelly: Statusantwort auswerten, Kanäle ermitteln, Befehls-URLs bilden.
 *
 * Wie `shelly.model.ts` bewusst frei von Tauri-Abhängigkeiten: reine Funktionen, die sich
 * ohne laufende App prüfen lassen. Siehe docs/plans/geraete-schalten.md.
 */

import type { ShellyDevice } from './shelly.model';

/** Ein schaltbarer Ausgang eines Geräts. */
export interface ShellyChannel {
  /** Kanalnummer im Gerät: Gen1 der Index in `relays`, ab Gen2 die `id` aus "switch:<id>". */
  id: number;
  /** Ist-Zustand laut Gerät – nie geraten (REQUIREMENTS §4.2, kein optimistisches UI). */
  on: boolean;
}

/** Ausgewertete Antwort von `/status` bzw. `Shelly.GetStatus`. */
export interface DeviceStatus {
  /** Schaltbare Relais-Kanäle, nach Kanalnummer sortiert. */
  channels: ShellyChannel[];
  /**
   * Erkannte Komponenten, die dieser Schritt nicht schalten kann ("light", "cover",
   * "pm1", "roller" …). Relevant, wenn `channels` leer ist: dann ist das die Typ-Info
   * hinter „erkannt, nicht steuerbar" (REQUIREMENTS §4.2). Bewusst die Namen aus der
   * Shelly-API – unter denen findet man sie in der Doku und in einem Issue wieder.
   */
  unsupported: string[];
}

/** Was ein Relais tun soll. */
export type SwitchAction = 'on' | 'off' | 'toggle';

/**
 * Wertet die Statusantwort eines Geräts aus.
 *
 * `null` bedeutet „damit lässt sich nichts anfangen" – die Antwort war kein Objekt. Ein
 * Gerät ganz ohne Kanäle ist dagegen ein gültiges Ergebnis: Reine Messgeräte gehören in
 * die Liste, nur eben ohne Schaltflächen.
 */
export function parseDeviceStatus(generation: number, data: unknown): DeviceStatus | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  const raw = data as Record<string, unknown>;

  return generation === 1 ? parseGen1Status(raw) : parseGen2Status(raw);
}

/** Gen1-Komponenten, die dieser Schritt nicht steuert – Array-Name → Typ-Info. */
const GEN1_COMPONENTS: ReadonlyArray<readonly [string, string]> = [
  ['lights', 'light'],
  ['rollers', 'roller'],
  ['emeters', 'emeter'],
];

/**
 * Gen1 `/status`: Die Komponenten stecken in gleichnamigen Arrays (`relays`, `lights`,
 * `rollers`), der Zustand eines Relais in `ison`.
 */
function parseGen1Status(raw: Record<string, unknown>): DeviceStatus {
  const channels: ShellyChannel[] = [];
  const unsupported = new Set<string>();

  // Ein Gerät im Rollladenmodus (z. B. Shelly 2.5) meldet weiterhin `relays`. Die einzeln
  // zu schalten fährt den Motor an und ist kein Ein/Aus – deshalb gilt es hier als nicht
  // steuerbar, bis der Rollladen-Schritt kommt.
  const rollerMode = raw['mode'] === 'roller';
  if (rollerMode) {
    unsupported.add('roller');
  }

  const relays = raw['relays'];
  if (!rollerMode && Array.isArray(relays)) {
    relays.forEach((relay, id) => {
      const on = readBoolean(relay, 'ison');
      if (on !== null) {
        channels.push({ id, on });
      }
    });
  }

  for (const [key, kind] of GEN1_COMPONENTS) {
    const value = raw[key];
    if (Array.isArray(value) && value.length > 0) {
      unsupported.add(kind);
    }
  }

  return { channels, unsupported: [...unsupported].sort() };
}

/** Schlüssel einer Komponenteninstanz ab Gen2, z. B. "switch:0" oder "pm1:0". */
const COMPONENT_KEY = /^([a-z][a-z0-9_]*):(\d+)$/;

/**
 * Komponenten, die nie ein schaltbarer Ausgang sind. In „erkannt, nicht steuerbar" wären
 * sie nur Rauschen: `input` ist ein physischer Eingang (steckt an fast jedem Relais mit
 * dran), `script` ein laufendes Skript und gar kein Gerätetyp.
 */
const IGNORED_COMPONENTS: ReadonlySet<string> = new Set(['input', 'script']);

/**
 * Ab Gen2 heißen die Schlüssel "<komponente>:<id>", z. B. "switch:0", "light:0", "pm1:0".
 * Schlüssel ohne Doppelpunkt ("sys", "wifi", "cloud", "ble") sind Infrastruktur.
 */
function parseGen2Status(raw: Record<string, unknown>): DeviceStatus {
  const channels: ShellyChannel[] = [];
  const unsupported = new Set<string>();

  for (const [key, value] of Object.entries(raw)) {
    const match = COMPONENT_KEY.exec(key);
    if (!match) {
      continue;
    }

    const [, component, id] = match;
    if (IGNORED_COMPONENTS.has(component)) {
      continue;
    }

    if (component === 'switch') {
      const on = readBoolean(value, 'output');
      if (on !== null) {
        channels.push({ id: Number(id), on });
        continue;
      }
      // Ein "switch" ohne `output` ist nicht das, was wir erwarten – dann lieber als
      // nicht steuerbar melden, als einen Knopf ohne bekannten Zustand anzubieten.
    }

    unsupported.add(component);
  }

  // Objektschlüssel kommen in Einfügereihenfolge – für eine stabile Anzeige sortieren.
  channels.sort((a, b) => a.id - b.id);
  return { channels, unsupported: [...unsupported].sort() };
}

/** Liest ein Wahrheitsfeld aus einem Objekt unbekannter Herkunft. */
function readBoolean(value: unknown, field: string): boolean | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const flag = (value as Record<string, unknown>)[field];
  return typeof flag === 'boolean' ? flag : null;
}

/** Adresse für die Statusabfrage (REQUIREMENTS §4.2). */
export function statusUrl(device: ShellyDevice): string {
  return device.generation === 1
    ? `http://${device.ip}/status`
    : `http://${device.ip}/rpc/Shelly.GetStatus`;
}

/**
 * Adresse für einen Schaltbefehl.
 *
 * Umgeschaltet wird über die Methode des Geräts, nicht über „Gegenteil des zuletzt
 * gelesenen Zustands": Der kann veraltet sein, wenn jemand am Taster war.
 */
export function switchUrl(device: ShellyDevice, channelId: number, action: SwitchAction): string {
  if (device.generation === 1) {
    return `http://${device.ip}/relay/${channelId}?turn=${action}`;
  }
  if (action === 'toggle') {
    return `http://${device.ip}/rpc/Switch.Toggle?id=${channelId}`;
  }
  return `http://${device.ip}/rpc/Switch.Set?id=${channelId}&on=${action === 'on'}`;
}

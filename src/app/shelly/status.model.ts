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

/**
 * Zustand eines Rollladens.
 *
 * Ab Gen2 die Werte der API; bei Gen1 daraus abgeleitet (siehe `parseGen1Rollers`).
 * `unknown` steht für einen Wert, den diese Version nicht kennt – die Fahrbefehle
 * funktionieren trotzdem, nur die Beschriftung ist dann vage.
 */
export type CoverState =
  | 'open'
  | 'closed'
  | 'opening'
  | 'closing'
  | 'stopped'
  | 'calibrating'
  | 'unknown';

/** Ein Rollladen-Ausgang eines Geräts. */
export interface ShellyCover {
  /** Kanalnummer: Gen1 der Index in `rollers`, ab Gen2 die `id` aus "cover:<id>". */
  id: number;
  state: CoverState;
  /**
   * Position in Prozent (100 = offen), oder `null` bei nicht kalibriertem Gerät. Eine
   * erfundene Prozentzahl wäre schlimmer als keine.
   */
  position: number | null;
}

/** Ausgewertete Antwort von `/status` bzw. `Shelly.GetStatus`. */
export interface DeviceStatus {
  /** Schaltbare Relais-Kanäle, nach Kanalnummer sortiert. */
  channels: ShellyChannel[];
  /**
   * Rollladen-Kanäle, nach Kanalnummer sortiert. Eigene Liste statt eines Typkennzeichens
   * in `channels`: Ein Rollladen teilt mit einem Relais kein Feld und keinen Befehl
   * (docs/plans/rollladen.md).
   */
  covers: ShellyCover[];
  /**
   * Erkannte Komponenten, die diese Version nicht bedienen kann ("light", "pm1" …).
   * Relevant, wenn weder Kanäle noch Rollläden übrig bleiben: dann ist das die Typ-Info
   * hinter „erkannt, nicht steuerbar" (REQUIREMENTS §4.2). Bewusst die Namen aus der
   * Shelly-API – unter denen findet man sie in der Doku und in einem Issue wieder.
   */
  unsupported: string[];
}

/** Was ein Relais tun soll. */
export type SwitchAction = 'on' | 'off' | 'toggle';

/** Was ein Rollladen tun soll (REQUIREMENTS §4.2). */
export type CoverAction = 'open' | 'close' | 'stop';

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

/** Gen1-Komponenten, die diese Version nicht steuert – Array-Name → Typ-Info. */
const GEN1_COMPONENTS: ReadonlyArray<readonly [string, string]> = [
  ['lights', 'light'],
  ['emeters', 'emeter'],
];

/**
 * Gen1 `/status`: Die Komponenten stecken in gleichnamigen Arrays (`relays`, `lights`,
 * `rollers`), der Zustand eines Relais in `ison`.
 */
function parseGen1Status(raw: Record<string, unknown>): DeviceStatus {
  const channels: ShellyChannel[] = [];
  const unsupported = new Set<string>();

  // `mode` entscheidet, was zählt: Ein Shelly 2.5 meldet `relays` und `rollers` in jedem
  // Modus. Im Rollladenmodus die Relais einzeln zu schalten führe den Motor an und wäre
  // kein Ein/Aus; im Relaismodus wiederum ist der `rollers`-Eintrag nur Beiwerk.
  const rollerMode = raw['mode'] === 'roller';

  const relays = raw['relays'];
  if (!rollerMode && Array.isArray(relays)) {
    relays.forEach((relay, id) => {
      const on = readBoolean(relay, 'ison');
      if (on !== null) {
        channels.push({ id, on });
      }
    });
  }

  const rollers = raw['rollers'];
  const covers = rollerMode && Array.isArray(rollers) ? parseGen1Rollers(rollers) : [];
  if (rollerMode && covers.length === 0) {
    // Rollladenmodus, aber nichts Brauchbares im `rollers`-Array: Die Relais bleiben trotzdem
    // gesperrt. Die Typ-Info ist dann das Einzige, was das Gerät noch verrät – und genau die
    // braucht ein Issue (REQUIREMENTS §4.2).
    unsupported.add('roller');
  }

  for (const [key, kind] of GEN1_COMPONENTS) {
    const value = raw[key];
    if (Array.isArray(value) && value.length > 0) {
      unsupported.add(kind);
    }
  }

  return { channels, covers, unsupported: [...unsupported].sort() };
}

/**
 * Gen1 `rollers`: `state` beschreibt nur die Bewegung („open" = fährt auf, „close" = fährt
 * zu, „stop" = steht). Ob offen oder geschlossen, sagt erst die Position – deshalb wird im
 * Stillstand aus 100 % „offen" und aus 0 % „geschlossen".
 */
function parseGen1Rollers(rollers: unknown[]): ShellyCover[] {
  return rollers.flatMap((roller, id): ShellyCover[] => {
    if (typeof roller !== 'object' || roller === null) {
      return [];
    }
    const raw = roller as Record<string, unknown>;

    // Ohne Kalibrierung ist `current_pos` bedeutungslos.
    const pos = raw['positioning'] === true ? readPosition(raw['current_pos']) : null;

    // Während der Kalibrierfahrt meldet Gen1 weiterhin eine Bewegung – das eigene Flag ist
    // die genauere Auskunft und deckt sich mit dem, was Gen2 von sich aus sagt.
    if (raw['calibrating'] === true) {
      return [{ id, state: 'calibrating', position: pos }];
    }

    let state: CoverState;
    switch (raw['state']) {
      case 'open':
        state = 'opening';
        break;
      case 'close':
        state = 'closing';
        break;
      case 'stop':
        state = pos === 100 ? 'open' : pos === 0 ? 'closed' : 'stopped';
        break;
      default:
        state = 'unknown';
    }

    return [{ id, state, position: pos }];
  });
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
  const covers: ShellyCover[] = [];
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

    if (component === 'cover' && typeof value === 'object' && value !== null) {
      const cover = value as Record<string, unknown>;
      covers.push({
        id: Number(id),
        state: readCoverState(cover['state']),
        // `pos_control: false` heißt „nicht kalibriert" – ein trotzdem mitgeliefertes
        // `current_pos` wäre dann eine Zahl ohne Bedeutung. Dieselbe Regel wie bei Gen1.
        position: cover['pos_control'] === false ? null : readPosition(cover['current_pos']),
      });
      continue;
    }

    unsupported.add(component);
  }

  // Objektschlüssel kommen in Einfügereihenfolge – für eine stabile Anzeige sortieren.
  channels.sort((a, b) => a.id - b.id);
  covers.sort((a, b) => a.id - b.id);
  return { channels, covers, unsupported: [...unsupported].sort() };
}

/** Zustände, die die Cover-Komponente ab Gen2 meldet. */
const COVER_STATES: ReadonlySet<string> = new Set([
  'open',
  'closed',
  'opening',
  'closing',
  'stopped',
  'calibrating',
]);

/**
 * Ein unbekannter Wert wird zu `unknown`, nicht zu einem Fehler: Fahren lässt sich der
 * Rollladen trotzdem, nur die Beschriftung bleibt vage.
 */
function readCoverState(value: unknown): CoverState {
  return typeof value === 'string' && COVER_STATES.has(value) ? (value as CoverState) : 'unknown';
}

/** Position in Prozent; alles außerhalb von 0–100 gilt als „keine Angabe". */
function readPosition(value: unknown): number | null {
  return typeof value === 'number' && value >= 0 && value <= 100 ? value : null;
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

/** RPC-Methode je Fahrbefehl ab Gen2. */
const COVER_METHODS: Readonly<Record<CoverAction, string>> = {
  open: 'Cover.Open',
  close: 'Cover.Close',
  stop: 'Cover.Stop',
};

/**
 * Adresse für einen Fahrbefehl (docs/plans/rollladen.md).
 *
 * Eine Zielposition anzufahren (`go=to_pos` bzw. `Cover.GoToPosition`) gehört nicht dazu:
 * REQUIREMENTS §4.2 verlangt Öffnen/Schließen/Stopp und das Anzeigen der Position.
 */
export function coverUrl(device: ShellyDevice, coverId: number, action: CoverAction): string {
  if (device.generation === 1) {
    return `http://${device.ip}/roller/${coverId}?go=${action}`;
  }
  return `http://${device.ip}/rpc/${COVER_METHODS[action]}?id=${coverId}`;
}

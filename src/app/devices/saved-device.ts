/**
 * Ein Gerät, wie es im Projekt gespeichert wird (REQUIREMENTS §4.4).
 *
 * Getrennt von `ShellyDevice` gehalten, obwohl es dieselben Felder trägt: `ShellyDevice`
 * ist das Ergebnis einer Antwort von `GET /shelly`, `SavedDevice` der Inhalt einer Datei.
 * Die Datei muss auch dann lesbar bleiben, wenn eine spätere Version den Scan ändert —
 * und sie trägt zwei Felder mehr, die es im Scan nicht gibt.
 *
 * Siehe docs/plans/projekt-geraete.md.
 */

import type { ShellyDevice } from '../shelly/shelly.model';
import type { DeviceStatus } from '../shelly/status.model';
import { SHELLY } from './vendor';

/**
 * Die Kanäle eines Geräts, nach Art getrennt.
 *
 * Relais und Rollläden liegen auseinander, weil sie verschieden bedient werden und ihre
 * Nummern beide bei 0 beginnen (docs/plans/rollladen.md).
 */
export interface DeviceChannels {
  switchIds: number[];
  coverIds: number[];
}

/** Kanäle, wie das Gerät sie gemeldet hat. */
export function channelsFromStatus(status: DeviceStatus): DeviceChannels {
  return {
    switchIds: status.channels.map((channel) => channel.id),
    coverIds: status.covers.map((cover) => cover.id),
  };
}

/** Nur Relais – der häufige Fall, und die Abkürzung für Aufrufer ohne Rollladen. */
export function switchChannels(...switchIds: number[]): DeviceChannels {
  return { switchIds, coverIds: [] };
}

/** Noch nichts bekannt – etwa bei einem Gerät, das auf die Statusabfrage nicht antwortet. */
export function emptyChannels(): DeviceChannels {
  return { switchIds: [], coverIds: [] };
}

export interface SavedDevice {
  /** Schlüssel des Eintrags — der einzige stabile Bezeichner (REQUIREMENTS §4.4). */
  mac: string;
  /** Zuletzt bekannte Adresse. Wechselt per DHCP und wird beim Wiederfinden nachgezogen. */
  ip: string;
  generation: number;
  model: string;
  vendorId: string;
  /** Name, den das Gerät selbst meldet; der eigene Name steht in der Zuordnung. */
  name: string | null;
  authEnabled: boolean;
  firmware: string | null;
  /**
   * Zuletzt bekannte Relais-Kanäle. Ohne sie stünde die Liste beim Start ohne
   * Schaltflächen da, bis die erste Statusabfrage durch ist — in einer Notfall-App die
   * längsten Sekunden.
   */
  channelIds: number[];
  /**
   * Zuletzt bekannte Rollladen-Kanäle. Eigenes Feld statt gemeinsamer Liste: Eine ältere
   * Version liest die Datei weiter (unbekanntes Feld), eine ältere Datei diese Version
   * (fehlendes Feld → leer).
   */
  coverIds: number[];
}

/** Ein gefundenes Gerät, wie es ins Projekt wandert. */
export function savedDeviceFrom(device: ShellyDevice, channels: DeviceChannels): SavedDevice {
  return {
    mac: device.mac,
    ip: device.ip,
    generation: device.generation,
    model: device.model,
    vendorId: SHELLY.id,
    name: device.name,
    authEnabled: device.authEnabled,
    firmware: device.firmware,
    channelIds: [...channels.switchIds],
    coverIds: [...channels.coverIds],
  };
}

/**
 * Ein gespeichertes Gerät als Ziel für Abfragen und Befehle.
 *
 * Genau die Felder, die `ControlService` braucht — mit der zuletzt bekannten IP. Ist sie
 * veraltet, meldet die Zeile „nicht erreichbar", bis ein Scan die neue nachträgt.
 */
export function toShellyDevice(saved: SavedDevice): ShellyDevice {
  return {
    ip: saved.ip,
    generation: saved.generation,
    model: saved.model,
    mac: saved.mac,
    name: saved.name,
    authEnabled: saved.authEnabled,
    firmware: saved.firmware,
  };
}

/**
 * Liest gespeicherte Geräte.
 *
 * Wie `parseProjectData`: Was aus der Datei kommt, ist JSON beliebiger Form. Ein kaputter
 * Eintrag fällt weg, er reißt nicht die Liste mit — eine Notfall-Fernbedienung, die wegen
 * eines Eintrags nicht startet, wäre das Gegenteil ihres Zwecks.
 */
export function parseSavedDevices(value: unknown): SavedDevice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return [];
    }
    const raw = entry as Record<string, unknown>;

    const mac = asString(raw['mac']);
    const ip = asString(raw['ip']);
    const model = asString(raw['model']);
    const generation = raw['generation'];
    // Ohne MAC gäbe es keinen Schlüssel, ohne IP nichts anzusprechen.
    if (!mac || !ip || typeof generation !== 'number') {
      return [];
    }

    return [
      {
        mac,
        ip,
        generation,
        model: model ?? '',
        vendorId: asString(raw['vendorId']) ?? SHELLY.id,
        name: asString(raw['name']),
        authEnabled: raw['authEnabled'] === true,
        firmware: asString(raw['firmware']),
        channelIds: parseChannelIds(raw['channelIds']),
        coverIds: parseChannelIds(raw['coverIds']),
      },
    ];
  });
}

function parseChannelIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((id): id is number => Number.isInteger(id) && (id as number) >= 0);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

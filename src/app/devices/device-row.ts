/**
 * Eine Zeile der Geräteliste – gemeinsame Grundlage von Discovery- und Projektseite.
 *
 * Beide zeigen dieselben Zeilen, aber aus verschiedenen Quellen: die Discovery frisch
 * Gefundenes, das Projekt Gespeichertes. Die Auffaltung auf Kanäle, der anzuzeigende Name
 * und der übersetzte Fehlertext sind in beiden Fällen dieselbe Rechnung — deshalb hier,
 * als reine Funktion. Siehe docs/plans/projekt-geraete.md.
 */

import type { MessageKey, MessageParams } from '../i18n/messages';
import { displayName, entityKey, type Assignment, type Project } from '../project/project.model';
import type { ShellyDevice } from '../shelly/shelly.model';
import type { DeviceFailure, DeviceState } from './device-state.service';
import { deviceKind, devicePhoto, vendorById, type DeviceKind, type Vendor } from './vendor';

/** Fehlercode zu Textschlüssel. Als Tabelle, damit der Compiler die Lücken findet. */
const ERROR_KEYS: Record<DeviceFailure['code'], MessageKey> = {
  unreachable: 'error.unreachable',
  locked: 'error.locked',
  badJson: 'error.badJson',
  badStatus: 'error.badStatus',
  http: 'error.http',
  unexpected: 'error.unexpected',
};

/**
 * Eine Zeile: ein Kanal – oder das Gerät selbst, solange bzw. weil es keinen hat.
 * Mehrkanalgeräte bekommen so je einen eigenen Eintrag (REQUIREMENTS §4.2).
 */
export interface DeviceRow {
  /** MAC bzw. MAC:Kanal – zugleich Schlüssel für `track` und für die Projekt-Zuordnung. */
  entityKey: string;
  device: ShellyDevice;
  /** Kanalnummer, oder `null` bei einem Gerät ohne schaltbaren Ausgang. */
  channelId: number | null;
  /** Ist-Zustand laut Gerät; `null`, solange keiner bestätigt ist (kein Raten). */
  on: boolean | null;
  state: DeviceState;
  /** Leer bei Einkanalgeräten – dort wäre „Kanal 1" nur Ballast. */
  channelLabel: string;
  /** Was in der Liste steht: eigener Name aus dem Projekt, sonst der des Geräts. */
  label: string;
  /** Fehlertext in der eingestellten Sprache; leer, wenn alles in Ordnung ist. */
  errorText: string;
  /** Zuordnung im aktiven Projekt; `null` ohne Projekt oder ohne Zuordnung. */
  assignment: Assignment | null;
  /** Name des zugeordneten Raums bzw. der Kategorie – leer, wenn nichts zugeordnet ist. */
  roomName: string;
  categoryName: string;
  vendor: Vendor;
  kind: DeviceKind;
  /** Produktfoto aus dem Repository, sonst `null` – dann gilt das Symbol zur Geräteart. */
  photo: string | null;
  /** Steht dieses Gerät im aktiven Projekt? */
  saved: boolean;
}

/** Was `buildRows` außer den Geräten braucht. */
export interface RowContext {
  /** Ist-Zustand je MAC, aus dem `DeviceStateService`. */
  state: (mac: string) => DeviceState;
  /** Aktives Projekt – liefert Zuordnungen, Raum- und Kategorienamen. */
  project: Project | null;
  t: (key: MessageKey, params?: MessageParams) => string;
  /**
   * Kanäle aus dem Projekt, solange das Gerät noch keinen Status gemeldet hat. Ohne sie
   * stünde die gespeicherte Liste beim Start ohne Schaltflächen da (REQUIREMENTS §4.4).
   */
  savedChannels?: (mac: string) => number[];
  /** Hersteller-ID aus dem gespeicherten Eintrag; ohne Angabe gilt Shelly. */
  vendorId?: (mac: string) => string;
  /** Steht das Gerät im Projekt? Auf der Projektseite immer `true`. */
  saved?: (mac: string) => boolean;
}

export function buildRows(devices: ShellyDevice[], ctx: RowContext): DeviceRow[] {
  const project = ctx.project;

  return devices.flatMap((device): DeviceRow[] => {
    const state = ctx.state(device.mac);
    const deviceName = device.name ?? device.ip;
    const vendor = vendorById(ctx.vendorId?.(device.mac) ?? 'shelly');
    const saved = ctx.saved?.(device.mac) ?? false;

    // Bestätigte Kanäle haben Vorrang; die gespeicherten überbrücken nur die Zeit bis zur
    // ersten Antwort. Ihr Zustand bleibt derweil `null` – geraten wird nichts.
    const confirmed = state.status?.channels ?? null;
    const channelIds = confirmed
      ? confirmed.map((channel) => channel.id)
      : (ctx.savedChannels?.(device.mac) ?? []);

    const toRow = (channelId: number | null, channelLabel: string): DeviceRow => {
      const key = entityKey(device.mac, channelId);
      const assignment = project?.assignments[key] ?? null;
      return {
        entityKey: key,
        device,
        channelId,
        on: confirmed?.find((channel) => channel.id === channelId)?.on ?? null,
        state,
        channelLabel,
        label: displayName(
          assignment,
          channelLabel ? `${deviceName} · ${channelLabel}` : deviceName,
        ),
        // Hier übersetzt, nicht beim Fehlschlag: So wechselt auch eine schon stehende
        // Fehlermeldung die Sprache mit.
        errorText: state.error ? ctx.t(ERROR_KEYS[state.error.code], state.error.params) : '',
        assignment,
        roomName: labelName(project?.rooms, assignment?.roomId),
        categoryName: labelName(project?.categories, assignment?.categoryId),
        vendor,
        kind: deviceKind(device.model),
        photo: devicePhoto(device.model),
        saved,
      };
    };

    if (channelIds.length === 0) {
      return [toRow(null, '')];
    }
    // Für Menschen ab 1 zählen; die Kanalnummer der API beginnt bei 0.
    return channelIds.map((id) =>
      toRow(id, channelIds.length > 1 ? ctx.t('device.channel', { number: id + 1 }) : ''),
    );
  });
}

/** Name einer Bezeichnung; leer, wenn nichts zugeordnet ist oder die ID nicht mehr gilt. */
function labelName(labels: { id: string; name: string }[] | undefined, id: string | null | undefined): string {
  return labels?.find((label) => label.id === id)?.name ?? '';
}

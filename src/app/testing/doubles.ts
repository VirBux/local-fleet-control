/**
 * Testdaten und Testdoubles, die mehr als eine Spec braucht.
 *
 * Bewusst ohne `vitest`-Import: Diese Datei liegt in `src/` und wird deshalb auch vom
 * App-Build typgeprüft (`tsconfig.app.json` schließt nur `*.spec.ts` aus). Spione (`vi.fn`)
 * legt jede Spec selbst an.
 *
 * Nach REQUIREMENTS §3.1 greift `vi.mock()` auf Modulpfade bei diesem Builder nicht —
 * ersetzbar ist nur, was über DI kommt.
 */

import type { LocalNetwork, ShellyDevice } from '../shelly/shelly.model';
import type { DeviceStatus } from '../shelly/status.model';

export const netz: LocalNetwork = {
  interface: 'WLAN',
  ip: '192.168.1.42',
  netmask: '255.255.255.0',
  prefixLen: 24,
};

/** Typisch für Tailscale und WireGuard: genau eine Adresse, keine Geräte darin. */
export const tunnel: LocalNetwork = {
  interface: 'Tailscale',
  ip: '100.70.91.49',
  netmask: '255.255.255.255',
  prefixLen: 32,
};

export const geraet: ShellyDevice = {
  ip: '192.168.1.50',
  generation: 2,
  model: 'SNSW-001X16EU',
  mac: 'A8032ABD42EC',
  name: 'Flurlicht',
  authEnabled: false,
  firmware: '1.0.7',
};

/** Zweites Gerät, um zu prüfen, dass ein Ausfall nicht auf die ganze Liste durchschlägt. */
export const zweitgeraet: ShellyDevice = {
  ...geraet,
  ip: '192.168.1.51',
  mac: 'A8032ABD42ED',
  name: 'Terrasse',
};

export const einKanalAus: DeviceStatus = {
  channels: [{ id: 0, on: false }],
  covers: [],
  unsupported: [],
};

/** Ein Gerät im Rollladenmodus: ein Rollladen, kein einzeln schaltbares Relais. */
export const einRollladen: DeviceStatus = {
  channels: [],
  covers: [{ id: 0, state: 'stopped', position: 40 }],
  unsupported: [],
};

/** Speicher-Double. Asynchron wie das Original: Die echte Ablage ist eine Datei. */
export class FakeStorage {
  constructor(readonly entries = new Map<string, unknown>()) {}

  async read(key: string): Promise<unknown> {
    return this.entries.get(key) ?? null;
  }

  async write(key: string, value: unknown): Promise<void> {
    // Wie durch die Datei: Was hier ankommt, muss serialisierbar sein.
    this.entries.set(key, JSON.parse(JSON.stringify(value)));
  }
}

/**
 * Plattform-Double. Die Sprache ist festgenagelt: Sonst hinge jeder erwartete Text an der
 * Locale, mit der die Testumgebung gerade läuft.
 */
export function fakePlatform(openExternal: (url: string) => Promise<void> = () => Promise.resolve()) {
  return {
    getAppVersion: () => Promise.resolve('0.1.0'),
    openExternal,
    preferredLanguages: () => ['de'],
  };
}

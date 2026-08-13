/**
 * Hersteller und Geräteart — die Grundlage der Hersteller-Spalte in der Geräteliste.
 *
 * Wie die Shelly-Modelle bewusst frei von Angular- und Tauri-Abhängigkeiten: reine
 * Funktionen auf reinen Daten. Siehe docs/plans/projekt-geraete.md.
 */

/** Ein Gerätehersteller. */
export interface Vendor {
  id: string;
  /** Markenname. Bleibt unübersetzt — ein Eigenname (REQUIREMENTS §4.6). */
  name: string;
  /** Tönung des Namensschilds in der Liste. */
  color: string;
}

/**
 * Der einzige Hersteller des MVP (REQUIREMENTS §4.2). Tasmota und WLED sind Phase 2 —
 * die Hersteller-ID steht trotzdem schon an jedem gespeicherten Gerät, weil sie später
 * nachzutragen hieße, gespeicherte Dateien zu migrieren.
 */
export const SHELLY: Vendor = { id: 'shelly', name: 'Shelly', color: '#3b82c4' };

/**
 * Rückfall für eine ID, die diese Version nicht kennt — etwa aus einer Datei, die eine
 * neuere Version geschrieben hat. Der Strich statt eines Wortes spart einen Textschlüssel,
 * der ohnehin nie erscheinen sollte.
 */
const UNKNOWN_VENDOR: Vendor = { id: 'unknown', name: '—', color: '#6b7280' };

const VENDORS: readonly Vendor[] = [SHELLY];

export function vendorById(id: string): Vendor {
  return VENDORS.find((vendor) => vendor.id === id) ?? UNKNOWN_VENDOR;
}

/**
 * Geräteart, soweit sie sich aus der Modellkennung ablesen lässt.
 *
 * Zweck ist **allein das Platzhalter-Symbol** in der Liste. Was ein Gerät tatsächlich kann,
 * sagt seine Statusantwort (`status.model.ts`) — nie diese Tabelle. Eine falsch geratene
 * Art zeigt deshalb schlimmstenfalls das falsche Bildchen.
 */
export type DeviceKind = 'switch' | 'plug' | 'dimmer' | 'meter' | 'sensor' | 'gateway' | 'unknown';

/** Gen1: die Kennung beginnt mit „SH" plus Kürzel der Baureihe („SHSW-25", „SHPLG-S"). */
const GEN1_KINDS: ReadonlyArray<readonly [RegExp, DeviceKind]> = [
  [/^SHSW/, 'switch'],
  [/^SHPLG/, 'plug'],
  [/^(SHDM|SHRGBW|SHBLB|SHBDUO|SHCB)/, 'dimmer'],
  [/^(SHEM|SH3EM)/, 'meter'],
  [/^(SHHT|SHWT|SHDW|SHMOS|SHGS|SHSM|SHIX|SHTRV)/, 'sensor'],
];

/**
 * Ab Gen2 kodieren die Zeichen 3 und 4 der Kennung die Baureihe: „SNSW-001X16EU" (Plus),
 * „SPSW-201XE16EU" (Pro), „S3SW-001X16EU" (Gen3), „S4SW-…" (Gen4).
 */
const GEN2_FAMILY = /^S[NP34]([A-Z]{2})/;

const FAMILY_KINDS: Readonly<Record<string, DeviceKind>> = {
  SW: 'switch',
  PL: 'plug',
  DM: 'dimmer',
  CL: 'dimmer',
  LT: 'dimmer',
  EM: 'meter',
  SN: 'sensor',
  GW: 'gateway',
};

export function deviceKind(model: string): DeviceKind {
  const key = model.toUpperCase();

  for (const [pattern, kind] of GEN1_KINDS) {
    if (pattern.test(key)) {
      return kind;
    }
  }

  const family = GEN2_FAMILY.exec(key)?.[1];
  return (family && FAMILY_KINDS[family]) || 'unknown';
}

/**
 * Produktfotos, die im Repository liegen (`src/assets/devices/`), nach Modellkennung in
 * Großbuchstaben.
 *
 * **Absichtlich leer.** Die Produktfotos von Shelly gehören Allterco; ein
 * Apache-2.0-Repository kann sie nicht mitliefern, ohne seine eigene Lizenz zu unterlaufen.
 * Wer Bilder rechtmäßig besitzt, legt sie unter `src/assets/devices/` ab und trägt sie hier
 * ein:
 *
 * ```ts
 * 'SNSW-001X16EU': 'assets/devices/shelly-plus-1pm.webp',
 * ```
 *
 * Ohne Eintrag zeichnet die Oberfläche das Symbol zur Geräteart — eine Registrierung im
 * Quelltext statt eines Ratens auf gut Glück, weil ein 404 pro Zeile in der Liste
 * flackerte.
 */
export const DEVICE_PHOTOS: Readonly<Record<string, string>> = {};

/** Pfad zum Produktfoto, oder `null` — dann gilt das Symbol zur Geräteart. */
export function devicePhoto(model: string): string | null {
  return DEVICE_PHOTOS[model.toUpperCase()] ?? null;
}

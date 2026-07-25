/**
 * Datenmodell und Auswertung der Shelly-Discovery.
 *
 * Bewusst frei von Tauri-Abhängigkeiten: reine Funktionen, die sich ohne laufende App
 * prüfen lassen. Siehe docs/plans/netzwerk-scan.md.
 */

/** Ein aktives IPv4-Netz dieses Rechners (Rückgabe des Rust-Commands). */
export interface LocalNetwork {
  interface: string;
  ip: string;
  netmask: string;
  prefixLen: number;
}

/** Ein per `GET /shelly` erkanntes Gerät. */
export interface ShellyDevice {
  ip: string;
  /** 1 für Gen1, sonst der Wert aus dem `gen`-Feld (2, 3, 4 …). */
  generation: number;
  /** Modellkennung: Gen1 `type` ("SHSW-25"), ab Gen2 `model` ("SNSW-001X16EU"). */
  model: string;
  mac: string;
  /** Konfigurierter Gerätename – erst ab Gen2 vorhanden. */
  name: string | null;
  /** Gerät ist passwortgeschützt. */
  authEnabled: boolean;
  firmware: string | null;
}

/**
 * Wertet die Antwort von `GET /shelly` aus.
 *
 * Gibt `null` zurück, wenn die Antwort nicht plausibel von einem Shelly stammt – im
 * Subnetz können beliebige Geräte auf beliebige Pfade mit irgendeinem JSON antworten.
 * Als Nachweis verlangen wir eine MAC-Adresse *und* eine Modellkennung.
 */
export function parseShellyInfo(ip: string, data: unknown): ShellyDevice | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  const raw = data as Record<string, unknown>;

  const mac = asString(raw['mac']);
  if (!mac) {
    return null;
  }

  // Gen1 kennt kein `gen`-Feld – daran unterscheiden sich die beiden API-Familien.
  if (raw['gen'] === undefined) {
    const type = asString(raw['type']);
    if (!type) {
      return null;
    }
    return {
      ip,
      generation: 1,
      model: type,
      mac,
      name: null,
      authEnabled: raw['auth'] === true,
      firmware: asString(raw['fw']),
    };
  }

  const generation = raw['gen'];
  const model = asString(raw['model']);
  if (typeof generation !== 'number' || !model) {
    return null;
  }
  return {
    ip,
    generation,
    model,
    mac,
    name: asString(raw['name']),
    authEnabled: raw['auth_en'] === true,
    firmware: asString(raw['ver']),
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Alle Host-Adressen eines Netzes, ohne Netz- und Broadcast-Adresse.
 *
 * `maxHosts` begrenzt die Größe: Ein /16-Netz hätte 65.534 Hosts und wäre bei 300 ms
 * Timeout nicht mehr sinnvoll scannbar. Für solche Netze ist der manuelle Scan-Bereich
 * aus REQUIREMENTS §4.5 vorgesehen. Zu große oder ungültige Netze liefern eine leere Liste.
 */
export function hostsInNetwork(ip: string, prefixLen: number, maxHosts = 1024): string[] {
  const address = ipv4ToInt(ip);
  if (address === null || !Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) {
    return [];
  }

  const hostBits = 32 - prefixLen;
  // /31 und /32 haben keine regulären Host-Adressen.
  const hostCount = hostBits >= 2 ? 2 ** hostBits - 2 : 0;
  if (hostCount <= 0 || hostCount > maxHosts) {
    return [];
  }

  // Host-Bits ausmaskieren ergibt die Netzadresse. `>>> 0` erzwingt eine vorzeichenlose
  // Zahl – JavaScripts Bit-Operatoren rechnen sonst mit vorzeichenbehafteten 32 Bit.
  const networkAddress = (address & (0xffffffff << hostBits)) >>> 0;

  const hosts: string[] = [];
  for (let offset = 1; offset <= hostCount; offset++) {
    hosts.push(intToIpv4((networkAddress + offset) >>> 0));
  }
  return hosts;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    // Schützt vor "1e2", " 12" und Ähnlichem, was Number() akzeptieren würde.
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    result = (result << 8) | octet;
  }
  return result >>> 0;
}

function intToIpv4(value: number): string {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.');
}

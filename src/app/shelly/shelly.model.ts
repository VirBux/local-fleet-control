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

/**
 * Ein zu scannender Adressbereich.
 *
 * Bewusst getrennt von `LocalNetwork`: Welchen Weg eine Anfrage nimmt, entscheidet die
 * Routing-Tabelle des Betriebssystems — die App bindet keine Sockets an ein Interface.
 * Ein Bereich muss deshalb *nicht* zu einem Netz dieses Rechners gehören: Über einen
 * VPN-Tunnel oder einen Tailscale-Subnet-Router sind fremde Netze erreichbar, ohne dass
 * der Rechner selbst eine Adresse darin hat. Die lokalen Netze sind nur Vorschläge
 * (REQUIREMENTS §4.5, „Scan-Bereich falls das Subnetz abweicht").
 */
export interface ScanRange {
  /** Netzadresse in Normalform, z. B. "192.168.10.0". */
  network: string;
  prefixLen: number;
}

/**
 * Obergrenze für einen Scan. Ein /16 hätte 65.534 Hosts und wäre bei kurzem Timeout
 * nicht mehr sinnvoll scannbar.
 */
export const MAX_HOSTS = 1024;

/** Ein per `GET /shelly` erkanntes Gerät. */
export interface ShellyDevice {
  ip: string;
  /** 1 für Gen1, sonst der Wert aus dem `gen`-Feld (2, 3, 4 …). */
  generation: number;
  /** Modellkennung: Gen1 `type` ("SHSW-25"), ab Gen2 `model` ("SNSW-001X16EU"). */
  model: string;
  /**
   * Der einzige stabile Bezeichner eines Geräts – IP (DHCP) und Name (frei änderbar)
   * taugen dafür nicht. In Normalform, siehe `normalizeMac`.
   */
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
      mac: normalizeMac(mac),
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
    mac: normalizeMac(mac),
    name: asString(raw['name']),
    authEnabled: raw['auth_en'] === true,
    firmware: asString(raw['ver']),
  };
}

/**
 * MAC in Normalform: Großbuchstaben, ohne Trennzeichen.
 *
 * Alle bisher beobachteten Geräte liefern sie ohnehin so. Aber an dieser Schreibweise
 * hängen die gespeicherten Projekt-Zuordnungen (docs/plans/projektstruktur.md), und eine
 * Zuordnung, die nach einem Firmware-Update ins Leere zeigt, wäre ein übler Fehler.
 * Bleibt nichts Verwertbares übrig, gilt der Ursprungswert – dann ist das Gerät zwar
 * seltsam, aber immer noch unterscheidbar.
 */
function normalizeMac(mac: string): string {
  const normalized = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return normalized || mac;
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
export function hostsInNetwork(ip: string, prefixLen: number, maxHosts = MAX_HOSTS): string[] {
  const address = ipv4ToInt(ip);
  const hostCount = hostCountForPrefix(prefixLen);
  if (address === null || hostCount <= 0 || hostCount > maxHosts) {
    return [];
  }

  const networkAddress = maskNetwork(address, prefixLen);

  const hosts: string[] = [];
  for (let offset = 1; offset <= hostCount; offset++) {
    hosts.push(intToIpv4((networkAddress + offset) >>> 0));
  }
  return hosts;
}

/**
 * Anzahl regulär nutzbarer Host-Adressen eines Präfixes, ohne Netz- und Broadcast-Adresse.
 *
 * /31 und /32 haben keine — ein /32 (typisch für Tailscale- und WireGuard-Adressen)
 * beschreibt genau einen Rechner und ist deshalb nicht scannbar. Ungültige Präfixe
 * liefern 0.
 */
export function hostCountForPrefix(prefixLen: number): number {
  if (!Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) {
    return 0;
  }
  const hostBits = 32 - prefixLen;
  return hostBits >= 2 ? 2 ** hostBits - 2 : 0;
}

/**
 * Liest einen Scan-Bereich aus einer Eingabe wie "192.168.10.0/24".
 *
 * Erlaubt ist jede Adresse des Netzes ("192.168.10.37/24") — zurück kommt immer die
 * Netzadresse. Ohne Präfix wird /24 angenommen: die Scan-Einheit aus REQUIREMENTS §4.1
 * und der Normalfall im Heimnetz. `null` bedeutet „keine gültige Eingabe"; ob der
 * Bereich auch sinnvoll scannbar ist, beantwortet `hostCountForPrefix`.
 */
export function parseScanRange(input: string): ScanRange | null {
  const [addressPart, prefixPart, ...rest] = input.trim().split('/');
  if (rest.length > 0) {
    return null;
  }

  const address = ipv4ToInt(addressPart);
  if (address === null) {
    return null;
  }

  let prefixLen = 24;
  if (prefixPart !== undefined) {
    // Schützt vor "24.5", " 24" und Leerstring, was Number() akzeptieren würde.
    if (!/^\d{1,2}$/.test(prefixPart)) {
      return null;
    }
    prefixLen = Number(prefixPart);
    if (prefixLen > 32) {
      return null;
    }
  }

  return { network: intToIpv4(maskNetwork(address, prefixLen)), prefixLen };
}

/** Schreibweise für Anzeige und Eingabefeld: "192.168.10.0/24". */
export function formatScanRange(range: ScanRange): string {
  return `${range.network}/${range.prefixLen}`;
}

/** Das Netz eines lokalen Interfaces als Scan-Bereich (Vorschlag in der UI). */
export function toScanRange(network: LocalNetwork): ScanRange {
  const address = ipv4ToInt(network.ip);
  return {
    network: address === null ? network.ip : intToIpv4(maskNetwork(address, network.prefixLen)),
    prefixLen: network.prefixLen,
  };
}

/**
 * Hängt dieser Rechner selbst an dem Netz, das der Bereich beschreibt?
 *
 * Nur dann ist mit LAN-Latenz zu rechnen. Alles andere läuft über eine Route — VPN-Tunnel,
 * Subnet-Router — und braucht spürbar länger pro Anfrage, siehe `scanSettingsFor`.
 */
export function isDirectlyAttached(range: ScanRange, networks: LocalNetwork[]): boolean {
  const target = ipv4ToInt(range.network);
  if (target === null) {
    return false;
  }

  return networks.some((network) => {
    const local = ipv4ToInt(network.ip);
    // Der Zielbereich muss vollständig im lokalen Netz liegen, nicht nur überlappen.
    return (
      local !== null &&
      range.prefixLen >= network.prefixLen &&
      maskNetwork(target, network.prefixLen) === maskNetwork(local, network.prefixLen)
    );
  });
}

/**
 * Private Adressräume, in denen Smart-Home-Geräte leben: RFC 1918 plus 100.64/10
 * (Carrier-Grade NAT – der Adressraum, den Tailscale vergibt).
 */
const PRIVATE_BLOCKS: ReadonlyArray<readonly [string, number]> = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
];

/**
 * Liegt der Bereich vollständig in einem privaten Adressraum?
 *
 * REQUIREMENTS §8: Die App spricht keine Fremd-Endpunkte an. Seit der Scan-Bereich frei
 * wählbar ist, hält diese Prüfung die Zusage — öffentliche Adressen lassen sich nicht
 * scannen, die App wird also nicht versehentlich zum Portscanner fürs Internet.
 */
export function isPrivateRange(range: ScanRange): boolean {
  const target = ipv4ToInt(range.network);
  if (target === null) {
    return false;
  }

  return PRIVATE_BLOCKS.some(([base, prefixLen]) => {
    const blockBase = ipv4ToInt(base);
    return (
      blockBase !== null && range.prefixLen >= prefixLen && maskNetwork(target, prefixLen) === blockBase
    );
  });
}

/**
 * Netzadresse: die Host-Bits ausmaskieren. `>>> 0` erzwingt eine vorzeichenlose Zahl —
 * JavaScripts Bit-Operatoren rechnen sonst mit vorzeichenbehafteten 32 Bit.
 */
function maskNetwork(address: number, prefixLen: number): number {
  const hostBits = 32 - prefixLen;
  // Ein Shift um 32 ist in JavaScript ein Shift um 0 – /0 deshalb gesondert behandeln.
  const mask = hostBits >= 32 ? 0 : (0xffffffff << hostBits) >>> 0;
  return (address & mask) >>> 0;
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

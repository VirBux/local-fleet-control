import { describe, expect, it } from 'vitest';
import {
  hostCountForPrefix,
  hostsInNetwork,
  isDirectlyAttached,
  isPrivateRange,
  parseScanRange,
  parseShellyInfo,
  toScanRange,
  type LocalNetwork,
} from './shelly.model';

/** Kurzschreibweise für die Testfälle rund um lokale Netze. */
function netz(ip: string, prefixLen: number): LocalNetwork {
  return { interface: 'test', ip, netmask: '', prefixLen };
}

describe('parseShellyInfo', () => {
  it('erkennt ein Gen1-Gerät (Shelly 2.5)', () => {
    const device = parseShellyInfo('192.168.1.50', {
      type: 'SHSW-25',
      mac: 'A4CF12B4C5D6',
      auth: true,
      fw: '20230913-112003/v1.14.0-gcb84623',
      num_outputs: 2,
    });

    expect(device).toEqual({
      ip: '192.168.1.50',
      generation: 1,
      model: 'SHSW-25',
      mac: 'A4CF12B4C5D6',
      name: null,
      authEnabled: true,
      firmware: '20230913-112003/v1.14.0-gcb84623',
    });
  });

  it('erkennt ein Gen2-Gerät (Shelly Plus 1)', () => {
    const device = parseShellyInfo('192.168.1.51', {
      name: 'Flurlicht',
      id: 'shellyplus1-a8032abd42ec',
      mac: 'A8032ABD42EC',
      model: 'SNSW-001X16EU',
      gen: 2,
      fw_id: '20231031-165617/1.0.7-g27d6d4c',
      ver: '1.0.7',
      app: 'Plus1',
      auth_en: false,
      auth_domain: null,
    });

    expect(device).toEqual({
      ip: '192.168.1.51',
      generation: 2,
      model: 'SNSW-001X16EU',
      mac: 'A8032ABD42EC',
      name: 'Flurlicht',
      authEnabled: false,
      firmware: '1.0.7',
    });
  });

  it('übernimmt die Generation aus dem gen-Feld', () => {
    const device = parseShellyInfo('192.168.1.52', {
      mac: 'AA',
      model: 'S3SW-001X16EU',
      gen: 3,
    });

    expect(device?.generation).toBe(3);
  });

  it('erkennt Passwortschutz je nach Generation am richtigen Feld', () => {
    // Gen1 meldet ihn als `auth`, ab Gen2 als `auth_en`.
    expect(parseShellyInfo('1.1.1.1', { mac: 'AA', type: 'SHSW-1', auth: true })?.authEnabled).toBe(true);
    expect(parseShellyInfo('1.1.1.1', { mac: 'AA', model: 'X', gen: 2, auth_en: true })?.authEnabled).toBe(true);
    expect(parseShellyInfo('1.1.1.1', { mac: 'AA', model: 'X', gen: 2 })?.authEnabled).toBe(false);
  });

  describe('weist Antworten ab, die nicht von einem Shelly stammen', () => {
    const abgewiesen: [string, unknown][] = [
      ['kein Objekt', 'hallo'],
      ['null', null],
      ['Array', [1, 2]],
      ['leeres Objekt', {}],
      ['MAC ohne Modellkennung', { mac: 'AA' }],
      ['Modellkennung ohne MAC', { type: 'SHSW-25' }],
      ['gen ist kein number', { mac: 'AA', model: 'X', gen: '2' }],
      ['fremdes JSON', { status: 'ok', uptime: 1234 }],
    ];

    it.each(abgewiesen)('%s', (_name, payload) => {
      expect(parseShellyInfo('1.1.1.1', payload)).toBeNull();
    });
  });
});

describe('hostsInNetwork', () => {
  it('liefert für ein /24 alle 254 Host-Adressen', () => {
    const hosts = hostsInNetwork('192.168.1.42', 24);

    expect(hosts).toHaveLength(254);
    expect(hosts[0]).toBe('192.168.1.1');
    expect(hosts[253]).toBe('192.168.1.254');
  });

  it('lässt Netz- und Broadcast-Adresse aus', () => {
    const hosts = hostsInNetwork('192.168.1.42', 24);

    expect(hosts).not.toContain('192.168.1.0');
    expect(hosts).not.toContain('192.168.1.255');
  });

  it('rechnet die Netzadresse aus einer beliebigen Adresse des Netzes', () => {
    // .70 liegt im Block 10.0.0.64/26 – erwartet werden .65 bis .126.
    const hosts = hostsInNetwork('10.0.0.70', 26);

    expect(hosts).toHaveLength(62);
    expect(hosts[0]).toBe('10.0.0.65');
    expect(hosts[61]).toBe('10.0.0.126');
  });

  it('rechnet über Oktett-Grenzen hinweg', () => {
    const hosts = hostsInNetwork('192.168.4.5', 23);

    expect(hosts).toHaveLength(510);
    expect(hosts[0]).toBe('192.168.4.1');
    expect(hosts[509]).toBe('192.168.5.254');
  });

  it('verweigert zu große Netze', () => {
    // Ein /16 hätte 65.534 Hosts – bei 300 ms Timeout nicht sinnvoll scannbar.
    expect(hostsInNetwork('192.168.1.1', 16)).toHaveLength(0);
    expect(hostsInNetwork('192.168.1.1', 16, 70000)).toHaveLength(65534);
  });

  it('liefert für /31 und /32 keine Hosts', () => {
    expect(hostsInNetwork('192.168.1.1', 31)).toHaveLength(0);
    expect(hostsInNetwork('192.168.1.1', 32)).toHaveLength(0);
  });

  describe('weist ungültige Eingaben ab', () => {
    const ungueltig: [string, string, number][] = [
      ['zu wenige Oktette', '192.168.1', 24],
      ['Oktett über 255', '192.168.1.300', 24],
      ['Exponentialschreibweise', '192.168.1.1e2', 24],
      ['führende Leerzeichen', '192.168.1. 1', 24],
      ['negativer Präfix', '192.168.1.1', -1],
      ['Präfix über 32', '192.168.1.1', 33],
      ['nicht ganzzahliger Präfix', '192.168.1.1', 24.5],
    ];

    it.each(ungueltig)('%s', (_name, ip, prefixLen) => {
      expect(hostsInNetwork(ip, prefixLen)).toHaveLength(0);
    });
  });
});

describe('hostCountForPrefix', () => {
  it('zählt die Host-Adressen ohne Netz- und Broadcast-Adresse', () => {
    expect(hostCountForPrefix(24)).toBe(254);
    expect(hostCountForPrefix(23)).toBe(510);
    expect(hostCountForPrefix(26)).toBe(62);
    expect(hostCountForPrefix(16)).toBe(65534);
  });

  it('liefert 0, wo es keine Geräteadressen gibt', () => {
    // /32 ist der Normalfall bei Tailscale- und WireGuard-Adressen.
    expect(hostCountForPrefix(32)).toBe(0);
    expect(hostCountForPrefix(31)).toBe(0);
  });

  it('liefert 0 für ungültige Präfixe', () => {
    expect(hostCountForPrefix(-1)).toBe(0);
    expect(hostCountForPrefix(33)).toBe(0);
    expect(hostCountForPrefix(24.5)).toBe(0);
  });
});

describe('parseScanRange', () => {
  it('liest Adresse und Präfix', () => {
    expect(parseScanRange('192.168.10.0/24')).toEqual({ network: '192.168.10.0', prefixLen: 24 });
  });

  it('rechnet eine beliebige Adresse des Netzes auf die Netzadresse herunter', () => {
    expect(parseScanRange('192.168.1.39/24')).toEqual({ network: '192.168.1.0', prefixLen: 24 });
    expect(parseScanRange('10.0.0.70/26')).toEqual({ network: '10.0.0.64', prefixLen: 26 });
  });

  it('nimmt ohne Präfix /24 an', () => {
    expect(parseScanRange('192.168.10.5')).toEqual({ network: '192.168.10.0', prefixLen: 24 });
  });

  it('ignoriert umgebende Leerzeichen', () => {
    expect(parseScanRange('  192.168.10.0/24  ')).toEqual({ network: '192.168.10.0', prefixLen: 24 });
  });

  it('akzeptiert auch Präfixe ohne Host-Adressen – die Bewertung passiert getrennt', () => {
    expect(parseScanRange('100.70.91.49/32')).toEqual({ network: '100.70.91.49', prefixLen: 32 });
  });

  describe('weist ungültige Eingaben ab', () => {
    const ungueltig = [
      ['leer', ''],
      ['nur Leerzeichen', '   '],
      ['kein Präfix hinter dem Schrägstrich', '192.168.1.0/'],
      ['Präfix über 32', '192.168.1.0/33'],
      ['nicht ganzzahliger Präfix', '192.168.1.0/24.5'],
      ['zwei Schrägstriche', '192.168.1.0/24/24'],
      ['zu wenige Oktette', '192.168.1/24'],
      ['Oktett über 255', '192.168.1.300/24'],
      ['IPv6', 'fe80::1/64'],
      ['Hostname', 'shelly.local/24'],
    ] as const;

    it.each(ungueltig)('%s', (_name, input) => {
      expect(parseScanRange(input)).toBeNull();
    });
  });
});

describe('toScanRange', () => {
  it('macht aus der Interface-Adresse den Netzbereich', () => {
    expect(toScanRange(netz('192.168.1.39', 24))).toEqual({ network: '192.168.1.0', prefixLen: 24 });
  });

  it('lässt ein /32 unverändert', () => {
    expect(toScanRange(netz('100.70.91.49', 32))).toEqual({ network: '100.70.91.49', prefixLen: 32 });
  });
});

describe('isDirectlyAttached', () => {
  const netze = [netz('192.168.1.39', 24), netz('172.27.66.2', 24)];

  it('erkennt das eigene Netz', () => {
    expect(isDirectlyAttached({ network: '192.168.1.0', prefixLen: 24 }, netze)).toBe(true);
    expect(isDirectlyAttached({ network: '172.27.66.0', prefixLen: 24 }, netze)).toBe(true);
  });

  it('erkennt einen Teilbereich des eigenen Netzes', () => {
    expect(isDirectlyAttached({ network: '192.168.1.64', prefixLen: 26 }, netze)).toBe(true);
  });

  it('meldet fremde Netze als nicht direkt angebunden', () => {
    // Über einen Subnet-Router erreichbar – aber eben nicht mit LAN-Latenz.
    expect(isDirectlyAttached({ network: '192.168.10.0', prefixLen: 24 }, netze)).toBe(false);
  });

  it('meldet einen Bereich, der das eigene Netz nur enthält, als nicht direkt angebunden', () => {
    // Ein /16 um das eigene /24 herum enthält überwiegend fremde Adressen.
    expect(isDirectlyAttached({ network: '192.168.0.0', prefixLen: 16 }, netze)).toBe(false);
  });

  it('kommt ohne lokale Netze klar', () => {
    expect(isDirectlyAttached({ network: '192.168.1.0', prefixLen: 24 }, [])).toBe(false);
  });
});

describe('isPrivateRange', () => {
  const privat: [string, string][] = [
    ['RFC 1918 – 192.168', '192.168.10.0/24'],
    ['RFC 1918 – 10/8', '10.13.37.0/24'],
    ['RFC 1918 – 172.16/12 (untere Grenze)', '172.16.0.0/24'],
    ['RFC 1918 – 172.16/12 (obere Grenze)', '172.31.255.0/24'],
    ['CGNAT/Tailscale – 100.64/10', '100.70.91.0/24'],
  ];

  it.each(privat)('%s', (_name, cidr) => {
    expect(isPrivateRange(parseScanRange(cidr)!)).toBe(true);
  });

  const oeffentlich: [string, string][] = [
    ['öffentliches /24', '8.8.8.0/24'],
    ['knapp unter 172.16/12', '172.15.255.0/24'],
    ['knapp über 172.16/12', '172.32.0.0/24'],
    ['knapp über 100.64/10', '100.128.0.0/24'],
    ['192.169 statt 192.168', '192.169.1.0/24'],
  ];

  it.each(oeffentlich)('%s', (_name, cidr) => {
    expect(isPrivateRange(parseScanRange(cidr)!)).toBe(false);
  });

  it('lehnt einen Bereich ab, der über den privaten Block hinausreicht', () => {
    // 192.168.0.0/15 enthält auch 192.169.x – nicht mehr vollständig privat.
    expect(isPrivateRange({ network: '192.168.0.0', prefixLen: 15 })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { hostsInNetwork, parseShellyInfo } from './shelly.model';

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

import { describe, expect, it } from 'vitest';
import type { ShellyDevice } from './shelly.model';
import { parseDeviceStatus, statusUrl, switchUrl, type SwitchAction } from './status.model';

/** Baut ein Gerät für die URL-Tests; nur `ip` und `generation` spielen dort eine Rolle. */
function device(generation: number, ip = '192.168.1.183'): ShellyDevice {
  return {
    ip,
    generation,
    model: 'SNSW-001P16EU',
    mac: 'A8032ABD42EC',
    name: null,
    authEnabled: false,
    firmware: null,
  };
}

describe('parseDeviceStatus – Gen2/3', () => {
  it('liest den Kanal eines Relais aus "switch:0"', () => {
    const status = parseDeviceStatus(2, {
      'switch:0': { id: 0, source: 'init', output: true, apower: 12.4 },
      sys: { mac: 'A8032ABD42EC' },
      wifi: { sta_ip: '192.168.1.183' },
    });

    expect(status).toEqual({ channels: [{ id: 0, on: true }], unsupported: [] });
  });

  it('meldet jeden Kanal eines Mehrkanalgeräts einzeln, nach Nummer sortiert', () => {
    // Shelly 2PM. Die Schlüssel kommen bewusst verdreht – Objektreihenfolge ist keine Zusage.
    const status = parseDeviceStatus(2, {
      'switch:1': { id: 1, output: true },
      'switch:0': { id: 0, output: false },
    });

    expect(status?.channels).toEqual([
      { id: 0, on: false },
      { id: 1, on: true },
    ]);
  });

  it('führt ein reines Messgerät als erkannt, aber nicht steuerbar', () => {
    // PM Mini Gen3 (S3PM-001PCEU16): misst nur, hat keinen Schaltausgang.
    const status = parseDeviceStatus(3, {
      'pm1:0': { id: 0, voltage: 233.4, current: 0.21, apower: 48.9 },
      sys: {},
    });

    expect(status).toEqual({ channels: [], unsupported: ['pm1'] });
  });

  it('nennt bei einem Dimmer den Typ, statt ihn stumm zu verschlucken', () => {
    const status = parseDeviceStatus(3, { 'light:0': { id: 0, output: true, brightness: 60 } });

    expect(status).toEqual({ channels: [], unsupported: ['light'] });
  });

  it('zählt gleichartige Komponenten nur einmal auf', () => {
    const status = parseDeviceStatus(3, {
      'light:0': { id: 0, output: false },
      'light:1': { id: 1, output: false },
    });

    expect(status?.unsupported).toEqual(['light']);
  });

  it('ignoriert Eingänge und Skripte – sie sind keine schaltbaren Ausgänge', () => {
    const status = parseDeviceStatus(2, {
      'switch:0': { id: 0, output: false },
      'input:0': { id: 0, state: false },
      'script:1': { id: 1, running: true },
    });

    expect(status).toEqual({ channels: [{ id: 0, on: false }], unsupported: [] });
  });

  it('ignoriert Infrastruktur-Schlüssel ohne Doppelpunkt', () => {
    const status = parseDeviceStatus(2, {
      ble: {},
      cloud: { connected: false },
      mqtt: { connected: false },
      ws: { connected: false },
      sys: { uptime: 1234 },
    });

    expect(status).toEqual({ channels: [], unsupported: [] });
  });

  it('behandelt einen "switch" ohne Zustandsfeld als nicht steuerbar', () => {
    // Lieber als unbekannt melden, als einen Knopf ohne bekannten Ist-Zustand anbieten.
    const status = parseDeviceStatus(2, { 'switch:0': { id: 0 } });

    expect(status).toEqual({ channels: [], unsupported: ['switch'] });
  });
});

describe('parseDeviceStatus – Gen1', () => {
  it('liest die Relais aus dem `relays`-Array', () => {
    const status = parseDeviceStatus(1, {
      relays: [{ ison: false, has_timer: false }, { ison: true }],
      meters: [{ power: 0 }],
    });

    expect(status).toEqual({
      channels: [
        { id: 0, on: false },
        { id: 1, on: true },
      ],
      unsupported: [],
    });
  });

  it('schaltet im Rollladenmodus keine Relais einzeln', () => {
    // Shelly 2.5 im Rollladenmodus meldet weiterhin `relays` – die einzeln zu schalten
    // fährt den Motor an und ist kein Ein/Aus.
    const status = parseDeviceStatus(1, {
      mode: 'roller',
      relays: [{ ison: false }, { ison: false }],
      rollers: [{ state: 'stop', current_pos: 40 }],
    });

    expect(status).toEqual({ channels: [], unsupported: ['roller'] });
  });

  it('nennt Licht und Energiemessung als erkannte, nicht steuerbare Typen', () => {
    const status = parseDeviceStatus(1, {
      lights: [{ ison: true, brightness: 80 }],
      emeters: [{ power: 120.5 }],
    });

    expect(status).toEqual({ channels: [], unsupported: ['emeter', 'light'] });
  });
});

describe('parseDeviceStatus – unbrauchbare Antworten', () => {
  it.each([
    ['Text', 'nicht mein Tag'],
    ['Zahl', 42],
    ['null', null],
    ['Array', [{ ison: true }]],
  ])('lehnt %s ab', (_name, data) => {
    expect(parseDeviceStatus(2, data)).toBeNull();
  });

  it('nimmt ein leeres Objekt an – ein Gerät ohne Komponenten ist kein Fehler', () => {
    expect(parseDeviceStatus(2, {})).toEqual({ channels: [], unsupported: [] });
  });
});

describe('statusUrl', () => {
  it('nutzt bei Gen1 /status', () => {
    expect(statusUrl(device(1, '192.168.1.50'))).toBe('http://192.168.1.50/status');
  });

  it('nutzt ab Gen2 die RPC-Methode', () => {
    expect(statusUrl(device(2))).toBe('http://192.168.1.183/rpc/Shelly.GetStatus');
    expect(statusUrl(device(3))).toBe('http://192.168.1.183/rpc/Shelly.GetStatus');
  });
});

describe('switchUrl', () => {
  const gen1: [SwitchAction, string][] = [
    ['on', 'http://192.168.1.50/relay/1?turn=on'],
    ['off', 'http://192.168.1.50/relay/1?turn=off'],
    ['toggle', 'http://192.168.1.50/relay/1?turn=toggle'],
  ];

  it.each(gen1)('Gen1, Kanal 1, %s', (action, erwartet) => {
    expect(switchUrl(device(1, '192.168.1.50'), 1, action)).toBe(erwartet);
  });

  const gen2: [SwitchAction, string][] = [
    ['on', 'http://192.168.1.183/rpc/Switch.Set?id=0&on=true'],
    ['off', 'http://192.168.1.183/rpc/Switch.Set?id=0&on=false'],
    // Eigene Methode statt „Gegenteil des zuletzt gelesenen Zustands" – der kann veraltet
    // sein, wenn jemand am Taster war.
    ['toggle', 'http://192.168.1.183/rpc/Switch.Toggle?id=0'],
  ];

  it.each(gen2)('Gen2, Kanal 0, %s', (action, erwartet) => {
    expect(switchUrl(device(2), 0, action)).toBe(erwartet);
  });
});

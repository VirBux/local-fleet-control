import { describe, expect, it } from 'vitest';
import type { ShellyDevice } from './shelly.model';
import {
  coverUrl,
  parseDeviceStatus,
  statusUrl,
  switchUrl,
  type CoverAction,
  type SwitchAction,
} from './status.model';

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

    expect(status).toEqual({ channels: [{ id: 0, on: true }], covers: [], unsupported: [] });
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

    expect(status).toEqual({ channels: [], covers: [], unsupported: ['pm1'] });
  });

  it('nennt bei einem Dimmer den Typ, statt ihn stumm zu verschlucken', () => {
    const status = parseDeviceStatus(3, { 'light:0': { id: 0, output: true, brightness: 60 } });

    expect(status).toEqual({ channels: [], covers: [], unsupported: ['light'] });
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

    expect(status).toEqual({ channels: [{ id: 0, on: false }], covers: [], unsupported: [] });
  });

  it('ignoriert Infrastruktur-Schlüssel ohne Doppelpunkt', () => {
    const status = parseDeviceStatus(2, {
      ble: {},
      cloud: { connected: false },
      mqtt: { connected: false },
      ws: { connected: false },
      sys: { uptime: 1234 },
    });

    expect(status).toEqual({ channels: [], covers: [], unsupported: [] });
  });

  it('liest einen Rollladen aus "cover:0"', () => {
    const status = parseDeviceStatus(2, {
      'cover:0': { id: 0, state: 'stopped', current_pos: 40, pos_control: true, apower: 0 },
      'input:0': { id: 0, state: false },
      sys: {},
    });

    expect(status).toEqual({
      channels: [],
      covers: [{ id: 0, state: 'stopped', position: 40 }],
      unsupported: [],
    });
  });

  it('übernimmt den gemeldeten Zustand einer laufenden Fahrt', () => {
    const status = parseDeviceStatus(3, {
      'cover:0': { id: 0, state: 'closing', current_pos: 62 },
    });

    expect(status?.covers).toEqual([{ id: 0, state: 'closing', position: 62 }]);
  });

  it('meldet einen unbekannten Zustand als "unknown", statt die Zeile zu verlieren', () => {
    // Fahren lässt sich der Rollladen trotzdem – nur die Beschriftung bleibt vage.
    const status = parseDeviceStatus(3, { 'cover:0': { id: 0, state: 'wat', current_pos: 5 } });

    expect(status?.covers).toEqual([{ id: 0, state: 'unknown', position: 5 }]);
  });

  it('gibt ohne brauchbare Positionsangabe keine Zahl aus', () => {
    // Ein nicht kalibrierter Rollladen meldet gar kein `current_pos`.
    const status = parseDeviceStatus(3, {
      'cover:0': { id: 0, state: 'stopped', pos_control: false },
    });

    expect(status?.covers).toEqual([{ id: 0, state: 'stopped', position: null }]);
  });

  it('verwirft die Position, wenn das Gerät die Positionierung abschaltet', () => {
    // `pos_control: false` heißt „nicht kalibriert" – ein trotzdem mitgeliefertes
    // `current_pos` wäre eine Zahl ohne Bedeutung. Dieselbe Regel wie bei Gen1.
    const status = parseDeviceStatus(3, {
      'cover:0': { id: 0, state: 'stopped', current_pos: 73, pos_control: false },
    });

    expect(status?.covers).toEqual([{ id: 0, state: 'stopped', position: null }]);
  });

  it('behandelt einen "switch" ohne Zustandsfeld als nicht steuerbar', () => {
    // Lieber als unbekannt melden, als einen Knopf ohne bekannten Ist-Zustand anbieten.
    const status = parseDeviceStatus(2, { 'switch:0': { id: 0 } });

    expect(status).toEqual({ channels: [], covers: [], unsupported: ['switch'] });
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
      covers: [],
      unsupported: [],
    });
  });

  it('schaltet im Rollladenmodus keine Relais einzeln, sondern meldet den Rollladen', () => {
    // Shelly 2.5 im Rollladenmodus meldet weiterhin `relays` – die einzeln zu schalten
    // fährt den Motor an und ist kein Ein/Aus.
    const status = parseDeviceStatus(1, {
      mode: 'roller',
      relays: [{ ison: false }, { ison: false }],
      rollers: [{ state: 'stop', current_pos: 40, positioning: true }],
    });

    expect(status).toEqual({
      channels: [],
      covers: [{ id: 0, state: 'stopped', position: 40 }],
      unsupported: [],
    });
  });

  it('lässt den `rollers`-Eintrag im Relaismodus liegen', () => {
    // Ein Shelly 2.5 meldet `rollers` in jedem Modus; im Relaismodus ist er Beiwerk.
    const status = parseDeviceStatus(1, {
      mode: 'relay',
      relays: [{ ison: true }, { ison: false }],
      rollers: [{ state: 'stop', current_pos: 0, positioning: true }],
    });

    expect(status?.covers).toEqual([]);
    expect(status?.channels).toHaveLength(2);
  });

  it('leitet offen und geschlossen aus der Position ab, solange der Rollladen steht', () => {
    // Gen1 kennt nur die Bewegung („stop") – erst die Position sagt, wo er steht.
    const zu = parseDeviceStatus(1, {
      mode: 'roller',
      rollers: [{ state: 'stop', current_pos: 0, positioning: true }],
    });
    const auf = parseDeviceStatus(1, {
      mode: 'roller',
      rollers: [{ state: 'stop', current_pos: 100, positioning: true }],
    });

    expect(zu?.covers).toEqual([{ id: 0, state: 'closed', position: 0 }]);
    expect(auf?.covers).toEqual([{ id: 0, state: 'open', position: 100 }]);
  });

  it('übersetzt die Fahrtrichtung', () => {
    const status = parseDeviceStatus(1, {
      mode: 'roller',
      rollers: [{ state: 'open', current_pos: 30, positioning: true }, { state: 'close' }],
    });

    expect(status?.covers).toEqual([
      { id: 0, state: 'opening', position: 30 },
      { id: 1, state: 'closing', position: null },
    ]);
  });

  it('nennt die Kalibrierfahrt beim Namen', () => {
    // Gen1 meldet dabei weiterhin eine Bewegung; das eigene Flag ist die genauere Auskunft.
    const status = parseDeviceStatus(1, {
      mode: 'roller',
      rollers: [{ state: 'open', current_pos: 50, positioning: true, calibrating: true }],
    });

    expect(status?.covers).toEqual([{ id: 0, state: 'calibrating', position: 50 }]);
  });

  it('behält die Typ-Info, wenn im Rollladenmodus nichts Brauchbares kommt', () => {
    // Die Relais bleiben trotzdem gesperrt – dann ist der Typ das Einzige, was das Gerät
    // noch verrät, und genau den braucht ein Issue.
    const status = parseDeviceStatus(1, {
      mode: 'roller',
      relays: [{ ison: false }, { ison: false }],
      rollers: [],
    });

    expect(status).toEqual({ channels: [], covers: [], unsupported: ['roller'] });
  });

  it('verwirft die Position eines nicht kalibrierten Rollladens', () => {
    // Ohne Kalibrierung ist `current_pos` bedeutungslos – eine erfundene Prozentzahl wäre
    // schlimmer als keine. Ohne Position bleibt es beim schlichten „angehalten".
    const status = parseDeviceStatus(1, {
      mode: 'roller',
      rollers: [{ state: 'stop', current_pos: 0, positioning: false }],
    });

    expect(status?.covers).toEqual([{ id: 0, state: 'stopped', position: null }]);
  });

  it('nennt Licht und Energiemessung als erkannte, nicht steuerbare Typen', () => {
    const status = parseDeviceStatus(1, {
      lights: [{ ison: true, brightness: 80 }],
      emeters: [{ power: 120.5 }],
    });

    expect(status).toEqual({ channels: [], covers: [], unsupported: ['emeter', 'light'] });
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
    expect(parseDeviceStatus(2, {})).toEqual({ channels: [], covers: [], unsupported: [] });
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

describe('coverUrl', () => {
  const gen1: [CoverAction, string][] = [
    ['open', 'http://192.168.1.50/roller/0?go=open'],
    ['close', 'http://192.168.1.50/roller/0?go=close'],
    ['stop', 'http://192.168.1.50/roller/0?go=stop'],
  ];

  it.each(gen1)('Gen1, Rollladen 0, %s', (action, erwartet) => {
    expect(coverUrl(device(1, '192.168.1.50'), 0, action)).toBe(erwartet);
  });

  const gen2: [CoverAction, string][] = [
    ['open', 'http://192.168.1.183/rpc/Cover.Open?id=1'],
    ['close', 'http://192.168.1.183/rpc/Cover.Close?id=1'],
    ['stop', 'http://192.168.1.183/rpc/Cover.Stop?id=1'],
  ];

  it.each(gen2)('Gen2, Rollladen 1, %s', (action, erwartet) => {
    expect(coverUrl(device(2), 1, action)).toBe(erwartet);
  });
});

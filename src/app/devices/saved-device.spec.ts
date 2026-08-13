import { describe, expect, it } from 'vitest';
import type { ShellyDevice } from '../shelly/shelly.model';
import { parseSavedDevices, savedDeviceFrom, toShellyDevice } from './saved-device';

const geraet: ShellyDevice = {
  ip: '192.168.1.50',
  generation: 2,
  model: 'SNSW-001X16EU',
  mac: 'A8032ABD42EC',
  name: 'Flurlicht',
  authEnabled: false,
  firmware: '1.0.7',
};

describe('savedDeviceFrom', () => {
  it('übernimmt das gefundene Gerät samt Kanälen', () => {
    const saved = savedDeviceFrom(geraet, [0, 1]);

    expect(saved).toEqual({
      mac: 'A8032ABD42EC',
      ip: '192.168.1.50',
      generation: 2,
      model: 'SNSW-001X16EU',
      vendorId: 'shelly',
      name: 'Flurlicht',
      authEnabled: false,
      firmware: '1.0.7',
      channelIds: [0, 1],
    });
  });

  it('kopiert die Kanalliste, statt sie zu teilen', () => {
    const kanaele = [0];
    const saved = savedDeviceFrom(geraet, kanaele);
    kanaele.push(1);

    expect(saved.channelIds).toEqual([0]);
  });
});

describe('toShellyDevice', () => {
  it('macht aus dem gespeicherten Eintrag wieder ein Ziel für Abfragen', () => {
    expect(toShellyDevice(savedDeviceFrom(geraet, [0]))).toEqual(geraet);
  });
});

describe('parseSavedDevices', () => {
  it('liest zurück, was gespeichert wurde', () => {
    const saved = [savedDeviceFrom(geraet, [0, 1])];

    expect(parseSavedDevices(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('wirft nur den kaputten Eintrag weg, nicht die Liste', () => {
    const devices = parseSavedDevices([
      { mac: 'AA', ip: '192.168.1.9', generation: 1 },
      { ip: '192.168.1.10', generation: 2 }, // ohne MAC: kein Schlüssel
      { mac: 'BB', generation: 2 }, // ohne IP: nichts anzusprechen
      'kein Objekt',
    ]);

    expect(devices.map((device) => device.mac)).toEqual(['AA']);
    // Was fehlt, wird zum Standard – nicht zum Grund, die Datei zu verwerfen.
    expect(devices[0]).toEqual({
      mac: 'AA',
      ip: '192.168.1.9',
      generation: 1,
      model: '',
      vendorId: 'shelly',
      name: null,
      authEnabled: false,
      firmware: null,
      channelIds: [],
    });
  });

  it('nimmt nur brauchbare Kanalnummern', () => {
    const [device] = parseSavedDevices([
      { mac: 'AA', ip: '1.2.3.4', generation: 2, channelIds: [0, -1, 'x', 1.5, 2] },
    ]);

    expect(device.channelIds).toEqual([0, 2]);
  });

  it('liefert für alles andere eine leere Liste', () => {
    expect(parseSavedDevices(undefined)).toEqual([]);
    expect(parseSavedDevices({ mac: 'AA' })).toEqual([]);
  });
});

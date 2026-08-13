import { describe, expect, it } from 'vitest';
import { SHELLY, deviceKind, devicePhoto, vendorById } from './vendor';

describe('vendorById', () => {
  it('kennt Shelly', () => {
    expect(vendorById('shelly')).toBe(SHELLY);
  });

  it('fällt bei einer unbekannten ID auf einen Platzhalter zurück', () => {
    // Kann aus einer Datei kommen, die eine neuere Version geschrieben hat – das darf die
    // Liste nicht sprengen.
    expect(vendorById('tasmota').name).toBe('—');
  });
});

describe('deviceKind', () => {
  const faelle: [string, string][] = [
    ['SHSW-25', 'switch'],
    ['SHPLG-S', 'plug'],
    ['SHDM-2', 'dimmer'],
    ['SHHT-1', 'sensor'],
    ['SHEM-3', 'meter'],
    ['SNSW-001X16EU', 'switch'],
    ['SNPL-00112EU', 'plug'],
    ['SPSW-201XE16EU', 'switch'],
    ['S3SW-001X16EU', 'switch'],
    ['S3EM-002CXCEU', 'meter'],
    ['SNGW-BT01', 'gateway'],
    ['s3sw-001x16eu', 'switch'],
  ];

  it.each(faelle)('%s', (model, erwartet) => {
    expect(deviceKind(model)).toBe(erwartet);
  });

  it('rät nichts, wo die Kennung nichts hergibt', () => {
    // Die Art bestimmt nur das Symbol – falsch geraten wäre schlimmer als „unbekannt".
    expect(deviceKind('')).toBe('unknown');
    expect(deviceKind('IRGENDWAS')).toBe('unknown');
  });
});

describe('devicePhoto', () => {
  it('liefert null, solange kein Foto hinterlegt ist', () => {
    // Produktfotos liegen nicht im Repository (Lizenz, siehe vendor.ts) – die Liste muss
    // deshalb ohne sie auskommen.
    expect(devicePhoto('SNSW-001X16EU')).toBeNull();
  });
});

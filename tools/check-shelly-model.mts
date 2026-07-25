/**
 * Prüft die reine Auswertungslogik aus `src/app/shelly/shelly.model.ts`.
 *
 * Bewusst ein schlichtes Node-Skript ohne Test-Framework: Welches Test-Setup das
 * Projekt bekommt, ist noch nicht entschieden (siehe docs/TODO_OPEN.md). Sobald es
 * eines gibt, wandern diese Fälle dorthin und diese Datei entfällt.
 *
 * Aufruf: npm run check:model
 */
import { parseShellyInfo, hostsInNetwork } from '../src/app/shelly/shelly.model.ts';

let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}\n       erwartet: ${e}\n       bekommen: ${a}`);
  }
}

console.log('parseShellyInfo – Gen1 (Shelly 2.5):');
const gen1 = parseShellyInfo('192.168.1.50', {
  type: 'SHSW-25',
  mac: 'A4CF12B4C5D6',
  auth: true,
  fw: '20230913-112003/v1.14.0-gcb84623',
  num_outputs: 2,
});
check('Generation', gen1?.generation, 1);
check('Modell aus type', gen1?.model, 'SHSW-25');
check('auth -> authEnabled', gen1?.authEnabled, true);
check('kein Name bei Gen1', gen1?.name, null);
check('Firmware aus fw', gen1?.firmware, '20230913-112003/v1.14.0-gcb84623');

console.log('\nparseShellyInfo – Gen2 (Shelly Plus 1):');
const gen2 = parseShellyInfo('192.168.1.51', {
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
check('Generation', gen2?.generation, 2);
check('Modell aus model', gen2?.model, 'SNSW-001X16EU');
check('auth_en -> authEnabled', gen2?.authEnabled, false);
check('Name übernommen', gen2?.name, 'Flurlicht');
check('Firmware aus ver', gen2?.firmware, '1.0.7');

console.log('\nparseShellyInfo – Gen3 und geschütztes Gerät:');
check(
  'gen 3 erkannt',
  parseShellyInfo('192.168.1.52', { mac: 'AA', model: 'S3SW-001X16EU', gen: 3 })?.generation,
  3,
);
check(
  'auth_en true',
  parseShellyInfo('192.168.1.53', { mac: 'AA', model: 'X', gen: 2, auth_en: true })?.authEnabled,
  true,
);

console.log('\nparseShellyInfo – Fremdgeräte werden abgewiesen:');
check('kein Objekt', parseShellyInfo('1.1.1.1', 'hallo'), null);
check('null', parseShellyInfo('1.1.1.1', null), null);
check('Array', parseShellyInfo('1.1.1.1', [1, 2]), null);
check('leeres Objekt', parseShellyInfo('1.1.1.1', {}), null);
check('MAC ohne Modell', parseShellyInfo('1.1.1.1', { mac: 'AA' }), null);
check('Modell ohne MAC', parseShellyInfo('1.1.1.1', { type: 'SHSW-25' }), null);
check('gen ist kein number', parseShellyInfo('1.1.1.1', { mac: 'AA', model: 'X', gen: '2' }), null);
check('fremdes JSON', parseShellyInfo('1.1.1.1', { status: 'ok', uptime: 1234 }), null);

console.log('\nhostsInNetwork:');
const slash24 = hostsInNetwork('192.168.1.42', 24);
check('/24 Anzahl', slash24.length, 254);
check('/24 erste', slash24[0], '192.168.1.1');
check('/24 letzte', slash24[253], '192.168.1.254');
check('Netzadresse nicht enthalten', slash24.includes('192.168.1.0'), false);
check('Broadcast nicht enthalten', slash24.includes('192.168.1.255'), false);

const slash26 = hostsInNetwork('10.0.0.70', 26);
check('/26 Anzahl', slash26.length, 62);
check('/26 erste', slash26[0], '10.0.0.65');
check('/26 letzte', slash26[61], '10.0.0.126');

const slash23 = hostsInNetwork('192.168.4.5', 23);
check('/23 Anzahl', slash23.length, 510);
check('/23 erste', slash23[0], '192.168.4.1');
check('/23 letzte', slash23[509], '192.168.5.254');

console.log('\nhostsInNetwork – Grenzfälle:');
check('/16 zu groß -> leer', hostsInNetwork('192.168.1.1', 16).length, 0);
check('/31 -> leer', hostsInNetwork('192.168.1.1', 31).length, 0);
check('/32 -> leer', hostsInNetwork('192.168.1.1', 32).length, 0);
check('ungültige IP', hostsInNetwork('192.168.1', 24).length, 0);
check('Oktett > 255', hostsInNetwork('192.168.1.300', 24).length, 0);
check('Exponentialschreibweise', hostsInNetwork('192.168.1.1e2', 24).length, 0);
check('negativer Präfix', hostsInNetwork('192.168.1.1', -1).length, 0);
check('Präfix > 32', hostsInNetwork('192.168.1.1', 33).length, 0);
check('/16 mit erhöhtem Limit', hostsInNetwork('192.168.1.1', 16, 70000).length, 65534);

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

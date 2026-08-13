import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformService } from '../core/platform.service';
import { StorageService } from '../core/storage.service';
import { ProjectService } from '../project/project.service';
import { ControlService, DeviceError } from '../shelly/control.service';
import { DiscoveryService } from '../shelly/discovery.service';
import type { ShellyDevice } from '../shelly/shelly.model';
import {
  FakeStorage,
  einKanalAus,
  fakePlatform,
  geraet,
  netz,
  tunnel,
  zweitgeraet,
} from '../testing/doubles';
import { DiscoveryPageComponent } from './discovery-page.component';

// Hinweis: `vi.mock()` auf Modulpfade greift bei diesem Builder nicht (die Specs werden
// vorab gebündelt). Tauri-Zugriffe werden deshalb über DI ersetzt.

/** Erzeugt die Seite mit Testdoubles für alle nativen Zugriffe. */
function setup(
  overrides: Partial<DiscoveryService> = {},
  controlOverrides: Partial<ControlService> = {},
) {
  const discovery = {
    listLocalNetworks: () => Promise.resolve([netz]),
    scanRange: () => Promise.resolve([]),
    ...overrides,
  };

  const control = {
    getStatus: vi.fn(() => Promise.resolve(einKanalAus)),
    setSwitch: vi.fn(() => Promise.resolve()),
    ...controlOverrides,
  };

  TestBed.configureTestingModule({
    imports: [DiscoveryPageComponent],
    providers: [
      { provide: DiscoveryService, useValue: discovery },
      { provide: ControlService, useValue: control },
      { provide: PlatformService, useValue: fakePlatform() },
      // Eigener Speicher je Test – sonst schleppen sich Projekte von Test zu Test.
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });

  return {
    fixture: TestBed.createComponent(DiscoveryPageComponent),
    control,
    projects: TestBed.inject(ProjectService),
  };
}

/** Ein Scan, der die übergebenen Geräte sofort meldet. */
function scanFindet(...devices: ShellyDevice[]): Partial<DiscoveryService> {
  return {
    scanRange: (_range, options = {}) => {
      for (const device of devices) {
        options.onFound?.(device);
      }
      return Promise.resolve(devices);
    },
  };
}

describe('DiscoveryPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('schlägt beim Start das eigene Netz als Scan-Bereich vor', async () => {
    const { fixture } = setup();
    await fixture.whenStable();

    expect(fixture.componentInstance.networks()).toEqual([netz]);
    // Nicht die Interface-Adresse, sondern der Bereich – .42 ist nur ein Host darin.
    expect(fixture.componentInstance.rangeInput()).toBe('192.168.1.0/24');
  });

  it('bietet ein /32 nicht als scannbaren Bereich an', async () => {
    const { fixture } = setup({ listLocalNetworks: () => Promise.resolve([tunnel, netz]) });
    await fixture.whenStable();

    const presets = fixture.componentInstance.presets();
    expect(presets[0].disabledReason).toBe('keine Geräteadressen');
    expect(presets[1].disabledReason).toBeNull();
    // Der Startwert überspringt den nicht scannbaren Vorschlag.
    expect(fixture.componentInstance.rangeInput()).toBe('192.168.1.0/24');
  });

  it('lässt einen selbst eingetragenen Bereich außerhalb der eigenen Netze zu', async () => {
    const scanRange = vi.fn(() => Promise.resolve([]));
    const { fixture } = setup({ scanRange });
    await fixture.whenStable();

    // Über einen Tailscale-Subnet-Router erreichbar, ohne eigene Adresse darin.
    fixture.componentInstance.rangeInput.set('192.168.10.0/24');
    expect(fixture.componentInstance.rangeError()).toBe('');

    await fixture.componentInstance.scan();

    expect(scanRange).toHaveBeenCalledWith(
      { network: '192.168.10.0', prefixLen: 24 },
      // Fremdes Netz: mehr Zeit pro Gerät, weniger parallel.
      expect.objectContaining({ settings: { timeoutMs: 1000, concurrency: 16 } }),
    );
  });

  it('scannt das eigene Netz mit den schnellen LAN-Vorgaben', async () => {
    const scanRange = vi.fn(() => Promise.resolve([]));
    const { fixture } = setup({ scanRange });
    await fixture.whenStable();

    await fixture.componentInstance.scan();

    expect(scanRange).toHaveBeenCalledWith(
      { network: '192.168.1.0', prefixLen: 24 },
      expect.objectContaining({ settings: { timeoutMs: 300, concurrency: 32 } }),
    );
  });

  describe('lehnt unbrauchbare Bereiche mit Begründung ab', () => {
    const faelle: [string, string, string][] = [
      ['ungültig', 'kein netz', 'Ungültiger Bereich'],
      ['ohne Host-Adressen', '100.70.91.49/32', 'keine Geräteadressen'],
      ['zu groß', '10.0.0.0/8', 'zu groß'],
      ['öffentlich', '8.8.8.0/24', 'Nur private Netze'],
      ['leer', '', 'Bereich angeben'],
    ];

    it.each(faelle)('%s', async (_name, input, erwartet) => {
      const { fixture } = setup();
      await fixture.whenStable();

      fixture.componentInstance.rangeInput.set(input);

      expect(fixture.componentInstance.rangeError()).toContain(erwartet);
      expect(fixture.componentInstance.canScan()).toBe(false);
    });
  });

  it('zeigt gefundene Geräte an, sobald der Scan sie meldet', async () => {
    const { fixture } = setup({
      scanRange: (_range, options = {}) => {
        options.onFound?.(geraet);
        options.onProgress?.({ done: 254, total: 254 });
        return Promise.resolve([geraet]);
      },
    });
    await fixture.whenStable();

    await fixture.componentInstance.scan();
    await fixture.whenStable();

    expect(fixture.componentInstance.devices()).toEqual([geraet]);

    // Der eigentliche Nachweis für Zoneless: Die Signal-Änderung muss ohne Zone.js
    // im DOM ankommen.
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Flurlicht');
    expect(text).toContain('SNSW-001X16EU');
  });

  it('meldet einen Fehler, wenn die Netze nicht ermittelt werden können', async () => {
    const { fixture } = setup({
      listLocalNetworks: () => Promise.reject(new Error('kein Zugriff')),
    });
    await fixture.whenStable();

    expect(fixture.componentInstance.error()).toContain('kein Zugriff');
  });

  it('startet keinen zweiten Scan, solange einer läuft', async () => {
    const scanRange = vi.fn(() => new Promise<ShellyDevice[]>(() => {}));
    const { fixture } = setup({ scanRange });
    await fixture.whenStable();

    void fixture.componentInstance.scan();
    void fixture.componentInstance.scan();

    expect(scanRange).toHaveBeenCalledTimes(1);
  });

  it('nennt nach einem leeren Scan die möglichen Ursachen', async () => {
    const { fixture } = setup();
    await fixture.whenStable();

    await fixture.componentInstance.scan();
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('In 192.168.1.0/24 wurde kein Shelly gefunden');
    expect(text).toContain('Falscher Bereich');
  });

  describe('Status und Schalten', () => {
    it('fragt den Ist-Zustand jedes gefundenen Geräts ab und zeigt den Kanal', async () => {
      const { fixture, control } = setup(scanFindet(geraet));
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      expect(control.getStatus).toHaveBeenCalledWith(geraet);

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Aus');
      expect(text).toContain('Umschalten');
    });

    it('faltet ein Mehrkanalgerät in einen Eintrag je Kanal auf', async () => {
      const { fixture } = setup(scanFindet(geraet), {
        getStatus: () =>
          Promise.resolve({
            channels: [
              { id: 0, on: false },
              { id: 1, on: true },
            ],
            unsupported: [],
          }),
      });
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      const rows = fixture.componentInstance.rows();
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.channelLabel)).toEqual(['Kanal 1', 'Kanal 2']);
      // Beide Zeilen gehören demselben Gerät, unterscheiden sich aber im Zustand.
      expect(rows.map((row) => row.on)).toEqual([false, true]);
    });

    it('schaltet ein Relais und übernimmt erst den nachgefragten Zustand', async () => {
      const setSwitch = vi.fn(() => Promise.resolve());
      // Erst „aus", nach dem Befehl „an" – so wie es das Gerät meldet.
      const getStatus = vi
        .fn(() => Promise.resolve(einKanalAus))
        .mockResolvedValueOnce(einKanalAus)
        .mockResolvedValue({ channels: [{ id: 0, on: true }], unsupported: [] });

      const { fixture } = setup(scanFindet(geraet), { getStatus, setSwitch });
      await fixture.whenStable();
      await fixture.componentInstance.scan();
      await fixture.whenStable();

      fixture.componentInstance.switchChannel(fixture.componentInstance.rows()[0], 'on');
      await fixture.whenStable();

      expect(setSwitch).toHaveBeenCalledWith(geraet, 0, 'on');
      // Kein optimistisches UI: Der neue Zustand kommt aus der zweiten Abfrage, nicht aus
      // dem Befehl.
      expect(getStatus).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.rows()[0].on).toBe(true);
    });

    it('fragt ein passwortgeschütztes Gerät gar nicht erst ab', async () => {
      const geschuetzt = { ...geraet, authEnabled: true };
      const { fixture, control } = setup(scanFindet(geschuetzt));
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      expect(control.getStatus).not.toHaveBeenCalled();

      const [row] = fixture.componentInstance.rows();
      expect(row.state.locked).toBe(true);
      expect(row.state.error?.code).toBe('locked');
      expect(row.errorText).toContain('Passwortgeschützt');
      // Ohne Kanal gibt es auch nichts zu schalten.
      expect(row.channelId).toBeNull();
    });

    it('behandelt einen 401 im Betrieb wie ein gesperrtes Gerät', async () => {
      const { fixture } = setup(scanFindet(geraet), {
        getStatus: () => Promise.reject(new DeviceError('locked')),
      });
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      expect(fixture.componentInstance.rows()[0].state.locked).toBe(true);
    });

    it('hält den Fehler eines Geräts bei diesem Gerät', async () => {
      const { fixture } = setup(scanFindet(geraet, zweitgeraet), {
        getStatus: (device) =>
          device.mac === geraet.mac
            ? Promise.reject(new DeviceError('unreachable'))
            : Promise.resolve(einKanalAus),
      });
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      const [kaputt, heil] = fixture.componentInstance.rows();
      expect(kaputt.errorText).toBe('Gerät nicht erreichbar.');
      expect(heil.on).toBe(false);
      // Die globale Fehlerzeile bleibt dem Scan vorbehalten.
      expect(fixture.componentInstance.error()).toBe('');
    });

    it('fragt auf „Erneut versuchen" hin neu ab', async () => {
      const getStatus = vi
        .fn(() => Promise.resolve(einKanalAus))
        .mockRejectedValueOnce(new DeviceError('unreachable'));

      const { fixture } = setup(scanFindet(geraet), { getStatus });
      await fixture.whenStable();
      await fixture.componentInstance.scan();
      await fixture.whenStable();

      const retry = (fixture.nativeElement as HTMLElement).querySelector('.retry');
      retry?.dispatchEvent(new MouseEvent('click'));
      await fixture.whenStable();

      expect(getStatus).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.rows()[0].on).toBe(false);
    });

    it('nennt bei einem Gerät ohne Schaltausgang den erkannten Typ', async () => {
      const { fixture } = setup(scanFindet(geraet), {
        // PM Mini Gen3: misst nur, hat keinen Schaltausgang.
        getStatus: () => Promise.resolve({ channels: [], unsupported: ['pm1'] }),
      });
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Erkannt, nicht steuerbar');
      expect(text).toContain('pm1');
      expect(text).not.toContain('Umschalten');
    });
  });

  describe('Aufnahme ins Projekt', () => {
    /** Scannt und liefert die Seite mit Geräten in der Fundliste. */
    async function mitFund(...devices: ShellyDevice[]) {
      const teile = setup(scanFindet(...(devices.length ? devices : [geraet])));
      await teile.fixture.whenStable();
      await teile.fixture.componentInstance.scan();
      await teile.fixture.whenStable();
      return teile;
    }

    it('zeigt den Hersteller in jeder Zeile', async () => {
      const { fixture } = await mitFund();

      expect(fixture.componentInstance.rows()[0].vendor.name).toBe('Shelly');
      // Ohne hinterlegtes Foto steht das Symbol zur Geräteart da – kein leeres Feld.
      expect(fixture.componentInstance.rows()[0].photo).toBeNull();
      expect(fixture.componentInstance.rows()[0].kind).toBe('switch');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Shelly');
    });

    it('nimmt ein Gerät mit allen bekannten Kanälen ins Projekt auf', async () => {
      const { fixture, projects } = await mitFund();
      projects.createProject('Musterkunde');
      await fixture.whenStable();

      fixture.componentInstance.addToProject(fixture.componentInstance.rows()[0]);
      await fixture.whenStable();

      expect(projects.devices()).toHaveLength(1);
      expect(projects.devices()[0].mac).toBe(geraet.mac);
      expect(projects.devices()[0].channelIds).toEqual([0]);
      // Die Zeile sagt jetzt, dass es drin ist – sonst wüsste man es beim zweiten Scan nicht.
      expect(fixture.componentInstance.rows()[0].saved).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Im Projekt');
    });

    it('lässt ohne aktives Projekt nichts hinzufügen und sagt warum', async () => {
      const { fixture } = await mitFund();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Kein Projekt aktiv');

      const knopf = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ghost');
      expect(knopf?.disabled).toBe(true);
    });

    it('zeigt an einem bekannten Gerät, was das Projekt schon weiß', async () => {
      const { fixture, projects } = await mitFund();
      projects.createProject('Musterkunde');
      projects.addRoom('Flur');
      projects.addDevice(geraet, [0]);
      projects.assign(`${geraet.mac}:0`, {
        name: 'Deckenlampe',
        roomId: projects.activeProject()!.rooms[0].id,
      });
      await fixture.whenStable();

      const [row] = fixture.componentInstance.rows();
      expect(row.label).toBe('Deckenlampe');
      expect(row.roomName).toBe('Flur');

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Deckenlampe');
      expect(text).toContain('Flur');
    });

    it('bietet den Knopf nur einmal je Gerät an, nicht je Kanal', async () => {
      const { fixture, projects } = setup(scanFindet(geraet), {
        getStatus: () =>
          Promise.resolve({
            channels: [
              { id: 0, on: false },
              { id: 1, on: false },
            ],
            unsupported: [],
          }),
      });
      projects.createProject('Musterkunde');
      await fixture.whenStable();
      await fixture.componentInstance.scan();
      await fixture.whenStable();

      const rows = fixture.componentInstance.rows();
      expect(rows.map((row) => fixture.componentInstance.isFirstRow(row))).toEqual([true, false]);

      // Aufgenommen wird das Gerät samt beider Kanäle – nicht der angeklickte Kanal.
      fixture.componentInstance.addToProject(rows[0]);
      expect(projects.devices()[0].channelIds).toEqual([0, 1]);
    });

    it('zieht beim Wiederfinden die neue IP ins Projekt nach', async () => {
      // Dasselbe Gerät nach einem DHCP-Wechsel: gleiche MAC, andere Adresse.
      const umgezogen = { ...geraet, ip: '192.168.1.99' };
      const { fixture, projects } = setup(scanFindet(umgezogen));
      projects.createProject('Musterkunde');
      projects.addDevice(geraet, [0]);
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      expect(projects.devices()[0].ip).toBe('192.168.1.99');
      // Kein zweiter Eintrag – erkannt wird über die MAC, nicht über die Adresse.
      expect(projects.devices()).toHaveLength(1);
    });
  });
});

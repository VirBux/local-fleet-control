import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { PlatformService } from './core/platform.service';
import { StorageService } from './core/storage.service';
import { ProjectService } from './project/project.service';
import { ControlService, DeviceError } from './shelly/control.service';
import { DiscoveryService } from './shelly/discovery.service';
import type { LocalNetwork, ShellyDevice } from './shelly/shelly.model';
import type { DeviceStatus } from './shelly/status.model';

// Hinweis: `vi.mock()` auf Modulpfade greift bei diesem Builder nicht (die Specs werden
// vorab gebündelt). Tauri-Zugriffe werden deshalb über DI ersetzt – siehe
// PlatformService.

const netz: LocalNetwork = {
  interface: 'WLAN',
  ip: '192.168.1.42',
  netmask: '255.255.255.0',
  prefixLen: 24,
};

/** Typisch für Tailscale und WireGuard: genau eine Adresse, keine Geräte darin. */
const tunnel: LocalNetwork = {
  interface: 'Tailscale',
  ip: '100.70.91.49',
  netmask: '255.255.255.255',
  prefixLen: 32,
};

const geraet: ShellyDevice = {
  ip: '192.168.1.50',
  generation: 2,
  model: 'SNSW-001X16EU',
  mac: 'A8032ABD42EC',
  name: 'Flurlicht',
  authEnabled: false,
  firmware: '1.0.7',
};

/** Zweites Gerät, um zu prüfen, dass ein Ausfall nicht auf die ganze Liste durchschlägt. */
const zweitgeraet: ShellyDevice = {
  ...geraet,
  ip: '192.168.1.51',
  mac: 'A8032ABD42ED',
  name: 'Terrasse',
};

const einKanalAus: DeviceStatus = { channels: [{ id: 0, on: false }], unsupported: [] };

/** Erzeugt die Komponente mit Testdoubles für alle nativen Zugriffe. */
function setup(overrides: Partial<DiscoveryService> = {}, controlOverrides: Partial<ControlService> = {}) {
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

  const platform = {
    getAppVersion: () => Promise.resolve('0.1.0'),
    openExternal: vi.fn(() => Promise.resolve()),
  };

  // Eigener Speicher je Test – sonst schleppen sich Projekte von Test zu Test.
  // Asynchron wie das Original: Die echte Ablage ist eine Datei.
  const entries = new Map<string, unknown>();
  const storage = {
    read: async (key: string) => entries.get(key) ?? null,
    write: async (key: string, value: unknown) => void entries.set(key, value),
  };

  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      { provide: DiscoveryService, useValue: discovery },
      { provide: ControlService, useValue: control },
      { provide: PlatformService, useValue: platform },
      { provide: StorageService, useValue: storage },
    ],
  });

  return {
    fixture: TestBed.createComponent(AppComponent),
    control,
    platform,
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

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('zeigt das Branding und die Version an', async () => {
    const { fixture } = setup();
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('powered by HA Fleet Manager');
    expect(text).toContain('v0.1.0');
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
      expect(rows.map((row) => row.channel?.on)).toEqual([false, true]);
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

      await fixture.componentInstance.switchChannel(fixture.componentInstance.rows()[0], 'on');
      await fixture.whenStable();

      expect(setSwitch).toHaveBeenCalledWith(geraet, 0, 'on');
      // Kein optimistisches UI: Der neue Zustand kommt aus der zweiten Abfrage, nicht aus
      // dem Befehl.
      expect(getStatus).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.rows()[0].channel?.on).toBe(true);
    });

    it('fragt ein passwortgeschütztes Gerät gar nicht erst ab', async () => {
      const geschuetzt = { ...geraet, authEnabled: true };
      const { fixture, control } = setup(scanFindet(geschuetzt));
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      expect(control.getStatus).not.toHaveBeenCalled();

      const state = fixture.componentInstance.rows()[0].state;
      expect(state.locked).toBe(true);
      expect(state.error).toContain('Passwortgeschützt');
      // Ohne Kanal gibt es auch nichts zu schalten.
      expect(fixture.componentInstance.rows()[0].channel).toBeNull();
    });

    it('behandelt einen 401 im Betrieb wie ein gesperrtes Gerät', async () => {
      const { fixture } = setup(scanFindet(geraet), {
        getStatus: () => Promise.reject(new DeviceError('Passwortgeschützt — …', true)),
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
            ? Promise.reject(new DeviceError('Gerät nicht erreichbar.'))
            : Promise.resolve(einKanalAus),
      });
      await fixture.whenStable();

      await fixture.componentInstance.scan();
      await fixture.whenStable();

      const [kaputt, heil] = fixture.componentInstance.rows();
      expect(kaputt.state.error).toBe('Gerät nicht erreichbar.');
      expect(heil.channel).toEqual({ id: 0, on: false });
      // Die globale Fehlerzeile bleibt dem Scan vorbehalten.
      expect(fixture.componentInstance.error()).toBe('');
    });

    it('fragt auf „Erneut versuchen" hin neu ab', async () => {
      const getStatus = vi
        .fn(() => Promise.resolve(einKanalAus))
        .mockRejectedValueOnce(new DeviceError('Gerät nicht erreichbar.'));

      const { fixture } = setup(scanFindet(geraet), { getStatus });
      await fixture.whenStable();
      await fixture.componentInstance.scan();
      await fixture.whenStable();

      const retry = (fixture.nativeElement as HTMLElement).querySelector('.retry');
      retry?.dispatchEvent(new MouseEvent('click'));
      await fixture.whenStable();

      expect(getStatus).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.rows()[0].channel).toEqual({ id: 0, on: false });
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

  describe('Projektstruktur', () => {
    /** Scannt und liefert die Komponente mit einem Gerät in der Liste. */
    async function mitGeraet(...devices: ShellyDevice[]) {
      const teile = setup(scanFindet(...(devices.length ? devices : [geraet])));
      await teile.fixture.whenStable();
      await teile.fixture.componentInstance.scan();
      await teile.fixture.whenStable();
      return teile;
    }

    it('bleibt ohne Projekt eine flache Liste', async () => {
      const { fixture } = await mitGeraet();

      expect(fixture.componentInstance.groups()).toHaveLength(1);
      expect(fixture.componentInstance.groups()[0].title).toBe('');
    });

    it('sortiert die Geräte unter die Überschrift ihres Raums', async () => {
      const { fixture, projects } = await mitGeraet(geraet, zweitgeraet);
      projects.createProject('Musterkunde');
      projects.addRoom('Flur');
      const raumId = projects.activeProject()!.rooms[0].id;

      // Nur das erste Gerät bekommt einen Raum.
      projects.assign(`${geraet.mac}:0`, { roomId: raumId });
      await fixture.whenStable();

      const gruppen = fixture.componentInstance.groups();
      expect(gruppen.map((g) => g.title)).toEqual(['Flur', 'Ohne Raum']);
      expect(gruppen[0].items[0].device.ip).toBe(geraet.ip);

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Flur');
      expect(text).toContain('Ohne Raum');
    });

    it('gruppiert auf Wunsch nach Kategorie statt nach Raum', async () => {
      const { fixture, projects } = await mitGeraet();
      projects.createProject('Musterkunde');
      projects.addCategory('Licht');
      projects.assign(`${geraet.mac}:0`, {
        categoryId: projects.activeProject()!.categories[0].id,
      });

      fixture.componentInstance.groupMode.set('category');
      await fixture.whenStable();

      expect(fixture.componentInstance.groups().map((g) => g.title)).toEqual(['Licht']);
    });

    it('zeigt den eigenen Namen statt des Gerätenamens', async () => {
      const { fixture, projects } = await mitGeraet();
      projects.createProject('Musterkunde');

      projects.assign(`${geraet.mac}:0`, { name: 'Deckenlampe' });
      await fixture.whenStable();

      expect(fixture.componentInstance.rows()[0].label).toBe('Deckenlampe');
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Deckenlampe');
      expect(text).not.toContain('Flurlicht');
    });

    it('hängt die Zuordnung an Kanal und MAC, nicht ans Gerät', async () => {
      const { fixture, projects } = await mitGeraet();
      projects.createProject('Musterkunde');
      // Zwei Kanäle desselben Geräts – der zweite bleibt unbenannt.
      projects.assign(`${geraet.mac}:1`, { name: 'Nur Kanal 2' });
      await fixture.whenStable();

      expect(fixture.componentInstance.rows()[0].label).toBe('Flurlicht');
      expect(fixture.componentInstance.rows()[0].entityKey).toBe(`${geraet.mac}:0`);
    });

    it('hält die Zuordnung, wenn das Gerät eine neue IP bekommt', async () => {
      const { fixture, projects } = await mitGeraet();
      projects.createProject('Musterkunde');
      projects.assign(`${geraet.mac}:0`, { name: 'Deckenlampe' });

      // Dasselbe Gerät nach einem DHCP-Wechsel: gleiche MAC, andere Adresse.
      fixture.componentInstance.devices.set([{ ...geraet, ip: '192.168.1.99' }]);
      await fixture.whenStable();

      const [row] = fixture.componentInstance.rows();
      expect(row.device.ip).toBe('192.168.1.99');
      expect(row.label).toBe('Deckenlampe');
    });
  });

  it('öffnet den Marken-Link extern statt im App-Fenster', async () => {
    const { fixture, platform } = setup();
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector('.app-footer a');
    link?.dispatchEvent(new MouseEvent('click', { cancelable: true }));

    expect(platform.openExternal).toHaveBeenCalledWith('https://ha-fleet-manager.com');
  });
});

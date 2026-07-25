import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { PlatformService } from './core/platform.service';
import { DiscoveryService } from './shelly/discovery.service';
import type { LocalNetwork, ShellyDevice } from './shelly/shelly.model';

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

/** Erzeugt die Komponente mit Testdoubles für alle nativen Zugriffe. */
function setup(overrides: Partial<DiscoveryService> = {}) {
  const discovery = {
    listLocalNetworks: () => Promise.resolve([netz]),
    scanRange: () => Promise.resolve([]),
    ...overrides,
  };

  const platform = {
    getAppVersion: () => Promise.resolve('0.1.0'),
    openExternal: vi.fn(() => Promise.resolve()),
  };

  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      { provide: DiscoveryService, useValue: discovery },
      { provide: PlatformService, useValue: platform },
    ],
  });

  return { fixture: TestBed.createComponent(AppComponent), platform };
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

  it('öffnet den Marken-Link extern statt im App-Fenster', async () => {
    const { fixture, platform } = setup();
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector('.app-footer a');
    link?.dispatchEvent(new MouseEvent('click', { cancelable: true }));

    expect(platform.openExternal).toHaveBeenCalledWith('https://ha-fleet-manager.com');
  });
});

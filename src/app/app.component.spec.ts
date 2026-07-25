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
    scanNetwork: () => Promise.resolve([]),
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

  it('lädt die lokalen Netze beim Start', async () => {
    const { fixture } = setup();
    await fixture.whenStable();

    expect(fixture.componentInstance.networks()).toEqual([netz]);
    // Bei genau einem Netz gibt es nichts auszuwählen – es wird direkt übernommen.
    expect(fixture.componentInstance.selectedNetwork()).toEqual(netz);
  });

  it('zeigt gefundene Geräte an, sobald der Scan sie meldet', async () => {
    const { fixture } = setup({
      scanNetwork: (_network, callbacks = {}) => {
        callbacks.onFound?.(geraet);
        callbacks.onProgress?.({ done: 254, total: 254 });
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
    const scanNetwork = vi.fn(() => new Promise<ShellyDevice[]>(() => {}));
    const { fixture } = setup({ scanNetwork });
    await fixture.whenStable();

    void fixture.componentInstance.scan();
    void fixture.componentInstance.scan();

    expect(scanNetwork).toHaveBeenCalledTimes(1);
  });

  it('öffnet den Marken-Link extern statt im App-Fenster', async () => {
    const { fixture, platform } = setup();
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector('.app-footer a');
    link?.dispatchEvent(new MouseEvent('click', { cancelable: true }));

    expect(platform.openExternal).toHaveBeenCalledWith('https://ha-fleet-manager.com');
  });
});

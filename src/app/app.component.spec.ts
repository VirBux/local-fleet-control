import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { PlatformService } from './core/platform.service';
import { StorageService } from './core/storage.service';
import { PROJECT_STORAGE_KEY, ProjectService } from './project/project.service';
import { ControlService } from './shelly/control.service';
import { DiscoveryService } from './shelly/discovery.service';
import { FakeStorage, einKanalAus, fakePlatform, geraet, netz } from './testing/doubles';

// Hinweis: `vi.mock()` auf Modulpfade greift bei diesem Builder nicht (die Specs werden
// vorab gebündelt). Tauri-Zugriffe werden deshalb über DI ersetzt – siehe PlatformService.

/** Der Rahmen mit beiden Seiten; `vorbelegt` ist der Inhalt von `projects.json`. */
function setup(vorbelegt?: unknown) {
  const openExternal = vi.fn(() => Promise.resolve());
  const platform = fakePlatform(openExternal);

  const storage = new FakeStorage(
    vorbelegt ? new Map<string, unknown>([[PROJECT_STORAGE_KEY, vorbelegt]]) : new Map(),
  );

  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      {
        provide: DiscoveryService,
        useValue: { listLocalNetworks: () => Promise.resolve([netz]), scanRange: () => Promise.resolve([]) },
      },
      {
        provide: ControlService,
        useValue: { getStatus: () => Promise.resolve(einKanalAus), setSwitch: () => Promise.resolve() },
      },
      { provide: PlatformService, useValue: platform },
      { provide: StorageService, useValue: storage },
    ],
  });

  return {
    fixture: TestBed.createComponent(AppComponent),
    openExternal,
    projects: TestBed.inject(ProjectService),
  };
}

/** Eine Ablage mit einem eingerichteten Projekt – wie bei einem Nutzer, der schon dabei war. */
function eingerichtet() {
  return {
    version: 1,
    activeProjectId: 'p1',
    projects: [
      {
        id: 'p1',
        name: 'Musterkunde',
        devices: [
          { mac: geraet.mac, ip: geraet.ip, generation: 2, model: geraet.model, channelIds: [0] },
        ],
      },
    ],
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

  it('stellt die Oberfläche auf die gewählte Sprache um', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Geräte suchen');

    fixture.componentInstance.selectLanguage('en');
    await fixture.whenStable();

    // Zugleich die Probe aufs Exempel für zoneless: Der Wechsel muss ohne Zone.js ein
    // Rendering auslösen, sonst stünde hier noch der deutsche Text.
    expect(element.textContent).toContain('Find devices');
    expect(element.textContent).not.toContain('Geräte suchen');
    // Der Produktname bleibt in jeder Sprache stehen.
    expect(element.textContent).toContain('Local Fleet Control');
  });

  describe('Reiter', () => {
    it('startet ohne eingerichtete Anlage auf der Discovery-Seite', async () => {
      const { fixture } = setup();
      await fixture.whenStable();

      expect(fixture.componentInstance.tab()).toBe('discovery');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Geräte suchen');
    });

    it('öffnet bei eingerichteter Anlage sofort das Projekt', async () => {
      // REQUIREMENTS §4.4: Im Notfall soll niemand erst einen Reiter suchen.
      const { fixture } = setup(eingerichtet());
      await fixture.whenStable();

      expect(fixture.componentInstance.tab()).toBe('project');
    });

    it('respektiert eine eigene Wahl, die vor dem Laden der Datei kam', async () => {
      const { fixture } = setup(eingerichtet());
      fixture.componentInstance.selectTab('discovery');

      await fixture.whenStable();

      expect(fixture.componentInstance.tab()).toBe('discovery');
    });

    it('hält beide Seiten im DOM, damit ein Reiterwechsel kein Scan-Ergebnis verwirft', async () => {
      const { fixture } = setup();
      await fixture.whenStable();

      const seiten = (fixture.nativeElement as HTMLElement).querySelectorAll('.page');
      expect(seiten).toHaveLength(2);
      expect(seiten[0].hasAttribute('hidden')).toBe(false);
      expect(seiten[1].hasAttribute('hidden')).toBe(true);

      fixture.componentInstance.selectTab('project');
      await fixture.whenStable();

      expect(seiten[0].hasAttribute('hidden')).toBe(true);
      expect(seiten[1].hasAttribute('hidden')).toBe(false);
    });
  });

  it('öffnet den Marken-Link extern statt im App-Fenster', async () => {
    const { fixture, openExternal } = setup();
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector('.app-footer a');
    link?.dispatchEvent(new MouseEvent('click', { cancelable: true }));

    expect(openExternal).toHaveBeenCalledWith('https://ha-fleet-manager.com');
  });
});

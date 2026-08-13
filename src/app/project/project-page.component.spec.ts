import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformService } from '../core/platform.service';
import { StorageService } from '../core/storage.service';
import { ControlService, DeviceError } from '../shelly/control.service';
import { FakeStorage, einKanalAus, fakePlatform, geraet, zweitgeraet } from '../testing/doubles';
import { ProjectPageComponent } from './project-page.component';
import { PROJECT_STORAGE_KEY, ProjectService } from './project.service';

/** Erzeugt die Seite; `vorbelegt` ist der Inhalt von `projects.json` beim Start. */
function setup(controlOverrides: Partial<ControlService> = {}, vorbelegt?: unknown) {
  const control = {
    getStatus: vi.fn(() => Promise.resolve(einKanalAus)),
    setSwitch: vi.fn(() => Promise.resolve()),
    ...controlOverrides,
  };

  const storage = new FakeStorage(
    vorbelegt ? new Map<string, unknown>([[PROJECT_STORAGE_KEY, vorbelegt]]) : new Map(),
  );

  TestBed.configureTestingModule({
    imports: [ProjectPageComponent],
    providers: [
      { provide: ControlService, useValue: control },
      { provide: PlatformService, useValue: fakePlatform() },
      { provide: StorageService, useValue: storage },
    ],
  });

  return {
    fixture: TestBed.createComponent(ProjectPageComponent),
    control,
    storage,
    projects: TestBed.inject(ProjectService),
  };
}

describe('ProjectPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('fordert ohne Projekt zum Anlegen auf', async () => {
    const { fixture } = setup();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Kein Projekt ausgewählt',
    );
  });

  it('sagt bei einem leeren Projekt, wo Geräte herkommen', async () => {
    const { fixture, projects } = setup();
    projects.createProject('Musterkunde');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Noch keine Geräte im Projekt',
    );
  });

  it('zeigt gespeicherte Geräte sofort und fragt den Status danach ab', async () => {
    // REQUIREMENTS §4.4: Im Notfall darf niemand auf einen Scan warten müssen.
    const { fixture, control } = setup(
      {},
      {
        version: 1,
        activeProjectId: 'p1',
        projects: [
          {
            id: 'p1',
            name: 'Musterkunde',
            devices: [
              {
                mac: geraet.mac,
                ip: geraet.ip,
                generation: 2,
                model: geraet.model,
                name: 'Flurlicht',
                channelIds: [0],
              },
            ],
          },
        ],
      },
    );
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Flurlicht');
    expect(text).toContain('SNSW-001X16EU');
    // Die Kanäle kommen aus der Datei – die Schaltflächen stehen, bevor jemand antwortet.
    expect(fixture.componentInstance.rows()[0].channelId).toBe(0);
    expect(control.getStatus).toHaveBeenCalledTimes(1);
  });

  it('zeigt einen gespeicherten Kanal ohne bestätigten Zustand als unbekannt', async () => {
    // Gerät ist aus: Die Zeile steht da, der Zustand bleibt offen – geraten wird nichts.
    const { fixture, projects } = setup({
      getStatus: () => Promise.reject(new DeviceError('unreachable')),
    });
    projects.createProject('Musterkunde');
    projects.addDevice(geraet, [0]);
    await fixture.whenStable();

    const [row] = fixture.componentInstance.rows();
    expect(row.channelId).toBe(0);
    expect(row.on).toBeNull();
    expect(row.errorText).toBe('Gerät nicht erreichbar.');
  });

  it('schaltet ein gespeichertes Gerät', async () => {
    const { fixture, control, projects } = setup();
    projects.createProject('Musterkunde');
    projects.addDevice(geraet, [0]);
    await fixture.whenStable();

    fixture.componentInstance.switchChannel(fixture.componentInstance.rows()[0], 'on');
    await fixture.whenStable();

    expect(control.setSwitch).toHaveBeenCalledWith(
      expect.objectContaining({ mac: geraet.mac, ip: geraet.ip }),
      0,
      'on',
    );
  });

  it('entfernt ein Gerät erst beim zweiten Klick', async () => {
    const { fixture, projects } = setup();
    projects.createProject('Musterkunde');
    projects.addDevice(geraet, [0]);
    await fixture.whenStable();

    fixture.componentInstance.requestRemove(geraet.mac);
    expect(projects.devices()).toHaveLength(1);

    fixture.componentInstance.requestRemove(geraet.mac);
    expect(projects.devices()).toEqual([]);
  });

  describe('Projektstruktur', () => {
    /** Ein Projekt mit den übergebenen Geräten. */
    async function mitGeraeten(...devices: typeof geraet[]) {
      const teile = setup();
      teile.projects.createProject('Musterkunde');
      for (const device of devices.length ? devices : [geraet]) {
        teile.projects.addDevice(device, [0]);
      }
      await teile.fixture.whenStable();
      return teile;
    }

    it('sortiert die Geräte unter die Überschrift ihres Raums', async () => {
      const { fixture, projects } = await mitGeraeten(geraet, zweitgeraet);
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
      const { fixture, projects } = await mitGeraeten();
      projects.addCategory('Licht');
      projects.assign(`${geraet.mac}:0`, {
        categoryId: projects.activeProject()!.categories[0].id,
      });

      fixture.componentInstance.groupMode.set('category');
      await fixture.whenStable();

      expect(fixture.componentInstance.groups().map((g) => g.title)).toEqual(['Licht']);
    });

    it('übersetzt die Überschrift der nicht zugeordneten Geräte', async () => {
      const { fixture, projects } = await mitGeraeten();
      projects.addRoom('Flur');
      fixture.componentInstance.groupMode.set('category');
      await fixture.whenStable();

      expect(fixture.componentInstance.groups().map((g) => g.title)).toEqual(['Ohne Kategorie']);
    });

    it('zeigt den eigenen Namen statt des Gerätenamens', async () => {
      const { fixture, projects } = await mitGeraeten();

      projects.assign(`${geraet.mac}:0`, { name: 'Deckenlampe' });
      await fixture.whenStable();

      expect(fixture.componentInstance.rows()[0].label).toBe('Deckenlampe');
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Deckenlampe');
      expect(text).not.toContain('Flurlicht');
    });

    it('hängt die Zuordnung an Kanal und MAC, nicht ans Gerät', async () => {
      const { fixture, projects } = await mitGeraeten();
      // Zweiter Kanal desselben Geräts – der ist hier gar nicht gespeichert.
      projects.assign(`${geraet.mac}:1`, { name: 'Nur Kanal 2' });
      await fixture.whenStable();

      expect(fixture.componentInstance.rows()[0].label).toBe('Flurlicht');
      expect(fixture.componentInstance.rows()[0].entityKey).toBe(`${geraet.mac}:0`);
    });
  });
});

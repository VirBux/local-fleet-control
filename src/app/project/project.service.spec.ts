import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '../core/storage.service';
import { switchChannels } from '../devices/saved-device';
import type { ShellyDevice } from '../shelly/shelly.model';
import { parseProjectData } from './project.model';
import { PROJECT_STORAGE_KEY, ProjectService } from './project.service';

/**
 * Speicher-Double. Nach REQUIREMENTS §3.1 greift `vi.mock()` auf Modulpfade bei diesem
 * Builder nicht – ersetzbar ist nur, was über DI kommt. Asynchron wie das Original: Die
 * echte Ablage ist eine Datei.
 */
class FakeStorage {
  private writes = 0;

  constructor(private readonly entries = new Map<string, unknown>()) {}

  async read(key: string): Promise<unknown> {
    return this.entries.get(key) ?? null;
  }

  async write(key: string, value: unknown): Promise<void> {
    this.writes++;
    // Wie durch die Datei: Was hier ankommt, muss serialisierbar sein.
    this.entries.set(key, JSON.parse(JSON.stringify(value)));
  }

  /** Was tatsächlich abgelegt wurde – nicht, was der Service im Kopf hat. */
  gespeichert() {
    return parseProjectData(this.entries.get(PROJECT_STORAGE_KEY) ?? null);
  }

  /** Wie oft geschrieben wurde – für „schreibt nur bei echter Änderung". */
  schreibzugriffe(): number {
    return this.writes;
  }
}

const geraet: ShellyDevice = {
  ip: '192.168.1.50',
  generation: 2,
  model: 'SNSW-001X16EU',
  mac: 'A8032ABD42EC',
  name: 'Flurlicht',
  authEnabled: false,
  firmware: '1.0.7',
};

/** Erzeugt den Service und wartet, bis der gespeicherte Zustand geladen ist. */
async function setup(vorbelegt?: unknown) {
  const storage = new FakeStorage(
    vorbelegt ? new Map([[PROJECT_STORAGE_KEY, vorbelegt]]) : new Map(),
  );

  TestBed.configureTestingModule({
    providers: [ProjectService, { provide: StorageService, useValue: storage }],
  });

  const service = TestBed.inject(ProjectService);
  await service.ready;
  return { service, storage };
}

describe('ProjectService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('startet ohne Projekt', async () => {
    const { service } = await setup();

    expect(service.projects()).toEqual([]);
    expect(service.activeProject()).toBeNull();
  });

  it('legt ein Projekt an, aktiviert es und speichert sofort', async () => {
    const { service, storage } = await setup();

    service.createProject('  Musterkunde  ');

    expect(service.activeProject()?.name).toBe('Musterkunde');
    expect(storage.gespeichert().projects).toHaveLength(1);
    expect(storage.gespeichert().activeProjectId).toBe(service.activeProject()?.id);
  });

  it('lehnt einen leeren Projektnamen ab', async () => {
    const { service } = await setup();

    service.createProject('   ');

    expect(service.projects()).toEqual([]);
  });

  it('lädt beim Start, was gespeichert wurde', async () => {
    const { service } = await setup({
      version: 1,
      projects: [{ id: 'p1', name: 'Alt', rooms: [{ id: 'r1', name: 'Flur' }] }],
      activeProjectId: 'p1',
    });

    expect(service.activeProject()?.name).toBe('Alt');
    expect(service.activeProject()?.rooms).toEqual([{ id: 'r1', name: 'Flur' }]);
  });

  it('überschreibt keine Eingabe, die vor dem Laden kam', async () => {
    // Die Ablage ist eine Datei; zwischen App-Start und geladenem Zustand liegt ein
    // kleines Fenster. Was der Nutzer darin anlegt, darf nicht verlorengehen.
    const storage = new FakeStorage(
      new Map([[PROJECT_STORAGE_KEY, { version: 1, projects: [{ id: 'p1', name: 'Alt' }] }]]),
    );
    TestBed.configureTestingModule({
      providers: [ProjectService, { provide: StorageService, useValue: storage }],
    });

    const service = TestBed.inject(ProjectService);
    service.createProject('Schnell getippt');
    await service.ready;

    expect(service.projects().map((p) => p.name)).toEqual(['Schnell getippt']);
  });

  it('legt Räume und Kategorien in Eingabereihenfolge ab', async () => {
    const { service } = await setup();
    service.createProject('P');

    service.addRoom('Flur');
    service.addRoom('Bad');
    service.addCategory('Licht');

    expect(service.activeProject()?.rooms.map((r) => r.name)).toEqual(['Flur', 'Bad']);
    expect(service.activeProject()?.categories.map((c) => c.name)).toEqual(['Licht']);
  });

  it('ignoriert Bezeichnungen ohne Projekt und ohne Namen', async () => {
    const { service } = await setup();

    service.addRoom('Flur');
    expect(service.projects()).toEqual([]);

    service.createProject('P');
    service.addRoom('  ');
    expect(service.activeProject()?.rooms).toEqual([]);
  });

  it('ordnet eine Entität zu und speichert das', async () => {
    const { service, storage } = await setup();
    service.createProject('P');
    service.addRoom('Flur');
    const raumId = service.activeProject()!.rooms[0].id;

    service.assign('AA:0', { roomId: raumId, name: 'Deckenlampe' });

    expect(service.assignmentFor('AA:0')).toEqual({
      name: 'Deckenlampe',
      categoryId: null,
      roomId: raumId,
    });
    expect(storage.gespeichert().projects[0].assignments['AA:0'].name).toBe('Deckenlampe');
  });

  it('entfernt eine Zuordnung, sobald nichts mehr darin steht', async () => {
    const { service } = await setup();
    service.createProject('P');
    service.assign('AA:0', { name: 'Deckenlampe' });

    service.assign('AA:0', { name: '' });

    // Keine leere Hülle liegen lassen – die wäre nur Ballast in der Datei.
    expect(service.assignmentFor('AA:0')).toBeNull();
    expect(service.activeProject()?.assignments).toEqual({});
  });

  it('löst beim Löschen eines Raums alle Zuordnungen darauf', async () => {
    const { service } = await setup();
    service.createProject('P');
    service.addRoom('Flur');
    const raumId = service.activeProject()!.rooms[0].id;
    service.assign('AA:0', { roomId: raumId, name: 'Deckenlampe' });
    service.assign('BB:0', { roomId: raumId });

    service.removeRoom(raumId);

    expect(service.activeProject()?.rooms).toEqual([]);
    // Der Name überlebt, der tote Verweis nicht.
    expect(service.assignmentFor('AA:0')).toEqual({
      name: 'Deckenlampe',
      categoryId: null,
      roomId: null,
    });
    // Diese Zuordnung bestand nur aus dem Raum – sie fällt ganz weg.
    expect(service.assignmentFor('BB:0')).toBeNull();
  });

  it('löst beim Löschen einer Kategorie nur deren Verweise', async () => {
    const { service } = await setup();
    service.createProject('P');
    service.addRoom('Flur');
    service.addCategory('Licht');
    const raumId = service.activeProject()!.rooms[0].id;
    const kategorieId = service.activeProject()!.categories[0].id;
    service.assign('AA:0', { roomId: raumId, categoryId: kategorieId });

    service.removeCategory(kategorieId);

    expect(service.assignmentFor('AA:0')).toEqual({ name: '', categoryId: null, roomId: raumId });
  });

  it('hält Projekte auseinander', async () => {
    const { service } = await setup();
    service.createProject('Kunde A');
    service.assign('AA:0', { name: 'Nur bei A' });
    const idA = service.activeProject()!.id;

    service.createProject('Kunde B');

    expect(service.assignmentFor('AA:0')).toBeNull();

    service.selectProject(idA);
    expect(service.assignmentFor('AA:0')?.name).toBe('Nur bei A');
  });

  it('ignoriert die Auswahl eines unbekannten Projekts', async () => {
    const { service } = await setup();
    service.createProject('P');

    service.selectProject('gibt-es-nicht');

    expect(service.activeProject()).toBeNull();
  });

  it('löscht ein Projekt und gibt die Auswahl frei', async () => {
    const { service, storage } = await setup();
    service.createProject('P');
    const id = service.activeProject()!.id;

    service.deleteProject(id);

    expect(service.projects()).toEqual([]);
    expect(service.activeProject()).toBeNull();
    expect(storage.gespeichert()).toEqual({ version: 1, projects: [], activeProjectId: null });
  });

  describe('Geräte', () => {
    it('nimmt ein Gerät auf und speichert es sofort', async () => {
      const { service, storage } = await setup();
      service.createProject('P');

      service.addDevice(geraet, switchChannels(0));

      expect(service.devices()).toEqual([
        {
          mac: geraet.mac,
          ip: geraet.ip,
          generation: 2,
          model: 'SNSW-001X16EU',
          vendorId: 'shelly',
          name: 'Flurlicht',
          authEnabled: false,
          firmware: '1.0.7',
          channelIds: [0],
          coverIds: [],
        },
      ]);
      // Der Punkt der ganzen Übung: Ein Neustart darf die Liste nicht verlieren.
      expect(storage.gespeichert().projects[0].devices).toHaveLength(1);
    });

    it('ignoriert das Hinzufügen ohne aktives Projekt', async () => {
      const { service } = await setup();

      service.addDevice(geraet, switchChannels(0));

      expect(service.devices()).toEqual([]);
    });

    it('frischt ein bereits aufgenommenes Gerät auf, statt es zu verdoppeln', async () => {
      const { service } = await setup();
      service.createProject('P');
      service.addDevice(geraet, switchChannels(0));

      service.addDevice({ ...geraet, ip: '192.168.1.99' }, switchChannels(0, 1));

      expect(service.devices()).toHaveLength(1);
      expect(service.devices()[0].ip).toBe('192.168.1.99');
      expect(service.devices()[0].channelIds).toEqual([0, 1]);
    });

    it('zieht beim Wiederfinden die neue IP nach', async () => {
      const { service } = await setup();
      service.createProject('P');
      service.addDevice(geraet, switchChannels(0));

      // Dasselbe Gerät nach einem DHCP-Wechsel: gleiche MAC, andere Adresse.
      service.syncDevice({ ...geraet, ip: '192.168.1.99' }, switchChannels(0));

      expect(service.devices()[0].ip).toBe('192.168.1.99');
    });

    it('schreibt nicht, wenn sich nichts geändert hat', async () => {
      const { service, storage } = await setup();
      service.createProject('P');
      service.addDevice(geraet, switchChannels(0));
      const vorher = storage.schreibzugriffe();

      service.syncDevice(geraet, switchChannels(0));

      // Sonst legte jede Statusabfrage die Datei neu an – bei 20 Geräten im Sekundentakt.
      expect(storage.schreibzugriffe()).toBe(vorher);
    });

    it('behält die gespeicherten Kanäle, solange keine Statusantwort vorliegt', async () => {
      const { service } = await setup();
      service.createProject('P');
      service.addDevice(geraet, switchChannels(0, 1));

      // `null` heißt „noch nichts gehört" – nicht „keine Kanäle".
      service.syncDevice(geraet, null);

      expect(service.devices()[0].channelIds).toEqual([0, 1]);
    });

    it('tut nichts für ein Gerät, das gar nicht im Projekt steht', async () => {
      const { service } = await setup();
      service.createProject('P');

      service.syncDevice(geraet, switchChannels(0));

      expect(service.devices()).toEqual([]);
    });

    it('entfernt ein Gerät samt seiner Zuordnungen', async () => {
      const { service } = await setup();
      service.createProject('P');
      service.addDevice(geraet, switchChannels(0, 1));
      service.assign(`${geraet.mac}:0`, { name: 'Deckenlampe' });
      service.assign(`${geraet.mac}:1`, { name: 'Terrasse' });
      service.assign('BB:0', { name: 'Anderes Gerät' });

      service.removeDevice(geraet.mac);

      expect(service.devices()).toEqual([]);
      expect(service.assignmentFor(`${geraet.mac}:0`)).toBeNull();
      expect(service.assignmentFor(`${geraet.mac}:1`)).toBeNull();
      // Ein fremdes Gerät mit ähnlichem Schlüssel bleibt unangetastet.
      expect(service.assignmentFor('BB:0')?.name).toBe('Anderes Gerät');
    });

    it('hält die Geräte der Projekte auseinander', async () => {
      const { service } = await setup();
      service.createProject('Kunde A');
      service.addDevice(geraet, switchChannels(0));

      service.createProject('Kunde B');

      expect(service.devices()).toEqual([]);
      expect(service.deviceMacs().has(geraet.mac)).toBe(false);
    });

    it('lädt gespeicherte Geräte beim Start', async () => {
      const { service } = await setup({
        version: 1,
        projects: [
          {
            id: 'p1',
            name: 'Alt',
            devices: [{ mac: 'AA', ip: '192.168.1.9', generation: 2, channelIds: [0] }],
          },
        ],
        activeProjectId: 'p1',
      });

      // REQUIREMENTS §4.4: Die Liste steht sofort, ohne dass jemand scannen muss.
      expect(service.devices().map((device) => device.mac)).toEqual(['AA']);
    });
  });

  it('benennt das aktive Projekt um', async () => {
    const { service } = await setup();
    service.createProject('Alt');

    service.renameProject('  Neu  ');

    expect(service.activeProject()?.name).toBe('Neu');
  });

  it('lehnt einen leeren neuen Projektnamen ab', async () => {
    const { service } = await setup();
    service.createProject('Alt');

    service.renameProject('   ');

    // Ein namenloses Projekt wäre in der Auswahlliste unsichtbar.
    expect(service.activeProject()?.name).toBe('Alt');
  });
});

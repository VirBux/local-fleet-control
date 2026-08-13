import { describe, expect, it } from 'vitest';
import {
  displayName,
  emptyAssignment,
  entityKey,
  groupEntities,
  newId,
  parseProjectData,
  type Project,
} from './project.model';

const flur = { id: 'r1', name: 'Flur' };
const bad = { id: 'r2', name: 'Bad' };
const licht = { id: 'c1', name: 'Licht' };

function projekt(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Musterkunde',
    categories: [licht],
    rooms: [flur, bad],
    devices: [],
    assignments: {},
    ...overrides,
  };
}

/** Testeintrag – `groupEntities` verlangt nur einen Entitätsschlüssel. */
function eintrag(entityKey: string) {
  return { entityKey };
}

describe('entityKey', () => {
  it('nimmt für ein Gerät ohne Kanal die MAC allein', () => {
    expect(entityKey('A8032ABD42EC', null)).toBe('A8032ABD42EC');
  });

  it('hängt die Kanalnummer an – ein 2PM kann zwei Räume bedienen', () => {
    expect(entityKey('A8032ABD42EC', 0)).toBe('A8032ABD42EC:0');
    expect(entityKey('A8032ABD42EC', 1)).toBe('A8032ABD42EC:1');
  });
});

describe('newId', () => {
  it('liefert unterschiedliche Werte', () => {
    const ids = new Set(Array.from({ length: 200 }, newId));
    expect(ids.size).toBe(200);
  });
});

describe('displayName', () => {
  it('nimmt den eigenen Namen, wenn einer gesetzt ist', () => {
    expect(displayName({ ...emptyAssignment(), name: 'Deckenlampe' }, '192.168.1.50')).toBe(
      'Deckenlampe',
    );
  });

  it('fällt auf den Gerätenamen zurück – auch bei reinen Leerzeichen', () => {
    expect(displayName(null, 'Flurlicht')).toBe('Flurlicht');
    expect(displayName({ ...emptyAssignment(), name: '   ' }, 'Flurlicht')).toBe('Flurlicht');
  });
});

describe('groupEntities', () => {
  const project = projekt({
    assignments: {
      a: { name: '', categoryId: licht.id, roomId: flur.id },
      b: { name: '', categoryId: null, roomId: bad.id },
      c: { name: 'Nur benannt', categoryId: null, roomId: null },
    },
  });
  const eintraege = [eintrag('a'), eintrag('b'), eintrag('c')];

  it('teilt nach Raum, in der Reihenfolge des Projekts', () => {
    const gruppen = groupEntities(eintraege, project, 'room', 'Ohne Raum');

    // Flur steht im Projekt vor Bad – nicht alphabetisch sortieren.
    expect(gruppen.map((g) => g.title)).toEqual(['Flur', 'Bad', 'Ohne Raum']);
    expect(gruppen[0].items).toEqual([eintrag('a')]);
    expect(gruppen[2].items).toEqual([eintrag('c')]);
  });

  it('teilt nach Kategorie', () => {
    const gruppen = groupEntities(eintraege, project, 'category', 'Ohne Kategorie');

    expect(gruppen.map((g) => g.title)).toEqual(['Licht', 'Ohne Kategorie']);
    expect(gruppen[1].items).toEqual([eintrag('b'), eintrag('c')]);
  });

  it('lässt leere Gruppen weg', () => {
    const gruppen = groupEntities([eintrag('a')], project, 'room', 'Ohne Raum');

    expect(gruppen.map((g) => g.title)).toEqual(['Flur']);
  });

  it('behandelt eine Zuordnung auf eine gelöschte Bezeichnung als nicht zugeordnet', () => {
    const veraltet = projekt({
      assignments: { a: { name: '', categoryId: null, roomId: 'gibt-es-nicht' } },
    });

    const gruppen = groupEntities([eintrag('a')], veraltet, 'room', 'Ohne Raum');

    // Sonst verschwände das Gerät in einer Gruppe ohne Namen.
    expect(gruppen).toEqual([{ key: '', title: 'Ohne Raum', items: [eintrag('a')] }]);
  });

  it('liefert ohne Projekt eine einzige Gruppe ohne Überschrift', () => {
    expect(groupEntities(eintraege, null, 'room', 'Ohne Raum')).toEqual([
      { key: '', title: '', items: eintraege },
    ]);
  });

  it('liefert bei „gar nicht" eine einzige Gruppe ohne Überschrift', () => {
    expect(groupEntities(eintraege, project, 'none', 'Ohne Raum')).toEqual([
      { key: '', title: '', items: eintraege },
    ]);
  });

  it('liefert für eine leere Liste gar keine Gruppe', () => {
    expect(groupEntities([], project, 'room', 'Ohne Raum')).toEqual([]);
    expect(groupEntities([], null, 'none', 'Ohne Raum')).toEqual([]);
  });
});

describe('parseProjectData', () => {
  it('liest unverändert zurück, was gespeichert wurde', () => {
    const data = {
      version: 1 as const,
      projects: [projekt({ assignments: { 'AA:0': { name: 'X', categoryId: 'c1', roomId: 'r1' } } })],
      activeProjectId: 'p1',
    };

    // Der Weg durch die Datei: Objekt rein, geparstes JSON zurück.
    expect(parseProjectData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  describe('gibt einen leeren Zustand zurück, statt zu scheitern', () => {
    const faelle: [string, unknown][] = [
      ['nichts gespeichert', null],
      ['undefined', undefined],
      ['kein Objekt', 'text'],
      ['Array', []],
      ['fremde Version', { version: 99, projects: [] }],
      ['projects fehlt', { version: 1 }],
      ['projects ist kein Array', { version: 1, projects: {} }],
    ];

    it.each(faelle)('%s', (_name, data) => {
      expect(parseProjectData(data)).toEqual({ version: 1, projects: [], activeProjectId: null });
    });
  });

  it('überspringt kaputte Projekte, statt die guten mitzureißen', () => {
    const data = parseProjectData({
      version: 1,
      projects: [{ name: 'ohne ID' }, 'kein Objekt', { id: 'p2', name: 'Heil' }],
      activeProjectId: 'p2',
    });

    expect(data.projects).toEqual([
      { id: 'p2', name: 'Heil', categories: [], rooms: [], devices: [], assignments: {} },
    ]);
    expect(data.activeProjectId).toBe('p2');
  });

  it('vergisst ein aktives Projekt, das es nicht mehr gibt', () => {
    expect(parseProjectData({ version: 1, projects: [], activeProjectId: 'weg' }).activeProjectId)
      .toBeNull();
  });

  it('säubert Bezeichnungen und Zuordnungen von Unbrauchbarem', () => {
    const [project] = parseProjectData({
      version: 1,
      projects: [
        {
          id: 'p1',
          name: 'X',
          rooms: [{ id: 'r1', name: 'Flur' }, { id: 'r2' }, 42],
          categories: 'keine Liste',
          assignments: { a: { name: 'Nur Name' }, b: 'kein Objekt' },
        },
      ],
      activeProjectId: null,
    }).projects;

    expect(project.rooms).toEqual([{ id: 'r1', name: 'Flur' }]);
    expect(project.categories).toEqual([]);
    expect(project.assignments).toEqual({ a: { name: 'Nur Name', categoryId: null, roomId: null } });
  });
});

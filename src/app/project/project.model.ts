/**
 * Projektstruktur: Kategorien, Räume und eigene Namen für gefundene Geräte.
 *
 * Wie die Shelly-Modelle bewusst frei von Angular- und Tauri-Abhängigkeiten: reine
 * Funktionen auf reinen Daten. Siehe docs/plans/projektstruktur.md und
 * docs/plans/projekt-geraete.md.
 */

import { parseSavedDevices, type SavedDevice } from '../devices/saved-device';

/** Eine frei angelegte Bezeichnung – Kategorie oder Raum. */
export interface Label {
  id: string;
  name: string;
}

/** Was der Nutzer einer Entität zugeordnet hat. */
export interface Assignment {
  /** Freitext. Leer heißt „nimm den Namen, den das Gerät selbst meldet". */
  name: string;
  categoryId: string | null;
  roomId: string | null;
}

/** Ein Projekt: eine Anlage, ein Kunde, ein Standort. */
export interface Project {
  id: string;
  name: string;
  /** Reihenfolge ist Anzeigereihenfolge – vom Nutzer bestimmt, nicht alphabetisch. */
  categories: Label[];
  rooms: Label[];
  /**
   * Die Geräte der Anlage, in der Reihenfolge, in der sie aufgenommen wurden. Erst sie
   * machen das Projekt zu einer Anlage, die einen Neustart übersteht – die Zuordnungen
   * allein beschrieben nur, wie ein Gerät heißt, wenn es der Scan wiederfindet.
   */
  devices: SavedDevice[];
  /** Zuordnungen nach Entitätsschlüssel (`entityKey`). */
  assignments: Record<string, Assignment>;
}

/** Der gespeicherte Gesamtzustand. */
export interface ProjectData {
  /** Haken für spätere Migrationen. */
  version: 1;
  projects: Project[];
  activeProjectId: string | null;
}

/** Wonach die Geräteliste in Abschnitte zerfällt. */
export type GroupMode = 'room' | 'category' | 'none';

/** Ein Abschnitt der Geräteliste. */
export interface EntityGroup<T> {
  /** Stabiler Schlüssel für `track` – die Label-ID bzw. "" für „nicht zugeordnet". */
  key: string;
  /** Überschrift; leer, wenn nicht gruppiert wird. */
  title: string;
  items: T[];
}

/** Leerer Zustand – auch das Ergebnis, wenn gespeicherte Daten unbrauchbar sind. */
export function emptyProjectData(): ProjectData {
  return { version: 1, projects: [], activeProjectId: null };
}

/** Zuordnung ohne Inhalt: kein eigener Name, keine Kategorie, kein Raum. */
export function emptyAssignment(): Assignment {
  return { name: '', categoryId: null, roomId: null };
}

/**
 * Schlüssel einer Entität.
 *
 * Zugeordnet wird nicht das Gerät, sondern der einzelne Kanal: Ein Shelly 2PM kann Kanal 0
 * im Flur und Kanal 1 im Bad haben. Geräte ohne schaltbaren Ausgang (Messgeräte, noch nicht
 * unterstützte Typen) bekommen die MAC allein.
 */
export function entityKey(mac: string, channelId: number | null): string {
  return channelId === null ? mac : `${mac}:${channelId}`;
}

/**
 * Gehört ein Entitätsschlüssel zu diesem Gerät?
 *
 * Nicht `startsWith(mac)` allein: Zwei MACs können sich im Präfix gleichen. Erlaubt ist
 * genau die MAC selbst oder die MAC mit angehängtem Kanal.
 */
export function belongsToDevice(key: string, mac: string): boolean {
  return key === mac || key.startsWith(`${mac}:`);
}

/**
 * Kurze, eindeutige ID für Projekte und Bezeichnungen.
 *
 * Kein `crypto.randomUUID()`: Das verlangt einen Secure Context und ist damit nicht in
 * jedem WebView verlässlich da. Kryptografische Güte braucht es hier ohnehin nicht — die
 * IDs sind lokal und werden nie geraten.
 */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Der Name, der in der Liste steht: eigener Freitext, sonst der des Geräts. */
export function displayName(assignment: Assignment | null, fallback: string): string {
  return assignment?.name.trim() || fallback;
}

/**
 * Teilt Einträge in Abschnitte.
 *
 * Die Gruppenreihenfolge folgt dem Projekt, nicht dem Alphabet — der Nutzer hat seine
 * Räume in einer Reihenfolge angelegt, die für ihn Sinn ergibt. Nicht zugeordnete Einträge
 * kommen ans Ende: sichtbar, damit man sie zuordnet, aber nicht im Weg. Leere Gruppen
 * erscheinen nicht.
 *
 * `unassignedTitle` kommt von außen, weil diese Datei keine Sprache kennt: Die Überschrift
 * der letzten Gruppe ist der einzige Text hier, und der gehört in die i18n
 * (REQUIREMENTS §4.6).
 */
export function groupEntities<T extends { entityKey: string }>(
  items: T[],
  project: Project | null,
  mode: GroupMode,
  unassignedTitle: string,
): EntityGroup<T>[] {
  if (!project || mode === 'none') {
    return items.length > 0 ? [{ key: '', title: '', items }] : [];
  }

  const labels = mode === 'room' ? project.rooms : project.categories;

  const buckets = new Map<string, T[]>(labels.map((label) => [label.id, []]));
  const unassigned: T[] = [];

  for (const item of items) {
    const assignment = project.assignments[item.entityKey];
    const labelId = (mode === 'room' ? assignment?.roomId : assignment?.categoryId) ?? null;
    // Eine gelöschte Bezeichnung kann in alten Daten noch stehen – dann gilt der Eintrag
    // als nicht zugeordnet, statt in einer Gruppe ohne Namen zu verschwinden.
    const bucket = labelId === null ? undefined : buckets.get(labelId);
    (bucket ?? unassigned).push(item);
  }

  const groups: EntityGroup<T>[] = labels
    .filter((label) => (buckets.get(label.id)?.length ?? 0) > 0)
    .map((label) => ({ key: label.id, title: label.name, items: buckets.get(label.id) ?? [] }));

  if (unassigned.length > 0) {
    groups.push({ key: '', title: unassignedTitle, items: unassigned });
  }
  return groups;
}

/**
 * Liest gespeicherte Daten.
 *
 * Nimmt bewusst `unknown`: Was aus der Datei kommt, ist geparstes JSON beliebiger Form.
 * Fremdes oder halb Kaputtes führt zum leeren Zustand, nicht zum Absturz — eine
 * Notfall-Fernbedienung, die wegen eines kaputten Eintrags nicht startet, wäre das
 * Gegenteil ihres Zwecks. Jede Ebene wird deshalb einzeln geprüft.
 */
export function parseProjectData(data: unknown): ProjectData {
  if (!isRecord(data) || data['version'] !== 1 || !Array.isArray(data['projects'])) {
    return emptyProjectData();
  }

  const projects = data['projects'].map(parseProject).filter((p): p is Project => p !== null);
  const activeProjectId = asString(data['activeProjectId']);

  return {
    version: 1,
    projects,
    // Ein Verweis auf ein gelöschtes Projekt wäre ein Zustand ohne Anzeige.
    activeProjectId: projects.some((p) => p.id === activeProjectId) ? activeProjectId : null,
  };
}

function parseProject(value: unknown): Project | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value['id']);
  const name = asString(value['name']);
  if (!id || name === null) {
    return null;
  }

  return {
    id,
    name,
    categories: parseLabels(value['categories']),
    rooms: parseLabels(value['rooms']),
    devices: parseSavedDevices(value['devices']),
    assignments: parseAssignments(value['assignments']),
  };
}

function parseLabels(value: unknown): Label[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const id = asString(entry['id']);
    const name = asString(entry['name']);
    return id && name ? [{ id, name }] : [];
  });
}

function parseAssignments(value: unknown): Record<string, Assignment> {
  if (!isRecord(value)) {
    return {};
  }

  const assignments: Record<string, Assignment> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }
    assignments[key] = {
      name: asString(entry['name']) ?? '',
      categoryId: asString(entry['categoryId']),
      roomId: asString(entry['roomId']),
    };
  }
  return assignments;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

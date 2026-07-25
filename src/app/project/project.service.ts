import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from '../core/storage.service';
import {
  emptyAssignment,
  emptyProjectData,
  newId,
  parseProjectData,
  type Assignment,
  type Label,
  type Project,
  type ProjectData,
} from './project.model';

/** Schlüssel in der Ablage. Der Name ist Teil des Datenformats – nicht ändern. */
export const PROJECT_STORAGE_KEY = 'projects';

/**
 * Verwaltet Projekte, ihre Kategorien und Räume sowie die Zuordnung der Geräte.
 *
 * Gespeichert wird bei jeder Änderung, über einen einzigen Pfad (`apply`). Bewusst kein
 * `effect()`: Ein Speichervorgang, der an der Change Detection hängt, ist schwerer zu
 * testen und liefe Gefahr, ausgerechnet im Notfall noch nicht gelaufen zu sein.
 */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly storage = inject(StorageService);

  private readonly data = signal<ProjectData>(emptyProjectData());

  /** Hat der Nutzer schon etwas geändert? Siehe `load`. */
  private touched = false;

  /**
   * Erfüllt, sobald der gespeicherte Zustand geladen ist.
   *
   * Die Ablage ist eine Datei und damit asynchron; die App startet währenddessen mit einem
   * leeren Zustand. Nach außen sichtbar, weil sich sonst nichts darauf warten ließe.
   */
  readonly ready: Promise<void>;

  readonly projects = computed(() => this.data().projects);
  readonly activeProjectId = computed(() => this.data().activeProjectId);

  readonly activeProject = computed<Project | null>(() => {
    const { projects, activeProjectId } = this.data();
    return projects.find((project) => project.id === activeProjectId) ?? null;
  });

  constructor() {
    this.ready = this.load();
  }

  /**
   * Einmalig beim Start laden.
   *
   * Hat der Nutzer in der Zwischenzeit schon etwas angelegt, gewinnt seine Eingabe: Das
   * Fenster ist klein, aber Arbeit stillschweigend zu überschreiben wäre der schlimmere
   * Fehler von beiden.
   */
  private async load(): Promise<void> {
    const stored = parseProjectData(await this.storage.read(PROJECT_STORAGE_KEY));
    if (!this.touched) {
      this.data.set(stored);
    }
  }

  /** Legt ein Projekt an und macht es zum aktiven. Leere Namen werden abgelehnt. */
  createProject(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const project: Project = {
      id: newId(),
      name: trimmed,
      categories: [],
      rooms: [],
      assignments: {},
    };
    this.apply((data) => ({
      ...data,
      projects: [...data.projects, project],
      activeProjectId: project.id,
    }));
  }

  /** `null` blendet die Projektzuordnung aus, die Liste bleibt dann flach. */
  selectProject(id: string | null): void {
    this.apply((data) => ({
      ...data,
      activeProjectId: data.projects.some((project) => project.id === id) ? id : null,
    }));
  }

  /** Leere Namen werden abgelehnt – ein namenloses Projekt wäre in der Auswahl unsichtbar. */
  renameProject(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    this.updateActive((project) => ({ ...project, name: trimmed }));
  }

  deleteProject(id: string): void {
    this.apply((data) => ({
      ...data,
      projects: data.projects.filter((project) => project.id !== id),
      activeProjectId: data.activeProjectId === id ? null : data.activeProjectId,
    }));
  }

  addRoom(name: string): void {
    this.addLabel('rooms', name);
  }

  addCategory(name: string): void {
    this.addLabel('categories', name);
  }

  /** Entfernt einen Raum und löst alle Zuordnungen darauf. */
  removeRoom(id: string): void {
    this.removeLabel('rooms', 'roomId', id);
  }

  /** Entfernt eine Kategorie und löst alle Zuordnungen darauf. */
  removeCategory(id: string): void {
    this.removeLabel('categories', 'categoryId', id);
  }

  /** Zuordnung einer Entität; `null`, solange nichts zugeordnet ist. */
  assignmentFor(key: string): Assignment | null {
    return this.activeProject()?.assignments[key] ?? null;
  }

  /**
   * Ändert Teile einer Zuordnung. Bleibt danach nichts übrig – kein Name, keine Kategorie,
   * kein Raum –, verschwindet der Eintrag wieder, statt als leere Hülle liegen zu bleiben.
   */
  assign(key: string, patch: Partial<Assignment>): void {
    this.updateActive((project) => {
      const next: Assignment = { ...(project.assignments[key] ?? emptyAssignment()), ...patch };
      const assignments = { ...project.assignments };

      if (!next.name.trim() && next.categoryId === null && next.roomId === null) {
        delete assignments[key];
      } else {
        assignments[key] = next;
      }
      return { ...project, assignments };
    });
  }

  private addLabel(field: 'rooms' | 'categories', name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const label: Label = { id: newId(), name: trimmed };
    this.updateActive((project) => ({ ...project, [field]: [...project[field], label] }));
  }

  private removeLabel(
    field: 'rooms' | 'categories',
    assignedField: 'roomId' | 'categoryId',
    id: string,
  ): void {
    this.updateActive((project) => {
      const assignments: Record<string, Assignment> = {};
      for (const [key, assignment] of Object.entries(project.assignments)) {
        // Ohne dieses Aufräumen zeigten Zuordnungen auf eine ID, die es nicht mehr gibt –
        // die Geräte verschwänden in eine Gruppe ohne Namen.
        const cleaned =
          assignment[assignedField] === id ? { ...assignment, [assignedField]: null } : assignment;
        if (cleaned.name.trim() || cleaned.categoryId !== null || cleaned.roomId !== null) {
          assignments[key] = cleaned;
        }
      }

      return {
        ...project,
        [field]: project[field].filter((label) => label.id !== id),
        assignments,
      };
    });
  }

  private updateActive(change: (project: Project) => Project): void {
    const activeId = this.data().activeProjectId;
    if (!activeId) {
      return;
    }
    this.apply((data) => ({
      ...data,
      projects: data.projects.map((project) => (project.id === activeId ? change(project) : project)),
    }));
  }

  /**
   * Der einzige Schreibpfad: Zustand setzen und sichern.
   *
   * Auf das Schreiben wird nicht gewartet — die Oberfläche soll nicht an der Platte hängen.
   * Scheitert es, bleibt der Zustand im Speicher gültig, nur eben nicht dauerhaft.
   */
  private apply(change: (data: ProjectData) => ProjectData): void {
    const next = change(this.data());
    this.touched = true;
    this.data.set(next);
    void this.storage.write(PROJECT_STORAGE_KEY, next);
  }
}

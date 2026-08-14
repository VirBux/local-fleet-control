import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { buildRows, type DeviceRow } from '../devices/device-row';
import { DeviceRowComponent } from '../devices/device-row.component';
import { DeviceStateService, PENDING } from '../devices/device-state.service';
import { channelsFromStatus, emptyChannels, toShellyDevice } from '../devices/saved-device';
import { I18nService } from '../i18n/i18n.service';
import type { ShellyDevice } from '../shelly/shelly.model';
import type { CoverAction, SwitchAction } from '../shelly/status.model';
import { groupEntities, type Assignment, type GroupMode } from './project.model';
import { ProjectService } from './project.service';

/**
 * Die Projektseite: die Anlage definieren und im Notfall bedienen.
 *
 * Sie rendert aus `projects.json` und kommt damit **ohne Netz** aus — die Liste steht
 * sofort, der Ist-Zustand wandert im Hintergrund nach (REQUIREMENTS §4.4). Siehe
 * docs/plans/projekt-geraete.md.
 */
@Component({
  selector: 'app-project-page',
  imports: [DeviceRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-page.component.html',
  styleUrl: './project-page.component.css',
})
export class ProjectPageComponent {
  private readonly deviceStates = inject(DeviceStateService);
  readonly projects = inject(ProjectService);

  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t;

  /** Eingabefelder der Projektverwaltung. */
  readonly newProjectName = signal('');
  readonly newRoomName = signal('');
  readonly newCategoryName = signal('');

  /** Projekt bzw. Gerät, dessen Löschung bestätigt werden muss – zwei Klicks statt Verlust. */
  readonly pendingDelete = signal<string | null>(null);
  readonly pendingRemove = signal<string | null>(null);

  /**
   * Wonach die Liste in Abschnitte zerfällt. Umschaltbar, weil beide Sichten ihren Moment
   * haben: im Notfall sucht man nach Raum, beim Einrichten nach Kategorie.
   */
  readonly groupMode = signal<GroupMode>('room');

  /** MACs, für die schon einmal eine Abfrage angestoßen wurde – siehe `constructor`. */
  private readonly requested = new Set<string>();

  readonly rows = computed<DeviceRow[]>(() => {
    const devices = this.projects.devices();
    // Über das Signal des Dienstes gelesen, nicht über `stateFor`: Nur so hängt die Liste
    // daran und rendert nach, wenn ein Gerät antwortet.
    const states = this.deviceStates.all();

    return buildRows(devices.map(toShellyDevice), {
      state: (mac) => states.get(mac) ?? PENDING,
      project: this.projects.activeProject(),
      t: this.t,
      savedChannels: (mac) => {
        const saved = devices.find((device) => device.mac === mac);
        return saved ? { switchIds: saved.channelIds, coverIds: saved.coverIds } : emptyChannels();
      },
      vendorId: (mac) => devices.find((device) => device.mac === mac)?.vendorId ?? 'shelly',
      saved: () => true,
    });
  });

  /** Die Liste in Abschnitte geteilt; ohne Gruppierung bleibt es eine ohne Überschrift. */
  readonly groups = computed(() =>
    groupEntities(
      this.rows(),
      this.projects.activeProject(),
      this.groupMode(),
      this.groupMode() === 'room' ? this.t('group.unassignedRoom') : this.t('group.unassignedCategory'),
    ),
  );

  constructor() {
    // Jedes Gerät, das neu in der Liste auftaucht — beim Laden der Datei oder beim
    // Hinzufügen auf der Discovery-Seite —, wird einmal abgefragt. `requested` verhindert,
    // dass das Zurückspiegeln der Antwort (`syncDevice`) eine zweite Runde auslöst.
    effect(() => {
      for (const device of this.projects.devices()) {
        if (!this.requested.has(device.mac)) {
          this.requested.add(device.mac);
          void this.refresh(toShellyDevice(device));
        }
      }
    });
  }

  /** Alle Geräte neu abfragen – der Knopf für „stimmt das noch?". */
  refreshAll(): void {
    for (const device of this.projects.devices()) {
      void this.refresh(toShellyDevice(device));
    }
  }

  retry(row: DeviceRow): void {
    void this.refresh(row.device);
  }

  switchChannel(row: DeviceRow, action: SwitchAction): void {
    if (row.channelId !== null) {
      void this.deviceStates.switchChannel(row.device, row.channelId, action);
    }
  }

  moveCover(row: DeviceRow, action: CoverAction): void {
    if (row.channelId !== null) {
      void this.deviceStates.moveCover(row.device, row.channelId, action);
    }
  }

  /**
   * Status abfragen und das Ergebnis ins Projekt zurückspiegeln: Ein Gerät, das inzwischen
   * anders heißt oder einen Kanal mehr hat, soll nicht mit alten Angaben in der Datei
   * stehen bleiben. `syncDevice` schreibt nur bei echter Änderung.
   */
  private async refresh(device: ShellyDevice): Promise<void> {
    await this.deviceStates.loadStatus(device);
    const status = this.deviceStates.stateFor(device.mac).status;
    this.projects.syncDevice(device, status ? channelsFromStatus(status) : null);
  }

  // --- Projektverwaltung: nimmt den Eingabefeldern die Arbeit ab, der Rest liegt im Service ---

  createProject(): void {
    this.projects.createProject(this.newProjectName());
    this.newProjectName.set('');
  }

  selectProject(id: string): void {
    this.projects.selectProject(id || null);
    this.pendingDelete.set(null);
    this.pendingRemove.set(null);
  }

  /** Erster Klick fragt nach, zweiter löscht – ein Projekt ist Handarbeit. */
  requestDelete(id: string): void {
    if (this.pendingDelete() === id) {
      this.projects.deleteProject(id);
      this.pendingDelete.set(null);
      return;
    }
    this.pendingDelete.set(id);
  }

  /** Dasselbe für ein Gerät: Mit ihm fallen auch seine Zuordnungen weg. */
  requestRemove(mac: string): void {
    if (this.pendingRemove() === mac) {
      this.projects.removeDevice(mac);
      this.requested.delete(mac);
      this.pendingRemove.set(null);
      return;
    }
    this.pendingRemove.set(mac);
  }

  addRoom(): void {
    this.projects.addRoom(this.newRoomName());
    this.newRoomName.set('');
  }

  addCategory(): void {
    this.projects.addCategory(this.newCategoryName());
    this.newCategoryName.set('');
  }

  /** Zuordnung einer Zeile ändern. Leere Auswahl heißt „nicht zugeordnet". */
  assign(row: DeviceRow, patch: Partial<Assignment>): void {
    this.projects.assign(row.entityKey, patch);
  }
}

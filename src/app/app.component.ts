import { Component, computed, inject, signal } from '@angular/core';
import { PlatformService } from './core/platform.service';
import {
  displayName,
  entityKey,
  groupEntities,
  type Assignment,
  type GroupMode,
} from './project/project.model';
import { ProjectService } from './project/project.service';
import { ControlService, DeviceError } from './shelly/control.service';
import { DiscoveryService, scanSettingsFor, type ScanProgress } from './shelly/discovery.service';
import {
  MAX_HOSTS,
  formatScanRange,
  hostCountForPrefix,
  isDirectlyAttached,
  isPrivateRange,
  parseScanRange,
  toScanRange,
  type LocalNetwork,
  type ScanRange,
  type ShellyDevice,
} from './shelly/shelly.model';
import type { DeviceStatus, ShellyChannel, SwitchAction } from './shelly/status.model';

/** Ein anklickbarer Vorschlag aus den lokalen Netzen dieses Rechners. */
export interface RangePreset {
  label: string;
  cidr: string;
  /** Grund, warum der Bereich nicht scannbar ist – sonst `null`. */
  disabledReason: string | null;
}

/** Ist-Zustand und Bedienbarkeit eines gefundenen Geräts. */
export interface DeviceState {
  /** `null`, solange nichts bestätigt ist: beim Laden und nach einem Fehlschlag. */
  status: DeviceStatus | null;
  /** Eine Abfrage oder ein Befehl läuft gerade. */
  busy: boolean;
  /** Fehlermeldung genau dieses Geräts – nie global, sonst wird die Liste unbrauchbar. */
  error: string;
  /** Passwortgeschützt: Aktionen gesperrt, bis die Geräte-Auth gebaut ist. */
  locked: boolean;
}

/** Zustand eines gerade gefundenen Geräts: Die Statusabfrage läuft bereits. */
const PENDING: DeviceState = { status: null, busy: true, error: '', locked: false };

/**
 * Eine Zeile der Geräteliste: ein Kanal – oder das Gerät selbst, solange bzw. weil es
 * keinen hat. Mehrkanalgeräte bekommen so je einen eigenen Eintrag (REQUIREMENTS §4.2).
 */
export interface DeviceRow {
  /** MAC bzw. MAC:Kanal – zugleich Schlüssel für `track` und für die Projekt-Zuordnung. */
  entityKey: string;
  device: ShellyDevice;
  channel: ShellyChannel | null;
  state: DeviceState;
  /** Leer bei Einkanalgeräten – dort wäre „Kanal 1" nur Ballast. */
  channelLabel: string;
  /** Was in der Liste steht: eigener Name aus dem Projekt, sonst der des Geräts. */
  label: string;
  /** Zuordnung im aktiven Projekt; `null` ohne Projekt oder ohne Zuordnung. */
  assignment: Assignment | null;
}

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly discovery = inject(DiscoveryService);
  private readonly control = inject(ControlService);
  private readonly platform = inject(PlatformService);
  readonly projects = inject(ProjectService);

  /** Version aus tauri.conf.json – im Browser (ng serve) nicht verfügbar. */
  readonly version = signal('');

  readonly networks = signal<LocalNetwork[]>([]);

  /**
   * Der einzugebende Scan-Bereich als Text. Einzige Quelle der Wahrheit für den Scan –
   * die Vorschläge aus den lokalen Netzen schreiben nur hier hinein. Grund: Welchen Weg
   * eine Anfrage nimmt, entscheidet die Routing-Tabelle des Systems, nicht die App. Ein
   * über VPN erreichbares Fremdnetz ist damit genauso scannbar wie das eigene WLAN.
   */
  readonly rangeInput = signal('');

  readonly devices = signal<ShellyDevice[]>([]);
  readonly progress = signal<ScanProgress | null>(null);
  readonly scanning = signal(false);
  readonly error = signal('');

  /**
   * Zustand je Gerät, nach MAC. Bewusst getrennt von `devices`: Ein Treffer steht sofort
   * in der Liste, sein Status wandert nach.
   */
  readonly deviceStates = signal<ReadonlyMap<string, DeviceState>>(new Map());

  /**
   * Wonach die Liste in Abschnitte zerfällt. Umschaltbar, weil beide Sichten ihren Moment
   * haben: im Notfall sucht man nach Raum, beim Einrichten nach Kategorie.
   */
  readonly groupMode = signal<GroupMode>('room');

  /** Eingabefelder der Projektverwaltung. */
  readonly newProjectName = signal('');
  readonly newRoomName = signal('');
  readonly newCategoryName = signal('');

  /** Projekt, dessen Löschung bestätigt werden muss – zwei Klicks statt Datenverlust. */
  readonly pendingDelete = signal<string | null>(null);

  /** Zuletzt gescannter Bereich – für den Hinweis, wenn nichts gefunden wurde. */
  readonly scannedRange = signal<ScanRange | null>(null);

  /** Vorschläge aus den lokalen Netzen. Nicht scannbare bleiben sichtbar, aber gesperrt. */
  readonly presets = computed<RangePreset[]>(() =>
    this.networks().map((network) => {
      const range = toScanRange(network);
      const hosts = hostCountForPrefix(range.prefixLen);
      return {
        label: `${network.interface} — ${formatScanRange(range)}`,
        cidr: formatScanRange(range),
        disabledReason: hosts === 0 ? 'keine Geräteadressen' : hosts > MAX_HOSTS ? 'zu groß' : null,
      };
    }),
  );

  readonly range = computed(() => parseScanRange(this.rangeInput()));

  /** Leerer String = Eingabe ist in Ordnung. */
  readonly rangeError = computed(() => {
    if (!this.rangeInput().trim()) {
      return 'Bereich angeben, z. B. 192.168.1.0/24';
    }

    const range = this.range();
    if (!range) {
      return 'Ungültiger Bereich. Beispiel: 192.168.1.0/24';
    }

    const hosts = hostCountForPrefix(range.prefixLen);
    if (hosts === 0) {
      // Typisch für Tailscale- und WireGuard-Adressen: ein /32 ist genau ein Rechner.
      return `Ein /${range.prefixLen} enthält keine Geräteadressen — hier ist nichts zu finden.`;
    }
    if (hosts > MAX_HOSTS) {
      return `Bereich zu groß (${hosts} Adressen, erlaubt sind ${MAX_HOSTS}). Kleiner wählen, z. B. /24.`;
    }
    if (!isPrivateRange(range)) {
      // REQUIREMENTS §8: keine Fremd-Endpunkte, die App ist kein Portscanner.
      return 'Nur private Netze: 10.x, 172.16–31.x, 192.168.x oder 100.64–127.x.';
    }
    return '';
  });

  readonly canScan = computed(() => !this.scanning() && !this.rangeError());

  /**
   * Die Geräteliste, aufgefaltet auf Kanäle: Ein Shelly 2PM steht mit zwei Einträgen
   * darin (REQUIREMENTS §4.2). Geräte ohne schaltbaren Ausgang – reine Messgeräte, noch
   * nicht unterstützte Typen, gesperrte – behalten genau eine Zeile.
   */
  readonly rows = computed<DeviceRow[]>(() => {
    const project = this.projects.activeProject();

    return this.devices().flatMap((device): DeviceRow[] => {
      const state = this.stateFor(device);
      const channels = state.status?.channels ?? [];
      const deviceName = device.name ?? device.ip;

      const toRow = (channel: ShellyChannel | null, channelLabel: string): DeviceRow => {
        const key = entityKey(device.mac, channel?.id ?? null);
        const assignment = project?.assignments[key] ?? null;
        return {
          entityKey: key,
          device,
          channel,
          state,
          channelLabel,
          label: displayName(assignment, channelLabel ? `${deviceName} · ${channelLabel}` : deviceName),
          assignment,
        };
      };

      if (channels.length === 0) {
        return [toRow(null, '')];
      }
      // Für Menschen ab 1 zählen; die Kanalnummer der API beginnt bei 0.
      return channels.map((channel) =>
        toRow(channel, channels.length > 1 ? `Kanal ${channel.id + 1}` : ''),
      );
    });
  });

  /**
   * Die Liste in Abschnitte geteilt. Ohne aktives Projekt bleibt es bei einer Gruppe ohne
   * Überschrift – also der flachen Liste von vorher.
   */
  readonly groups = computed(() =>
    groupEntities(this.rows(), this.projects.activeProject(), this.groupMode()),
  );

  constructor() {
    void this.platform.getAppVersion().then((v) => this.version.set(v));
    void this.loadNetworks();
  }

  async loadNetworks(): Promise<void> {
    try {
      const networks = await this.discovery.listLocalNetworks();
      this.networks.set(networks);

      // Als Startwert das erste scannbare eigene Netz – der mit Abstand häufigste Fall.
      const usable = this.presets().find((preset) => preset.disabledReason === null);
      if (usable) {
        this.rangeInput.set(usable.cidr);
      }
    } catch (cause) {
      this.error.set(String(cause));
    }
  }

  usePreset(preset: RangePreset): void {
    if (!preset.disabledReason) {
      this.rangeInput.set(preset.cidr);
    }
  }

  async scan(): Promise<void> {
    const range = this.range();
    if (!range || !this.canScan()) {
      return;
    }

    this.scanning.set(true);
    this.error.set('');
    this.devices.set([]);
    this.deviceStates.set(new Map());
    this.progress.set(null);
    this.scannedRange.set(range);

    try {
      await this.discovery.scanRange(range, {
        // Über eine Route (VPN, Subnet-Router) braucht der Scan mehr Geduld als im LAN.
        settings: scanSettingsFor(isDirectlyAttached(range, this.networks())),
        // Treffer sofort anzeigen, statt bis zum Ende des Scans zu warten.
        onFound: (device) => {
          this.devices.update((list) => [...list, device]);
          // Der Status läuft nebenher: Der Scan soll nicht auf ihn warten.
          void this.loadStatus(device);
        },
        onProgress: (progress) => this.progress.set(progress),
      });
    } catch (cause) {
      this.error.set(String(cause));
    } finally {
      this.scanning.set(false);
    }
  }

  /**
   * Fragt den Ist-Zustand eines Geräts ab (REQUIREMENTS §4.2). Fehler bleiben am Gerät –
   * die Liste muss auch dann brauchbar bleiben, wenn eines nicht antwortet.
   */
  async loadStatus(device: ShellyDevice): Promise<void> {
    if (device.authEnabled) {
      // Ohne Geräte-Auth (REQUIREMENTS §4.3, eigener Schritt) käme nur ein 401 zurück.
      // Den Grund zeigen, statt das Gerät als „Fehler" abzustempeln.
      this.setState(device, {
        status: null,
        busy: false,
        error: 'Passwortgeschützt — Anmeldung ist noch nicht gebaut.',
        locked: true,
      });
      return;
    }

    // Der zuletzt bestätigte Zustand bleibt während der Abfrage stehen: Er ist das Letzte,
    // was das Gerät wirklich gemeldet hat — nur bedienen lässt er sich derweil nicht. Ihn
    // wegzuwerfen würde die Zeile bei jeder Nachfrage kurz zusammenklappen lassen.
    this.setState(device, { ...this.stateFor(device), busy: true, error: '' });
    try {
      const status = await this.control.getStatus(device);
      this.setState(device, { status, busy: false, error: '', locked: false });
    } catch (cause) {
      this.setState(device, failureFor(cause));
    }
  }

  /**
   * Schaltet einen Kanal und fragt danach den echten Zustand neu ab.
   *
   * Kein optimistisches UI: Was das Gerät aus dem Befehl gemacht hat, sagt nur das Gerät.
   */
  async switchChannel(row: DeviceRow, action: SwitchAction): Promise<void> {
    if (!row.channel || row.state.busy || row.state.locked) {
      return;
    }

    this.setState(row.device, { ...this.stateFor(row.device), busy: true, error: '' });
    try {
      await this.control.setSwitch(row.device, row.channel.id, action);
    } catch (cause) {
      this.setState(row.device, failureFor(cause));
      return;
    }
    await this.loadStatus(row.device);
  }

  /** Typ-Info hinter „erkannt, nicht steuerbar" – leer, wenn das Gerät nichts meldet. */
  unsupportedInfo(state: DeviceState): string {
    return (state.status?.unsupported ?? []).join(', ');
  }

  /** Bekannter Zustand eines Geräts; frisch gefunden heißt „Abfrage läuft". */
  private stateFor(device: ShellyDevice): DeviceState {
    return this.deviceStates().get(device.mac) ?? PENDING;
  }

  private setState(device: ShellyDevice, state: DeviceState): void {
    // Neue Map statt Mutation: Signals vergleichen Referenzen, sonst rendert nichts nach.
    this.deviceStates.update((states) => new Map(states).set(device.mac, state));
  }

  format(range: ScanRange): string {
    return formatScanRange(range);
  }

  // --- Projektverwaltung: nimmt den Eingabefeldern die Arbeit ab, der Rest liegt im Service ---

  createProject(): void {
    this.projects.createProject(this.newProjectName());
    this.newProjectName.set('');
  }

  selectProject(id: string): void {
    this.projects.selectProject(id || null);
    this.pendingDelete.set(null);
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

  /** Externe Links im System-Browser öffnen, nicht im App-Fenster. */
  openHomepage(event: Event): void {
    event.preventDefault();
    void this.platform.openExternal('https://ha-fleet-manager.com');
  }
}

/**
 * Gescheiterte Abfrage oder gescheiterter Befehl.
 *
 * Der zuletzt bekannte Status fällt dabei weg: Ein Zustand, den das Gerät nicht bestätigt
 * hat, ist kein Ist-Zustand – ihn mit einer Fehlermeldung daneben stehen zu lassen wäre
 * genau das optimistische UI, das REQUIREMENTS §4.2 ausschließt.
 */
function failureFor(cause: unknown): DeviceState {
  const locked = cause instanceof DeviceError && cause.locked;
  const error = cause instanceof DeviceError ? cause.message : String(cause);
  return { status: null, busy: false, error, locked };
}

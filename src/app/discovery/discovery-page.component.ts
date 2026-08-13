import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DeviceRowComponent } from '../devices/device-row.component';
import { buildRows, type DeviceRow } from '../devices/device-row';
import { DeviceStateService, PENDING } from '../devices/device-state.service';
import { I18nService } from '../i18n/i18n.service';
import { ProjectService } from '../project/project.service';
import { DiscoveryService, scanSettingsFor, type ScanProgress } from '../shelly/discovery.service';
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
} from '../shelly/shelly.model';
import type { SwitchAction } from '../shelly/status.model';

/** Ein anklickbarer Vorschlag aus den lokalen Netzen dieses Rechners. */
export interface RangePreset {
  label: string;
  cidr: string;
  /** Grund, warum der Bereich nicht scannbar ist – sonst `null`. */
  disabledReason: string | null;
}

/**
 * Die Discovery-Seite: Geräte im Netz suchen und ins Projekt aufnehmen.
 *
 * Jede Fundzeile zeigt, was das Projekt über das Gerät bereits weiß — eigener Name, Raum,
 * Kategorie — und ob es schon aufgenommen ist. Ohne das wüsste man beim zweiten Scan nicht,
 * was neu ist. Siehe docs/plans/projekt-geraete.md.
 */
@Component({
  selector: 'app-discovery-page',
  imports: [DeviceRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discovery-page.component.html',
  styleUrl: './discovery-page.component.css',
})
export class DiscoveryPageComponent {
  private readonly discovery = inject(DiscoveryService);
  private readonly deviceStates = inject(DeviceStateService);
  readonly projects = inject(ProjectService);

  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t;

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
        disabledReason:
          hosts === 0
            ? this.t('scan.reasonNoHosts')
            : hosts > MAX_HOSTS
              ? this.t('scan.reasonTooLarge')
              : null,
      };
    }),
  );

  readonly range = computed(() => parseScanRange(this.rangeInput()));

  /** Leerer String = Eingabe ist in Ordnung. */
  readonly rangeError = computed(() => {
    if (!this.rangeInput().trim()) {
      return this.t('range.empty');
    }

    const range = this.range();
    if (!range) {
      return this.t('range.invalid');
    }

    const hosts = hostCountForPrefix(range.prefixLen);
    if (hosts === 0) {
      // Typisch für Tailscale- und WireGuard-Adressen: ein /32 ist genau ein Rechner.
      return this.t('range.noHosts', { prefix: range.prefixLen });
    }
    if (hosts > MAX_HOSTS) {
      return this.t('range.tooLarge', { hosts, max: MAX_HOSTS });
    }
    if (!isPrivateRange(range)) {
      // REQUIREMENTS §8: keine Fremd-Endpunkte, die App ist kein Portscanner.
      return this.t('range.notPrivate');
    }
    return '';
  });

  readonly canScan = computed(() => !this.scanning() && !this.rangeError());

  /**
   * Die Fundliste, aufgefaltet auf Kanäle: Ein Shelly 2PM steht mit zwei Einträgen darin
   * (REQUIREMENTS §4.2). Geschaltet werden darf auch hier — beim Einrichten ist das der
   * schnellste Weg herauszufinden, welches Gerät welches ist.
   */
  readonly rows = computed<DeviceRow[]>(() => {
    const macs = this.projects.deviceMacs();
    // Über das Signal des Dienstes gelesen, nicht über `stateFor`: Nur so hängt die Liste
    // daran und rendert nach, wenn ein Gerät antwortet.
    const states = this.deviceStates.all();
    return buildRows(this.devices(), {
      state: (mac) => states.get(mac) ?? PENDING,
      project: this.projects.activeProject(),
      t: this.t,
      saved: (mac) => macs.has(mac),
    });
  });

  /**
   * Der Entitätsschlüssel der jeweils ersten Zeile eines Geräts.
   *
   * Aufgenommen wird das **Gerät**, nicht der einzelne Kanal — der Knopf gehört deshalb nur
   * an die erste Zeile. An jeder Kanalzeile stünde er dreimal und täte dreimal dasselbe.
   */
  private readonly firstRows = computed(() => {
    const first = new Map<string, string>();
    for (const row of this.rows()) {
      if (!first.has(row.device.mac)) {
        first.set(row.device.mac, row.entityKey);
      }
    }
    return first;
  });

  constructor() {
    void this.loadNetworks();
  }

  isFirstRow(row: DeviceRow): boolean {
    return this.firstRows().get(row.device.mac) === row.entityKey;
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
          void this.refresh(device);
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
   * Status abfragen und das Ergebnis ins Projekt zurückspiegeln.
   *
   * Der Scan ist die Gelegenheit, an der ein gespeichertes Gerät seine neue IP bekommt:
   * Gefunden wird es über die MAC, nicht über die Adresse. `syncDevice` schreibt nur, wenn
   * sich wirklich etwas geändert hat, und tut nichts für Geräte außerhalb des Projekts.
   */
  private async refresh(device: ShellyDevice): Promise<void> {
    await this.deviceStates.loadStatus(device);
    this.projects.syncDevice(device, this.channelsOf(device.mac));
  }

  retry(row: DeviceRow): void {
    void this.refresh(row.device);
  }

  switchChannel(row: DeviceRow, action: SwitchAction): void {
    if (row.channelId !== null) {
      void this.deviceStates.switchChannel(row.device, row.channelId, action);
    }
  }

  /** Nimmt das Gerät der Zeile ins aktive Projekt auf – mit allen bekannten Kanälen. */
  addToProject(row: DeviceRow): void {
    this.projects.addDevice(row.device, this.channelsOf(row.device.mac) ?? []);
  }

  /** Bestätigte Kanäle eines Geräts; `null`, solange keine Statusantwort vorliegt. */
  private channelsOf(mac: string): number[] | null {
    const status = this.deviceStates.stateFor(mac).status;
    return status ? status.channels.map((channel) => channel.id) : null;
  }

  format(range: ScanRange): string {
    return formatScanRange(range);
  }
}

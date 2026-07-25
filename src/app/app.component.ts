import { Component, computed, inject, signal } from '@angular/core';
import { PlatformService } from './core/platform.service';
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

/** Ein anklickbarer Vorschlag aus den lokalen Netzen dieses Rechners. */
export interface RangePreset {
  label: string;
  cidr: string;
  /** Grund, warum der Bereich nicht scannbar ist – sonst `null`. */
  disabledReason: string | null;
}

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly discovery = inject(DiscoveryService);
  private readonly platform = inject(PlatformService);

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
    this.progress.set(null);
    this.scannedRange.set(range);

    try {
      await this.discovery.scanRange(range, {
        // Über eine Route (VPN, Subnet-Router) braucht der Scan mehr Geduld als im LAN.
        settings: scanSettingsFor(isDirectlyAttached(range, this.networks())),
        // Treffer sofort anzeigen, statt bis zum Ende des Scans zu warten.
        onFound: (device) => this.devices.update((list) => [...list, device]),
        onProgress: (progress) => this.progress.set(progress),
      });
    } catch (cause) {
      this.error.set(String(cause));
    } finally {
      this.scanning.set(false);
    }
  }

  format(range: ScanRange): string {
    return formatScanRange(range);
  }

  /** Externe Links im System-Browser öffnen, nicht im App-Fenster. */
  openHomepage(event: Event): void {
    event.preventDefault();
    void this.platform.openExternal('https://ha-fleet-manager.com');
  }
}

import { Component, inject, signal } from '@angular/core';
import { PlatformService } from './core/platform.service';
import { DiscoveryService, type ScanProgress } from './shelly/discovery.service';
import type { LocalNetwork, ShellyDevice } from './shelly/shelly.model';

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
  readonly selectedNetwork = signal<LocalNetwork | null>(null);
  readonly devices = signal<ShellyDevice[]>([]);
  readonly progress = signal<ScanProgress | null>(null);
  readonly scanning = signal(false);
  readonly error = signal('');

  constructor() {
    void this.platform.getAppVersion().then((v) => this.version.set(v));
    void this.loadNetworks();
  }

  async loadNetworks(): Promise<void> {
    try {
      const networks = await this.discovery.listLocalNetworks();
      this.networks.set(networks);
      // Häufigster Fall ist genau ein nutzbares Netz – dann keine Auswahl verlangen.
      this.selectedNetwork.set(networks.length > 0 ? networks[0] : null);
    } catch (cause) {
      this.error.set(String(cause));
    }
  }

  selectNetwork(index: string): void {
    this.selectedNetwork.set(this.networks()[Number(index)] ?? null);
  }

  async scan(): Promise<void> {
    const network = this.selectedNetwork();
    if (!network || this.scanning()) {
      return;
    }

    this.scanning.set(true);
    this.error.set('');
    this.devices.set([]);
    this.progress.set(null);

    try {
      await this.discovery.scanNetwork(network, {
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

  /** Externe Links im System-Browser öffnen, nicht im App-Fenster. */
  openHomepage(event: Event): void {
    event.preventDefault();
    void this.platform.openExternal('https://ha-fleet-manager.com');
  }
}

import { Component, inject, signal } from '@angular/core';
import { PlatformService } from './core/platform.service';
import { DiscoveryPageComponent } from './discovery/discovery-page.component';
import { I18nService } from './i18n/i18n.service';
import { LANGUAGES, LANGUAGE_NAMES, isLanguage } from './i18n/messages';
import { ProjectPageComponent } from './project/project-page.component';
import { ProjectService } from './project/project.service';

/** Die beiden Seiten der App: Geräte finden – Anlage definieren und bedienen. */
export type Tab = 'discovery' | 'project';

/**
 * Der Rahmen: Kopfzeile, Reiter, Fußzeile. Der Inhalt liegt in den beiden Seiten
 * (docs/plans/projekt-geraete.md).
 */
@Component({
  selector: 'app-root',
  imports: [DiscoveryPageComponent, ProjectPageComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly platform = inject(PlatformService);
  private readonly i18n = inject(I18nService);
  private readonly projects = inject(ProjectService);

  /**
   * Übersetzt einen Text. Kurz gehalten, weil im Template fast jede Zeile sie aufruft;
   * als Feld weitergereicht, damit `this` nicht verloren geht.
   */
  readonly t = this.i18n.t;

  readonly language = this.i18n.language;
  readonly languages = LANGUAGES;
  readonly languageNames = LANGUAGE_NAMES;

  /** Version aus tauri.conf.json – im Browser (ng serve) nicht verfügbar. */
  readonly version = signal('');

  readonly tab = signal<Tab>('discovery');

  /** Hat der Nutzer schon selbst umgeschaltet? Dann redet ihm der Start nicht mehr rein. */
  private switched = false;

  constructor() {
    void this.platform.getAppVersion().then((v) => this.version.set(v));

    // Ist die Anlage schon eingerichtet, öffnet die App die Projektseite: Im Notfall soll
    // niemand erst einen Reiter suchen (REQUIREMENTS §4.4). Die Entscheidung fällt erst
    // nach dem Laden der Datei — vorher ist die Geräteliste zwangsläufig leer.
    void this.projects.ready.then(() => {
      if (!this.switched && this.projects.devices().length > 0) {
        this.tab.set('project');
      }
    });
  }

  selectTab(tab: Tab): void {
    this.switched = true;
    this.tab.set(tab);
  }

  /** Sprache umstellen; der Service merkt sie sich dauerhaft. */
  selectLanguage(value: string): void {
    if (isLanguage(value)) {
      this.i18n.setLanguage(value);
    }
  }

  /** Externe Links im System-Browser öffnen, nicht im App-Fenster. */
  openHomepage(event: Event): void {
    event.preventDefault();
    void this.platform.openExternal('https://ha-fleet-manager.com');
  }
}

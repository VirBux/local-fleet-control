import { Injectable } from '@angular/core';
import { load, type Store } from '@tauri-apps/plugin-store';

/**
 * Dateiname im App-Datenverzeichnis. Teil des Datenformats – nicht ändern, ohne eine
 * Migration mitzuliefern.
 */
const STORE_FILE = 'projects.json';

/**
 * Kapselt die dauerhafte Ablage.
 *
 * **JSON-Datei im App-Datenverzeichnis** (Tauri-Store-Plugin), nicht `localStorage`: Der
 * WebView-Speicher liegt im Browser-Profil und ist damit weder sicherbar noch weitergebbar
 * — beides braucht das geplante Export/Import (REQUIREMENTS §5). Abgelegt werden Objekte,
 * keine JSON-Strings, damit die Datei lesbar bleibt.
 *
 * Eigene Klasse statt direkter Importe, weil `vi.mock()` auf Modulpfade bei diesem Builder
 * nicht greift (REQUIREMENTS §3.1) — ersetzbar ist nur, was über DI kommt.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private store: Promise<Store> | null = null;

  /** `null`, wenn nichts gespeichert ist oder die Ablage nicht erreichbar war. */
  async read(key: string): Promise<unknown> {
    try {
      const store = await this.open();
      return (await store.get(key)) ?? null;
    } catch {
      return this.giveUp();
    }
  }

  async write(key: string, value: unknown): Promise<void> {
    try {
      const store = await this.open();
      await store.set(key, value);
      // Ohne `save()` stünde der Wert nur im Speicher – autoSave ist bewusst aus, damit
      // nach einem erfolgreichen Aufruf sicher ist, dass die Datei geschrieben wurde.
      await store.save();
    } catch {
      this.giveUp();
    }
  }

  /** Die Datei wird einmal geöffnet und offen gehalten. */
  private open(): Promise<Store> {
    return (this.store ??= load(STORE_FILE, { autoSave: false }));
  }

  /**
   * Nach einem Fehlschlag den Griff auf die Datei fallen lassen, damit der nächste Versuch
   * neu aufsetzt. Ohne Tauri-Brücke – etwa unter `ng serve` – scheitert jeder Versuch;
   * die App läuft dann ohne dauerhafte Ablage weiter, statt gar nicht zu starten.
   */
  private giveUp(): null {
    this.store = null;
    return null;
  }
}

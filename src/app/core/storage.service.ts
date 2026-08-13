import { Injectable } from '@angular/core';
import { load, type Store } from '@tauri-apps/plugin-store';

/**
 * Dateien im App-Datenverzeichnis. Die Namen sind Teil des Datenformats – nicht ändern,
 * ohne eine Migration mitzuliefern.
 *
 * Zwei Dateien, weil die Inhalte verschiedenen Lebensläufen folgen: `projects.json` ist
 * die Anlage eines Kunden und damit das, was das geplante Export/Import (REQUIREMENTS §5)
 * transportieren wird. `settings.json` beschreibt dagegen diese eine Installation – die
 * Sprache des Integrators hat auf dem Rechner des Endkunden nichts zu suchen.
 */
export const PROJECT_FILE = 'projects.json';
export const SETTINGS_FILE = 'settings.json';

export type StoreFile = typeof PROJECT_FILE | typeof SETTINGS_FILE;

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
  /** Offene Dateien, je Name eine. */
  private readonly stores = new Map<StoreFile, Promise<Store>>();

  /** `null`, wenn nichts gespeichert ist oder die Ablage nicht erreichbar war. */
  async read(key: string, file: StoreFile): Promise<unknown> {
    try {
      const store = await this.open(file);
      return (await store.get(key)) ?? null;
    } catch {
      return this.giveUp(file);
    }
  }

  async write(key: string, value: unknown, file: StoreFile): Promise<void> {
    try {
      const store = await this.open(file);
      await store.set(key, value);
      // Ohne `save()` stünde der Wert nur im Speicher – autoSave ist bewusst aus, damit
      // nach einem erfolgreichen Aufruf sicher ist, dass die Datei geschrieben wurde.
      await store.save();
    } catch {
      this.giveUp(file);
    }
  }

  /** Jede Datei wird einmal geöffnet und offen gehalten. */
  private open(file: StoreFile): Promise<Store> {
    let store = this.stores.get(file);
    if (!store) {
      store = load(file, { autoSave: false });
      this.stores.set(file, store);
    }
    return store;
  }

  /**
   * Nach einem Fehlschlag den Griff auf die Datei fallen lassen, damit der nächste Versuch
   * neu aufsetzt. Ohne Tauri-Brücke – etwa unter `ng serve` – scheitert jeder Versuch;
   * die App läuft dann ohne dauerhafte Ablage weiter, statt gar nicht zu starten.
   */
  private giveUp(file: StoreFile): null {
    this.stores.delete(file);
    return null;
  }
}

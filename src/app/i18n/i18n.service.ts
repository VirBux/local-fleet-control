import { Injectable, computed, inject, signal } from '@angular/core';
import { PlatformService } from '../core/platform.service';
import { SETTINGS_FILE, StorageService } from '../core/storage.service';
import {
  format,
  isLanguage,
  matchLanguage,
  messagesFor,
  type Language,
  type MessageKey,
  type MessageParams,
} from './messages';

/** Schlüssel in `settings.json`. Der Name ist Teil des Datenformats – nicht ändern. */
export const LANGUAGE_STORAGE_KEY = 'language';

/**
 * Hält die eingestellte Sprache und liefert die Texte dazu.
 *
 * Die Sprache ist ein Signal, `t()` liest es: Ein Wechsel lässt damit jede Ansicht neu
 * rendern, die einen Text anzeigt — ohne Zone.js wäre eine gewöhnliche Variable hier
 * wirkungslos (REQUIREMENTS §3).
 *
 * Bewusst als Methode im Template (`t('scan.start')`) statt als Pipe: Eine reine Pipe
 * würde ihr Ergebnis pro Schlüssel zwischenspeichern und beim Sprachwechsel den alten
 * Text stehen lassen; eine unreine liefe bei jedem Durchlauf. Der Aufruf liest das Signal
 * direkt und ist damit genau so reaktiv, wie er sein soll — und der Schlüssel bleibt
 * typgeprüft.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly storage = inject(StorageService);
  private readonly platform = inject(PlatformService);

  /**
   * Startwert ist die Systemsprache: Bis die Datei gelesen ist, ist das die beste
   * Vermutung — und beim allerersten Start bleibt es dabei.
   */
  private readonly current = signal<Language>(matchLanguage(this.platform.preferredLanguages()));

  readonly language = this.current.asReadonly();

  /** Hat der Nutzer schon selbst gewählt? Siehe `load`. */
  private chosen = false;

  /**
   * Erfüllt, sobald die gespeicherte Sprache geladen ist. Nach außen sichtbar, weil sich
   * sonst im Test nichts darauf warten ließe (wie bei `ProjectService.ready`).
   */
  readonly ready: Promise<void>;

  private readonly messages = computed(() => messagesFor(this.current()));

  constructor() {
    this.apply(this.current());
    this.ready = this.load();
  }

  /**
   * Übersetzt einen Schlüssel und setzt Platzhalter ein.
   *
   * Als Feld statt als Methode, damit Komponenten es kurz weiterreichen können
   * (`readonly t = inject(I18nService).t`), ohne dass `this` verloren geht.
   */
  readonly t = (key: MessageKey, params?: MessageParams): string =>
    format(this.messages()[key], params);

  /** Sprache umstellen und dauerhaft merken. */
  setLanguage(language: Language): void {
    this.chosen = true;
    this.apply(language);
    // Nicht abwarten: Die Oberfläche soll nicht an der Platte hängen. Scheitert es,
    // stimmt die Anzeige trotzdem – nur der nächste Start fällt zurück.
    void this.storage.write(LANGUAGE_STORAGE_KEY, language, SETTINGS_FILE);
  }

  /**
   * Einmalig beim Start laden.
   *
   * Hat der Nutzer in der Zwischenzeit schon umgestellt, gewinnt seine Wahl — dieselbe
   * Regel wie beim `ProjectService`: Das Fenster ist klein, aber eine Eingabe
   * stillschweigend zurückzudrehen wäre der schlimmere Fehler von beiden.
   */
  private async load(): Promise<void> {
    const stored = await this.storage.read(LANGUAGE_STORAGE_KEY, SETTINGS_FILE);
    if (isLanguage(stored) && !this.chosen) {
      this.apply(stored);
    }
  }

  /**
   * Der einzige Schreibpfad auf die Sprache. Setzt zusätzlich `<html lang>` — Screenreader
   * und die Silbentrennung des WebViews richten sich danach.
   */
  private apply(language: Language): void {
    this.current.set(language);
    document.documentElement.lang = language;
  }
}

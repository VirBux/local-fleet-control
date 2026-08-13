import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { hr } from './hr';

/**
 * Alle Textschlüssel — abgeleitet aus der Referenzsprache Deutsch. Eine Sprache, der ein
 * Schlüssel fehlt, ist damit ein Compilerfehler.
 */
export type MessageKey = keyof typeof de;

/** Ein vollständiges Wörterbuch. */
export type Messages = Record<MessageKey, string>;

/** Werte, die in einen Text eingesetzt werden (`{hosts}`). */
export type MessageParams = Record<string, string | number>;

/** Die fünf Sprachen aus REQUIREMENTS §4.6. */
export const LANGUAGES = ['de', 'en', 'es', 'fr', 'hr'] as const;

export type Language = (typeof LANGUAGES)[number];

/**
 * Beschriftung der Sprachauswahl — jede Sprache in sich selbst benannt.
 *
 * Absicht: Wer die App versehentlich auf Kroatisch gestellt hat, findet „Deutsch" auch
 * dann wieder, wenn er kein Wort Kroatisch versteht. Übersetzte Sprachnamen („Nemački")
 * würden genau das verhindern.
 */
export const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  hr: 'Hrvatski',
};

/**
 * Sprache, wenn die des Systems keine der fünf ist.
 *
 * Englisch, nicht Deutsch: Das Projekt ist Open Source und richtet sich an die
 * internationale Home-Assistant-Community (REQUIREMENTS §1). Deutsch bleibt lediglich
 * die Referenz im Quelltext.
 */
export const FALLBACK_LANGUAGE: Language = 'en';

/**
 * Alle Wörterbücher, fest eingebunden statt nachgeladen.
 *
 * Bewusst kein Lazy-Loading: Es geht um wenige Kilobyte, und die App ist eine
 * Notfall-Fernbedienung (REQUIREMENTS §1) — sie darf beim Start nicht auf eine Datei
 * warten, nur um ihre Knöpfe beschriften zu können.
 */
const MESSAGES: Record<Language, Messages> = { de, en, es, fr, hr };

export function messagesFor(language: Language): Messages {
  return MESSAGES[language];
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Wählt aus den Sprachwünschen des Systems (`navigator.languages`) die erste
 * unterstützte.
 *
 * Regionalanhänge werden abgeschnitten: `de-AT` und `de-CH` sind für uns Deutsch. Passt
 * nichts, gilt `FALLBACK_LANGUAGE`.
 */
export function matchLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) {
      return base;
    }
  }
  return FALLBACK_LANGUAGE;
}

/**
 * Setzt Platzhalter ein. Unbekannte Namen bleiben unverändert stehen — sichtbar falsch
 * ist besser als stillschweigend leer.
 */
export function format(template: string, params?: MessageParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

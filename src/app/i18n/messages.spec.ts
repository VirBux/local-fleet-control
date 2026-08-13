import { describe, expect, it } from 'vitest';
import { de } from './de';
import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
  LANGUAGE_NAMES,
  format,
  isLanguage,
  matchLanguage,
  messagesFor,
  type MessageKey,
} from './messages';

/** Namen der Platzhalter eines Textes, etwa `{hosts}` → `hosts`. */
function placeholders(text: string): Set<string> {
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]));
}

const keys = Object.keys(de) as MessageKey[];

describe('Wörterbücher', () => {
  it('kennen in jeder Sprache dieselben Schlüssel', () => {
    // Der Compiler deckt das über den Typ `Messages` bereits ab; der Test hält es fest,
    // falls jemand die Typbindung löst.
    for (const language of LANGUAGES) {
      expect(Object.keys(messagesFor(language)).sort()).toEqual([...keys].sort());
    }
  });

  it('lassen keinen Text leer', () => {
    for (const language of LANGUAGES) {
      const messages = messagesFor(language);
      for (const key of keys) {
        expect(messages[key].trim(), `${language}/${key}`).not.toBe('');
      }
    }
  });

  it('behalten alle Platzhalter der Referenzsprache', () => {
    // Ein beim Übersetzen verlorenes `{hosts}` fällt sonst niemandem auf – die Meldung
    // steht dann ohne die Zahl da, um die es geht.
    for (const language of LANGUAGES) {
      const messages = messagesFor(language);
      for (const key of keys) {
        expect(placeholders(messages[key]), `${language}/${key}`).toEqual(
          placeholders(de[key]),
        );
      }
    }
  });

  it('haben für jede Sprache einen Namen in der Sprache selbst', () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_NAMES[language]).toBeTruthy();
    }
  });
});

describe('matchLanguage', () => {
  it('erkennt die Sprache trotz Regionalanhang', () => {
    expect(matchLanguage(['de-AT', 'en'])).toBe('de');
    expect(matchLanguage(['HR-hr'])).toBe('hr');
  });

  it('nimmt den ersten unterstützten Wunsch', () => {
    expect(matchLanguage(['ja', 'pt-BR', 'fr-CA', 'en'])).toBe('fr');
  });

  it('fällt auf Englisch zurück, wenn nichts passt', () => {
    expect(matchLanguage(['ja', 'ko'])).toBe(FALLBACK_LANGUAGE);
    expect(matchLanguage([])).toBe(FALLBACK_LANGUAGE);
  });
});

describe('isLanguage', () => {
  it('nimmt nur die fünf unterstützten Sprachen an', () => {
    expect(isLanguage('hr')).toBe(true);
    expect(isLanguage('de-DE')).toBe(false);
    expect(isLanguage('ja')).toBe(false);
    expect(isLanguage(null)).toBe(false);
    expect(isLanguage(42)).toBe(false);
  });
});

describe('format', () => {
  it('setzt Platzhalter ein', () => {
    expect(format('{hosts} von {max}', { hosts: 512, max: 1024 })).toBe('512 von 1024');
  });

  it('ersetzt denselben Platzhalter überall', () => {
    expect(format('{a}-{a}', { a: 'x' })).toBe('x-x');
  });

  it('lässt unbekannte Platzhalter stehen', () => {
    // Sichtbar falsch ist besser als stillschweigend leer.
    expect(format('{fehlt}', { andere: 1 })).toBe('{fehlt}');
  });

  it('lässt einen Text ohne Werte unangetastet', () => {
    expect(format('{roh}')).toBe('{roh}');
  });
});

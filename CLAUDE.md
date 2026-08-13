# CLAUDE.md

Arbeitsanweisungen für Claude Code in diesem Repository.

## Projektkontext

Local Fleet Control ist eine Open-Source-Notfall-Fernbedienung für Smart-Home-Geräte mit lokaler
HTTP-API (MVP: Shelly), als Fallback bei Ausfall von Home Assistant. Ein Subprojekt von
HA Fleet Manager („powered by HA Fleet Manager").

**Maßgebliche Spezifikation: [REQUIREMENTS.md](./docs/REQUIREMENTS.md)** — Ziel, Scope,
Tech-Stack, Entscheidungen.
Offene Aufgaben: [TODO_OPEN.md](./docs/TODO_OPEN.md). Erledigte:
[TODO_DONE.md](./docs/TODO_DONE.md).

Bei Widersprüchen gilt REQUIREMENTS.md.

## Konventionen

- **Sprache:** Antworten und Code-Kommentare auf Deutsch. UI-Texte fünfsprachig
  (DE/EN/ES/FR/HR), keine hartcodierten Strings: Texte liegen in `src/app/i18n/`, Deutsch ist
  die Referenzsprache (definiert die Schlüssel), im Template `t('key')` (REQUIREMENTS §4.6).
  Neue Texte immer in allen fünf Dateien ergänzen — der Compiler erzwingt es.
- **Tech-Stack ist festgelegt** (Tauri 2 + Angular, eine Codebasis) — keine alternativen
  Frameworks vorschlagen, ohne explizit zu fragen. Rust-Anteil minimal halten.
- **Zoneless:** Zustand, der die Ansicht beeinflusst, gehört in Signals — ohne Zone.js löst
  sonst nichts ein Rendering aus.
- **Tests:** `npm test` (Vitest). `vi.mock()` auf Modulpfade funktioniert hier **nicht** —
  native Zugriffe hinter injizierbare Services legen und per DI ersetzen (REQUIREMENTS §3.1).
- **Kleine, nachvollziehbare Schritte** bevorzugen. Jede Änderung kurz begründen.
- **Erst lauffähige Basis, dann Erweiterung.**
- **Nicht ungefragt refaktorieren** oder Abstraktionen einführen, die der Task nicht braucht.
- **MVP-Disziplin:** Alles außerhalb von REQUIREMENTS §4 ist Phase 2 — nicht „nebenbei"
  mitbauen.

## Arbeitsweise

1. Vor größeren Änderungen: kurz Plan/Vorgehen skizzieren, dann umsetzen.
2. Nach Abschluss einer TODO-Aufgabe: Eintrag aus `TODO_OPEN.md` nach `TODO_DONE.md`
   verschieben.
3. Architektur- oder Scope-Entscheidungen: in `REQUIREMENTS.md` festhalten (§9 abbauen), nicht
   nur in Memory oder Chat.
4. Pläne und Spezifikationen als Markdown unter `docs/plans/` ablegen, TODO-Einträge kurz halten
   und dorthin verlinken.
5. Doku konsistent halten (README ↔ REQUIREMENTS ↔ CLAUDE.md); bei Widersprüchen nachfragen
   statt stillschweigend auflösen.

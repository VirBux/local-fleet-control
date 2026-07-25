# Erledigte Aufgaben

> Einträge aus [TODO_OPEN.md](./TODO_OPEN.md) landen hier, jeweils mit Datum.

## 2026-07-25

- [x] Projektdokumentation angelegt: `docs/REQUIREMENTS.md`, `CLAUDE.md`,
      `docs/TODO_OPEN.md`, `docs/TODO_DONE.md`
- [x] Rust-Toolchain installiert (rustup, stable 1.97.1, MSVC-Target)
- [x] Tauri-2-Projekt mit Angular-20-Frontend gescaffoldet (`src/` + `src-tauri/`),
      Demo-Code (Greet-Beispiel, Framework-Logos) entfernt
- [x] Tauri-HTTP-Plugin eingebunden: JS-Paket, Cargo-Dependency, `.plugin(...)` in `lib.rs`,
      Capability-Scope `http://**` + `https://api.github.com/**`, CSP gesetzt
- [x] App-Shell mit Pflicht-Branding („powered by HA Fleet Manager", Version aus
      `tauri.conf.json`) und Emerald-Farbwelt (hell/dunkel nach System)
- [x] Repo-Grundlagen: `LICENSE` (Apache-2.0), `TRADEMARK.md`, `CONTRIBUTING.md`,
      README, `.gitignore` erweitert (Rust-Target, Android-Artefakte, Keystore-Dateien)
- [x] Angular-Build verifiziert (`npm run build` läuft durch)

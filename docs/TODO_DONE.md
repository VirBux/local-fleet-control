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
- [x] Plan für den Netzwerk-Scan: [docs/plans/netzwerk-scan.md](./plans/netzwerk-scan.md)
- [x] Rust-Command `list_local_networks` geschrieben (`if-addrs` 0.15, filtert auf aktive
      IPv4-Interfaces ohne Loopback/Link-Local) — **noch nicht kompiliert**
- [x] Shelly-Auswertung (`src/app/shelly/shelly.model.ts`): Generationserkennung,
      Host-Berechnung; 33 Prüfungen bestanden (`npm run check:model`)
- [x] Sweep-Service (`src/app/shelly/discovery.service.ts`): 32 parallele Anfragen,
      300 ms Timeout, Treffer werden während des Scans gemeldet
- [x] Provisorische Spike-Oberfläche zum Testen des Scans am echten Gerät
- [x] **Entscheidung Test-Setup: Vitest über `@angular/build:unit-test`** (`npm test`) —
      Begründung und die Einschränkung bei `vi.mock` in REQUIREMENTS §3.1
- [x] **Entscheidung Zoneless:** `provideZonelessChangeDetection()`, Zone.js entfernt
      (Bundle 242 kB → 207 kB)
- [x] `PlatformService` eingeführt: kapselt Tauri-Zugriffe, damit sie im Test per DI
      ersetzbar sind
- [x] 31 Tests grün (25 Discovery-Logik, 6 Komponente inkl. Nachweis, dass Signal-Änderungen
      ohne Zone.js im DOM ankommen)

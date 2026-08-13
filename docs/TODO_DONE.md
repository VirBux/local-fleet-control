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
- [x] Visual Studio Build Tools installiert; `cargo check` läuft fehler- und warnungsfrei durch —
      der Rust-Command `list_local_networks` kompiliert
- [x] **Windows-Build verifiziert:** `npm run tauri build` erzeugt beide Installer
      (MSI 5,0 MB / NSIS-Setup 3,4 MB, Anwendung selbst 14,2 MB). Damit ist die
      Toolchain vollständig lauffähig.
- [x] **Scan gegen echte Geräte verifiziert:** Gen2 und Gen3 werden im eigenen WLAN gefunden,
      Generation und Modellkennung stimmen
- [x] **Scan-Bereich frei wählbar** statt Interface-Auswahl (CIDR-Eingabe, lokale Netze nur
      noch als Vorschläge, /32 gesperrt); Timeout/Parallelität je nach Strecke (LAN 300 ms/32,
      über Route 1000 ms/16); Hinweis mit möglichen Ursachen, wenn nichts gefunden wird.
      Begrenzung auf private Adressräume nach REQUIREMENTS §8. Siehe
      [Plan](./plans/netzwerk-scan.md), 76 Tests grün
- [x] Sicherheitsprüfung vor der Veröffentlichung: keine Tokens, Keys, Zertifikate oder
      `.env`-Dateien in Arbeitsstand und Historie. Gefunden und behoben: private E-Mail in
      den Commit-Metadaten — Historie auf `info@ha-fleet-manager.com` umgeschrieben.
- [x] **Repository veröffentlicht:** https://github.com/VirBux/local-fleet-control (public)
- [x] **Statusabfrage und Kanal-Ermittlung** (`shelly/status.model.ts`): Gen1 aus `relays[].ison`,
      Gen2/3 aus den Schlüsseln `switch:<id>`. Mehrkanalgeräte werden auf je einen
      Listeneintrag pro Kanal aufgefaltet; Geräte ohne Schaltausgang erscheinen als
      „erkannt, nicht steuerbar" mit Typ-Info (`pm1`, `light` …). Siehe
      [Plan](./plans/geraete-schalten.md)
- [x] **Ein/Aus/Umschalten für Relais** (`shelly/control.service.ts`) — der erste schreibende
      Zugriff des Projekts. Nach jedem Befehl wird der Zustand neu abgefragt statt geraten
      (REQUIREMENTS §4.2); eigenes Zeitlimit von 5 s statt der Sweep-Werte; Fehler und
      passwortgeschützte Geräte hängen am einzelnen Gerät, nicht an der Liste.
      **Am echten Gerät verifiziert:** Schalten funktioniert. 108 Tests grün (32 mehr als zuvor)
- [x] **Projektstruktur** ([Plan](./plans/projektstruktur.md), Scope-Erweiterung, in
      REQUIREMENTS §4.4.1 nachgetragen): Projekte mit frei anlegbaren Kategorien und Räumen,
      Freitext-Namen je Entität, Geräteliste zerfällt in Abschnitte — umschaltbar nach Raum
      oder Kategorie. Schlüssel ist die MAC bzw. `MAC:Kanal`, damit Zuordnungen einen
      IP-Wechsel überleben; die MAC wird beim Auswerten von `GET /shelly` normalisiert.
      Ablage gekapselt in `core/storage.service.ts`. 152 Tests grün
- [x] **Entscheidung Ablage: Tauri-Store-Plugin statt `localStorage` — und bewusst nicht
      SQLite.** `localStorage` liegt im WebView-Profil und ist damit weder sicherbar noch
      weitergebbar; für Export/Import (REQUIREMENTS §5) unbrauchbar. SQLite wurde geprüft und
      verworfen: Das Zugriffsmuster ist „alles laden, alles schreiben" auf wenigen Kilobytes,
      und sqlx als native Abhängigkeit wäre ein Risiko für den noch ausstehenden
      Android-Build. Jetzt eine lesbare JSON-Datei (`projects.json`) im App-Datenverzeichnis;
      Laden ist asynchron, Nutzereingaben vor dem Laden gewinnen. Begründung in
      REQUIREMENTS §4.4.1 und im [Plan](./plans/projektstruktur.md). 153 Tests grün,
      `cargo check` sauber
- [x] **Mehrsprachigkeit (DE/EN/ES/FR/HR)** — alle UI-Texte liegen in `src/app/i18n/`, die
      Sprache ist im Kopf der App umschaltbar und wird in `settings.json` gemerkt. Beim
      ersten Start gilt die Systemsprache, passt keine, Englisch.
- [x] **Entscheidung i18n: eigener Signal-Service statt Bibliothek** (REQUIREMENTS §4.6).
      Angular-Bordmittel (`$localize`) scheiden aus — ein Build pro Sprache lässt sich zur
      Laufzeit nicht umschalten. Gegenüber ngx-translate spart der eigene Service eine
      Abhängigkeit, die bei jedem Angular-Major nachziehen muss, und passt zur zoneless
      Change Detection. Deutsch ist die Referenzsprache: Der Schlüsseltyp leitet sich daraus
      ab, eine fehlende Übersetzung ist ein Compilerfehler.
- [x] **Zweite Ablagedatei `settings.json`** neben `projects.json` (REQUIREMENTS §4.4) — die
      Anlage wird einmal exportiert (§5), Einstellungen dieser Installation nicht.
- [x] **`DeviceError` trägt jetzt Codes statt fertiger Sätze**, damit eine schon sichtbare
      Fehlermeldung beim Sprachwechsel mitwandert. 175 Tests grün (22 mehr als zuvor,
      darunter der Nachweis, dass kein Wörterbuch einen Platzhalter der Referenzsprache
      verliert)

## 2026-08-13

- [x] **Eigenes Icon statt der Tauri-Default-Icons** — Power-Symbol in Emerald (`#2FC883`)
      auf dunklem Squircle, bewusst reduziert, damit es bei 16 px noch lesbar ist. Quelle ist
      `src/assets/icons/favicon.svg`; daraus generiert: Favicon (SVG, `favicon.ico` mit
      16–256 px, PNGs 16/32/48/64, Apple-Touch 180, 192/512) sowie alle App-Icons unter
      `src-tauri/icons/` inkl. Android-Mipmaps (`npx tauri icon`). iOS-Icons wurden entfernt,
      da außerhalb des Scope.
- [x] **`icon.ico` mit voller Größenstaffel** (`scripts/generate-ico.ps1`) — `tauri icon`
      legt nur 16/32/128/256 px hinein, die Taskleiste greift je nach Anzeigeskalierung aber
      zu 24/30/36/48 px und skaliert sichtbar unsauber herunter.
- [x] **Geräte werden im Projekt gespeichert; Discovery und Projekt sind getrennte Seiten**
      ([Plan](./plans/projekt-geraete.md), REQUIREMENTS §4.4.1/§4.5). Bisher überlebte nur
      die Zuordnung einen Neustart, die Geräte selbst kamen ausschließlich aus dem Scan —
      die Notfall-Anforderung aus §4.4 („Liste sofort anzeigen") war damit nicht erfüllt.
      Jetzt: `Project.devices` in `projects.json`, Aufnahme und Entfernen ausschließlich auf
      Klick, IP/Name/Kanäle ziehen beim Wiederfinden über die MAC nach. Die Projektseite
      rendert ohne Netz, der Ist-Zustand wandert im Hintergrund nach; die Discovery zeigt an
      jedem Fund, was das Projekt schon weiß. Die Spike-Oberfläche aus `app.component.html`
      ist damit abgelöst: `DiscoveryPageComponent`, `ProjectPageComponent`,
      `DeviceRowComponent` und `DeviceStateService` statt einer Komponente für alles.
      223 Tests grün (48 mehr als zuvor)
- [x] **Hersteller-Spalte in der Geräteliste** (REQUIREMENTS §4.5): Markenname und Bild je
      Zeile, Hersteller-ID an jedem gespeicherten Gerät. Produktfotos werden über
      `DEVICE_PHOTOS` (`devices/vendor.ts`) eingehängt; solange keines hinterlegt ist, zeigt
      die Liste ein selbst gezeichnetes Symbol zur Geräteart. **Entscheidung: keine
      Herstellerlogos und keine Produktfotos im Repository** — sie gehören ihren Herstellern
      und wären mit Apache-2.0 nicht vereinbar.
- [x] **Überschrift der nicht zugeordneten Gruppe übersetzt** — „Ohne Raum" / „Ohne
      Kategorie" standen als einzige Texte hartcodiert deutsch in `project.model.ts`
      (Verstoß gegen REQUIREMENTS §4.6); `groupEntities` bekommt sie jetzt von außen.

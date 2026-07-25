# Local Fleet Control — Anforderungsdokumentation

> Maßgebliche Spezifikation für dieses Repository. Bei Widersprüchen zu anderen
> Dokumenten (README, CLAUDE.md, TODOs) gilt dieses Dokument.
>
> Stand: 2026-07-25

## 1. Projektziel & Vision

Local Fleet Control ist eine **Notfall-Fernbedienung für das Smart Home**: Fällt Home Assistant
(oder eine andere Zentrale) aus, können Nutzer Geräte mit lokaler HTTP-API weiterhin direkt
steuern — ohne Cloud, ohne Account, ohne Zentrale.

- **Open Source** (Apache-2.0), sichtbar gebrandet mit „powered by HA Fleet Manager"
  (Link auf ha-fleet-manager.com).
- **Primäre Zielgruppe:** Smart-Home-Integratoren, die ihren Endkunden ein Fallback an die Hand
  geben wollen. Sekundär: die Home-Assistant-Community.
- **Strategischer Zweck:** Marketing-/Vertrauenskanal für HA Fleet Manager (Ausfallsicherheit ist
  das Kernversprechen der Hauptmarke).
- Bewusst klein gehalten: eine Geräteliste mit Schaltflächen, kein Dashboard-Ersatz, keine
  Automatisierungen.

## 2. Zielgruppen & Rollen

| Rolle | Nutzung |
|---|---|
| Integrator | Richtet das Tool beim Kunden ein, übergibt es als Notfall-Lösung (Phase 2: fertige Konfiguration per Export/Import) |
| Endkunde | Öffnet die App im Notfall, sieht seine Geräte, schaltet |
| HA-Community | Nutzt das Tool eigenständig, meldet Issues (= Feedback- und Lead-Kanal) |

Es gibt **keine Benutzerkonten, kein Backend, keine Cloud**. Die App arbeitet ausschließlich im
lokalen Netzwerk.

## 3. Architektur & Tech-Stack

**Eine Codebasis, mehrere Build-Targets** — keine getrennten App-Ordner pro Plattform.

- **Framework:** Tauri 2 (Desktop + Mobile aus einem Projekt)
- **Frontend:** Angular (aktuelle stabile Major-Version), TypeScript, Standalone Components,
  Signals
- **Change Detection: zoneless** (`provideZonelessChangeDetection()`, seit Angular 20 stabil).
  Zone.js ist entfernt. Konsequenz für die Entwicklung: **Zustand, der die Ansicht beeinflusst,
  gehört in Signals** — Werte in gewöhnlichen Feldern lösen kein Rendering aus.
- **Nativer Kern:** Rust nur wo zwingend nötig (voraussichtlich: Ermittlung der lokalen
  IP/Subnetzmaske für den Scan). Alle Geräte-HTTP-Aufrufe laufen über das
  **Tauri-HTTP-Plugin** (`@tauri-apps/plugin-http`) aus TypeScript — das umgeht CORS, ein eigener
  Rust-HTTP-Stack ist nicht nötig.
- **Projektstruktur (Tauri-Standard):** `src/` (Angular), `src-tauri/` (Rust/Config);
  Plattform-Artefakte entstehen beim Build.
- **Build-Targets MVP:** Windows (.msi/.exe), Android (.apk). **iOS ist Phase 2** (erfordert
  Apple-Developer-Account, 99 $/Jahr — bewusst verschoben, keine Kosten im MVP).

### 3.1 Tests

**Vitest über den offiziellen Angular-Builder `@angular/build:unit-test`** (`npm test`).

Begründung: Karma ist von Angular abgekündigt und damit für ein langlebiges Projekt keine
Option. Der `unit-test`-Builder ist der Weg, den das Angular-Team eingeschlagen hat; die
Konfiguration liegt in `angular.json` und wird von `ng update` mitgeführt, statt in einer
separaten Framework-Konfiguration zu verrotten. Gegenüber Vitest-direkt (z. B. via AnalogJS)
spart das eine Drittanbieter-Abhängigkeit im Testpfad.

Der Builder ist derzeit als **EXPERIMENTAL** markiert und gibt bei jedem Lauf einen
entsprechenden Hinweis aus. Betroffen sind die Builder-Optionen, nicht die Testdateien selbst —
die Migrationskosten bei einer Änderung bleiben gering.

**Wichtige Einschränkung (nachgemessen):** `vi.mock()` auf Modulpfade **greift nicht**, weil der
Builder die Spec-Dateien vorab mit esbuild bündelt und Vitests Modul-Interception damit ins
Leere läuft. Native Zugriffe (Tauri-APIs) gehören deshalb hinter injizierbare Services — siehe
`PlatformService` und `DiscoveryService` —, die im Test per DI ersetzt werden. Das ist ohnehin
die robustere Grenze zwischen Angular und der Tauri-Brücke.

### 3.2 Plattform-Besonderheiten (früh einplanen)

- **Android:** Shellys sprechen HTTP (kein TLS). Cleartext-Traffic ins LAN muss per
  `networkSecurityConfig` explizit erlaubt werden, sonst schlagen alle Requests fehl.
- **Tauri-Konfig:** HTTP-Plugin-Scope muss `http://**` (lokale IPs) zulassen; CSP entsprechend
  setzen.
- **Windows:** Binary ist im MVP unsigniert → SmartScreen-Warnung. In README/Download-Seite
  erklären. Code-Signing/winget später prüfen.

## 4. Funktionsumfang MVP

### 4.1 Geräte-Discovery

- **Subnetz-Sweep** eines /24-Netzes: `GET http://<ip>/shelly` auf alle Adressen, kurzer
  Timeout (~300 ms), parallelisiert. Der Endpunkt antwortet bei allen Shelly-Generationen
  **ohne Auth** und identifiziert das Gerät.
- **Der Scan-Bereich ist frei wählbar** (CIDR), die lokalen Netze des Rechners sind nur
  Vorschläge. Grund: Welchen Weg eine Anfrage nimmt, entscheidet die Routing-Tabelle des
  Betriebssystems — die App bindet keine Sockets an ein Interface. Damit sind auch Netze
  erreichbar, in denen der Rechner selbst keine Adresse hat (VPN, Tailscale-Subnet-Router).
  Grenzen: höchstens 1024 Adressen pro Scan und **nur private Adressräume** (RFC 1918 sowie
  100.64/10 für CGNAT/Tailscale) — siehe §8.
- Timeout und Parallelität hängen von der Strecke ab: im eigenen Netz 300 ms / 32 parallel,
  über eine Route (VPN-Tunnel, Subnet-Router) 1000 ms / 16 parallel, weil ein Round-Trip
  durch einen Tunnel deutlich länger dauert.
- Generationserkennung über die Antwort: Gen1 liefert `type`, Gen2/3 liefert `gen` + `model`;
  Feld `auth`/`auth_en` zeigt Passwortschutz an.
- **Kein mDNS im MVP** (spart iOS-Multicast-Entitlement und Sonderfälle; Phase 2).
- Scan ist ausschließlich lesend; Aktionen nur auf expliziten Nutzerklick.

### 4.2 Unterstützte Geräte & Aktionen (Shelly, Gen1 + Gen2/3)

| Gerätetyp | Aktionen | Gen1-API | Gen2/3-API (RPC) |
|---|---|---|---|
| Relais/Schalter | Ein/Aus/Toggle | `/relay/0?turn=on\|off\|toggle` | `/rpc/Switch.Set?id=0&on=true\|false` |
| Licht/Dimmer | Ein/Aus + Helligkeit | `/light/0?turn=on&brightness=NN` | `/rpc/Light.Set?id=0&on=true&brightness=NN` |
| Rollladen | Öffnen/Schließen/Stopp | `/roller/0?go=open\|close\|stop` | `/rpc/Cover.Open\|Close\|Stop?id=0` |

- Mehrkanal-Geräte (z. B. Shelly 2PM): jeder Kanal als eigener Listeneintrag.
- Ist-Zustand (an/aus, Position) nach Aktion bzw. beim Laden abfragen (`/status` bzw.
  `/rpc/Shelly.GetStatus`) und anzeigen.
- Unbekannte/nicht unterstützte Shelly-Typen erscheinen in der Liste als „erkannt, nicht
  steuerbar" (mit Typ-Info) — wichtig für Issue-Feedback.

### 4.3 Geräte-Auth

- Passwortgeschützte Geräte werden im MVP voll unterstützt:
  **Gen1 = HTTP Basic Auth, Gen2/3 = Digest Auth (SHA-256)**.
- Credentials pro Gerät eingebbar; geschützte Geräte ohne hinterlegte Credentials erscheinen als
  „gesperrt" mit Eingabemöglichkeit.

### 4.4 Persistenz (lokal auf dem Gerät)

- Gespeichert werden: Geräteliste (IP, Typ, Generation, Kanäle), **eigene Anzeigenamen**
  (Default: Gerätename aus der Shelly-Konfig, sonst IP) und **Geräte-Credentials**.
- **Schlüssel ist immer die MAC-Adresse**, bei Mehrkanalgeräten `MAC:Kanal`. Sie ist der
  einzige stabile Bezeichner: IP wechselt per DHCP, der Gerätename ist frei änderbar. Gen2/3
  liefern zusätzlich ein `id`-Feld — das ist die MAC mit Modellpräfix und fehlt bei Gen1.
- Credentials so sicher wie plattformüblich möglich ablegen (Tauri Stronghold-Plugin oder
  OS-Keystore; Entscheidung dokumentieren).
- Beim App-Start wird die gespeicherte Liste **sofort** angezeigt (Notfall-Anforderung: keine
  Wartezeit), Erreichbarkeit wird im Hintergrund geprüft; Neu-Scan auf Knopfdruck.

#### 4.4.1 Projektstruktur

**Nachträglich in den MVP aufgenommen** (zuvor kannte §4.4 nur eigene Anzeigenamen). Eine
Anlage mit 20 Geräten ist als flache Liste unbrauchbar; Räume und Kategorien machen sie
bedienbar. Detailplan: [docs/plans/projektstruktur.md](./plans/projektstruktur.md).

- Ein **Projekt** bündelt Kategorien, Räume und die Zuordnung der Entitäten. Mehrere Projekte
  sind möglich, eines ist aktiv. Ein Projekt ist zugleich die Einheit, die das geplante
  Export/Import-Feature (§5) transportieren wird — ein Integrator betreut mehrere Kunden.
- **Kategorien und Räume legt der Nutzer selbst an**, sie sind nicht vorgegeben. Sie sind
  damit Nutzerdaten und bleiben — wie Gerätenamen — von der i18n (§4.6) unberührt.
- Zugeordnet wird die **Entität** (`MAC:Kanal`), nicht das Gerät: Ein Shelly 2PM kann
  Kanal 0 im Flur und Kanal 1 im Bad haben.
- Die Geräteliste zerfällt in Abschnitte mit Überschrift, **umschaltbar nach Raum oder
  Kategorie** — im Notfall sucht man nach Raum, beim Einrichten nach Kategorie. Ohne aktives
  Projekt bleibt die Liste flach.
- Wird eine Kategorie oder ein Raum gelöscht, werden alle Zuordnungen darauf zurückgesetzt.
- **Ablage: JSON-Datei im App-Datenverzeichnis** über das Tauri-Store-Plugin
  (`projects.json`), gekapselt in `core/storage.service.ts`. Bewusst **nicht** SQLite: Das
  Zugriffsmuster ist „alles laden, alles schreiben" auf wenigen Kilobytes — es gibt keine
  Abfragen, keine Teilmengen. Eine relationale DB brächte sqlx als native Abhängigkeit
  (Risiko für den noch ausstehenden Android-Build, §3.2) und Schema-Migrationen, ohne ein
  Problem zu lösen, das wir haben. Erst mit Historie oder Messwerten — beides durch §1
  ausgeschlossen — wäre die Rechnung eine andere.
- **Die Datei ist Klartext.** Geräte-Credentials (§4.3) gehören deshalb *nicht* hinein,
  sondern in den separaten sicheren Speicher (§9).

### 4.5 UI

- Eine Hauptansicht: Geräteliste mit Name, Typ-Icon, Status, Aktions-Buttons; Suchfeld/Filter.
- Umbenennen und Credentials-Eingabe pro Gerät; Einstellungen (Sprache, Update-Check,
  Scan-Bereich falls das Subnetz abweicht).
- Footer/Info-Bereich: „powered by HA Fleet Manager" + Link, Versionsnummer, Lizenzhinweis.
- Farbwelt an die Marke anlehnen (Emerald `#2FC883` als Akzent), hell/dunkel nach System.
- Responsive: dieselbe Angular-UI läuft auf Desktop-Fenster und Smartphone.

### 4.6 Mehrsprachigkeit

- **5 Sprachen ab MVP: DE, EN, ES, FR, HR** (konsistent zum Hauptprodukt). Keine hartcodierten
  UI-Texte; i18n von Anfang an (ngx-translate oder Angular-Bordmittel — früh entscheiden und
  dokumentieren).

### 4.7 Update-Check

- Da Verteilung ohne Store: App prüft beim Start die GitHub-Releases-API und zeigt bei neuer
  Version einen dezenten Hinweis mit Download-Link. **Kein Auto-Update, keine Telemetrie** — der
  Versions-Check ist der einzige Internet-Zugriff der App und wird in der README transparent
  erklärt.

## 5. Nicht im MVP (Phase 2+)

- iOS-Build (wenn Apple-Account vorhanden; Tauri-Codebasis dafür kompatibel halten)
- mDNS-Discovery (ergänzend zum Sweep)
- **Export/Import der Konfiguration** (Integrator richtet ein, übergibt Datei an Endkunden) —
  als erstes Folge-Feature eingeplant
- Weitere Hersteller: Tasmota, WLED, ggf. Hue-Bridge
- Windows Code-Signing / winget / Microsoft Store
- Weitere Sprachen

## 6. Lizenz, Marke, Contribution-Modell

- **Lizenz: Apache-2.0** (explizite Markenklausel).
- `TRADEMARK.md`: Code frei, Name/Logo „Local Fleet Control" und „HA Fleet Manager" nicht —
  Forks müssen umbenennen.
- `CONTRIBUTING.md`: Issues ausdrücklich willkommen (Feedback-/Lead-Kanal); PRs möglich, aber
  ohne Garantie auf Annahme. Positionierung: „Open Source, maintained by HA Fleet Manager".
  Kein Community-Aufbau als Ziel; Ein-Maintainer-Modell ist der Normalfall.
- README: Screenshot, Notfall-Szenario erklärt, Download-Links, SmartScreen-/Sideload-Hinweise,
  „powered by"-Abschnitt.

## 7. Distribution & CI

- **GitHub Releases** als einziger Verteilkanal: GitHub Actions baut pro Tag/Release
  Windows-Installer und Android-APK (signiert mit eigenem Keystore; Keystore-Handling
  dokumentieren) und hängt sie ans Release.
- **Landingpage** auf ha-fleet-manager.com (Tool-Seite, SEO, verlinkt auf Releases) — wird im
  **Hauptrepo** umgesetzt, nicht hier; hier nur stabiler Link-Slug festlegen.

## 8. Sicherheit & Privacy

- Keine Telemetrie, keine Cloud-Aufrufe außer dem Update-Check (abschaltbar wäre nice-to-have).
- Netzwerk-Scan nur in **privaten Adressräumen**, rein lesend. Der Bereich ist frei wählbar
  (§4.1), aber auf 10/8, 172.16/12, 192.168/16 und 100.64/10 begrenzt — öffentliche Adressen
  lassen sich nicht scannen, damit die App nicht als Portscanner fürs Internet taugt.
- Credentials niemals loggen; sichere Ablage siehe 4.4.
- Keine Fremd-Endpunkte: Die App spricht ausschließlich Geräte-IPs in privaten Netzen und
  api.github.com an.

## 9. Offene Entscheidungen (im Projekt klären und hier nachtragen)

- i18n-Bibliothek (ngx-translate vs. Angular-Bordmittel)
- Credentials-Speicher konkret (Stronghold vs. OS-Keystore pro Plattform)
- Android-Keystore-Erzeugung und -Aufbewahrung
- Mindest-Android-Version / Windows-Version
- Name des GitHub-Release-Workflows und Versionsschema (empfohlen: SemVer, Tags `v0.x.y`)

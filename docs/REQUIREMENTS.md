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
- **Nativer Kern:** Rust nur wo zwingend nötig (voraussichtlich: Ermittlung der lokalen
  IP/Subnetzmaske für den Scan). Alle Geräte-HTTP-Aufrufe laufen über das
  **Tauri-HTTP-Plugin** (`@tauri-apps/plugin-http`) aus TypeScript — das umgeht CORS, ein eigener
  Rust-HTTP-Stack ist nicht nötig.
- **Projektstruktur (Tauri-Standard):** `src/` (Angular), `src-tauri/` (Rust/Config);
  Plattform-Artefakte entstehen beim Build.
- **Build-Targets MVP:** Windows (.msi/.exe), Android (.apk). **iOS ist Phase 2** (erfordert
  Apple-Developer-Account, 99 $/Jahr — bewusst verschoben, keine Kosten im MVP).

### 3.1 Plattform-Besonderheiten (früh einplanen)

- **Android:** Shellys sprechen HTTP (kein TLS). Cleartext-Traffic ins LAN muss per
  `networkSecurityConfig` explizit erlaubt werden, sonst schlagen alle Requests fehl.
- **Tauri-Konfig:** HTTP-Plugin-Scope muss `http://**` (lokale IPs) zulassen; CSP entsprechend
  setzen.
- **Windows:** Binary ist im MVP unsigniert → SmartScreen-Warnung. In README/Download-Seite
  erklären. Code-Signing/winget später prüfen.

## 4. Funktionsumfang MVP

### 4.1 Geräte-Discovery

- **Subnetz-Sweep** des lokalen /24-Netzes: `GET http://<ip>/shelly` auf alle Adressen, kurzer
  Timeout (~300 ms), parallelisiert. Der Endpunkt antwortet bei allen Shelly-Generationen
  **ohne Auth** und identifiziert das Gerät.
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
- Credentials so sicher wie plattformüblich möglich ablegen (Tauri Stronghold-Plugin oder
  OS-Keystore; Entscheidung dokumentieren).
- Beim App-Start wird die gespeicherte Liste **sofort** angezeigt (Notfall-Anforderung: keine
  Wartezeit), Erreichbarkeit wird im Hintergrund geprüft; Neu-Scan auf Knopfdruck.

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
- Netzwerk-Scan nur im lokalen Subnetz, rein lesend.
- Credentials niemals loggen; sichere Ablage siehe 4.4.
- Keine Fremd-Endpunkte: Die App spricht ausschließlich Geräte-IPs im LAN und api.github.com an.

## 9. Offene Entscheidungen (im Projekt klären und hier nachtragen)

- i18n-Bibliothek (ngx-translate vs. Angular-Bordmittel)
- Credentials-Speicher konkret (Stronghold vs. OS-Keystore pro Plattform)
- Android-Keystore-Erzeugung und -Aufbewahrung
- Mindest-Android-Version / Windows-Version
- Name des GitHub-Release-Workflows und Versionsschema (empfohlen: SemVer, Tags `v0.x.y`)

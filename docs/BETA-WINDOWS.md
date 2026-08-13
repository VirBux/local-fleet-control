# Local Fleet Control 0.1.0 — Beta für Windows

> **Zweck dieses Dokuments:** Übergabe an die Redaktion/den Agenten im Repository
> `ha-fleet-manager`, damit dort eine **Beta-Version** dieser App veröffentlicht werden kann
> (Download-Seite und/oder GitHub-Release). Es beschreibt, was die App in diesem Stand kann,
> was sie *noch nicht* kann, und was Windows dafür mitbringen muss.
>
> Stand: 2026-08-13 · Version 0.1.0 · Quelle der Wahrheit für den Funktionsumfang:
> [docs/REQUIREMENTS.md](./REQUIREMENTS.md)

---

## 1. Was die App ist

**Local Fleet Control ist eine Notfall-Fernbedienung für Smart-Home-Geräte.** Fällt Home
Assistant aus — Update schiefgelaufen, SD-Karte defekt, Server bootet neu —, spricht die App
die Geräte **direkt über deren lokale HTTP-API** an. Ohne Cloud, ohne Konto, ohne Zentrale,
ohne Internet.

Sie ist bewusst klein: eine Geräteliste mit Knöpfen. Kein Dashboard-Ersatz, keine
Automatisierungen, keine Szenen, keine Historie.

- **Zielgruppe:** primär Smart-Home-Integratoren, die ihren Kunden ein Fallback mitgeben;
  sekundär die Home-Assistant-Community.
- **Unterstützte Geräte:** Shelly, Generation 1 sowie 2/3 (weitere Hersteller später).
- **Lizenz:** Apache-2.0. Der Code ist frei, **Name und Logo sind es nicht** — siehe
  [TRADEMARK.md](../TRADEMARK.md).
- **Branding-Pflicht:** Die App trägt in der Fußzeile „powered by HA Fleet Manager" mit Link
  auf ha-fleet-manager.com. Diese Zeile bleibt in jeder Sprache unübersetzt und muss auch in
  der Kommunikation mitlaufen.

## 2. Funktionsumfang dieser Beta

### 2.1 Das funktioniert

| Funktion | Details |
|---|---|
| **Netzwerk-Scan** | Sweep über einen frei wählbaren CIDR-Bereich (`GET /shelly` auf jede Adresse). Die lokalen Netze des Rechners werden als Vorschlag angeboten, sind aber nicht bindend — auch Netze hinter VPN/Tailscale sind scannbar, sofern eine Route existiert. Grenzen: nur private Adressräume (10/8, 172.16/12, 192.168/16, 100.64/10), höchstens 1024 Adressen pro Scan. |
| **Geräteerkennung** | Generation, Modell, MAC und Passwortschutz werden aus der Antwort ausgelesen. |
| **Projekt-Verwaltung** | Mehrere Projekte (= Anlagen/Kunden), eines davon aktiv. Geräte werden **auf Klick** ins Projekt aufgenommen und bleiben dauerhaft gespeichert. |
| **Räume & Kategorien** | Frei anlegbar, pro Kanal zuordenbar (ein 2-Kanal-Gerät kann Kanal 1 im Flur und Kanal 2 im Bad haben). Die Liste lässt sich nach Raum oder Kategorie gruppieren. |
| **Eigene Namen** | Pro Kanal ein eigener Anzeigename; ohne Eingabe gilt der Name aus der Shelly-Konfiguration. |
| **Schalten (Relais)** | Ein / Aus / Umschalten für Relais- und Steckdosen-Kanäle, Gen1 und Gen2/3. Der angezeigte Zustand wird immer beim Gerät nachgefragt, nie geraten. |
| **Mehrsprachigkeit** | Deutsch, English, Español, Français, Hrvatski — zur Laufzeit umschaltbar, die Wahl wird gemerkt. Beim ersten Start gilt die Systemsprache, sonst Englisch. |
| **Persistenz** | Projekte und Sprache überleben den Neustart (Ablage siehe §4). |

### 2.2 Das ist noch **nicht** gebaut (wichtig für die Ankündigung)

Diese Punkte stehen in der Spezifikation, sind in 0.1.0 aber **nicht** enthalten. Sie dürfen
auf der Download-Seite nicht als vorhandene Funktion beschrieben werden:

- **Licht/Dimmer und Rollläden schalten.** Solche Geräte werden gefunden und angezeigt, aber
  mit dem Hinweis „Erkannt, nicht steuerbar (light / cover / roller)". Nur Relais-Kanäle
  haben Schaltflächen.
- **Anmeldung an passwortgeschützten Geräten.** Sie erscheinen als „Passwortgeschützt" bzw.
  laufen in „Passwortgeschützt — Anmeldung ist noch nicht gebaut". Es gibt keine
  Eingabemöglichkeit für Gerätezugangsdaten.
- **Update-Hinweis.** Die geplante Prüfung gegen die GitHub-Releases-API ist nicht
  implementiert. **Diese Beta stellt damit überhaupt keine Internet-Verbindung her** (siehe
  §5).
- **Einstellungsansicht.** Die Sprachwahl sitzt behelfsweise im Kopf der App; einen
  Einstellungsdialog gibt es nicht.
- **Suchfeld/Filter** über die Geräteliste.
- **Export/Import einer fertigen Konfiguration** an den Endkunden (erstes Folge-Feature).
- **Android- und iOS-Build.** Diese Beta ist ausschließlich Windows.

### 2.3 Reifegrad

Die Logik (Scan-Auswertung, Statusparser, Projektmodell, Übersetzungen) ist durch
automatisierte Tests abgedeckt. Am echten Aufbau bestätigt sind bisher: Start der App,
Sprachumschaltung inklusive Persistenz und der Scan im eigenen Netz (Shelly Gen2 und Gen3
gefunden). **Nicht** am echten Gerät gegengetestet sind bisher das Schalten, der Scan über
einen VPN-Subnet-Router und die Ablage der Projektdatei. Es ist eine Beta — bitte auch so
ankündigen und Rückmeldungen über GitHub-Issues erbitten.

## 3. Systemanforderungen (Windows)

| Anforderung | Wert |
|---|---|
| Betriebssystem | Windows 10 ab Version 1803 (64 Bit) oder Windows 11. Entwickelt und geprüft unter Windows 11. |
| Architektur | x64. Kein ARM64-Build, keine 32-Bit-Version. |
| **WebView2-Runtime** | **Voraussetzung, wird nicht mitgeliefert.** Auf Windows 11 und gepflegtem Windows 10 ist sie vorhanden. Fehlt sie, startet die App nicht — dann den „Evergreen Standalone Installer" von Microsoft nachinstallieren: <https://developer.microsoft.com/microsoft-edge/webview2/> |
| Rechte | Keine Administratorrechte nötig. Es wird nichts in die Registry geschrieben, nichts installiert. |
| Netzwerk | Der Rechner muss die Geräte per HTTP erreichen können — im selben LAN/WLAN oder über eine Route (VPN, Tailscale-Subnet-Router). Beim ersten Scan fragt die Windows-Firewall ggf. nach; ausgehende Verbindungen genügen, es wird kein Port geöffnet. |
| Speicherplatz | 14,8 MB für die Datei, dazu wenige Kilobyte Konfiguration in `%APPDATA%`. |
| Sonstiges | .NET, Java oder eine Runtime werden **nicht** benötigt. |

## 4. Auslieferung, Start und Ablage

- **Eine einzige portable Datei, kein Installer.** Bewusste Entscheidung: Wer im Notfall vor
  einer dunklen Wohnung steht, soll keinen Setup-Assistenten durchklicken. Herunterladen,
  Doppelklick, fertig. Die Datei lässt sich auf einem USB-Stick oder Notebook vorhalten.
- **Dateiname des Release-Artefakts:** `LocalFleetControl-0.1.0.exe` (Versionsnummer am Ende,
  ohne weitere Suffixe). Gilt für GitHub-Releases und für die auf ha-fleet-manager.com
  hinterlegte Kopie gleichermaßen.
- **SmartScreen-Warnung:** Die Datei ist **nicht signiert**. Windows zeigt beim ersten Start
  „Der Computer wurde durch Windows geschützt". Über *Weitere Informationen → Trotzdem
  ausführen* bestätigen. Das gehört prominent auf die Download-Seite, sonst brechen Nutzer
  hier ab. Ein Code-Signing-Zertifikat kostet laufend Geld und ist für dieses kostenlose Tool
  vorerst nicht vorgesehen.
- **Kein Startmenü-Eintrag, kein Deinstallations-Eintrag.** Löschen der Datei entfernt die
  Anwendung.
- **Konfiguration liegt in `%APPDATA%\com.hafleetmanager.localfleetcontrol\`**
  (`projects.json` für die Anlage, `settings.json` für die Sprache) — **nicht** neben der
  .exe. Auf einem fremden Rechner startet die App deshalb ohne Geräteliste, und ein
  vergessener USB-Stick verrät keine Kunden-IPs. In der Kommunikation deshalb bitte **„ohne
  Installation"** schreiben, nicht „portabel im Stick-Sinn".
- **Kein Auto-Update.** Aktualisieren heißt: neue Datei herunterladen, alte ersetzen. Die
  Konfiguration in `%APPDATA%` bleibt dabei erhalten.

## 5. Datenschutz und Netzwerkverhalten

Für die Download-Seite belastbar zusicherbar:

- **Keine Telemetrie, kein Konto, kein Backend.**
- **Diese Beta ruft keinerlei Internet-Adresse auf.** Der geplante Versions-Check gegen
  `api.github.com` (§2.2) ist noch nicht gebaut; ausgehende Verbindungen gehen ausschließlich
  an Geräte-IPs im privaten Netz. Einzige Ausnahme: Ein Klick auf „powered by HA Fleet
  Manager" öffnet ha-fleet-manager.com im Systembrowser.
- **Der Scan ist rein lesend**, geschaltet wird nur auf ausdrücklichen Klick.
- **Nur private Adressbereiche sind scannbar** (10.x, 172.16–31.x, 192.168.x, 100.64–127.x).
  Öffentliche Adressen lehnt die App ab — sie taugt nicht als Portscanner fürs Internet.
- Alle Daten bleiben lokal auf dem Rechner des Nutzers.

## 6. Angaben fürs Release

| Feld | Wert |
|---|---|
| Produktname | Local Fleet Control |
| Version | 0.1.0 (Beta) |
| Plattform | Windows x64, portable .exe |
| Artefakt | `LocalFleetControl-0.1.0.exe` |
| Dateigröße | 15.482.368 Byte (14,8 MB) |
| SHA-256 | `dafb0f77d14030a5a223fcd7b472580dd7945e0978b41b3d313e4fa87c3d1756` |
| Build | `npm run tauri build` (Tauri 2, Release-Profil), erzeugt am 2026-08-14 unter Windows 11 x64. Ohne Bundler — es entsteht nur die freistehende .exe, kein MSI und kein NSIS-Setup. Die Datei wurde nach dem Build gestartet: Das Fenster öffnet sich vollständig formatiert. |
| Lizenz | Apache-2.0 |
| Quellcode | GitHub-Repository `local-fleet-control` |
| Feedback | GitHub-Issues — ausdrücklich erwünscht, besonders zu Geräten, die nicht erkannt oder nicht gesteuert werden |
| Positionierung | Open-Source-Teilprojekt von HA Fleet Manager, „powered by HA Fleet Manager" |

## 7. Textbausteine für die Download-Seite

**Kurzbeschreibung (DE):**

> Wenn Home Assistant ausfällt, ist erst mal nichts mehr schaltbar. Local Fleet Control
> spricht deine Shelly-Geräte direkt über ihre lokale HTTP-API an — ohne Cloud, ohne Konto,
> ohne Zentrale. Eine Datei, Doppelklick, Geräteliste mit Knöpfen. Mehr will es nicht sein.

**Kurzbeschreibung (EN):**

> When Home Assistant is down, nothing switches any more. Local Fleet Control talks to your
> Shelly devices directly over their local HTTP API — no cloud, no account, no hub. One file,
> double-click, a list of devices with buttons. It doesn't try to be more than that.

**Pflichthinweise auf der Seite:**

1. Beta — Funktionsumfang laut §2, Rückmeldungen willkommen.
2. Nur Shelly (Gen1 und Gen2/3); Licht, Dimmer, Rollläden und passwortgeschützte Geräte
   werden angezeigt, aber noch nicht geschaltet.
3. Windows 10 (1803+) / 11, 64 Bit, WebView2-Runtime erforderlich.
4. Unsigniert — SmartScreen-Warnung ist zu erwarten und zu bestätigen.
5. Keine Installation, kein Auto-Update; Aktualisierung durch Ersetzen der Datei.

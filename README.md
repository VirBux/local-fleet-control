# Local Fleet Control

**Notfall-Fernbedienung für dein Smart Home.** Wenn Home Assistant ausfällt, steuerst du deine
Geräte damit weiterhin direkt — ohne Cloud, ohne Account, ohne Zentrale.

> ⚠️ **Status: Beta.** Die erste Windows-Version steht unter
> [Releases](https://github.com/VirBux/local-fleet-control/releases) bereit. Was sie heute kann
> und was noch fehlt, steht in [docs/BETA-WINDOWS.md](./docs/BETA-WINDOWS.md).

*powered by [HA Fleet Manager](https://ha-fleet-manager.com)*

---

## Das Problem

Deine Beleuchtung, deine Rollläden, deine Steckdosen hängen an Home Assistant. Fällt die Zentrale
aus — Update schiefgelaufen, SD-Karte defekt, Server neu am Booten — ist erst mal nichts mehr
schaltbar. Genau dafür ist dieses Tool da.

Local Fleet Control spricht die Geräte **direkt über ihre lokale HTTP-API** an. Es braucht dazu
weder Home Assistant noch Internet: nur dich und die Geräte im selben WLAN.

## Was es tut

- **Findet Geräte im lokalen Netz** per Subnetz-Scan (kein Konfigurationsaufwand). Der
  Scan-Bereich lässt sich frei angeben — auch Netze, die nur über VPN erreichbar sind.
- **Zeigt eine schlichte Geräteliste** mit Status und Schaltflächen — mehr nicht.
- **Schaltet** Relais und Steckdosen.
- **Sortiert die Anlage** nach Räumen und Kategorien, mit eigenen Namen pro Kanal.
- **Funktioniert offline.** Kein Konto, kein Backend, keine Telemetrie.
- **Spricht fünf Sprachen** (DE/EN/ES/FR/HR), umschaltbar im laufenden Betrieb.

Unterstützt werden derzeit **Shelly-Geräte** (Gen1 sowie Gen2/3).

### Noch in Arbeit

Diese Punkte sind fest eingeplant, in der Beta aber noch nicht enthalten:

- **Licht, Dimmer und Rollläden schalten** — solche Geräte werden bereits gefunden und
  angezeigt, bislang aber als „erkannt, nicht steuerbar".
- **Passwortgeschützte Geräte** (Gen1 Basic Auth, Gen2/3 Digest) — sie erscheinen als
  gesperrt, eine Anmeldung gibt es noch nicht.
- **Versions-Hinweis** beim Start, siehe [Datenschutz](#datenschutz).
- **Export/Import einer fertigen Konfiguration**, damit ein Integrator die eingerichtete
  Anlage an den Endkunden übergeben kann.
- **Weitere Hersteller** (Tasmota, WLED) und **mDNS** ergänzend zum Scan.

Der vollständige Plan steht in [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md), der aktuelle
Stand in [docs/TODO_OPEN.md](./docs/TODO_OPEN.md).

## Was es bewusst *nicht* tut

Das hier ist **kein Ersatz für Home Assistant**. Keine Automatisierungen, keine Szenen, keine
Dashboards, keine Historie. Eine Liste mit Knöpfen für den Notfall — absichtlich klein und
langweilig, damit es funktioniert, wenn es drauf ankommt.

## Plattformen

| Plattform | Status |
|---|---|
| Windows (portable .exe) | Beta verfügbar |
| Android (.apk) | in Arbeit |
| iOS | später |

## Installation

Die Downloads liegen unter [Releases](https://github.com/VirBux/local-fleet-control/releases).

**Windows:** Es gibt bewusst **keinen Installer** — eine Datei, Doppelklick, fertig. Wer im
Notfall vor einer dunklen Wohnung steht, soll keinen Setup-Assistenten durchklicken. Die Datei
lässt sich auf einem USB-Stick vorhalten; die Konfiguration bleibt in `%APPDATA%`, nicht neben
der .exe. Vorausgesetzt wird die **WebView2-Runtime** — auf Windows 11 und gepflegtem Windows 10
ist sie vorhanden, sonst
[hier nachinstallieren](https://developer.microsoft.com/microsoft-edge/webview2/). Ein
Auto-Update gibt es nicht: neue Datei laden, alte ersetzen.

Die Datei ist vorerst **nicht signiert**. Windows SmartScreen zeigt deshalb eine Warnung („Der
Computer wurde durch Windows geschützt"). Über *Weitere Informationen → Trotzdem ausführen* lässt
sie sich bestätigen. Ein Code-Signing-Zertifikat kostet laufend Geld und ist für dieses
kostenlose Tool vorerst nicht vorgesehen.

**Hinweis Android:** Die APK wird außerhalb des Play Store verteilt und muss per Sideload
installiert werden („Installation aus unbekannten Quellen").

## Datenschutz

Die App sendet **keine Telemetrie**. Die Beta stellt derzeit überhaupt keine Internet-Verbindung
her; geplant ist als einziger Internet-Zugriff ein Versions-Check gegen `api.github.com` beim
Start, der auf ein verfügbares Update hinweist. Ein Auto-Update wird es auch dann nicht geben.
Alles Übrige — Scan und Schaltbefehle — bleibt im privaten Netz: Scannbar sind ausschließlich
private Adressbereiche (10.x, 172.16–31.x, 192.168.x, 100.64–127.x), öffentliche Adressen lehnt
die App ab. Der Netzwerk-Scan ist rein lesend; geschaltet wird nur auf ausdrücklichen Klick.

Geräte-Zugangsdaten werden ausschließlich lokal auf deinem Gerät gespeichert.

## Für Integratoren

Gedacht als Fallback, das du deinen Kunden mitgeben kannst: einmal einrichten, erklären, fertig.
Wenn die Zentrale ausfällt, hat der Kunde weiterhin Zugriff auf seine Geräte — und ruft nicht
sofort bei dir an.

## Mitwirken

Issues sind ausdrücklich willkommen, insbesondere zu Geräten, die nicht erkannt oder nicht
gesteuert werden. Details in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Entwicklung

Voraussetzungen: [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/) und die
[Tauri-Prerequisites](https://tauri.app/start/prerequisites/) für die jeweilige Plattform
(unter Windows: Visual Studio Build Tools mit C++-Workload).

```bash
npm install
npm run tauri dev
```

Die maßgebliche Spezifikation liegt in [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md).

## Lizenz

[Apache-2.0](./LICENSE). Name und Logo sind davon ausgenommen — siehe
[TRADEMARK.md](./TRADEMARK.md).

# Local Fleet Control

**Notfall-Fernbedienung für dein Smart Home.** Wenn Home Assistant ausfällt, steuerst du deine
Geräte damit weiterhin direkt — ohne Cloud, ohne Account, ohne Zentrale.

> ⚠️ **Status: in Entwicklung.** Noch kein Release verfügbar.

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
- **Schaltet** Relais/Steckdosen, Licht und Dimmer, Rollläden.
- **Funktioniert offline.** Kein Konto, kein Backend, keine Telemetrie.

Unterstützt werden derzeit **Shelly-Geräte** (Gen1 sowie Gen2/3), inklusive passwortgeschützter
Geräte.

## Was es bewusst *nicht* tut

Das hier ist **kein Ersatz für Home Assistant**. Keine Automatisierungen, keine Szenen, keine
Dashboards, keine Historie. Eine Liste mit Knöpfen für den Notfall — absichtlich klein und
langweilig, damit es funktioniert, wenn es drauf ankommt.

## Plattformen

| Plattform | Status |
|---|---|
| Windows (.msi/.exe) | geplant fürs erste Release |
| Android (.apk) | geplant fürs erste Release |
| iOS | später |

## Installation

Sobald es ein Release gibt, erscheinen die Downloads unter **Releases** in diesem Repository.

**Hinweis Windows:** Die Installer sind vorerst nicht signiert. Windows SmartScreen zeigt deshalb
eine Warnung („Der Computer wurde durch Windows geschützt"). Über *Weitere Informationen →
Trotzdem ausführen* lässt sie sich bestätigen. Ein Code-Signing-Zertifikat kostet laufend Geld
und ist für dieses kostenlose Tool vorerst nicht vorgesehen.

**Hinweis Android:** Die APK wird außerhalb des Play Store verteilt und muss per Sideload
installiert werden („Installation aus unbekannten Quellen").

## Datenschutz

Die App sendet **keine Telemetrie**. Der einzige Internet-Zugriff ist ein Versions-Check gegen
`api.github.com` beim Start, der auf ein verfügbares Update hinweist. Es gibt kein Auto-Update.
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

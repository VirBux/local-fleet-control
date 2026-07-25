# Plan: Status abfragen und Relais schalten

Umsetzung von [REQUIREMENTS §4.2](../REQUIREMENTS.md#42-unterstützte-geräte--aktionen-shelly-gen1--gen23),
Teil 1: **Relais**. Licht/Dimmer und Rollladen folgen in eigenen Schritten.

Der erste schreibende Zugriff des Projekts — bisher war alles rein lesend (§8). Geschaltet
wird ausschließlich auf expliziten Nutzerklick.

## Aufteilung

Dieselbe Grenze wie beim Scan (siehe [netzwerk-scan.md](./netzwerk-scan.md)): reine Logik in
ein Modell, nativer Zugriff in einen injizierbaren Service. Grund ist REQUIREMENTS §3.1 —
`vi.mock()` auf Modulpfade greift bei diesem Builder nicht, ersetzbar ist nur, was über DI
kommt.

| Baustein | Aufgabe |
|---|---|
| `shelly/status.model.ts` | Statusantwort auswerten, Kanäle ermitteln, URLs bilden — reine Funktionen |
| `shelly/control.service.ts` | HTTP über das Tauri-Plugin, Fehler in `DeviceError` übersetzen |
| `app.component.ts` | Zustand pro Gerät, Auffaltung in Listenzeilen, Aktionen |

## Statusabfrage

| Generation | Endpunkt |
|---|---|
| Gen1 | `GET /status` |
| Gen2/3 | `GET /rpc/Shelly.GetStatus` |

Abgefragt wird **beim Fund** (jedes Gerät sofort, während der Scan noch läuft) und **nach
jeder Aktion erneut**. Es gibt kein optimistisches UI: Was ein Gerät aus einem Befehl gemacht
hat, sagt nur das Gerät selbst. Schlägt die Nachfrage fehl, verliert die Zeile ihren
Schaltzustand und zeigt den Fehler — ein nicht bestätigter Zustand ist kein Ist-Zustand.

## Kanal-Ermittlung

**Gen1** — die Komponenten stecken in gleichnamigen Arrays, der Zustand eines Relais in `ison`:

```json
{ "relays": [{ "ison": false, "has_timer": false }, { "ison": true }], "meters": [...] }
```

Jeder Eintrag in `relays` ist ein Kanal; der Index ist die Kanalnummer.

**Ab Gen2** heißen die Schlüssel `<komponente>:<id>`:

```json
{ "switch:0": { "id": 0, "output": false, "apower": 0.0 },
  "input:0": { "id": 0, "state": false },
  "sys": { ... }, "wifi": { ... } }
```

Ein Kanal ist jeder Schlüssel `switch:<id>`, sein Zustand steht in `output`. Schlüssel ohne
Doppelpunkt (`sys`, `wifi`, `cloud`, `ble`, `mqtt`) sind Infrastruktur, keine Komponenten.

Mehrkanalgeräte (Shelly 2PM: `switch:0`, `switch:1`) erscheinen als **je ein eigener
Listeneintrag pro Kanal** (REQUIREMENTS §4.2). Die Auffaltung passiert erst in der
Komponente — das Modell liefert Gerät plus Kanalliste.

**Kanalnamen** kommen ab Gen2 nicht aus dem Status, sondern aus `Shelly.GetConfig`. Das wäre
eine zweite Anfrage pro Gerät und gehört zur richtigen Geräteliste-UI; hier reicht die
Kanalnummer.

## Schaltbefehle

| Aktion | Gen1 | Gen2/3 |
|---|---|---|
| Ein | `/relay/<id>?turn=on` | `/rpc/Switch.Set?id=<id>&on=true` |
| Aus | `/relay/<id>?turn=off` | `/rpc/Switch.Set?id=<id>&on=false` |
| Umschalten | `/relay/<id>?turn=toggle` | `/rpc/Switch.Toggle?id=<id>` |

Umgeschaltet wird über die Methode des Geräts, nicht über „Gegenteil des zuletzt gelesenen
Zustands" — der gelesene Zustand kann veraltet sein, wenn jemand am Taster war.

Die Antwort wird verworfen: Sie meldet den *vorherigen* Zustand (`was_on`), nicht den neuen.
Maßgeblich ist die Nachfrage.

## Nicht steuerbare Geräte

Bleiben nach der Auswertung keine Kanäle übrig, erscheint das Gerät als **„erkannt, nicht
steuerbar"** mit Typ-Info (REQUIREMENTS §4.2, letzter Punkt). Die Typ-Info sind die
gefundenen Komponentennamen — `light`, `cover`, `pm1`, `roller` —, weil das die Begriffe
sind, unter denen sie in der Shelly-API stehen und in einem Issue wiederauffindbar sind.

Zwei Ausnahmen bewusst ausgeblendet, weil sie nur Rauschen wären:

- `input:<id>` — ein physischer Eingang, nie ein schaltbarer Ausgang. Steckt an fast jedem
  Relais mit dran.
- `script:<id>` — ein laufendes Skript, kein Gerätetyp.

**Gen1 im Rollladenmodus** (`"mode": "roller"`, z. B. Shelly 2.5) meldet weiterhin `relays`.
Diese einzeln zu schalten würde den Motor anfahren und ist kein Ein/Aus — solche Geräte
gelten hier deshalb als nicht steuerbar, bis der Rollladen-Schritt kommt. Mangels Gen1-Gerät
im Testnetz ist das ungetestete Vorsichtslogik, keine verifizierte Annahme.

## Zeitlimits

Der Sweep ist auf „antwortet gar nicht" optimiert (300 ms im LAN, 1000 ms über eine Route) —
dort bestimmt der Timeout die Gesamtdauer über 254 Adressen. Status und Schaltbefehl sprechen
dagegen ein bekanntes, antwortendes Gerät an; hier kostet Geduld nichts und ein Abbruch wäre
teuer. Deshalb einheitlich **5000 ms**, unabhängig von der Strecke.

## Auth

Die Geräte-Auth (REQUIREMENTS §4.3) ist ein eigener Schritt. Bis dahin:

- Geräte mit `authEnabled: true` (aus `GET /shelly`) werden **gar nicht erst abgefragt** —
  es käme nur ein 401. Sie erscheinen gesperrt, mit sichtbarem Grund, Aktionen deaktiviert.
- Ein 401 im laufenden Betrieb (Passwortschutz nach dem Scan eingeschaltet) landet über
  `DeviceError.locked` im selben Zustand, statt als anonymer Fehler zu verschwinden.

## Fehler bleiben am Gerät

Ein nicht erreichbares Gerät darf die Liste nicht unbrauchbar machen. Jede Zeile trägt ihren
eigenen Fehler plus „Erneut versuchen"; die globale Fehlerzeile bleibt dem Scan vorbehalten.

## Testgeräte (192.168.1.0/24)

| IP | Modell | Gen | Erwartung |
|---|---|---|---|
| .183 | SNSW-001P16EU | 2 | Plus 1PM — ein Relais, Hauptfall |
| .228 | S3SW-001P8EU | 3 | 1PM Mini — ein Relais |
| .216 | S3PM-001PCEU16 | 3 | PM Mini — reines Messgerät, erwartet „nicht steuerbar (pm1)" |
| .251 | S3DM-0A101WWL | 3 | Dimmer — erwartet „nicht steuerbar (light)", Licht kommt später |

Kein Mehrkanalgerät und kein Gen1-Gerät im Netz: Beides ist nur durch Tests abgedeckt.

## Nicht Teil dieses Schritts

- Licht/Dimmer, Rollladen — eigene Schritte
- Geräte-Auth, Persistenz, i18n
- Die richtige Geräteliste-UI: Die Schaltflächen hängen vorerst an der provisorischen
  Spike-Oberfläche mit hartcodierten deutschen Texten
- Kanalnamen aus `Shelly.GetConfig`
- Leistungswerte (`apower`, `voltage`) — die Geräte liefern sie mit, aber eine
  Notfall-Fernbedienung braucht sie nicht

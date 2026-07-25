# Plan: Netzwerk-Scan (Geräte-Discovery)

Umsetzung von [REQUIREMENTS §4.1](../REQUIREMENTS.md#41-geräte-discovery). Zugehöriges TODO:
„Spike Netzwerk-Scan".

## Aufgabenteilung Rust ↔ TypeScript

Der Rust-Anteil bleibt bewusst minimal (REQUIREMENTS §3):

| Schritt | Wo | Warum |
|---|---|---|
| Lokale IPv4 + Präfixlänge ermitteln | **Rust** | Aus dem WebView heraus nicht zugänglich |
| Host-Liste berechnen | TypeScript | Reine Rechnerei, kein Systemzugriff |
| HTTP-Sweep `GET /shelly` | TypeScript (Tauri-HTTP-Plugin) | Umgeht CORS, kein eigener Rust-HTTP-Stack |
| Antwort parsen, Generation erkennen | TypeScript | Reine Datenlogik |

## Rust-Command `list_local_networks`

Crate: `if-addrs` 0.15 — liefert pro Interface `ip`, `netmask`, `prefixlen`, `oper_status`.

Gefiltert wird auf: IPv4, nicht Loopback, nicht Link-Local (169.254.x.x), Interface
operational up. Zurück kommt eine Liste (nicht ein einzelner Treffer), weil ein Rechner
mehrere aktive Netze haben kann — WLAN und LAN gleichzeitig, VPN, Docker-Bridges. Die
Auswahl trifft die UI bzw. der Nutzer, nicht der Rust-Code.

## Sweep

- Nur `/24`-Netze werden gescannt (254 Hosts). Größere Netze (`/16` = 65.534 Hosts) würden
  den Scan unbrauchbar langsam machen — dafür ist der manuelle Scan-Bereich aus
  REQUIREMENTS §4.5 vorgesehen.
- Timeout pro Host: **300 ms**. Nicht existierende Hosts antworten gar nicht, der Timeout
  bestimmt also die Gesamtdauer.
- Parallelität: **32 gleichzeitige Requests**. Höhere Werte sind auf Android riskant
  (Dateideskriptor-Limits, WLAN-Stack); 254 Hosts / 32 parallel × 300 ms ≈ **2,5 s**
  Worst Case.
- Rein lesend, keine Schaltbefehle (REQUIREMENTS §8).

## Generationserkennung

`GET http://<ip>/shelly` antwortet bei allen Generationen **ohne Auth**.

**Gen1** — kein `gen`-Feld:
```json
{ "type": "SHSW-25", "mac": "...", "auth": false, "fw": "20230913-...", "num_outputs": 2 }
```

**Gen2/3/4** — mit `gen`:
```json
{ "name": "...", "id": "shellyplus1-...", "mac": "...", "model": "SNSW-001X16EU",
  "gen": 2, "fw_id": "...", "ver": "1.0.3", "app": "Plus1", "auth_en": false }
```

Ableitung:
- `gen` fehlt → Generation 1, Modellkennung aus `type`, Passwortschutz aus `auth`
- `gen` vorhanden → Generation aus `gen`, Modellkennung aus `model`, Passwortschutz aus `auth_en`

Ein Gerät gilt nur dann als Shelly, wenn die Antwort ein Objekt ist und `mac` **sowie**
`type` oder `model` enthält. Damit fallen fremde Geräte raus, die auf jeden Pfad mit
irgendeinem JSON antworten.

## Bekannte Risiken

- **`AbortSignal.timeout()`** braucht Chromium 103+. Unter Windows (WebView2) unkritisch, auf
  Android hängt es an der Version der System-WebView. Auf Geräten ohne Play-Store-Updates
  könnte sie zu alt sein — beim ersten Android-Test prüfen. Fallback wäre ein manueller
  `AbortController` mit `setTimeout`.
- **Parallelität 32** ist geschätzt, nicht gemessen. Android reagiert empfindlicher als
  Windows; der Wert gehört am echten Gerät nachjustiert.

## Bewusst offen (nicht Teil dieses Schritts)

- Kanal-Ermittlung bei Mehrkanal-Geräten (`/status` bzw. `/rpc/Shelly.GetStatus`) — gehört
  zur Geräteliste
- Auth-Handling — eigener Schritt
- Persistenz der Fundliste — eigener Schritt

## Verifikation

Der Spike gilt als bestanden, wenn ein echtes Shelly im LAN gefunden und mit korrekter
Generation angezeigt wird. Erfordert eine lauffähige Windows-Build-Umgebung
(Visual Studio Build Tools).

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

## Scan-Bereich: nicht das Interface, sondern die Zieladressen

**Die Auswahl eines Interfaces bewirkt nichts.** Die App bindet keine Sockets — welchen Weg
eine Anfrage nimmt, entscheidet allein die Routing-Tabelle des Betriebssystems. Was der
Nutzer wählt, ist deshalb nur *welche Adressen abgefragt werden*.

Konsequenzen, alle am echten Aufbau beobachtet (Tailscale + WireGuard parallel):

- Ein **/32** (Tailscale, WireGuard) hat keine Host-Adressen — als „Netzwerk" angeboten,
  produziert es einen Scan über 0 Adressen, der sofort ohne Treffer endet.
- Das **Tunnelnetz** eines VPN (z. B. `172.27.66.0/24`) zu scannen ist sinnlos: Dort wohnt
  die Gegenstelle, nicht die Geräte dahinter.
- Ein über einen **Tailscale-Subnet-Router** erreichbares Fremdnetz (`192.168.10.0/24`) ist
  problemlos scannbar — es fehlte nur die Eingabemöglichkeit.
- **WireGuard mit `AllowedIPs = 0.0.0.0/0`** legt jeden Scan lahm, auch den ins eigene LAN:
  Der Windows-Client aktiviert dann „Block untunneled traffic". Das ist außerhalb der App zu
  lösen (AllowedIPs einschränken); die App kann es nur als möglichen Grund benennen.

Daraus: Einzige Quelle der Wahrheit ist ein CIDR-Eingabefeld (`ScanRange`). Die lokalen Netze
werden als anklickbare Vorschläge angeboten, nicht scannbare davon gesperrt und mit Grund
beschriftet. Grenzen: max. 1024 Adressen (`MAX_HOSTS`) und nur private Adressräume
(`isPrivateRange`, REQUIREMENTS §8).

## Sweep

- Gescannt werden Bereiche bis 1024 Adressen, im Normalfall ein `/24` (254 Hosts). Größere
  Netze (`/16` = 65.534 Hosts) würden den Scan unbrauchbar langsam machen.
- Timeout und Parallelität hängen davon ab, wie das Ziel erreicht wird (`scanSettingsFor`,
  Unterscheidung über `isDirectlyAttached`):

  | Strecke | Timeout | Parallel | Worst Case /24 |
  |---|---|---|---|
  | Eigenes Netz (LAN/WLAN) | 300 ms | 32 | ≈ 2,5 s |
  | Über eine Route (VPN, Subnet-Router) | 1000 ms | 16 | ≈ 16 s |

  Nicht existierende Hosts antworten gar nicht, der Timeout bestimmt also die Gesamtdauer.
  Über einen Tunnel sind 300 ms zu knapp — ein erreichbares Gerät fiele schlicht ins Timeout.
  Die geringere Parallelität trägt dem Rechnung, dass der Tunnelverkehr durch einen einzigen
  Userspace-Prozess läuft. Höhere Werte sind zudem auf Android riskant
  (Dateideskriptor-Limits, WLAN-Stack).
- Die eigene Adresse wird mitgefragt: Bei einem frei gewählten Bereich ist sie nicht
  zwangsläufig bekannt, und eine Anfrage mehr fällt nicht ins Gewicht.
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

- **Geroutete Fremdnetze automatisch vorschlagen.** Die Routing-Tabelle des Systems kennt sie
  (Tailscale trägt seine Subnet-Routen dort ein) — auslesbar über `GetIpForwardTable2`
  (Windows) bzw. `/proc/net/route` (Android). Bewusst verworfen: deutlich mehr Rust-Anteil
  und pro Plattform verschieden, während die manuelle Eingabe denselben Nutzen bringt. Mit
  der Persistenz (REQUIREMENTS §4.4) merkt sich die App zuletzt genutzte Bereiche ohnehin.

- Kanal-Ermittlung bei Mehrkanal-Geräten (`/status` bzw. `/rpc/Shelly.GetStatus`) — gehört
  zur Geräteliste
- Auth-Handling — eigener Schritt
- Persistenz der Fundliste — eigener Schritt

## Verifikation

Der Spike gilt als bestanden, wenn ein echtes Shelly im LAN gefunden und mit korrekter
Generation angezeigt wird. Erfordert eine lauffähige Windows-Build-Umgebung
(Visual Studio Build Tools).

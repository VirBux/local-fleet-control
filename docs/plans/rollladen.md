# Plan: Rollladen steuern

Umsetzung von [REQUIREMENTS §4.2](../REQUIREMENTS.md#42-unterstützte-geräte--aktionen-shelly-gen1--gen23),
Teil 2: **Rollladen**. Baut auf [geraete-schalten.md](./geraete-schalten.md) auf; Licht/Dimmer
bleibt ein eigener Schritt.

Bis hierher fielen Rollläden in „erkannt, nicht steuerbar": Gen1 im Rollladenmodus über die
Sonderregel zu `mode: "roller"`, ab Gen2 über die Komponente `cover:<id>`. Genau diese beiden
Stellen bekommen jetzt Inhalt.

## Getrennte Liste statt gemeinsamer Kanäle

`DeviceStatus` trägt neben `channels` (Relais) eine zweite Liste `covers`:

```ts
interface DeviceStatus {
  channels: ShellyChannel[];  // Relais: id + on
  covers: ShellyCover[];      // Rollladen: id + state + position
  unsupported: string[];
}
```

Bewusst **keine** gemeinsame Liste mit Typkennzeichen: Ein Rollladen teilt mit einem Relais
kein einziges Feld — kein `on`, dafür Fahrtrichtung und Position — und keinen einzigen Befehl.
Eine Union hätte jede bestehende Auswertung von `channels` zu einer Fallunterscheidung
gemacht, ohne dass irgendwo beide Arten gemeinsam behandelt würden.

## Zustand lesen

**Gen1** (`/status`, Gerät im Rollladenmodus):

```json
{ "mode": "roller",
  "rollers": [{ "state": "stop", "current_pos": 40, "positioning": true }] }
```

`state` beschreibt nur die *Bewegung* (`open` = fährt auf, `close` = fährt zu, `stop` = steht).
Ob offen oder geschlossen, sagt erst die Position — deshalb wird im Stillstand aus `100` →
`open`, aus `0` → `closed`, dazwischen `stopped`. Ohne Kalibrierung (`positioning: false`) ist
`current_pos` bedeutungslos und wird verworfen: eine erfundene Prozentzahl wäre schlimmer als
keine.

Die Relais eines Gen1-Geräts im Rollladenmodus bleiben weiterhin unsichtbar — sie einzeln zu
schalten fährt den Motor an und ist kein Ein/Aus.

**Ab Gen2** (`Shelly.GetStatus`):

```json
{ "cover:0": { "id": 0, "state": "stopped", "current_pos": 40, "pos_control": true } }
```

`state` ist hier schon die vollständige Auskunft (`open`, `closed`, `opening`, `closing`,
`stopped`, `calibrating`). Ein unbekannter Wert wird zu `unknown` statt zu einem Fehler: Die
Fahrbefehle funktionieren trotzdem, nur die Beschriftung ist dann vage.

## Befehle

| Aktion | Gen1 | Gen2/3 |
|---|---|---|
| Öffnen | `/roller/0?go=open` | `/rpc/Cover.Open?id=0` |
| Schließen | `/roller/0?go=close` | `/rpc/Cover.Close?id=0` |
| Stopp | `/roller/0?go=stop` | `/rpc/Cover.Stop?id=0` |

Wie beim Relais: Antwort verwerfen, Zustand danach frisch abfragen (REQUIREMENTS §4.2, kein
optimistisches UI).

**Nicht Teil dieses Schritts:** Zielposition anfahren (`go=to_pos` bzw.
`Cover.GoToPosition`). §4.2 verlangt Öffnen/Schließen/Stopp und das *Anzeigen* der Position;
ein Positions-Regler ist Komfort und damit Phase 2.

**Stopp ist immer klickbar**, solange das Gerät nicht passwortgeschützt ist — auch während
einer laufenden Abfrage und auch nach einem Fehlschlag. Der Knopf, den man in einer
Notfall-Fernbedienung am dringendsten braucht, darf nicht ausgerechnet dann gesperrt sein,
wenn sich etwas bewegt: Ein Timeout mitten in der Motorfahrt wirft den bestätigten Zustand
weg, aber die Rollladennummer steht weiterhin fest (sie kommt aus dem Projekt). Stopp setzt
als einziger Befehl keinen gelesenen Zustand voraus — er ist nie geraten. Öffnen und
Schließen bleiben gesperrt, solange kein bestätigter Zustand vorliegt.

Damit können **zwei Vorgänge gleichzeitig offen sein**: die Statusabfrage zum Fahrbefehl und
der Stopp. `DeviceStateService` führt deshalb je Gerät eine laufende Nummer mit und übernimmt
nur das Ergebnis des jüngsten Vorgangs. Ohne sie überschriebe die spät eintreffende Antwort
der älteren Abfrage das Ergebnis des Stopps: Ein gescheiterter Stopp verschwände hinter einem
„alles in Ordnung", das sich auf den Zustand *vor* dem Stopp bezieht.

## Entitätsschlüssel

Ein Rollladen bekommt `MAC:cover:<id>` statt `MAC:<id>`. Grund: Relais- und Rollladen-IDs
beginnen beide bei 0. Bei Shelly schließen sich die Betriebsarten zwar aus (im
Rollladenmodus gibt es keine Relais), aber der Schlüssel entscheidet über Raum, Kategorie und
eigenen Namen — dort auf eine Annahme über fremde Firmware zu bauen, wäre der falsche Ort.

Folge: Wird ein Gerät vom Relais- in den Rollladenmodus umgestellt, verliert es seine
Zuordnung. Das ist gewollt — aus zwei Kanälen wird ein Rollladen, die alte Zuordnung passt
ohnehin nicht mehr.

## Persistenz

`SavedDevice` bekommt neben `channelIds` ein `coverIds` (REQUIREMENTS §4.4). Alte Dateien
lesen sich unverändert (fehlendes Feld → leere Liste), neue bleiben für ältere Versionen
lesbar (unbekanntes Feld → ignoriert). Ohne das stünde ein gespeicherter Rollladen beim Start
mit Relais-Knöpfen da, bis die erste Statusabfrage durch ist.

## Testgeräte

**Keine.** Im Testnetz (192.168.1.0/24) hängt kein Rollladen — die Umsetzung ist vollständig
durch `npm test` abgedeckt, aber an echter Hardware ungeprüft. Der Testplan führt die Punkte
zum Nachholen, sobald ein Shelly 2PM (Gen2/3) oder 2.5 (Gen1) im Rollladenmodus verfügbar ist.

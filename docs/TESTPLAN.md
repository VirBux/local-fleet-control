# Manuelle Prüfliste

> Was sich nur am laufenden Programm und am echten Gerät prüfen lässt. `npm test` deckt die
> Logik ab — hier steht, was Tests grundsätzlich nicht sehen: die Tauri-Brücke, das echte
> Netz, echte Shellys, das Layout.
>
> Abhaken, und was abweicht, unten unter [Notizen](#notizen) festhalten. Erledigte Blöcke
> wandern als Sammeleintrag nach [TODO_DONE.md](./TODO_DONE.md).

**Testnetz:** Shellys in `192.168.1.0/24`, zweiter Standort `192.168.10.0/24` über den
Tailscale-Subnet-Router. Bekannte Geräte: `.183` (Plus 1PM), `.228` (1PM Mini), `.216` (pm1,
nicht schaltbar), `.251` (light, noch nicht unterstützt).

---

## 0. Vorbereitung

- [ x ] `npm run tauri dev` startet, das Fenster öffnet sich
- [ x ] Eine Änderung an einer `.html`-Datei erscheint ohne Neustart im Fenster (Hot-Reload)
- [ x ] Keine roten Meldungen in der DevTools-Konsole (Rechtsklick → *Inspect Element*)

--> Error vorhanden

ERROR The resource id 629958297 is invalid.
handleError	@	root_effect_scheduler.mjs:3637

## 1. Start und Grundgerüst

- [ x ] Fußzeile zeigt **„powered by HA Fleet Manager"** und die Versionsnummer aus
      `tauri.conf.json`
- [ x ] Klick auf die Fußzeile öffnet ha-fleet-manager.com im **System-Browser**, nicht im
      App-Fenster
- [ x ] Der Kopf zeigt „Local Fleet Control" — in jeder Sprache unverändert

## 2. Sprache (neu, bisher nur durch Tests abgedeckt)

- [ x ] Beim allerersten Start (siehe *Zurücksetzen* unten) steht die App auf **Deutsch**, weil
      Windows deutsch ist
- [ x ] Die Auswahl im Kopf listet **Deutsch, English, Español, Français, Hrvatski** — jede in
      ihrer eigenen Schreibweise
- [ x ] Umschalten wechselt **sofort** alle Texte: Knöpfe, Platzhalter in den Eingabefeldern,
      Gruppenüberschriften
- [ x ] Nach `Alt+F4` und Neustart ist die gewählte Sprache **noch eingestellt**
- [ ] `%APPDATA%\com.hafleetmanager.localfleetcontrol\settings.json` existiert und enthält
      die Sprache
- [ ] `projects.json` enthält **keine** Sprache (sie gehört nicht in den späteren Export)
- [ ] **Französisch prüfen** — die längsten Texte: Passen „Rechercher des appareils" und
      „Protégé par mot de passe" ins Layout, ohne dass etwas überläuft oder umbricht?
- [ ] **Kroatisch prüfen** — Sonderzeichen (č, ž, ć, đ) werden korrekt dargestellt
- [ ] Ein **Fehlertext wechselt die Sprache mit**: Gerät vom Strom nehmen, „Erneut versuchen"
      drücken bis „Gerät nicht erreichbar." steht, dann auf English umstellen → der Text muss
      zu „Device not reachable." werden, nicht deutsch stehen bleiben
- [ ] Eigene Namen für Räume, Kategorien und Geräte bleiben beim Sprachwechsel **unverändert**
      (das sind Nutzerdaten, keine Übersetzungen)

## 3. Netzwerk-Scan

- [ x ] Beim Start steht das eigene Netz als Vorschlag im Feld (`192.168.1.0/24`)
- [ ] „Eigene Netze" listet die Interfaces; ein Tailscale-/WireGuard-Eintrag (`/32`) ist
      **gesperrt** mit dem Hinweis „keine Geräteadressen"
- [ x ] Scan im eigenen Netz findet alle bekannten Geräte
- [ x ] Treffer erscheinen **während** des Scans, nicht erst am Ende; der Zähler läuft mit
- [ x ] **Scan-Dauer notieren** (unten): Wie lange dauert ein /24 im LAN?

--> Rund 5 Sekunden

- [ x ] **Fremdnetz über Tailscale:** `192.168.10.0/24` von Hand eintragen → werden die Geräte
      am zweiten Standort gefunden? Reichen die 1000 ms Zeitlimit?
- [ x ] **Dauer im Fremdnetz notieren** — falls deutlich zu langsam oder unvollständig, sind
      Timeout und Parallelität in `discovery.service.ts` nachzujustieren

--> Rund 10 Sekunden

- [ ] Achtung: Läuft WireGuard mit `AllowedIPs = 0.0.0.0/0`, schlägt jeder Scan fehl — das ist
      erwartet und in der Hilfe unter „nichts gefunden" erklärt

### Grenzfälle der Eingabe

- [ ] Leeres Feld → „Bereich angeben, z. B. 192.168.1.0/24", Knopf gesperrt
- [ ] `quatsch` → „Ungültiger Bereich"
- [ ] `192.168.1.5/32` → „enthält keine Geräteadressen"
- [ ] `10.0.0.0/16` → „Bereich zu groß (… Adressen, erlaubt sind 1024)"
- [ ] `8.8.8.0/24` → „Nur private Netze …" — **wichtig:** Die App darf öffentliche Adressen
      nicht scannen (REQUIREMENTS §8)
- [ ] Ein Bereich ohne Geräte (z. B. `192.168.99.0/24`) → die Hilfe mit den drei Ursachen
      erscheint und nennt den gescannten Bereich

## 4. Geräte schalten

- [ x ] `.183` (Plus 1PM): **Ein**, **Aus**, **Umschalten** wirken am Gerät
- [ x ] `.228` (1PM Mini): dasselbe
- [ x ] Die Anzeige „An/Aus" stimmt nach jeder Aktion mit dem echten Zustand überein — auch wenn
      am Gerät selbst geschaltet wird und danach „Erneut versuchen" gedrückt wird
- [ x ] `.216` erscheint als **„Erkannt, nicht steuerbar (pm1)"** ohne Schaltknöpfe
- [ x ] `.251` erscheint als **„Erkannt, nicht steuerbar (light)"**
- [ x ] Ein Mehrkanalgerät (falls vorhanden) steht mit **je einem Eintrag pro Kanal** in der
      Liste, beschriftet „Kanal 1", „Kanal 2"
- [ ] **Gerät vom Strom nehmen** → nur dieses zeigt einen Fehler, die übrigen bleiben
      bedienbar; „Erneut versuchen" holt es zurück, sobald es wieder da ist
- [ ] Ein passwortgeschütztes Gerät (falls eines eingerichtet werden kann) zeigt 🔒 und
      „Passwortgeschützt — Anmeldung ist noch nicht gebaut", statt einen Fehler zu melden

## 5. Projektstruktur

- [ ] Projekt anlegen → es wird sofort das aktive
- [ ] Projekt umbenennen (Feld verlassen genügt)
- [ ] Räume und Kategorien anlegen, je zwei
- [ ] Geräte zuordnen: eigener Name, Kategorie, Raum
- [ ] „Gruppieren nach" schaltet zwischen **Raum**, **Kategorie** und **gar nicht** um
- [ ] Nicht zugeordnete Geräte landen in „Ohne Raum" bzw. „Ohne Kategorie"
- [ ] Einen Raum löschen → die Geräte rutschen nach „Ohne Raum", **ihr eigener Name bleibt**
- [ ] „Projekt löschen" fragt beim ersten Klick nach und löscht erst beim zweiten
- [ ] Ohne aktives Projekt ist die Liste flach, ohne Überschriften

## 6. Persistenz über einen Neustart

- [ ] App schließen und neu starten → Projekt, Räume, Kategorien und eigene Namen sind noch da
- [ ] `%APPDATA%\com.hafleetmanager.localfleetcontrol\projects.json` ist lesbares JSON
- [ ] Die Geräte selbst sind nach dem Neustart **weg** — das ist der derzeitige Stand, die
      Geräteliste wird noch nicht gespeichert (offener Punkt in
      [TODO_OPEN.md](./TODO_OPEN.md) §4)

**Zurücksetzen für einen Erststart-Test:** App schließen, `projects.json` und `settings.json`
im Datenverzeichnis löschen, neu starten.

## 7. Darstellung

- [ ] Windows auf **dunkles** Design stellen → die App folgt (dunkler Hintergrund, heller Text)
- [ ] Zurück auf **hell** → ebenso
- [ ] Der Emerald-Akzent (`#2FC883`) ist in beiden Varianten erkennbar
- [ ] Fenster auf **Handybreite** ziehen (~400 px): Nichts läuft aus dem Fenster, kein
      waagerechter Scrollbalken, die Geräteliste bleibt bedienbar
- [ ] Bedienung nur mit **Tastatur**: Tab springt sinnvoll durch Felder und Knöpfe

---

## Notizen

Scan-Dauer LAN (/24): ………………

Scan-Dauer über Tailscale (/24): ………………

Abweichungen:

-
-
-

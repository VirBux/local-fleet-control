# Offene Aufgaben

> Erledigtes wandert nach [TODO_DONE.md](./TODO_DONE.md). Detailpläne unter `docs/plans/`.
>
> Alle „am echten Gerät gegentesten"-Punkte sind in [TESTPLAN.md](./TESTPLAN.md) zum Abhaken
> ausformuliert.

## 1. Scaffolding

- [ ] `npm run tauri dev` einmal starten (Fenster öffnet sich, Hot-Reload prüfen) —
      `tauri build` läuft bereits
- [ ] Android-Target konfigurieren (`tauri android init`), inkl. `networkSecurityConfig`
      für Cleartext-HTTP ins LAN (REQUIREMENTS §3.2) — bewusst nach dem Windows-MVP
- [ ] App-Icons ersetzen (aktuell noch die Tauri-Default-Icons in `src-tauri/icons/`)
- [ ] Repo-Feinschliff auf GitHub: Topics (`home-assistant`, `shelly`, `tauri`, `smart-home`),
      Issue-Templates, Beschreibung ggf. anpassen

## 2. Netzwerk-Scan

Plan: [docs/plans/netzwerk-scan.md](./plans/netzwerk-scan.md). Der Scan findet Geräte im
eigenen Netz (am echten Aufbau bestätigt: Gen2 und Gen3). Die Auswertungslogik ist per
`npm test` geprüft.

- [ ] **Fremdnetz über VPN gegentesten** — `192.168.10.0/24` von Hand eintragen und prüfen,
      ob die 1000 ms Timeout über den Tailscale-Subnet-Router reichen
- [ ] Scan-Dauer im echten Netz messen; Timeout und Parallelität nachjustieren
      (LAN 300 ms/32, Route 1000 ms/16 — beide Werte sind geschätzt)

## 3. Geräteliste-UI

Status, Kanal-Ermittlung und das Schalten von Relais sind gebaut
([Plan](./plans/geraete-schalten.md)), hängen aber noch an der Spike-Oberfläche.

- [ ] **Schalten am echten Gerät gegentesten** — `.183` (Plus 1PM) und `.228` (1PM Mini)
      müssen schaltbar sein, `.216` als „nicht steuerbar (pm1)" und `.251` als
      „nicht steuerbar (light)" erscheinen. Bisher nur durch Tests abgedeckt.
- [ ] **Spike-Oberfläche in `app.component.html` ersetzen** — inzwischen die größte Baustelle:
      Projektleiste, Scan und Geräteliste liegen alle in einer Komponente. Die Texte kommen
      seit der i18n aus `app/i18n/`, die Struktur ist weiter provisorisch
- [ ] Einstellungsansicht (REQUIREMENTS §4.5: Sprache, Update-Check, Scan-Bereich) — die
      Sprachauswahl sitzt behelfsweise im Kopf der App
- [ ] Suchfeld/Filter über die Geräteliste (REQUIREMENTS §4.5)
- [ ] Scan-Ergebnis als Liste (Name, Typ-Icon, Status)
- [ ] Kanalnamen aus `Shelly.GetConfig` holen — bisher nur „Kanal 1/2"

## 4. Projektstruktur

Gebaut ([Plan](./plans/projektstruktur.md), REQUIREMENTS §4.4.1): Projekte, Kategorien, Räume,
eigene Namen, gruppierte Liste.

- [ ] **Ablage am echten Gerät gegentesten** — schreiben `projects.json` und `settings.json`
      (Sprache) tatsächlich ins App-Datenverzeichnis und überleben einen Neustart? Bisher nur
      durch Tests mit Speicher-Double abgedeckt
- [ ] Gespeicherte Geräteliste beim Start sofort anzeigen (REQUIREMENTS §4.4) — bisher wird
      nur die Zuordnung persistiert, die Geräte selbst kommen ausschließlich aus dem Scan
- [ ] Räume/Kategorien umbenennen und umsortieren (bisher nur anlegen und löschen)

## 5. Iterativ danach (Reihenfolge gemeinsam festlegen)

- [ ] Licht/Dimmer
- [ ] Rollladen
- [ ] Geräte-Auth (Gen1 Basic, Gen2/3 Digest SHA-256)
- [ ] Persistenz der Credentials (Geräteliste und Namen: siehe §4)
- [ ] Update-Check gegen GitHub-Releases-API
- [ ] CI/Release-Workflow (Windows-Installer + signiertes Android-APK)

## Offene Entscheidungen

Siehe [REQUIREMENTS.md §9](./REQUIREMENTS.md#9-offene-entscheidungen-im-projekt-klären-und-hier-nachtragen)
— jede getroffene Entscheidung dort nachtragen und aus §9 entfernen.

Zusätzlich aufgekommen:

- [ ] **`AbortSignal.timeout()` auf Android prüfen** — braucht Chromium 103+, siehe
      [Plan](./plans/netzwerk-scan.md). Betrifft den Scan direkt.

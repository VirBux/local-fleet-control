# Offene Aufgaben

> Erledigtes wandert nach [TODO_DONE.md](./TODO_DONE.md). Detailpläne unter `docs/plans/`.

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

- [ ] **Spike-Oberfläche in `app.component.html` ersetzen** — provisorisch, mit hartcodierten
      deutschen Texten (Verstoß gegen REQUIREMENTS §4.6, bewusst temporär)
- [ ] Scan-Ergebnis als Liste (Name, Typ-Icon, Status)
- [ ] Kanal-Ermittlung bei Mehrkanal-Geräten
- [ ] Statusabfrage (`/status` bzw. `/rpc/Shelly.GetStatus`)
- [ ] Ein/Aus für Relais

## 4. Iterativ danach (Reihenfolge gemeinsam festlegen)

- [ ] Licht/Dimmer
- [ ] Rollladen
- [ ] Geräte-Auth (Gen1 Basic, Gen2/3 Digest SHA-256)
- [ ] Persistenz (Geräteliste, Anzeigenamen, Credentials)
- [ ] i18n (DE/EN/ES/FR/HR)
- [ ] Update-Check gegen GitHub-Releases-API
- [ ] CI/Release-Workflow (Windows-Installer + signiertes Android-APK)

## Offene Entscheidungen

Siehe [REQUIREMENTS.md §9](./REQUIREMENTS.md#9-offene-entscheidungen-im-projekt-klären-und-hier-nachtragen)
— jede getroffene Entscheidung dort nachtragen und aus §9 entfernen.

Zusätzlich aufgekommen:

- [ ] **`AbortSignal.timeout()` auf Android prüfen** — braucht Chromium 103+, siehe
      [Plan](./plans/netzwerk-scan.md). Betrifft den Scan direkt.

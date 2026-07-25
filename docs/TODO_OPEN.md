# Offene Aufgaben

> Erledigtes wandert nach [TODO_DONE.md](./TODO_DONE.md). Detailpläne unter `docs/plans/`.

## 1. Scaffolding

- [ ] **Blocker: Visual Studio Build Tools mit C++-Workload installieren** — ohne `link.exe`
      kompiliert kein Rust-Code. Muss manuell erfolgen (GUI-Installer).
- [ ] Windows-Build verifizieren (`npm run tauri dev` + `npm run tauri build`) — erst nach
      Build-Tools möglich
- [ ] Android-Target konfigurieren (`tauri android init`), inkl. `networkSecurityConfig`
      für Cleartext-HTTP ins LAN (REQUIREMENTS §3.2) — bewusst nach dem Windows-MVP
- [ ] GitHub-Repo anlegen und pushen (gh CLI ist auf dem System nicht installiert)
- [ ] App-Icons ersetzen (aktuell noch die Tauri-Default-Icons in `src-tauri/icons/`)

## 2. Spike Netzwerk-Scan

Plan: [docs/plans/netzwerk-scan.md](./plans/netzwerk-scan.md). Code steht, die Auswertungslogik
ist per `npm run check:model` geprüft — **die Verifikation am echten Gerät fehlt noch**, weil
ohne Build Tools nichts kompiliert.

- [ ] **Rust-Command `list_local_networks` kompilieren** — nie gebaut, kann Fehler enthalten
- [ ] Gegen ein echtes Shelly testen: wird es gefunden, stimmt die Generation?
- [ ] Scan-Dauer im echten Netz messen; Timeout (300 ms) und Parallelität (32) nachjustieren

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

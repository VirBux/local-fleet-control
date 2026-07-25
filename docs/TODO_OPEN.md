# Offene Aufgaben

> Erledigtes wandert nach [TODO_DONE.md](./TODO_DONE.md). Detailpläne unter `docs/plans/`.

## 1. Scaffolding

- [ ] **Blocker: Visual Studio Build Tools mit C++-Workload installieren** — ohne `link.exe`
      kompiliert kein Rust-Code. Muss manuell erfolgen (GUI-Installer).
- [ ] Windows-Build verifizieren (`npm run tauri dev` + `npm run tauri build`) — erst nach
      Build-Tools möglich
- [ ] Android-Target konfigurieren (`tauri android init`), inkl. `networkSecurityConfig`
      für Cleartext-HTTP ins LAN (REQUIREMENTS §3.1) — bewusst nach dem Windows-MVP
- [ ] GitHub-Repo anlegen und pushen (gh CLI ist auf dem System nicht installiert)
- [ ] App-Icons ersetzen (aktuell noch die Tauri-Default-Icons in `src-tauri/icons/`)

## 2. Spike Netzwerk-Scan

- [ ] Rust-Command: lokale IP + Subnetzmaske ermitteln
- [ ] Sweep über /24: `GET http://<ip>/shelly`, Timeout ~300 ms, parallelisiert
- [ ] Gen-Erkennung aus der Antwort (Gen1 `type` / Gen2+3 `gen`+`model`, `auth`/`auth_en`)
- [ ] Gegen ein echtes Shelly testen

## 3. Geräteliste-UI

- [ ] Scan-Ergebnis als Liste (Name, Typ-Icon, Status)
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

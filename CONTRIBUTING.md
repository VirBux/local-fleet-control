# Mitwirken / Contributing

*Deutsche Fassung zuerst, English below.*

---

## Deutsch

Local Fleet Control ist Open Source, wird aber von einem einzelnen Maintainer bei
[HA Fleet Manager](https://ha-fleet-manager.com) gepflegt. Das prägt, welche Art von Beiträgen
gut funktioniert.

### Issues sind ausdrücklich willkommen

Der wertvollste Beitrag ist ein gutes Issue. Besonders hilfreich:

- **Nicht erkanntes oder nicht steuerbares Gerät.** Bitte Gerätetyp, Generation und – falls
  möglich – die Antwort von `http://<geräte-ip>/shelly` mitschicken.
- **Fehlverhalten beim Scan** (Gerät wird nicht gefunden, obwohl erreichbar).
- **Plattformprobleme** unter Windows oder Android, mit Version und Gerätemodell.
- **Übersetzungsfehler** in einer der fünf Sprachen (DE, EN, ES, FR, HR).

Bitte **keine Zugangsdaten, Tokens oder vollständigen Netzwerk-Dumps** in Issues posten.
IP-Adressen aus dem privaten Bereich sind unkritisch, alles andere bitte schwärzen.

### Pull Requests

PRs sind möglich, aber es gibt **keine Garantie auf Annahme** – auch nicht für technisch
saubere Beiträge. Der Scope dieses Projekts ist bewusst eng gehalten
(siehe [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)); Features außerhalb davon werden in der
Regel abgelehnt, egal wie gut sie umgesetzt sind.

Wenn du etwas Größeres vorhast: **bitte vorher ein Issue aufmachen** und abstimmen. Das erspart
dir umsonst investierte Arbeit.

Für PRs gilt:

- Ein Thema pro PR, nachvollziehbare Commits.
- Keine neuen Abhängigkeiten ohne Begründung.
- Der Tech-Stack (Tauri 2 + Angular) steht fest.
- Mit dem Beitrag stimmst du zu, dass dein Code unter Apache-2.0 veröffentlicht wird.

### Marke

Name und Logo sind nicht Teil der Lizenz – siehe [TRADEMARK.md](./TRADEMARK.md). Forks müssen
umbenannt werden.

---

## English

Local Fleet Control is open source but maintained by a single maintainer at
[HA Fleet Manager](https://ha-fleet-manager.com). That shapes what kind of contribution works
well here.

### Issues are explicitly welcome

The most valuable contribution is a good issue. Especially helpful:

- **A device that is not detected or not controllable.** Please include device type, generation
  and, if possible, the response from `http://<device-ip>/shelly`.
- **Scan problems** (device reachable but not found).
- **Platform issues** on Windows or Android, with version and device model.
- **Translation errors** in any of the five languages (DE, EN, ES, FR, HR).

Please do **not post credentials, tokens or full network dumps** in issues. Private-range IP
addresses are fine; redact anything else.

### Pull requests

PRs are possible, but there is **no guarantee of acceptance** — not even for technically sound
contributions. The scope of this project is deliberately narrow (see
[docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)); features outside it will usually be declined
regardless of implementation quality.

Planning something larger? **Please open an issue first** to align. It saves you wasted work.

For PRs:

- One topic per PR, readable commits.
- No new dependencies without justification.
- The tech stack (Tauri 2 + Angular) is fixed.
- By contributing you agree that your code is published under Apache-2.0.

### Trademark

Name and logo are not covered by the license — see [TRADEMARK.md](./TRADEMARK.md). Forks must be
renamed.

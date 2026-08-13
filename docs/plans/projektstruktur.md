# Plan: Projektstruktur (Kategorien, Räume, eigene Namen)

Erweitert [REQUIREMENTS §4.4](../REQUIREMENTS.md#44-persistenz-lokal-auf-dem-gerät) um eine
Ordnungsebene über der Geräteliste. **Scope-Erweiterung**, bewusst getroffen: §4.4 kannte
bisher nur eigene Anzeigenamen, aber keine Gruppierung.

Ziel: Eine Anlage mit 20 Geräten ist als flache Liste unbrauchbar. Ein Projekt gibt ihr
Räume und Kategorien, die Liste zerfällt in Abschnitte mit Überschrift.

## Warum „Projekt" und nicht einfach Einstellungen

Ein Projekt ist genau die Einheit, die das erste geplante Folge-Feature transportiert:
**Export/Import der Konfiguration** (REQUIREMENTS §5 — „Integrator richtet ein, übergibt
Datei an Endkunden"). Ein Integrator betreut mehrere Kunden; mehrere Projekte
nebeneinander, eines davon aktiv, ist deshalb die passende Form — nicht ein globaler
Satz Einstellungen.

## Der Schlüssel: MAC, nicht IP

Die **MAC-Adresse** ist der einzige stabile Bezeichner eines Shelly:

- herstellervergeben und global eindeutig
- ändert sich nie — im Gegensatz zur IP (DHCP) und zum Gerätenamen (frei änderbar)
- kommt bei **allen** Generationen aus `GET /shelly`, ohne Auth

Gen2/3 liefern zusätzlich ein `id`-Feld (`shellyplus1pm-a8032abd42ec`). Das ist die MAC mit
Modellpräfix und existiert bei Gen1 nicht — als Schlüssel taugt es deshalb nicht.

**Zugeordnet wird nicht das Gerät, sondern die Entität**, also der einzelne Kanal: Ein
Shelly 2PM kann Kanal 0 im Flur und Kanal 1 im Bad haben. Der Schlüssel ist deshalb

```
<MAC>            Gerät ohne schaltbaren Ausgang (Messgerät, noch nicht unterstützt)
<MAC>:<Kanal>    ein Kanal
```

Damit fällt der Schlüssel mit `DeviceRow.entityKey` zusammen, das die Liste ohnehin schon
zum Auffalten der Mehrkanalgeräte bildet.

Die MAC wird beim Auswerten von `GET /shelly` normalisiert (Großbuchstaben, ohne
Trennzeichen). Bisher lieferten alle beobachteten Geräte sie ohnehin so — aber an dieser
Schreibweise hängen ab jetzt gespeicherte Zuordnungen, und eine Zuordnung, die nach einem
Firmware-Update ins Leere zeigt, wäre ein übler Fehler.

## Datenmodell

```ts
ProjectData {                 // was gespeichert wird
  version: 1
  projects: Project[]
  activeProjectId: string | null
}

Project {
  id, name
  categories: Label[]         // frei angelegt, Reihenfolge = Anzeigereihenfolge
  rooms: Label[]
  devices: SavedDevice[]      // nachgetragen, siehe projekt-geraete.md
  assignments: Record<entityKey, Assignment>
}

Assignment {
  name: string                // Freitext; leer heißt „nimm den Gerätenamen"
  categoryId: string | null
  roomId: string | null
}
```

**Kategorien und Räume sind frei anlegbar**, nicht vorgegeben. Grund: Räume sind es
zwangsläufig (jede Wohnung ist anders), und eine feste Kategorienliste daneben wäre
inkonsistent. Beides sind damit Nutzerdaten und bleiben bei der i18n-Einführung
unübersetzt — genau wie Gerätenamen.

Löscht der Nutzer eine Kategorie oder einen Raum, werden **alle Zuordnungen darauf
zurückgesetzt**. Sonst zeigen sie auf eine ID, die es nicht mehr gibt, und die Geräte
verschwänden in eine Gruppe ohne Namen.

Zuordnungen überleben ein Gerät: Verschwindet ein Shelly aus dem Scan, bleibt sein Eintrag
gespeichert und greift wieder, sobald es zurückkommt. Aufgeräumt wird nichts automatisch —
ein Gerät ist auch mal aus.

> **Nachtrag:** Dieser Schritt speicherte nur die *Zuordnungen*; die Geräte selbst kamen
> weiterhin ausschließlich aus dem Scan. Nachgereicht in
> [projekt-geraete.md](./projekt-geraete.md) — dort wandert auch die Geräteliste ins Projekt,
> und die Oberfläche zerfällt in Discovery- und Projektseite.

## Speicherung

**JSON-Datei im App-Datenverzeichnis** (`projects.json`) über das Tauri-Store-Plugin,
gekapselt in `core/storage.service.ts`. Abgelegt werden Objekte, keine JSON-Strings — die
Datei soll lesbar sein, das ist ihr halber Zweck.

Die Kapselung ist ohnehin Pflicht: Nach REQUIREMENTS §3.1 greift `vi.mock()` auf Modulpfade
bei diesem Builder nicht, ersetzbar ist nur, was über DI kommt.

### Warum nicht `localStorage` — und warum nicht SQLite

`localStorage` liegt im WebView-Profil. Nicht sicherbar, nicht weitergebbar, weg wenn das
Profil weg ist — für Export/Import (REQUIREMENTS §5) unbrauchbar. Das war der Anlass.

**SQLite wurde geprüft und verworfen.** Das Problem war der Speicherort, nicht das
Datenmodell:

- Das Zugriffsmuster ist „beim Start alles laden, bei jeder Änderung alles schreiben", auf
  wenigen Kilobytes. Keine Abfragen, keine Joins, keine Teilmengen.
- `tauri-plugin-sql` zieht sqlx als native Abhängigkeit herein. REQUIREMENTS §3 hält den
  Rust-Anteil bewusst klein, und das Android-Target ist noch nicht einmal initialisiert —
  eine native SQLite-Abhängigkeit vor dem ersten Android-Build addiert Risiko genau dort,
  wo §3.2 ohnehin Fallstricke listet.
- Migrationen: In JSON reicht das `version`-Feld, in SQL braucht es Migrationsskripte.

Richtig wäre SQLite bei Historie oder Messwerten (Verbrauch über Zeit) oder hunderten
Geräten mit Suche — beides schließt REQUIREMENTS §1 aus („kein Dashboard-Ersatz").

### Ablauf

Gespeichert wird **bei jeder Änderung**, in einer einzigen privaten Methode des
`ProjectService` (`apply`). Kein `effect()`: Ein Speicherpfad, der an der Change Detection
hängt, ist schwerer zu testen und läuft Gefahr, im Notfall genau dann nicht gelaufen zu
sein, wenn es darauf ankommt. Auf das Schreiben wird nicht gewartet — die Oberfläche soll
nicht an der Platte hängen.

**Geladen wird asynchron**, weil eine Datei nun einmal asynchron ist: Die App startet mit
leerem Zustand, `ProjectService.ready` ist erfüllt, sobald der gespeicherte da ist. Hat der
Nutzer in diesem Fenster schon etwas angelegt, gewinnt seine Eingabe — Arbeit stillschweigend
zu überschreiben wäre der schlimmere Fehler von beiden.

Fremde oder halb kaputte Daten führen zu einem leeren Zustand, nicht zu einem Absturz —
`parseProjectData` prüft jede Ebene. Ist die Datei gar nicht lesbar oder fehlt die
Tauri-Brücke (`ng serve` im Browser), läuft die App ohne dauerhafte Ablage weiter.

**Die Datei ist Klartext.** Geräte-Credentials (REQUIREMENTS §4.3) gehören dort nicht hinein.

## Gruppierung der Liste

Umschaltbar: **nach Raum**, **nach Kategorie** oder **ohne**. Umschaltbar deshalb, weil beide
Sichten je nach Situation die richtige sind — im Notfall sucht man nach Raum („alles im
Keller aus"), beim Einrichten nach Kategorie.

- Gruppenreihenfolge = Reihenfolge im Projekt. Der Nutzer bestimmt sie, nicht das Alphabet.
- Nicht zugeordnete Geräte kommen als letzte Gruppe („Ohne Raum" / „Ohne Kategorie") —
  sichtbar, damit man sie zuordnet, aber nicht im Weg.
- Leere Gruppen erscheinen nicht.
- Ohne aktives Projekt bleibt die Liste flach wie bisher.

## Nicht Teil dieses Schritts

- Export/Import (REQUIREMENTS §5, Phase 2) — das Datenmodell ist darauf vorbereitet
- Typ-Icons je Kategorie
- Sortierung innerhalb einer Gruppe (bleibt die Scan-Reihenfolge nach IP)
- i18n der Oberfläche — die Spike-Texte bleiben hartcodiert deutsch

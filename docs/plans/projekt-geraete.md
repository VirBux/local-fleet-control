# Plan: Geräte im Projekt speichern, Discovery und Projekt trennen

Baut auf [projektstruktur.md](./projektstruktur.md) auf und behebt dessen größte Lücke:
Bisher wurde nur die **Zuordnung** eines Geräts gespeichert (Name, Raum, Kategorie), das
Gerät selbst nicht. Nach einem Neustart war die Liste leer, bis jemand einen Scan startete —
im Notfall genau das falsche Verhalten (REQUIREMENTS §4.4: „Beim App-Start wird die
gespeicherte Liste **sofort** angezeigt").

## Zwei Seiten statt einer

| Seite | Zweck | Inhalt |
|---|---|---|
| **Discovery** | Geräte finden und ins Projekt aufnehmen | Scan-Bereich, Scan, Fundliste mit „Hinzufügen" |
| **Projekt** | Die Anlage definieren und bedienen | Projektwahl, Räume/Kategorien, gespeicherte Geräte |

Die Trennung folgt den zwei Situationen, in denen die App benutzt wird: **Einrichten**
(einmal, mit Zeit, sucht Geräte) und **Notfall** (kein Scan, kein Netzsuchlauf, sofort
schalten). Beides in einer Ansicht hieß bisher, dass die Notfall-Bedienung hinter
Scan-Eingabefeldern liegt.

- Die Fundliste der Discovery zeigt an jedem Gerät, **was das Projekt darüber schon weiß**:
  eigener Name, Raum, Kategorie — und ob es bereits aufgenommen ist. Sonst weiß man beim
  zweiten Scan nicht, was neu ist.
- Die Projektseite kommt **ohne Netz aus**: Sie rendert aus `projects.json` und fragt den
  Ist-Zustand erst danach im Hintergrund ab.
- **Startseite:** Discovery, außer das aktive Projekt hat bereits Geräte — dann öffnet die
  App direkt die Projektseite. Wer eine eingerichtete Anlage hat, will im Notfall nicht
  erst einen Reiter umschalten.

## Datenmodell

`Project` bekommt eine Geräteliste. Der Schlüssel bleibt die MAC (siehe
[projektstruktur.md](./projektstruktur.md)), die Zuordnungen hängen unverändert an
`MAC:Kanal`.

```ts
SavedDevice {
  mac, ip, generation, model, firmware, name, authEnabled   // wie ShellyDevice
  vendorId: string        // 'shelly' — Tasmota/WLED sind Phase 2
  channelIds: number[]    // zuletzt bekannte Kanäle, damit die Liste ohne Netz vollständig ist
}
```

`vendorId` steht ab jetzt an jedem gespeicherten Gerät, obwohl der MVP nur Shelly kennt:
Ihn später nachzutragen hieße, gespeicherte Dateien zu migrieren — jetzt kostet er nichts.

**Gespeichert wird beim Hinzufügen, aktualisiert beim Wiederfinden.** Meldet ein bekanntes
Gerät eine neue IP (DHCP), einen neuen Namen oder andere Kanäle, zieht der Eintrag nach
(`syncDevice`) — aber nur dann, sonst schriebe jede Statusabfrage in die Datei.

**Entfernt wird nur auf Klick.** Ein Gerät, das nicht antwortet, bleibt in der Liste: Es ist
vielleicht nur aus. Automatisches Aufräumen wäre in einer Notfall-App fatal.

## Hersteller-Spalte

Jede Zeile bekommt eine Herstellerzelle: **Bild + Markenname**.

- **Bild:** Ein Produktfoto aus `src/assets/devices/`, falls für die Modellkennung eines
  hinterlegt ist (`DEVICE_PHOTOS`). Sonst ein selbst gezeichnetes Symbol zur Geräteart,
  abgeleitet aus der Modellkennung (`SNSW-…` → Schalter, `SNPL-…` → Steckdose, …). Die
  Ableitung ist eine Heuristik und beeinflusst **nur das Symbol** — nie, was die App
  schaltet.
- **Kein Herstellerlogo im Repo.** Logo und Produktfotos von Shelly gehören Allterco; ein
  Apache-2.0-Repository kann sie nicht mitliefern, ohne die Lizenz zu unterlaufen. Der
  Markenname als Wort ist zulässige nominative Nennung, ein nachgebautes Logo wäre es
  nicht. `DEVICE_PHOTOS` ist deshalb leer und dokumentiert, wie eigene, lizenzierte Bilder
  eingehängt werden.

## Aufteilung der Komponenten

Die Spike-Oberfläche lag komplett in `AppComponent` (TODO_OPEN §3). Mit zwei Seiten geht das
nicht mehr:

```
AppComponent            Rahmen: Kopf, Reiter, Fuß
├─ DiscoveryPage        Scan + Fundliste
└─ ProjectPage          Projektverwaltung + gespeicherte Geräte
   └─ DeviceRowComponent   eine Zeile (beide Seiten), Inhalt der letzten Spalte per <ng-content>
      └─ DeviceImageComponent
DeviceStateService      Ist-Zustand und Schaltbefehle je Gerät — geteilt von beiden Seiten
```

`DeviceStateService` hält den Zustand außerhalb der Seiten, damit ein Reiterwechsel nicht
jede Statusabfrage neu auslöst.

## Nicht Teil dieses Schritts

- Export/Import (REQUIREMENTS §5)
- Suchfeld/Filter, Einstellungsansicht (TODO_OPEN §3)
- Kanalnamen aus `Shelly.GetConfig`
- Geräte-Auth (REQUIREMENTS §4.3) — gesperrte Geräte lassen sich aufnehmen, aber nicht schalten

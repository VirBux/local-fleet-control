/**
 * Deutsche Texte — zugleich die **Referenzsprache**: Aus diesem Objekt leitet sich der
 * Schlüsseltyp ab (siehe `messages.ts`), alle anderen Sprachen müssen ihn vollständig
 * bedienen. Ein vergessener Schlüssel ist damit ein Compilerfehler, keine leere Stelle
 * in der Oberfläche.
 *
 * Platzhalter in geschweiften Klammern (`{hosts}`) werden zur Laufzeit ersetzt.
 *
 * Nicht übersetzt werden Produkt- und Markenname („Local Fleet Control", „powered by
 * HA Fleet Manager") sowie Nutzerdaten wie Raum- und Kategorienamen (REQUIREMENTS
 * §4.4.1).
 */
export const de = {
  'language.label': 'Sprache',

  'project.label': 'Projekt:',
  'project.none': '— keins —',
  'project.rename': 'Projekt umbenennen',
  'project.newPlaceholder': 'Neues Projekt',
  'project.newLabel': 'Name des neuen Projekts',
  'project.create': 'Anlegen',
  'project.delete': 'Projekt löschen',
  'project.deleteConfirm': 'Wirklich löschen?',

  'rooms.label': 'Räume:',
  'rooms.remove': 'Raum entfernen',
  'rooms.addPlaceholder': 'Raum hinzufügen',
  'rooms.addLabel': 'Neuer Raum',

  'categories.label': 'Kategorien:',
  'categories.remove': 'Kategorie entfernen',
  'categories.addPlaceholder': 'Kategorie hinzufügen',
  'categories.addLabel': 'Neue Kategorie',

  'scan.rangeLabel': 'Scan-Bereich',
  'scan.start': 'Geräte suchen',
  'scan.running': 'Suche läuft …',
  'scan.presets': 'Eigene Netze:',
  'scan.presetBlocked': 'Nicht scannbar: {reason}',
  'scan.noNetworks': 'Keine lokalen Netze gefunden — Bereich von Hand eintragen.',
  'scan.reasonNoHosts': 'keine Geräteadressen',
  'scan.reasonTooLarge': 'zu groß',

  'range.empty': 'Bereich angeben, z. B. 192.168.1.0/24',
  'range.invalid': 'Ungültiger Bereich. Beispiel: 192.168.1.0/24',
  'range.noHosts': 'Ein /{prefix} enthält keine Geräteadressen — hier ist nichts zu finden.',
  'range.tooLarge':
    'Bereich zu groß ({hosts} Adressen, erlaubt sind {max}). Kleiner wählen, z. B. /24.',
  'range.notPrivate': 'Nur private Netze: 10.x, 172.16–31.x, 192.168.x oder 100.64–127.x.',

  'group.by': 'Gruppieren nach:',
  'group.room': 'Raum',
  'group.category': 'Kategorie',
  'group.none': 'gar nicht',

  'device.channel': 'Kanal {number}',
  'device.generation': 'Gen {generation}',
  'device.protected': 'Passwortgeschützt',
  'device.on': 'An',
  'device.off': 'Aus',
  'device.turnOn': 'Ein',
  'device.turnOff': 'Aus',
  'device.toggle': 'Umschalten',
  'device.loading': 'Status wird abgefragt …',
  'device.retry': 'Erneut versuchen',
  'device.unsupported': 'Erkannt, nicht steuerbar',
  'device.unsupportedWith': 'Erkannt, nicht steuerbar ({kinds})',

  'assignment.namePlaceholder': 'Eigener Name',
  'assignment.nameLabel': 'Name für {device}',
  'assignment.category': '— Kategorie —',
  'assignment.categoryLabel': 'Kategorie für {device}',
  'assignment.room': '— Raum —',
  'assignment.roomLabel': 'Raum für {device}',

  'error.unreachable': 'Gerät nicht erreichbar.',
  'error.locked': 'Passwortgeschützt — Anmeldung ist noch nicht gebaut.',
  'error.badJson': 'Antwort auf die Statusabfrage war kein JSON.',
  'error.badStatus': 'Unerwartete Antwort auf die Statusabfrage.',
  'error.http': 'Gerät antwortet mit HTTP {status}.',
  'error.unexpected': 'Unerwarteter Fehler.',

  'empty.title': 'In {range} wurde kein Shelly gefunden. Häufige Ursachen:',
  'empty.rangeTitle': 'Falscher Bereich.',
  'empty.rangeText':
    'Die Geräte hängen oft in einem anderen Subnetz als dieser Rechner — den Bereich direkt ' +
    'eintragen, z. B. 192.168.10.0/24. Das Tunnelnetz eines VPN (z. B. 172.27.66.0/24) zu ' +
    'scannen bringt nichts: Dort wohnt nur die Gegenstelle, nicht die Geräte dahinter.',
  'empty.vpnTitle': 'VPN leitet allen Verkehr in den Tunnel.',
  'empty.vpnText':
    'Bei AllowedIPs = 0.0.0.0/0 blockiert der WireGuard-Client zusätzlich „Block untunneled ' +
    'traffic" — dann ist auch das eigene LAN nicht mehr erreichbar. In der VPN-Konfiguration ' +
    'einschränken.',
  'empty.timeoutTitle': 'Geräte antworten langsamer als das Zeitlimit.',
  'empty.timeoutText': 'Über einen Tunnel kann das passieren — Scan wiederholen.',
} as const;

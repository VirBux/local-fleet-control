import type { Messages } from './messages';

/** Kroatische Texte. Der Typ erzwingt Vollständigkeit gegenüber `de`. */
export const hr: Messages = {
  'language.label': 'Jezik',

  'tab.discovery': 'Traženje',
  'tab.project': 'Projekt',

  'project.label': 'Projekt:',
  'project.none': '— nijedan —',
  'project.rename': 'Preimenuj projekt',
  'project.newPlaceholder': 'Novi projekt',
  'project.newLabel': 'Naziv novog projekta',
  'project.create': 'Stvori',
  'project.delete': 'Obriši projekt',
  'project.deleteConfirm': 'Stvarno obrisati?',
  'project.devices': 'Uređaji ({count})',
  'project.refresh': 'Osvježi stanje',
  'project.noDevices':
    'U projektu još nema uređaja. Na kartici „Traženje” pretraži mrežu i dodaj ih — tada ' +
    'ostaju trajno spremljeni.',
  'project.noProject':
    'Nije odabran projekt. Stvori jedan: tek projekt trajno sprema uređaje, prostorije i ' +
    'nazive.',

  'rooms.label': 'Prostorije:',
  'rooms.remove': 'Ukloni prostoriju',
  'rooms.addPlaceholder': 'Dodaj prostoriju',
  'rooms.addLabel': 'Nova prostorija',

  'categories.label': 'Kategorije:',
  'categories.remove': 'Ukloni kategoriju',
  'categories.addPlaceholder': 'Dodaj kategoriju',
  'categories.addLabel': 'Nova kategorija',

  'scan.rangeLabel': 'Raspon pretraživanja',
  'scan.start': 'Pretraži uređaje',
  'scan.running': 'Pretraživanje …',
  'scan.presets': 'Vaše mreže:',
  'scan.presetBlocked': 'Nije moguće pretražiti: {reason}',
  'scan.noNetworks': 'Nije pronađena nijedna lokalna mreža — unesite raspon ručno.',
  'scan.reasonNoHosts': 'nema adresa uređaja',
  'scan.reasonTooLarge': 'prevelik',

  'range.empty': 'Unesite raspon, npr. 192.168.1.0/24',
  'range.invalid': 'Neispravan raspon. Primjer: 192.168.1.0/24',
  'range.noHosts': 'Raspon /{prefix} ne sadrži adrese uređaja — ovdje nema što pronaći.',
  'range.tooLarge':
    'Raspon je prevelik ({hosts} adresa, dopušteno je {max}). Odaberite manji, npr. /24.',
  'range.notPrivate': 'Samo privatne mreže: 10.x, 172.16–31.x, 192.168.x ili 100.64–127.x.',

  'group.by': 'Grupiraj po:',
  'group.room': 'Prostoriji',
  'group.category': 'Kategoriji',
  'group.none': 'bez grupiranja',
  'group.unassignedRoom': 'Bez prostorije',
  'group.unassignedCategory': 'Bez kategorije',

  'device.channel': 'Kanal {number}',
  'device.generation': 'Gen {generation}',
  'device.protected': 'Zaštićeno lozinkom',
  'device.on': 'Uključeno',
  'device.off': 'Isključeno',
  'device.turnOn': 'Uključi',
  'device.turnOff': 'Isključi',
  'device.toggle': 'Promijeni',
  'device.openCover': 'Gore',
  'device.closeCover': 'Dolje',
  'device.stopCover': 'Stop',

  'cover.open': 'Otvorena',
  'cover.closed': 'Zatvorena',
  'cover.opening': 'Otvara se …',
  'cover.closing': 'Zatvara se …',
  'cover.stopped': 'Zaustavljena',
  'cover.calibrating': 'Kalibracija …',
  'cover.unknown': 'Nepoznato',
  'cover.position': '{position} %',

  'device.loading': 'Dohvaćanje stanja …',
  'device.retry': 'Pokušaj ponovno',
  'device.unsupported': 'Prepoznato, nije upravljivo',
  'device.unsupportedWith': 'Prepoznato, nije upravljivo ({kinds})',
  'device.vendor': 'Proizvođač',
  'device.add': 'Dodaj u projekt',
  'device.added': 'U projektu',
  'device.remove': 'Ukloni',

  'discovery.noProject':
    'Nema aktivnog projekta — stvori ga na kartici „Projekt”, zatim se pronađeni uređaji ' +
    'mogu preuzeti.',

  'assignment.namePlaceholder': 'Vlastiti naziv',
  'assignment.nameLabel': 'Naziv za {device}',
  'assignment.category': '— Kategorija —',
  'assignment.categoryLabel': 'Kategorija za {device}',
  'assignment.room': '— Prostorija —',
  'assignment.roomLabel': 'Prostorija za {device}',

  'error.unreachable': 'Uređaj nije dostupan.',
  'error.locked': 'Zaštićeno lozinkom — prijava još nije izrađena.',
  'error.badJson': 'Odgovor na upit o stanju nije bio JSON.',
  'error.badStatus': 'Neočekivan odgovor na upit o stanju.',
  'error.http': 'Uređaj odgovara s HTTP {status}.',
  'error.unexpected': 'Neočekivana pogreška.',

  'empty.title': 'U rasponu {range} nije pronađen nijedan Shelly. Česti uzroci:',
  'empty.rangeTitle': 'Pogrešan raspon.',
  'empty.rangeText':
    'Uređaji su često u drugoj podmreži nego ovo računalo — unesite raspon izravno, npr. ' +
    '192.168.10.0/24. Pretraživanje tunelske mreže VPN-a (npr. 172.27.66.0/24) ne donosi ' +
    'ništa: ondje je samo druga strana veze, a ne uređaji iza nje.',
  'empty.vpnTitle': 'VPN usmjerava sav promet u tunel.',
  'empty.vpnText':
    'Uz AllowedIPs = 0.0.0.0/0 WireGuard dodatno blokira promet izvan tunela — tada ni ' +
    'vlastiti LAN više nije dostupan. Ograničite to u postavkama VPN-a.',
  'empty.timeoutTitle': 'Uređaji odgovaraju sporije od vremenskog ograničenja.',
  'empty.timeoutText': 'Kroz tunel se to može dogoditi — ponovite pretraživanje.',
};

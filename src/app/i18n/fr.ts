import type { Messages } from './messages';

/** Französische Texte. Der Typ erzwingt Vollständigkeit gegenüber `de`. */
export const fr: Messages = {
  'language.label': 'Langue',

  'project.label': 'Projet :',
  'project.none': '— aucun —',
  'project.rename': 'Renommer le projet',
  'project.newPlaceholder': 'Nouveau projet',
  'project.newLabel': 'Nom du nouveau projet',
  'project.create': 'Créer',
  'project.delete': 'Supprimer le projet',
  'project.deleteConfirm': 'Vraiment supprimer ?',

  'rooms.label': 'Pièces :',
  'rooms.remove': 'Retirer la pièce',
  'rooms.addPlaceholder': 'Ajouter une pièce',
  'rooms.addLabel': 'Nouvelle pièce',

  'categories.label': 'Catégories :',
  'categories.remove': 'Retirer la catégorie',
  'categories.addPlaceholder': 'Ajouter une catégorie',
  'categories.addLabel': 'Nouvelle catégorie',

  'scan.rangeLabel': 'Plage de recherche',
  'scan.start': 'Rechercher des appareils',
  'scan.running': 'Recherche en cours …',
  'scan.presets': 'Vos réseaux :',
  'scan.presetBlocked': 'Non analysable : {reason}',
  'scan.noNetworks': 'Aucun réseau local trouvé — saisissez une plage manuellement.',
  'scan.reasonNoHosts': "pas d'adresses d'appareil",
  'scan.reasonTooLarge': 'trop grande',

  'range.empty': 'Indiquez une plage, p. ex. 192.168.1.0/24',
  'range.invalid': 'Plage invalide. Exemple : 192.168.1.0/24',
  'range.noHosts': "Un /{prefix} ne contient aucune adresse d'appareil — il n'y a rien à trouver.",
  'range.tooLarge':
    'Plage trop grande ({hosts} adresses, {max} autorisées). Choisissez-en une plus petite, ' +
    'p. ex. /24.',
  'range.notPrivate': 'Réseaux privés uniquement : 10.x, 172.16–31.x, 192.168.x ou 100.64–127.x.',

  'group.by': 'Grouper par :',
  'group.room': 'Pièce',
  'group.category': 'Catégorie',
  'group.none': 'sans groupement',

  'device.channel': 'Canal {number}',
  'device.generation': 'Gén. {generation}',
  'device.protected': 'Protégé par mot de passe',
  'device.on': 'Allumé',
  'device.off': 'Éteint',
  'device.turnOn': 'Allumer',
  'device.turnOff': 'Éteindre',
  'device.toggle': 'Basculer',
  'device.loading': 'Lecture de l’état …',
  'device.retry': 'Réessayer',
  'device.unsupported': 'Détecté, non pilotable',
  'device.unsupportedWith': 'Détecté, non pilotable ({kinds})',

  'assignment.namePlaceholder': 'Nom personnalisé',
  'assignment.nameLabel': 'Nom de {device}',
  'assignment.category': '— Catégorie —',
  'assignment.categoryLabel': 'Catégorie de {device}',
  'assignment.room': '— Pièce —',
  'assignment.roomLabel': 'Pièce de {device}',

  'error.unreachable': 'Appareil inaccessible.',
  'error.locked': "Protégé par mot de passe — l'authentification n'est pas encore implémentée.",
  'error.badJson': "La réponse d'état n'était pas du JSON.",
  'error.badStatus': "Réponse d'état inattendue.",
  'error.http': "L'appareil répond avec HTTP {status}.",
  'error.unexpected': 'Erreur inattendue.',

  'empty.title': 'Aucun Shelly trouvé dans {range}. Causes fréquentes :',
  'empty.rangeTitle': 'Mauvaise plage.',
  'empty.rangeText':
    'Les appareils se trouvent souvent dans un autre sous-réseau que cet ordinateur — ' +
    'saisissez la plage directement, p. ex. 192.168.10.0/24. Analyser le réseau du tunnel ' +
    "d'un VPN (p. ex. 172.27.66.0/24) ne sert à rien : seul le point distant s'y trouve, pas " +
    'les appareils derrière lui.',
  'empty.vpnTitle': 'Le VPN dirige tout le trafic dans le tunnel.',
  'empty.vpnText':
    'Avec AllowedIPs = 0.0.0.0/0, le client WireGuard bloque en plus le trafic hors tunnel — ' +
    'votre propre réseau local devient alors inaccessible. Restreignez-le dans la ' +
    'configuration du VPN.',
  'empty.timeoutTitle': 'Les appareils répondent plus lentement que le délai imparti.',
  'empty.timeoutText': 'Cela peut arriver à travers un tunnel — relancez la recherche.',
};

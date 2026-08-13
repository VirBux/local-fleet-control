import type { Messages } from './messages';

/** Spanische Texte. Der Typ erzwingt Vollständigkeit gegenüber `de`. */
export const es: Messages = {
  'language.label': 'Idioma',

  'project.label': 'Proyecto:',
  'project.none': '— ninguno —',
  'project.rename': 'Renombrar proyecto',
  'project.newPlaceholder': 'Nuevo proyecto',
  'project.newLabel': 'Nombre del nuevo proyecto',
  'project.create': 'Crear',
  'project.delete': 'Eliminar proyecto',
  'project.deleteConfirm': '¿Eliminar de verdad?',

  'rooms.label': 'Habitaciones:',
  'rooms.remove': 'Quitar habitación',
  'rooms.addPlaceholder': 'Añadir habitación',
  'rooms.addLabel': 'Nueva habitación',

  'categories.label': 'Categorías:',
  'categories.remove': 'Quitar categoría',
  'categories.addPlaceholder': 'Añadir categoría',
  'categories.addLabel': 'Nueva categoría',

  'scan.rangeLabel': 'Rango de búsqueda',
  'scan.start': 'Buscar dispositivos',
  'scan.running': 'Buscando …',
  'scan.presets': 'Tus redes:',
  'scan.presetBlocked': 'No se puede analizar: {reason}',
  'scan.noNetworks': 'No se encontraron redes locales — introduce un rango manualmente.',
  'scan.reasonNoHosts': 'sin direcciones de dispositivo',
  'scan.reasonTooLarge': 'demasiado grande',

  'range.empty': 'Indica un rango, p. ej. 192.168.1.0/24',
  'range.invalid': 'Rango no válido. Ejemplo: 192.168.1.0/24',
  'range.noHosts': 'Un /{prefix} no contiene direcciones de dispositivo — aquí no hay nada.',
  'range.tooLarge':
    'Rango demasiado grande ({hosts} direcciones, se permiten {max}). Elige uno menor, p. ej. /24.',
  'range.notPrivate': 'Solo redes privadas: 10.x, 172.16–31.x, 192.168.x o 100.64–127.x.',

  'group.by': 'Agrupar por:',
  'group.room': 'Habitación',
  'group.category': 'Categoría',
  'group.none': 'sin agrupar',

  'device.channel': 'Canal {number}',
  'device.generation': 'Gen {generation}',
  'device.protected': 'Protegido con contraseña',
  'device.on': 'Encendido',
  'device.off': 'Apagado',
  'device.turnOn': 'Encender',
  'device.turnOff': 'Apagar',
  'device.toggle': 'Alternar',
  'device.loading': 'Consultando estado …',
  'device.retry': 'Reintentar',
  'device.unsupported': 'Detectado, no controlable',
  'device.unsupportedWith': 'Detectado, no controlable ({kinds})',

  'assignment.namePlaceholder': 'Nombre propio',
  'assignment.nameLabel': 'Nombre de {device}',
  'assignment.category': '— Categoría —',
  'assignment.categoryLabel': 'Categoría de {device}',
  'assignment.room': '— Habitación —',
  'assignment.roomLabel': 'Habitación de {device}',

  'error.unreachable': 'Dispositivo no accesible.',
  'error.locked': 'Protegido con contraseña — el inicio de sesión aún no está implementado.',
  'error.badJson': 'La respuesta de estado no era JSON.',
  'error.badStatus': 'Respuesta de estado inesperada.',
  'error.http': 'El dispositivo responde con HTTP {status}.',
  'error.unexpected': 'Error inesperado.',

  'empty.title': 'No se encontró ningún Shelly en {range}. Causas frecuentes:',
  'empty.rangeTitle': 'Rango incorrecto.',
  'empty.rangeText':
    'Los dispositivos suelen estar en una subred distinta a la de este ordenador — introduce ' +
    'el rango directamente, p. ej. 192.168.10.0/24. Analizar la red del túnel de una VPN ' +
    '(p. ej. 172.27.66.0/24) no sirve de nada: allí solo está el extremo remoto, no los ' +
    'dispositivos que hay detrás.',
  'empty.vpnTitle': 'La VPN envía todo el tráfico al túnel.',
  'empty.vpnText':
    'Con AllowedIPs = 0.0.0.0/0 el cliente de WireGuard bloquea además el tráfico fuera del ' +
    'túnel — con lo que tu propia LAN deja de ser accesible. Limítalo en la configuración de ' +
    'la VPN.',
  'empty.timeoutTitle': 'Los dispositivos responden más lento que el límite de tiempo.',
  'empty.timeoutText': 'A través de un túnel puede ocurrir — repite la búsqueda.',
};

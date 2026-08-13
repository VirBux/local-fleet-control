import type { Messages } from './messages';

/** Englische Texte. Der Typ erzwingt Vollständigkeit gegenüber `de`. */
export const en: Messages = {
  'language.label': 'Language',

  'project.label': 'Project:',
  'project.none': '— none —',
  'project.rename': 'Rename project',
  'project.newPlaceholder': 'New project',
  'project.newLabel': 'Name of the new project',
  'project.create': 'Create',
  'project.delete': 'Delete project',
  'project.deleteConfirm': 'Really delete?',

  'rooms.label': 'Rooms:',
  'rooms.remove': 'Remove room',
  'rooms.addPlaceholder': 'Add room',
  'rooms.addLabel': 'New room',

  'categories.label': 'Categories:',
  'categories.remove': 'Remove category',
  'categories.addPlaceholder': 'Add category',
  'categories.addLabel': 'New category',

  'scan.rangeLabel': 'Scan range',
  'scan.start': 'Find devices',
  'scan.running': 'Searching …',
  'scan.presets': 'Your networks:',
  'scan.presetBlocked': 'Cannot be scanned: {reason}',
  'scan.noNetworks': 'No local networks found — enter a range manually.',
  'scan.reasonNoHosts': 'no device addresses',
  'scan.reasonTooLarge': 'too large',

  'range.empty': 'Enter a range, e.g. 192.168.1.0/24',
  'range.invalid': 'Invalid range. Example: 192.168.1.0/24',
  'range.noHosts': 'A /{prefix} contains no device addresses — there is nothing to find here.',
  'range.tooLarge':
    'Range too large ({hosts} addresses, {max} allowed). Choose a smaller one, e.g. /24.',
  'range.notPrivate': 'Private networks only: 10.x, 172.16–31.x, 192.168.x or 100.64–127.x.',

  'group.by': 'Group by:',
  'group.room': 'Room',
  'group.category': 'Category',
  'group.none': 'no grouping',

  'device.channel': 'Channel {number}',
  'device.generation': 'Gen {generation}',
  'device.protected': 'Password protected',
  'device.on': 'On',
  'device.off': 'Off',
  'device.turnOn': 'On',
  'device.turnOff': 'Off',
  'device.toggle': 'Toggle',
  'device.loading': 'Reading status …',
  'device.retry': 'Try again',
  'device.unsupported': 'Detected, not controllable',
  'device.unsupportedWith': 'Detected, not controllable ({kinds})',

  'assignment.namePlaceholder': 'Custom name',
  'assignment.nameLabel': 'Name for {device}',
  'assignment.category': '— Category —',
  'assignment.categoryLabel': 'Category for {device}',
  'assignment.room': '— Room —',
  'assignment.roomLabel': 'Room for {device}',

  'error.unreachable': 'Device not reachable.',
  'error.locked': 'Password protected — sign-in is not built yet.',
  'error.badJson': 'The status response was not JSON.',
  'error.badStatus': 'Unexpected status response.',
  'error.http': 'Device responded with HTTP {status}.',
  'error.unexpected': 'Unexpected error.',

  'empty.title': 'No Shelly found in {range}. Common causes:',
  'empty.rangeTitle': 'Wrong range.',
  'empty.rangeText':
    'Devices often live in a different subnet than this computer — enter the range directly, ' +
    'e.g. 192.168.10.0/24. Scanning a VPN tunnel network (e.g. 172.27.66.0/24) achieves ' +
    'nothing: only the remote endpoint lives there, not the devices behind it.',
  'empty.vpnTitle': 'The VPN routes all traffic into the tunnel.',
  'empty.vpnText':
    'With AllowedIPs = 0.0.0.0/0 the WireGuard client also blocks untunneled traffic — which ' +
    'cuts off your own LAN as well. Narrow it down in the VPN configuration.',
  'empty.timeoutTitle': 'Devices answer slower than the time limit.',
  'empty.timeoutText': 'This can happen through a tunnel — run the scan again.',
};

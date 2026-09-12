import { messages, translate } from '@ccssmnn/intl';

export { baseCommonMessages, deCommonMessages };

const baseCommonMessages = messages({
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.privacy': 'Privacy',
  'common.install.title': 'Install Pip',
  'common.install.description': 'Keep it one tap away on this device.',
  'common.install.action': 'Install',
  'common.error.generic': 'Something went wrong. Try again.',
  'common.error.connection': 'Connection problem. Try again.',
  'common.relative.seconds': '{$seconds}s ago',
  'common.relative.minutes': '{$minutes}m ago',
  'common.copyUnavailable': 'Copy is unavailable. Select and copy the invitation code below.',
  'common.dismissError': 'Dismiss error',
  'common.closeDialog': 'Close dialog',
  'common.audioLevel': 'Audio level',

  'role.baby': 'Baby',
  'role.parent': 'Parent',

  'nav.monitor': 'Monitor',
  'nav.activity': 'Activity',
  'nav.settings': 'Settings',
  'nav.roomLabel': 'Room navigation',
  'nav.projectLinks': 'Project links',
  'app.title': 'Pip · A little peace of mind',
  'app.description':
    'A little peace of mind. A private, audio-only baby monitor for your own devices.',
  'app.homeLabel': 'Pip homepage',
  'app.roomHomeLabel': 'Pip home',
  'app.accessRemoved': 'Your access to this room was removed.',
  'app.switchFailed': 'Could not switch rooms.',
  'app.connectBeforeSwitch': 'Connect before switching rooms.',
  'notFound.title': 'Page not found',
  'notFound.action': 'Open your monitor',

  'language.title': 'Language',
  'language.description': 'Choose the language Pip uses.',
  'language.label': 'Language',
  'language.name.en': 'English',
  'language.name.de': 'Deutsch',
});

const deCommonMessages = translate(baseCommonMessages, {
  'common.cancel': 'Abbrechen',
  'common.save': 'Speichern',
  'common.privacy': 'Datenschutz',
  'common.install.title': 'Pip installieren',
  'common.install.description': 'Bleibt mit einem Tipp auf diesem Gerät.',
  'common.install.action': 'Installieren',
  'common.error.generic': 'Etwas ist schiefgelaufen. Versuch es noch einmal.',
  'common.error.connection': 'Verbindungsproblem. Versuch es noch einmal.',
  'common.relative.seconds': 'vor {$seconds} s',
  'common.relative.minutes': 'vor {$minutes} min',
  'common.copyUnavailable':
    'Kopieren ist nicht möglich. Markiere den Einladungscode unten und kopiere ihn.',
  'common.dismissError': 'Fehler schließen',
  'common.closeDialog': 'Dialog schließen',
  'common.audioLevel': 'Audiolautstärke',

  'role.baby': 'Baby',
  'role.parent': 'Elternteil',

  'nav.monitor': 'Monitor',
  'nav.activity': 'Aktivität',
  'nav.settings': 'Einstellungen',
  'nav.roomLabel': 'Raumnavigation',
  'nav.projectLinks': 'Projektlinks',
  'app.title': 'Pip · Eine kleine Ruhe',
  'app.description':
    'Eine kleine Ruhe. Ein privates, reines Audio-Babyphone für deine eigenen Geräte.',
  'app.homeLabel': 'Pip-Startseite',
  'app.roomHomeLabel': 'Pip-Start',
  'app.accessRemoved': 'Dein Zugriff auf diesen Raum wurde entfernt.',
  'app.switchFailed': 'Räume konnten nicht gewechselt werden.',
  'app.connectBeforeSwitch': 'Stelle die Verbindung her, bevor du den Raum wechselst.',
  'notFound.title': 'Seite nicht gefunden',
  'notFound.action': 'Öffne deinen Monitor',

  'language.title': 'Sprache',
  'language.description': 'Wähle die Sprache, die Pip verwendet.',
  'language.label': 'Sprache',
  'language.name.en': 'English',
  'language.name.de': 'Deutsch',
});

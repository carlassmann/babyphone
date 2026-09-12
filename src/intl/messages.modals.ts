import { messages, translate } from '@ccssmnn/intl';

export { baseModalMessages, deModalMessages };

const baseModalMessages = messages({
  'invite.openTitle': 'Open this invitation?',
  'invite.switchBody':
    'Switch from {$room}? Monitoring and notifications follow the active room. You can return to your saved rooms anytime.',
  'invite.switching': 'Switching room…',
  'invite.switchAndJoin': 'Switch room and join',
  'invite.keep': 'Keep current room',

  'rooms.switchLabel': 'Switch room',
  'rooms.saved': 'Saved rooms',
  'rooms.title': 'Your rooms',
  'rooms.subtitle': 'Switching rooms stops live audio.',
  'rooms.forgetLabel': 'Forget {$room}',
  'rooms.forget': 'Forget',

  'privacy.title': 'Privacy',
  'privacy.paragraph1':
    'Sound is analyzed on the baby device. Pip never records it. Live listening uses an encrypted audio connection between your devices, with a relay only when needed.',
  'privacy.paragraph2':
    'Your invitation code is the key to your room. Share it only with people you trust.',
  'privacy.source': 'Source code',

  'roomInvite.title': 'Invite a device',
  'roomInvite.body':
    'Choose Me on the joining device to listen, or Baby for the device that stays in the nursery.',
  'roomInvite.codeLabel': 'Private invitation code',
  'roomInvite.copyLink': 'Copy invite link',
  'roomInvite.linkCopied': 'Link copied',
  'roomInvite.copyCode': 'Copy code',
  'roomInvite.codeCopied': 'Code copied',
  'roomInvite.shareHint': 'Anyone with this invitation can join. Share it privately.',
  'roomInvite.reset': 'Reset invitation link',

  'deviceSettings.title': 'Device settings',
  'deviceSettings.name': 'Device name',
  'deviceSettings.switchToParent': 'Switch to parent device',
  'deviceSettings.switchToBaby': 'Switch to baby device',
  'deviceSettings.switchHint': 'Switching roles pauses monitoring and stops live audio.',
  'deviceSettings.leave': 'Leave this room',
  'deviceSettings.leaveHint': 'You’ll need the invitation code to join again.',

  'removeDevice.title': 'Remove {$name}?',
  'removeDevice.body':
    '{$name} loses access to this room right away. The invitation link is reset, so it can only rejoin with a new invitation.',
  'removeDevice.confirm': 'Remove {$name}',
  'removeDevice.keep': 'Keep this device',

  'scanner.title': 'Scan invitation',
  'scanner.prompt': 'Point your camera at the invitation QR code.',
  'scanner.invalid': 'This is not a Pip invitation code. Try another QR code.',
  'scanner.cameraUnavailable':
    'Camera unavailable. Allow camera access, or close this and paste the code.',

  'qr.alt': 'Invitation code QR',
  'qr.hint': 'Scan to copy the code, then paste it into Pip’s Join a room screen.',
  'qr.unavailable': 'QR code unavailable. Copy the invitation code below.',
});

const deModalMessages = translate(baseModalMessages, {
  'invite.openTitle': 'Diese Einladung öffnen?',
  'invite.switchBody':
    'Von {$room} wechseln? Überwachung und Benachrichtigungen folgen dem aktiven Raum. Du kannst jederzeit zu deinen gespeicherten Räumen zurückkehren.',
  'invite.switching': 'Raum wird gewechselt…',
  'invite.switchAndJoin': 'Raum wechseln und beitreten',
  'invite.keep': 'Aktuellen Raum behalten',

  'rooms.switchLabel': 'Raum wechseln',
  'rooms.saved': 'Gespeicherte Räume',
  'rooms.title': 'Deine Räume',
  'rooms.subtitle': 'Beim Wechseln des Raums wird Live-Audio beendet.',
  'rooms.forgetLabel': '{$room} vergessen',
  'rooms.forget': 'Vergessen',

  'privacy.title': 'Datenschutz',
  'privacy.paragraph1':
    'Der Ton wird auf dem Babygerät analysiert. Pip zeichnet ihn nie auf. Beim Live-Zuhören wird eine verschlüsselte Audioverbindung zwischen deinen Geräten verwendet, mit einer Weiterleitung nur bei Bedarf.',
  'privacy.paragraph2':
    'Dein Einladungscode ist der Schlüssel zu deinem Raum. Teile ihn nur mit Personen, denen du vertraust.',
  'privacy.source': 'Quellcode',

  'roomInvite.title': 'Gerät einladen',
  'roomInvite.body':
    'Wähle „Ich“ auf dem beitretenden Gerät zum Zuhören oder „Baby“ für das Gerät, das im Kinderzimmer bleibt.',
  'roomInvite.codeLabel': 'Privater Einladungscode',
  'roomInvite.copyLink': 'Einladungslink kopieren',
  'roomInvite.linkCopied': 'Link kopiert',
  'roomInvite.copyCode': 'Code kopieren',
  'roomInvite.codeCopied': 'Code kopiert',
  'roomInvite.shareHint': 'Jede Person mit dieser Einladung kann beitreten. Teile sie privat.',
  'roomInvite.reset': 'Einladungslink zurücksetzen',

  'deviceSettings.title': 'Geräteeinstellungen',
  'deviceSettings.name': 'Gerätename',
  'deviceSettings.switchToParent': 'Zum Elterngerät wechseln',
  'deviceSettings.switchToBaby': 'Zum Babygerät wechseln',
  'deviceSettings.switchHint': 'Ein Rollenwechsel pausiert die Überwachung und beendet Live-Audio.',
  'deviceSettings.leave': 'Diesen Raum verlassen',
  'deviceSettings.leaveHint': 'Du brauchst den Einladungscode, um wieder beizutreten.',

  'removeDevice.title': '{$name} entfernen?',
  'removeDevice.body':
    '{$name} verliert sofort den Zugriff auf diesen Raum. Der Einladungslink wird zurückgesetzt, sodass nur mit einer neuen Einladung wieder beigetreten werden kann.',
  'removeDevice.confirm': '{$name} entfernen',
  'removeDevice.keep': 'Dieses Gerät behalten',

  'scanner.title': 'Einladung scannen',
  'scanner.prompt': 'Richte deine Kamera auf den QR-Code der Einladung.',
  'scanner.invalid': 'Das ist kein Pip-Einladungscode. Versuch es mit einem anderen QR-Code.',
  'scanner.cameraUnavailable':
    'Kamera nicht verfügbar. Erlaube den Kamerazugriff oder schließe das Fenster und füge den Code ein.',

  'qr.alt': 'QR-Code für den Einladungscode',
  'qr.hint':
    'Scanne, um den Code zu kopieren, und füge ihn dann in den Bildschirm „Raum betreten“ von Pip ein.',
  'qr.unavailable': 'QR-Code nicht verfügbar. Kopiere den Einladungscode unten.',
});

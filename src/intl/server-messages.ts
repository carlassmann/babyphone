import { messages, translate } from '@ccssmnn/intl';
import type { Locale } from './locale';

export { errorMessagesFor, pushMessagesFor };
export type { ServerErrorKey, ServerPushKey };

const errorMessagesEn = messages({
  'error.generic': 'Could not complete that request.',
  'error.connectionProblem': 'Connection problem. Reconnect and try again.',
  'error.name': 'Use a name between 1 and 40 characters.',
  'error.bodyRequired': 'Request body required.',
  'error.tooLarge': 'Request too large',
  'error.invalidRequest': 'Invalid request.',
  'error.joinAgain': 'Join your room again.',
  'error.notFound': 'Not found',
  'error.originNotAllowed': 'Origin not allowed',
  'error.tooManyAttempts': 'Too many attempts. Try again in a minute.',
  'error.roomNotFoundInvite': 'Room not found. Check your invitation code.',
  'error.deviceExpired': 'Device session expired. Join your room again.',
  'error.renameRoom': 'Use a parent device to rename the room.',
  'error.renameDevice': 'You cannot rename that device.',
  'error.manageAccess': 'Use a parent device to manage access.',
  'error.chooseOther': 'Choose another device to remove.',
  'error.babyUnavailable': 'That baby device is unavailable.',
  'error.sensitivity': 'Invalid sensitivity.',
  'error.mute': 'Invalid mute setting.',
  'error.clearActivity': 'Use a parent device to clear activity.',
  'error.activateFirst': 'Activate this room before enabling notifications.',
  'error.subscription': 'Invalid notification subscription.',
  'error.enableFirst': 'Enable notifications first.',
  'error.role': 'Invalid role',
  'error.websocket': 'WebSocket required',
  'error.roomNotFound': 'Room not found',
  'error.tooManyConnections': 'Too many connections',
  'error.chooseRole': 'Choose a device role.',
  'error.invitationExpired': 'Invitation expired. Ask for a new link.',
  'error.startMonitoring': 'Start monitoring before sending an alert.',
  'error.authenticateFirst': 'Authenticate first.',
  'error.unknownMessage': 'Unknown message.',
  'error.deviceUnavailable': 'That device is unavailable.',
  'error.audioMessage': 'Invalid audio connection message.',
  'error.notMonitoring': 'The baby device is not monitoring.',
  'error.relayUnavailable': 'Audio relay unavailable. Try again.',
  'error.relayConfig': 'Audio relay configuration unavailable.',
  'error.pushAuthFailed':
    'Push server authentication failed. Check the server VAPID keys and contact URL.',
  'error.pushExpired': 'This notification subscription expired. Enable notifications again.',
  'error.pushUnavailable': 'The push service is temporarily unavailable. Try the test again.',
});

const errorMessagesDe = translate(errorMessagesEn, {
  'error.generic': 'Die Anfrage konnte nicht abgeschlossen werden.',
  'error.connectionProblem': 'Verbindungsproblem. Verbinde dich erneut und versuch es noch einmal.',
  'error.name': 'Verwende einen Namen mit 1 bis 40 Zeichen.',
  'error.bodyRequired': 'Anfragekörper erforderlich.',
  'error.tooLarge': 'Anfrage zu groß',
  'error.invalidRequest': 'Ungültige Anfrage.',
  'error.joinAgain': 'Tritt deinem Raum erneut bei.',
  'error.notFound': 'Nicht gefunden',
  'error.originNotAllowed': 'Ursprung nicht erlaubt',
  'error.tooManyAttempts': 'Zu viele Versuche. Versuch es in einer Minute erneut.',
  'error.roomNotFoundInvite': 'Raum nicht gefunden. Prüfe deinen Einladungscode.',
  'error.deviceExpired': 'Gerätesitzung abgelaufen. Tritt deinem Raum erneut bei.',
  'error.renameRoom': 'Verwende ein Elterngerät, um den Raum umzubenennen.',
  'error.renameDevice': 'Du kannst dieses Gerät nicht umbenennen.',
  'error.manageAccess': 'Verwende ein Elterngerät, um den Zugriff zu verwalten.',
  'error.chooseOther': 'Wähle ein anderes Gerät zum Entfernen.',
  'error.babyUnavailable': 'Dieses Babygerät ist nicht verfügbar.',
  'error.sensitivity': 'Ungültige Empfindlichkeit.',
  'error.mute': 'Ungültige Stummschaltung.',
  'error.clearActivity': 'Verwende ein Elterngerät, um die Aktivität zu löschen.',
  'error.activateFirst': 'Aktiviere diesen Raum, bevor du Benachrichtigungen aktivierst.',
  'error.subscription': 'Ungültiges Benachrichtigungs-Abo.',
  'error.enableFirst': 'Aktiviere zuerst Benachrichtigungen.',
  'error.role': 'Ungültige Rolle',
  'error.websocket': 'WebSocket erforderlich',
  'error.roomNotFound': 'Raum nicht gefunden',
  'error.tooManyConnections': 'Zu viele Verbindungen',
  'error.chooseRole': 'Wähle eine Geräterolle.',
  'error.invitationExpired': 'Einladung abgelaufen. Bitte um einen neuen Link.',
  'error.startMonitoring': 'Starte die Überwachung, bevor du einen Hinweis sendest.',
  'error.authenticateFirst': 'Zuerst authentifizieren.',
  'error.unknownMessage': 'Unbekannte Nachricht.',
  'error.deviceUnavailable': 'Dieses Gerät ist nicht verfügbar.',
  'error.audioMessage': 'Ungültige Audioverbindungs-Nachricht.',
  'error.notMonitoring': 'Das Babygerät überwacht nicht.',
  'error.relayUnavailable': 'Audio-Weiterleitung nicht verfügbar. Versuch es erneut.',
  'error.relayConfig': 'Audio-Weiterleitung nicht konfiguriert.',
  'error.pushAuthFailed':
    'Authentifizierung beim Push-Server fehlgeschlagen. Prüfe die VAPID-Schlüssel und die Kontakt-URL des Servers.',
  'error.pushExpired':
    'Dieses Benachrichtigungs-Abo ist abgelaufen. Aktiviere Benachrichtigungen erneut.',
  'error.pushUnavailable': 'Der Push-Dienst ist vorübergehend nicht verfügbar. Versuch es erneut.',
});

const pushMessagesEn = messages({
  'push.noise.title': 'A little sound',
  'push.noise.body': '{$name} detected noise.',
  'push.paused.title': 'Monitoring paused',
  'push.paused.body': '{$name} stopped monitoring.',
  'push.offline.title': 'Check your baby device',
  'push.offline.body': '{$name} lost its connection. Check on your baby.',
  'push.test.title': 'Pip is all ears',
  'push.test.body': 'Your test notification arrived. Try this again with Pip in the background.',
});

const pushMessagesDe = translate(pushMessagesEn, {
  'push.noise.title': 'Ein leises Geräusch',
  'push.noise.body': '{$name} hat ein Geräusch erkannt.',
  'push.paused.title': 'Überwachung pausiert',
  'push.paused.body': '{$name} hat die Überwachung gestoppt.',
  'push.offline.title': 'Prüfe dein Babygerät',
  'push.offline.body': '{$name} hat die Verbindung verloren. Schau nach deinem Baby.',
  'push.test.title': 'Pip ist ganz Ohr',
  'push.test.body':
    'Deine Testbenachrichtigung ist angekommen. Versuch es erneut, während Pip im Hintergrund ist.',
});

const errorCatalogs = { en: errorMessagesEn, de: errorMessagesDe } as const;
const pushCatalogs = { en: pushMessagesEn, de: pushMessagesDe } as const;

type ServerErrorKey = keyof typeof errorMessagesEn;
type ServerPushKey = keyof typeof pushMessagesEn;

function errorMessagesFor(locale: Locale) {
  return errorCatalogs[locale] as unknown as typeof errorMessagesEn;
}

function pushMessagesFor(locale: Locale) {
  return pushCatalogs[locale] as unknown as typeof pushMessagesEn;
}

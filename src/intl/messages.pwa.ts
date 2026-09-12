import { messages, translate } from '@ccssmnn/intl';

export { basePwaMessages, dePwaMessages };

const basePwaMessages = messages({
  'pwa.updateTitle': 'Pip update available',
  'pwa.updateBlocked': 'Pause monitoring and listening before updating.',
  'pwa.updateAction': 'Update',
  'pwa.offlineUnavailable': 'Offline installation is unavailable. Reload while connected.',
  'pwa.iosHint':
    'On iPhone or iPad, add Pip to your Home Screen, then open it there to enable alerts.',
  'pwa.blocked':
    'Notifications are blocked. Allow them in your browser or device settings, then try again.',
  'pwa.gettingReady': 'Installation is still getting ready. Reload and try again.',
  'pwa.notConfigured': 'Push notifications are not configured on this server.',
  'pwa.timeout': 'Notification setup timed out. Check your connection and try again.',
});

const dePwaMessages = translate(basePwaMessages, {
  'pwa.updateTitle': 'Pip-Update verfügbar',
  'pwa.updateBlocked': 'Pausiere Überwachung und Zuhören, bevor du aktualisierst.',
  'pwa.updateAction': 'Aktualisieren',
  'pwa.offlineUnavailable':
    'Offline-Installation ist nicht verfügbar. Lade neu, während du verbunden bist.',
  'pwa.iosHint':
    'Füge Pip auf iPhone oder iPad zum Home-Bildschirm hinzu und öffne es dort, um Hinweise zu aktivieren.',
  'pwa.blocked':
    'Benachrichtigungen sind blockiert. Erlaube sie in deinen Browser- oder Geräteeinstellungen und versuch es dann erneut.',
  'pwa.gettingReady': 'Die Installation wird noch vorbereitet. Lade neu und versuch es erneut.',
  'pwa.notConfigured': 'Push-Benachrichtigungen sind auf diesem Server nicht konfiguriert.',
  'pwa.timeout':
    'Die Einrichtung der Benachrichtigungen hat zu lange gedauert. Prüfe deine Verbindung und versuch es erneut.',
});

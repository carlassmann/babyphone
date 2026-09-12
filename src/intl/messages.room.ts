import { messages, translate } from '@ccssmnn/intl';

export { baseRoomMessages, deRoomMessages };

const baseRoomMessages = messages({
  'mic.https': 'Microphone needs HTTPS or localhost. Open Pip using a secure address.',
  'mic.stopped': 'Microphone stopped. Restart monitoring.',
  'mic.interrupted': 'Microphone interrupted. Keep Pip open, then restart monitoring.',
  'mic.suspended': 'Audio was suspended. Keep Pip open and restart monitoring.',

  'audio.connecting': 'Connecting audio',
  'audio.live': 'Listening live',
  'audio.paused': 'Tap Resume audio to hear your baby.',
  'audio.stopped': 'Audio stopped',
  'audio.disconnected': 'Audio disconnected. Tap Listen to reconnect.',
  'audio.failed': 'Could not connect. Try again; different networks may need TURN.',

  'status.connecting': 'Connecting',
  'status.connected': 'Connected',
  'status.lost': 'Connection lost',
  'status.accessRemoved': 'Access removed',
  'status.inactive': 'Room inactive',
  'status.openElsewhere': 'Open in another tab',

  'mascot.stir': 'Make Pip stir',
  'mascot.awake': 'Pip awake and looking around',

  'room.inviteDevice': 'Invite a device',
  'room.screenAwake': 'Screen staying awake',
  'room.screenWakeUnavailable':
    'Screen wake lock unavailable. Keep this screen awake manually while listening.',
  'room.deviceRemoved': 'Device removed. Previous invitation links no longer work.',
  'room.invitationReset': 'Invitation reset. Previous links no longer work.',
  'room.micBlocked': 'Microphone access is blocked. Allow it in browser settings, then try again.',

  'notice.accessRemoved':
    'Your access to this room was removed. Leave this room and ask for a new invitation.',
  'notice.openElsewhere':
    'This device is open in another tab. Close this tab or reload to use Pip here.',
  'notice.connectionUnavailable':
    'Connection unavailable. Monitoring alerts cannot reach you. Check your baby and your connection; Pip is reconnecting.',
  'notice.dismiss': 'Dismiss notification',

  'event.noise.title': 'Noise detected',
  'event.paused.title': 'Monitoring paused',
  'event.offline.title': 'Baby device disconnected',
  'event.noise.detail': '{$name} picked up a sound.',
  'event.paused.detail': '{$name} stopped monitoring.',
  'event.offline.detail': '{$name} lost its connection. Check on your baby.',

  'monitor.statusMonitoring': 'Monitoring',
  'monitor.statusLocal': 'Monitoring locally only',
  'monitor.statusReady': 'Ready when you are',
  'monitor.titleMonitoring': 'Monitoring sound',
  'monitor.titleReady': 'Ready to monitor',
  'monitor.subtitleMonitoring': 'Listening for sounds in this room.',
  'monitor.subtitleReady': 'Place this device near your baby, out of reach.',
  'monitor.roomSound': 'Room sound',
  'monitor.levelLittle': 'A little sound',
  'monitor.levelQuiet': 'Quiet',
  'monitor.levelOff': 'Microphone off',
  'monitor.mascotAlt': 'Pip sleeping',
  'monitor.pause': 'Pause monitoring',
  'monitor.start': 'Start monitoring',
  'monitor.opening': 'Opening microphone…',
  'monitor.micOn': 'Microphone on',
  'monitor.micOff': 'Microphone off',
  'monitor.awakeOn': 'Screen staying awake',
  'monitor.awakeOff': 'Screen wake lock off',
  'monitor.parentsOnline':
    '.input {$count :number} .match $count one {{one parent device online}} * {{{$count} parent devices online}}',
  'monitor.keepAwake': 'Keep the screen awake manually. Automatic screen wake lock is unavailable.',

  'monitor.dim': 'Dim screen',
  'monitor.restoreBrightness': 'Restore brightness',
  'monitor.dimTitle': 'Reduce screen brightness',
  'monitor.restoreTitle': 'Restore screen brightness',

  'parent.emptyAlt': 'Pip waiting for a baby device',
  'parent.emptyTitle': 'Add your baby device',
  'parent.emptyBody':
    'Add a device to stay with your baby.{#br}{/br}Open the invitation on the phone that stays in the nursery.',
  'parent.emptyInvite': 'Invite a baby device',

  'parent.deviceUnknown': 'Connection unknown',
  'parent.deviceOffline': 'Offline · check device',
  'parent.deviceMonitoring': 'Monitoring',
  'parent.devicePaused': 'Monitoring paused',
  'parent.deviceSensitivity': '{$name} sound sensitivity',
  'parent.deviceLastSound': 'Last sound {$time}',
  'parent.deviceNoSounds': 'No sounds detected yet',
  'parent.stopListening': 'Stop listening',
  'parent.listen': 'Listen',
  'parent.resumeAudio': 'Resume audio',

  'nest.alt': 'Pip watching over the nest',
  'nest.titleSound': 'A little sound',
  'nest.titleQuiet': 'All quiet',
  'nest.titlePaused': 'Nobody listening',
  'nest.soundDetail': '{$name} is picking up some noise.',
  'nest.quietDetail': 'Pip is keeping watch over {$name}.',
  'nest.pausedDetail': 'Start monitoring on the baby device so Pip can listen in.',
  'nest.fallbackBaby': 'A baby device',
  'nest.theNest': 'the nest',

  'mute.muted': 'Alerts muted',
  'mute.mute': 'Mute alerts',

  'sensitivity.label': 'Sound sensitivity',
  'sensitivity.low': 'Low',
  'sensitivity.medium': 'Medium',
  'sensitivity.high': 'High',
  'sensitivity.hint': 'Alerts after 1.5 seconds of sound, with 20 seconds between alerts.',

  'activity.title': 'Activity',
  'activity.last24h': 'Last 24 hours',
  'activity.clear': 'Clear activity',
  'activity.noise': 'A little sound',
  'activity.paused': 'Monitoring paused',
  'activity.offline': 'Device disconnected',
  'activity.empty': 'No activity yet.{#br}{/br}Sound and connection events appear here.',

  'settings.room': 'Room',
  'settings.roomName': 'Room name',
  'settings.deviceSetup': 'Device setup',
  'settings.notifications': 'Notifications',
  'settings.manageDevice': 'Manage this device',
  'settings.devicesTitle': 'Devices in this room',
  'settings.devicesHint':
    'Removing a device also resets the invitation link. Devices that stay keep their connection.',
  'settings.deviceNameFor': 'Name for {$name}',
  'settings.deviceOnline': 'Online',
  'settings.deviceOffline': 'Offline',
  'settings.rename': 'Rename',
  'settings.renameLabel': 'Rename {$name}',
  'settings.remove': 'Remove',
  'settings.removeLabel': 'Remove {$name}',
  'settings.deviceTypeBaby': 'Baby device',
  'settings.deviceTypeParent': 'Parent device',
  'settings.babyKeepPlugged': 'Keep this device plugged in, with Pip open in the foreground.',
  'settings.babyCheckAnalyzed': 'Volume is analyzed here',
  'settings.babyCheckNoSave': 'No audio is saved',
  'settings.babyCheckListen': 'Parents can listen anytime',
  'settings.notificationsBody':
    'Get a notification for noise or a disconnected baby device, even when Pip is in the background.',
  'settings.notificationsEnable': 'Enable notifications',
  'settings.notificationsEnabled': 'Notifications enabled',
  'settings.notificationsTest': 'Test notification',
  'settings.notificationsHint':
    'Allow notifications in your device settings too. Delivery can be delayed by your device or network.',
  'settings.notificationsAccepted':
    'Accepted by the push service. Check this device for the test notification.',
});

const deRoomMessages = translate(baseRoomMessages, {
  'mic.https': 'Das Mikrofon benötigt HTTPS oder localhost. Öffne Pip über eine sichere Adresse.',
  'mic.stopped': 'Mikrofon gestoppt. Starte die Überwachung neu.',
  'mic.interrupted': 'Mikrofon unterbrochen. Lass Pip geöffnet und starte die Überwachung neu.',
  'mic.suspended': 'Audio wurde ausgesetzt. Lass Pip geöffnet und starte die Überwachung neu.',

  'audio.connecting': 'Audio wird verbunden',
  'audio.live': 'Live zuhören',
  'audio.paused': 'Tippe auf „Audio fortsetzen“, um dein Baby zu hören.',
  'audio.stopped': 'Audio gestoppt',
  'audio.disconnected': 'Audio getrennt. Tippe auf „Zuhören“, um erneut zu verbinden.',
  'audio.failed':
    'Verbindung nicht möglich. Versuch es erneut; verschiedene Netzwerke brauchen evtl. TURN.',

  'status.connecting': 'Verbinden',
  'status.connected': 'Verbunden',
  'status.lost': 'Verbindung verloren',
  'status.accessRemoved': 'Zugriff entfernt',
  'status.inactive': 'Raum inaktiv',
  'status.openElsewhere': 'In einem anderen Tab geöffnet',

  'mascot.stir': 'Pip wecken',
  'mascot.awake': 'Pip ist wach und schaut sich um',

  'room.inviteDevice': 'Gerät einladen',
  'room.screenAwake': 'Bildschirm bleibt wach',
  'room.screenWakeUnavailable':
    'Bildschirm-Wachhalten nicht verfügbar. Halte diesen Bildschirm beim Zuhören manuell wach.',
  'room.deviceRemoved': 'Gerät entfernt. Frühere Einladungslinks funktionieren nicht mehr.',
  'room.invitationReset': 'Einladung zurückgesetzt. Frühere Links funktionieren nicht mehr.',
  'room.micBlocked':
    'Der Mikrofonzugriff ist blockiert. Erlaube ihn in den Browsereinstellungen und versuch es dann erneut.',

  'notice.accessRemoved':
    'Dein Zugriff auf diesen Raum wurde entfernt. Verlass den Raum und bitte um eine neue Einladung.',
  'notice.openElsewhere':
    'Dieses Gerät ist in einem anderen Tab geöffnet. Schließe diesen Tab oder lade neu, um Pip hier zu verwenden.',
  'notice.connectionUnavailable':
    'Verbindung nicht verfügbar. Hinweise können dich nicht erreichen. Prüfe dein Baby und deine Verbindung; Pip verbindet sich erneut.',
  'notice.dismiss': 'Hinweis schließen',

  'event.noise.title': 'Geräusch erkannt',
  'event.paused.title': 'Überwachung pausiert',
  'event.offline.title': 'Babygerät getrennt',
  'event.noise.detail': '{$name} hat ein Geräusch aufgenommen.',
  'event.paused.detail': '{$name} hat die Überwachung gestoppt.',
  'event.offline.detail': '{$name} hat die Verbindung verloren. Schau nach deinem Baby.',

  'monitor.statusMonitoring': 'Überwachung läuft',
  'monitor.statusLocal': 'Nur lokale Überwachung',
  'monitor.statusReady': 'Bereit, wenn du es bist',
  'monitor.titleMonitoring': 'Geräusche überwachen',
  'monitor.titleReady': 'Bereit zur Überwachung',
  'monitor.subtitleMonitoring': 'Hört auf Geräusche in diesem Raum.',
  'monitor.subtitleReady': 'Platziere dieses Gerät in der Nähe deines Babys, außer Reichweite.',
  'monitor.roomSound': 'Raumgeräusch',
  'monitor.levelLittle': 'Ein leises Geräusch',
  'monitor.levelQuiet': 'Still',
  'monitor.levelOff': 'Mikrofon aus',
  'monitor.mascotAlt': 'Pip schläft',
  'monitor.pause': 'Überwachung pausieren',
  'monitor.start': 'Überwachung starten',
  'monitor.opening': 'Mikrofon wird geöffnet…',
  'monitor.micOn': 'Mikrofon an',
  'monitor.micOff': 'Mikrofon aus',
  'monitor.awakeOn': 'Bildschirm bleibt wach',
  'monitor.awakeOff': 'Bildschirm-Wachhalten aus',
  'monitor.parentsOnline':
    '.input {$count :number} .match $count one {{ein Elterngerät online}} * {{{$count} Elterngeräte online}}',
  'monitor.keepAwake':
    'Halte den Bildschirm manuell wach. Automatisches Wachhalten ist nicht verfügbar.',

  'monitor.dim': 'Bildschirm dimmen',
  'monitor.restoreBrightness': 'Helligkeit zurücksetzen',
  'monitor.dimTitle': 'Bildschirmhelligkeit verringern',
  'monitor.restoreTitle': 'Bildschirmhelligkeit zurücksetzen',

  'parent.emptyAlt': 'Pip wartet auf ein Babygerät',
  'parent.emptyTitle': 'Füge dein Babygerät hinzu',
  'parent.emptyBody':
    'Füge ein Gerät hinzu, das bei deinem Baby bleibt.{#br}{/br}Öffne die Einladung auf dem Handy, das im Kinderzimmer bleibt.',
  'parent.emptyInvite': 'Babygerät einladen',

  'parent.deviceUnknown': 'Verbindung unbekannt',
  'parent.deviceOffline': 'Offline · Gerät prüfen',
  'parent.deviceMonitoring': 'Überwachung läuft',
  'parent.devicePaused': 'Überwachung pausiert',
  'parent.deviceSensitivity': 'Geräuschempfindlichkeit von {$name}',
  'parent.deviceLastSound': 'Letztes Geräusch {$time}',
  'parent.deviceNoSounds': 'Noch keine Geräusche erkannt',
  'parent.stopListening': 'Zuhören beenden',
  'parent.listen': 'Zuhören',
  'parent.resumeAudio': 'Audio fortsetzen',

  'nest.alt': 'Pip wacht über das Nest',
  'nest.titleSound': 'Ein leises Geräusch',
  'nest.titleQuiet': 'Alles still',
  'nest.titlePaused': 'Niemand hört zu',
  'nest.soundDetail': '{$name} nimmt etwas Lärm auf.',
  'nest.quietDetail': 'Pip wacht über {$name}.',
  'nest.pausedDetail': 'Starte die Überwachung auf dem Babygerät, damit Pip zuhören kann.',
  'nest.fallbackBaby': 'Ein Babygerät',
  'nest.theNest': 'das Nest',

  'mute.muted': 'Hinweise stumm',
  'mute.mute': 'Hinweise stummschalten',

  'sensitivity.label': 'Geräuschempfindlichkeit',
  'sensitivity.low': 'Niedrig',
  'sensitivity.medium': 'Mittel',
  'sensitivity.high': 'Hoch',
  'sensitivity.hint':
    'Hinweise nach 1,5 Sekunden Geräusch, mit 20 Sekunden zwischen den Hinweisen.',

  'activity.title': 'Aktivität',
  'activity.last24h': 'Letzte 24 Stunden',
  'activity.clear': 'Aktivität löschen',
  'activity.noise': 'Ein leises Geräusch',
  'activity.paused': 'Überwachung pausiert',
  'activity.offline': 'Gerät getrennt',
  'activity.empty':
    'Noch keine Aktivität.{#br}{/br}Geräusch- und Verbindungsereignisse erscheinen hier.',

  'settings.room': 'Raum',
  'settings.roomName': 'Raumname',
  'settings.deviceSetup': 'Geräte-Einrichtung',
  'settings.notifications': 'Benachrichtigungen',
  'settings.manageDevice': 'Dieses Gerät verwalten',
  'settings.devicesTitle': 'Geräte in diesem Raum',
  'settings.devicesHint':
    'Das Entfernen eines Geräts setzt auch den Einladungslink zurück. Geräte, die bleiben, behalten ihre Verbindung.',
  'settings.deviceNameFor': 'Name für {$name}',
  'settings.deviceOnline': 'Online',
  'settings.deviceOffline': 'Offline',
  'settings.rename': 'Umbenennen',
  'settings.renameLabel': '{$name} umbenennen',
  'settings.remove': 'Entfernen',
  'settings.removeLabel': '{$name} entfernen',
  'settings.deviceTypeBaby': 'Babygerät',
  'settings.deviceTypeParent': 'Elterngerät',
  'settings.babyKeepPlugged': 'Lass dieses Gerät angeschlossen und Pip im Vordergrund geöffnet.',
  'settings.babyCheckAnalyzed': 'Lautstärke wird hier analysiert',
  'settings.babyCheckNoSave': 'Es wird kein Audio gespeichert',
  'settings.babyCheckListen': 'Eltern können jederzeit zuhören',
  'settings.notificationsBody':
    'Erhalte eine Benachrichtigung bei Geräuschen oder einem getrennten Babygerät, auch wenn Pip im Hintergrund ist.',
  'settings.notificationsEnable': 'Benachrichtigungen aktivieren',
  'settings.notificationsEnabled': 'Benachrichtigungen aktiviert',
  'settings.notificationsTest': 'Testbenachrichtigung',
  'settings.notificationsHint':
    'Erlaube Benachrichtigungen auch in den Geräteeinstellungen. Die Zustellung kann durch dein Gerät oder Netzwerk verzögert werden.',
  'settings.notificationsAccepted':
    'Vom Push-Dienst angenommen. Prüfe dieses Gerät auf die Testbenachrichtigung.',
});

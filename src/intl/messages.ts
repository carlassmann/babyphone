import { check, merge } from '@ccssmnn/intl';
import { baseCommonMessages, deCommonMessages } from './messages.common';
import { baseLandingMessages, deLandingMessages } from './messages.landing';
import { baseRoomMessages, deRoomMessages } from './messages.room';
import { baseModalMessages, deModalMessages } from './messages.modals';
import { basePwaMessages, dePwaMessages } from './messages.pwa';
import type { Locale } from './locale';

export { messagesEn, messagesDe, catalogs };
export type { MessageKey };

const messagesEn = merge(
  baseCommonMessages,
  baseLandingMessages,
  baseRoomMessages,
  baseModalMessages,
  basePwaMessages,
);

const messagesDe = check(
  messagesEn,
  deCommonMessages,
  deLandingMessages,
  deRoomMessages,
  deModalMessages,
  dePwaMessages,
);

const catalogs = { en: messagesEn, de: messagesDe } as const;

type MessageKey = keyof typeof messagesEn;

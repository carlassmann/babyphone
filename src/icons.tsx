import { IconContext, type Icon } from '@phosphor-icons/react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellRinging,
  CaretDown,
  CaretRight,
  Check,
  Copy,
  DeviceMobile,
  GearSix,
  Headphones,
  LinkSimple,
  Microphone,
  MoonStars,
  Pause,
  Plus,
  Sun,
  SunDim,
  Waveform,
  WifiHigh,
  X,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';

const DEFAULTS = { weight: 'regular', size: 20, mirrored: false } as const;

export function IconDefaults({ children }: { children: ReactNode }) {
  return <IconContext.Provider value={DEFAULTS}>{children}</IconContext.Provider>;
}

export type IconComponent = Icon;

export const BackIcon = ArrowLeft;
export const ForwardIcon = ArrowRight;
export const AlertIcon = Bell;
export const AlertActiveIcon = BellRinging;
export const ExpandIcon = CaretDown;
export const DisclosureIcon = CaretRight;
export const CheckIcon = Check;
export const CopyIcon = Copy;
export const DeviceIcon = DeviceMobile;
export const SettingsIcon = GearSix;
export const ParentIcon = Headphones;
export const InviteLinkIcon = LinkSimple;
export const MicrophoneIcon = Microphone;
export const BabyIcon = MoonStars;
export const PauseIcon = Pause;
export const AddIcon = Plus;
export const BrightIcon = Sun;
export const DimIcon = SunDim;
export const SoundIcon = Waveform;
export const ConnectionIcon = WifiHigh;
export const CloseIcon = X;

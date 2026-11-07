import { Platform } from 'react-native';

import type { AppConfig } from '@/api/types';

export interface LoginMessageInput {
  config: Pick<AppConfig, 'eventName' | 'appUrl' | 'apkUrl'> | null;
  teamName: string;
  phone: string;
  password: string;
}

/** The installed web app's address: configured APP_URL, else this site's origin on web. */
export function resolveAppUrl(config: Pick<AppConfig, 'appUrl'> | null): string {
  const configured = config?.appUrl?.trim();
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) return window.location.origin;
  return '';
}

/** Same text the lead sends by SMS, WhatsApp or copy/paste. */
export function buildLoginMessage({ config, teamName, phone, password }: LoginMessageInput): string {
  const event = config?.eventName || 'Tech Arena';
  const apkUrl = config?.apkUrl?.trim() ?? '';
  const appUrl = resolveAppUrl(config);

  const install: string[] = [];
  if (apkUrl) install.push(`Android ${apkUrl}`);
  if (appUrl) install.push(`iPhone ${appUrl} (open in Safari > Share > Add to Home Screen)`);
  const installLine = install.length
    ? `Install the app: ${install.join(' / ')}.`
    : 'Install the app (ask your team lead for the link).';

  return `${event}: You've been added to team ${teamName}. ${installLine} Login with your phone ${phone} and team password: ${password}`;
}

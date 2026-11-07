import * as Clipboard from 'expo-clipboard';
import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';

import { phoneDigits } from './phone';

/** Opens a URL; returns false if nothing could handle it. */
export async function openUrl(url: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return false;
      window.open(url, '_blank', 'noopener');
      return true;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** `sms:` URI. iOS uses `&body=`, everyone else `?body=`. */
function smsLink(phone: string, body: string): string {
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return `sms:${phone}${sep}body=${encodeURIComponent(body)}`;
}

/**
 * Composes an SMS on this device (the user still taps send).
 * Uses expo-sms when available, otherwise an `sms:` link (web / devices without SMS).
 */
export async function smsTo(phone: string, body: string): Promise<boolean> {
  try {
    if (Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
      await SMS.sendSMSAsync([phone], body);
      return true;
    }
  } catch {
    // fall through to the link
  }
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    window.location.href = smsLink(phone, body);
    return true;
  }
  return openUrl(smsLink(phone, body));
}

/** WhatsApp chat with a pre-filled message via https://wa.me/<digits>?text=... */
export function whatsappUrl(phone: string, body: string): string {
  return `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(body)}`;
}

export function whatsappTo(phone: string, body: string): Promise<boolean> {
  return openUrl(whatsappUrl(phone, body));
}

/** Copies text; returns false if the clipboard is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

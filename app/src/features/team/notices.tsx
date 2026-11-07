import { useWindowDimensions } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Banner, EmptyState, goBack } from '@/components';
import { layout } from '@/theme';

/** True on tablets / desktop widths. */
export function useIsWide(): boolean {
  return useWindowDimensions().width >= layout.tabletMinWidth;
}

export function useIsLead(): boolean {
  return useAuth().role === 'lead';
}

/** Shown on lead-only screens when a member opens them. */
export function LeadOnlyNotice({ what }: { what: string }) {
  return (
    <EmptyState
      icon="lock-closed-outline"
      title="Team lead only"
      message={`Only your team lead can ${what}. Ask them if something needs to change.`}
      action={{ label: 'Go back', icon: 'chevron-back', onPress: () => goBack('/team') }}
    />
  );
}

export function RegistrationClosedBanner({ message }: { message: string }) {
  return <Banner type="warning" icon="lock-closed" title="Registration is closed" message={message} />;
}

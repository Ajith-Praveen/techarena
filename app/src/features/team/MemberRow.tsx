import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Member } from '@/api/types';
import { AppText, Badge } from '@/components';
import { formatPhone } from '@/lib/phone';
import { colors, spacing } from '@/theme';

import { photoUrlOf } from './people';
import { PersonAvatar } from './PersonAvatar';

export interface MemberRowProps {
  member: Member;
  isMe?: boolean;
  /** Show phone / email / USN lines (default true). */
  showContact?: boolean;
  right?: ReactNode;
  last?: boolean;
}

export function MemberRow({ member, isMe, showContact = true, right, last }: MemberRowProps) {
  const lead = member.role === 'lead';
  return (
    <View style={[styles.row, last ? null : styles.border]}>
      <PersonAvatar name={member.name} photoUrl={photoUrlOf(member)} size={48} ringColor={isMe ? colors.accent : undefined} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {member.name}
          </AppText>
          <Badge label={lead ? 'Lead' : 'Member'} tone={lead ? 'accent' : 'violet'} icon={lead ? 'star' : undefined} />
          {isMe ? <Badge label="You" tone="neutral" /> : null}
        </View>
        {showContact ? (
          <>
            <View style={styles.line}>
              <Ionicons name="call-outline" size={14} color={colors.muted} />
              <AppText variant="caption" color="textSecondary" selectable>
                {formatPhone(member.phone)}
              </AppText>
            </View>
            <View style={styles.line}>
              <Ionicons name="mail-outline" size={14} color={colors.muted} />
              <AppText variant="caption" color="textSecondary" numberOfLines={1} selectable style={styles.flex}>
                {member.email}
              </AppText>
            </View>
            {member.usn ? (
              <View style={styles.line}>
                <Ionicons name="id-card-outline" size={14} color={colors.muted} />
                <AppText variant="caption" color="textSecondary" selectable>
                  {member.usn}
                </AppText>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs + 2, marginBottom: 2 },
  name: { flexShrink: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  flex: { flexShrink: 1 },
});

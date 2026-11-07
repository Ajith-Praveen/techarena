import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, KeyValue } from '@/components';
import { useConfig } from '@/hooks';
import { copyToClipboard } from '@/lib';
import { spacing } from '@/theme';

export interface ShownCredentials {
  name: string;
  username: string;
  password: string;
  kind: 'created' | 'reset';
}

/** Shows a judge's login once, right after create / reset, with a copy button. */
export function CredentialsCard({ creds, onDismiss }: { creds: ShownCredentials; onDismiss: () => void }) {
  const { config } = useConfig();
  const [copied, setCopied] = useState<boolean | null>(null);
  const appUrl = config?.appUrl?.trim();
  const text = [
    `${config?.eventName ?? 'Tech Arena'} judge login`,
    `Name: ${creds.name}`,
    `Username: ${creds.username}`,
    `Password: ${creds.password}`,
    appUrl ? `App: ${appUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Card tone="success">
      <AppText variant="heading">{creds.kind === 'created' ? 'Judge created' : 'Password reset'}</AppText>
      <AppText color="muted" variant="caption" style={styles.sub}>
        Write this down or copy it now. The password is not shown again.
      </AppText>
      <KeyValue label="Name" value={creds.name} />
      <KeyValue label="Username" value={creds.username} mono copyable />
      <KeyValue label="Password" value={creds.password} mono copyable last />
      {copied === false ? <Banner type="warning" message="Copy failed. Please write the credentials down." /> : null}
      <View style={styles.actions}>
        <Button
          title={copied ? 'Copied' : 'Copy login details'}
          icon={copied ? 'checkmark' : 'copy-outline'}
          variant="secondary"
          onPress={async () => setCopied(await copyToClipboard(text))}
        />
        <Button title="Done" variant="ghost" onPress={onDismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: spacing.xs, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});

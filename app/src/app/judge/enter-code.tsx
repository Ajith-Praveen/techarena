import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

import { api, type ApiError } from '@/api/client';
import { AppText, Banner, Button, Card, OtpInput, Screen, type OtpInputHandle } from '@/components';
import { NextUpCard } from '@/features/judge/NextUpCard';
import { ScoreBreakdown } from '@/features/judge/ScoreBreakdown';
import { TeamConfirmCard } from '@/features/judge/TeamConfirmCard';
import type { JudgeEvaluation, JudgePublicTeam } from '@/features/judge/types';
import { useShake } from '@/features/judge/useShake';
import { useConfig } from '@/hooks';
import { errorFeedback, successFeedback, toApiError } from '@/lib';
import { colors, spacing } from '@/theme';

const CODE_LENGTH = 4;

type Lookup =
  | { status: 'idle' }
  | { status: 'loading'; code: string }
  | { status: 'notFound'; code: string }
  | { status: 'error'; code: string; error: ApiError }
  | { status: 'found'; code: string; team: JudgePublicTeam; myEvaluation: JudgeEvaluation | null };

export default function JudgeEnterCodeScreen() {
  const { config } = useConfig();
  const [code, setCode] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' });
  const otpRef = useRef<OtpInputHandle>(null);
  const requestId = useRef(0);
  const { shake, style: shakeStyle } = useShake();

  const runLookup = useCallback(
    async (value: string) => {
      const id = ++requestId.current;
      setLookup({ status: 'loading', code: value });
      try {
        const res = await api.judgeTeamByCode(value);
        if (id !== requestId.current) return;
        successFeedback();
        setLookup({ status: 'found', code: value, team: res.team, myEvaluation: res.myEvaluation });
      } catch (e) {
        if (id !== requestId.current) return;
        const err = toApiError(e);
        errorFeedback();
        if (err.status === 404) {
          setLookup({ status: 'notFound', code: value });
          shake();
          // Clear the digits after the shake so the judge can retype straight away.
          setTimeout(() => {
            if (id !== requestId.current) return;
            setCode('');
            otpRef.current?.focus();
          }, 450);
        } else {
          setLookup({ status: 'error', code: value, error: err });
        }
      }
    },
    [shake],
  );

  // Each visit starts blank: never carry a looked-up team across screens.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => otpRef.current?.focus(), 100);
      return () => {
        clearTimeout(t);
        requestId.current++;
        setCode('');
        setLookup({ status: 'idle' });
      };
    }, []),
  );

  const onChange = (value: string) => {
    setCode(value);
    if (value.length < CODE_LENGTH && lookup.status !== 'idle') {
      requestId.current++;
      setLookup({ status: 'idle' });
    }
  };

  const reset = () => {
    requestId.current++;
    setCode('');
    setLookup({ status: 'idle' });
    setTimeout(() => otpRef.current?.focus(), 50);
  };

  const startEvaluation = (team: JudgePublicTeam, teamCode: string) => {
    router.push({ pathname: '/judge/evaluate/[teamId]', params: { teamId: team.id, code: teamCode } });
  };

  const published = config?.resultsPublished === true;
  const busy = lookup.status === 'loading';

  return (
    <Screen title="Enter team code" backHref="/judge">
      {published ? (
        <Banner
          type="warning"
          title="Judging is closed"
          message="Results have been published, so no more scores can be submitted."
        />
      ) : null}

      {lookup.status === 'idle' || lookup.status === 'notFound' ? <NextUpCard /> : null}

      <Card>
        <View style={styles.codeCard}>
          <Ionicons name="keypad" size={32} color={colors.accent} />
          <AppText variant="heading" align="center">
            Ask the team for its 4-digit code
          </AppText>
          <AppText color="muted" align="center" style={styles.hint}>
            It is shown on their Tech Arena home screen.
          </AppText>
          <Animated.View style={[styles.otp, shakeStyle]}>
            <OtpInput
              ref={otpRef}
              value={code}
              onChange={onChange}
              onComplete={(v) => void runLookup(v)}
              length={CODE_LENGTH}
              autoFocus
              disabled={busy}
              error={lookup.status === 'notFound'}
              size="lg"
            />
          </Animated.View>
          <View style={styles.status}>
            {busy ? (
              <View style={styles.statusRow}>
                <ActivityIndicator color={colors.accent} />
                <AppText color="muted">Looking up team…</AppText>
              </View>
            ) : lookup.status === 'notFound' ? (
              <AppText color="danger" weight="700" align="center">
                No team with code {lookup.code}. Check the digits and try again.
              </AppText>
            ) : null}
          </View>
          {code.length > 0 && !busy ? (
            <Button title="Clear" icon="backspace-outline" variant="ghost" size="sm" fullWidth={false} onPress={reset} style={styles.clear} />
          ) : null}
        </View>
      </Card>

      {lookup.status === 'error' ? (
        <Banner
          type="error"
          title={lookup.error.isNetwork ? 'No connection' : 'Could not look up the team'}
          message={lookup.error.message}
          action={{ label: 'Try again', onPress: () => void runLookup(lookup.code) }}
        />
      ) : null}

      {lookup.status === 'found' && lookup.myEvaluation ? (
        <>
          <Banner
            type="success"
            title="Already evaluated"
            message="You have already scored this team. Scores are final and cannot be edited."
            icon="lock-closed"
          />
          <TeamConfirmCard team={lookup.team} compact />
          <Card>
            <AppText variant="overline" color="muted" style={styles.sectionLabel}>
              Your submitted scores
            </AppText>
            <ScoreBreakdown evaluation={lookup.myEvaluation} criteria={config?.criteria} maxPerJudge={config?.maxPerJudge} />
          </Card>
          <Button title="Enter another code" icon="keypad-outline" variant="secondary" size="lg" onPress={reset} />
        </>
      ) : null}

      {lookup.status === 'found' && !lookup.myEvaluation ? (
        <>
          <AppText variant="overline" color="muted" style={styles.sectionLabel}>
            Is this the right team?
          </AppText>
          <TeamConfirmCard team={lookup.team} />
          <View style={styles.actions}>
            <Button
              title="Start evaluation"
              icon="create-outline"
              size="lg"
              disabled={published}
              onPress={() => startEvaluation(lookup.team, lookup.code)}
            />
            <Button title="Wrong team? Enter another code" variant="ghost" onPress={reset} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  hint: { marginBottom: spacing.md },
  otp: { marginVertical: spacing.sm },
  status: { minHeight: 28, justifyContent: 'center', marginTop: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clear: { alignSelf: 'center' },
  sectionLabel: { marginBottom: spacing.sm, marginTop: spacing.xs },
  actions: { gap: spacing.sm },
});

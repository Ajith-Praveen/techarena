import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { Criterion, Evaluation } from '@/api/types';
import {
  AppText,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  ScoreSelector,
  Screen,
  TextField,
} from '@/components';
import { NextUpCard } from '@/features/judge/NextUpCard';
import { markScoredHere } from '@/features/judge/types';
import { ScoreBreakdown } from '@/features/judge/ScoreBreakdown';
import { TeamConfirmCard } from '@/features/judge/TeamConfirmCard';
import type { JudgePublicTeam } from '@/features/judge/types';
import { useAsync, useConfig } from '@/hooks';
import { confirm, errorFeedback, fieldErrors, successFeedback, toApiError } from '@/lib';
import { colors, spacing } from '@/theme';

const REMARKS_MAX = 500;
const TITLE = 'Evaluate';

type Notice = { type: 'error' | 'warning'; title: string; message: string };

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function goNextTeam() {
  router.dismissTo('/judge/enter-code');
}

function goHome() {
  router.dismissTo('/judge');
}

export default function JudgeEvaluateScreen() {
  const params = useLocalSearchParams<{ teamId: string; code?: string }>();
  const teamId = param(params.teamId);
  const code = param(params.code);
  const validCode = /^\d{4}$/.test(code);

  const { config, loading: configLoading, error: configError, refresh: refreshConfig } = useConfig();
  const { data, error, loading, refresh, reload } = useAsync(() => api.judgeTeamByCode(code), [code], {
    enabled: validCode,
  });

  const [scores, setScores] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState('');
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Evaluation | null>(null);
  const [closed, setClosed] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const submittingRef = useRef(false);

  const dirty =
    !submitted && !discarded && !closed && !data?.myEvaluation && (Object.keys(scores).length > 0 || remarks.trim() !== '');

  usePreventRemove(dirty, ({ repeat }) => {
    void confirm('Discard scores?', 'Your scores for this team have not been submitted yet.', 'Discard', {
      cancelText: 'Keep scoring',
      destructive: true,
    }).then((ok) => {
      if (!ok) return;
      setDiscarded(true);
      repeat();
    });
  });

  if (!validCode) {
    return (
      <Screen title={TITLE} backHref="/judge/enter-code">
        <EmptyState
          icon="keypad-outline"
          title="Team code missing"
          message="Open a team by entering its 4-digit code first."
          action={{ label: 'Enter code', icon: 'keypad', onPress: goNextTeam }}
        />
      </Screen>
    );
  }

  if (loading || (configLoading && !config)) {
    return (
      <Screen title={TITLE} backHref="/judge/enter-code">
        <LoadingView message="Loading team…" />
      </Screen>
    );
  }

  if (!config) {
    return (
      <Screen title={TITLE} backHref="/judge/enter-code">
        <ErrorView error={configError} title="Could not load the scoring criteria" onRetry={refreshConfig} />
      </Screen>
    );
  }

  if (!data) {
    const notFound = error?.status === 404;
    return (
      <Screen title={TITLE} backHref="/judge/enter-code">
        {notFound ? (
          <EmptyState
            icon="help-circle-outline"
            title="No team with that code"
            message={`Code ${code} does not belong to any team.`}
            action={{ label: 'Enter another code', icon: 'keypad', onPress: goNextTeam }}
          />
        ) : (
          <ErrorView error={error} onRetry={refresh} />
        )}
      </Screen>
    );
  }

  const team = data.team as JudgePublicTeam;
  const criteria = config.criteria;
  const maxPerJudge = config.maxPerJudge;

  if (team.id !== teamId) {
    return (
      <Screen title={TITLE} backHref="/judge/enter-code">
        <EmptyState
          icon="alert-circle-outline"
          title="Code does not match this team"
          message="The code you entered belongs to a different team. Enter the code again to be safe."
          action={{ label: 'Enter code', icon: 'keypad', onPress: goNextTeam }}
        />
      </Screen>
    );
  }

  if (submitted) {
    return <SubmittedView team={team} evaluation={submitted} criteria={criteria} maxPerJudge={maxPerJudge} />;
  }

  if (data.myEvaluation) {
    return (
      <Screen title="Already evaluated" back={false}>
        <Banner
          type="info"
          title="You already scored this team"
          message="Scores are final and cannot be edited."
          icon="lock-closed"
        />
        <TeamConfirmCard team={team} compact />
        <Card>
          <ScoreBreakdown evaluation={data.myEvaluation} criteria={criteria} maxPerJudge={maxPerJudge} />
        </Card>
        <DoneActions teamId={team.id} />
      </Screen>
    );
  }

  const scoredCount = criteria.filter((c) => scores[c.key] !== undefined).length;
  const allScored = scoredCount === criteria.length && criteria.length > 0;
  const total = criteria.reduce((sum, c) => sum + (scores[c.key] ?? 0), 0);
  const published = closed || config.resultsPublished;
  const canSubmit = allScored && !published && !submitting && remarks.length <= REMARKS_MAX;

  const setScore = (key: string, value: number) => {
    setScores((s) => ({ ...s, [key]: value }));
    if (fieldErrs[`scores.${key}`]) setFieldErrs((f) => ({ ...f, [`scores.${key}`]: '' }));
  };

  const onSubmit = async () => {
    if (submittingRef.current || !canSubmit) return;
    submittingRef.current = true;
    try {
      const ok = await confirm(
        'Submit scores?',
        `${team.name}: ${total} / ${maxPerJudge}.\n\nScores are final and cannot be edited.`,
        'Submit',
      );
      if (!ok) return;
      setSubmitting(true);
      setNotice(null);
      setFieldErrs({});
      const body = {
        teamId: team.id,
        code,
        scores: Object.fromEntries(criteria.map((c) => [c.key, scores[c.key] as number])),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      };
      const res = await api.submitEvaluation(body);
      markScoredHere(teamId);
      successFeedback();
      setSubmitted(res.evaluation);
    } catch (e) {
      errorFeedback();
      const err = toApiError(e);
      if (err.code === 'ALREADY_EVALUATED') {
        markScoredHere(teamId);
        setClosed(true);
        setNotice({ type: 'warning', title: 'Already evaluated', message: 'You have already scored this team. Your first submission stands.' });
        void reload();
      } else if (err.code === 'RESULTS_PUBLISHED') {
        setClosed(true);
        setNotice({ type: 'warning', title: 'Judging is closed', message: 'Results have been published, so no more scores can be submitted.' });
        void refreshConfig();
      } else {
        setFieldErrs(fieldErrors(err));
        setNotice({
          type: 'error',
          title: err.isNetwork ? 'Not submitted: no connection' : 'Could not submit scores',
          message: err.isNetwork ? `${err.message} Your scores are still here; try again.` : err.message,
        });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const footer = (
    <View style={styles.footerRow}>
      <View style={styles.totalBlock}>
        <AppText variant="overline" color="muted">
          Total
        </AppText>
        <AppText variant="title" color={allScored ? 'accent' : 'text'}>
          {total}
          <AppText variant="subheading" color="muted">
            {' '}
            / {maxPerJudge}
          </AppText>
        </AppText>
        <AppText variant="caption" color={allScored ? 'success' : 'muted'} numberOfLines={1}>
          {allScored ? 'All criteria scored' : `${scoredCount} of ${criteria.length} scored`}
        </AppText>
      </View>
      <Button
        title={submitting ? 'Submitting…' : 'Submit scores'}
        icon="checkmark-circle"
        size="lg"
        fullWidth={false}
        disabled={!canSubmit}
        loading={submitting}
        onPress={onSubmit}
        style={styles.submit}
      />
    </View>
  );

  return (
    <Screen title={TITLE} subtitle={team.name} backHref="/judge/enter-code" footer={footer}>
      <TeamConfirmCard team={team} compact />

      {notice ? <Banner type={notice.type} title={notice.title} message={notice.message} /> : null}
      {!notice && published ? (
        <Banner type="warning" title="Judging is closed" message="Results have been published, so no more scores can be submitted." />
      ) : null}
      {fieldErrs.code ? <Banner type="error" message={fieldErrs.code} /> : null}

      {criteria.map((c: Criterion) => (
        <View key={c.key}>
          <ScoreSelector
            label={c.label}
            description={c.description}
            max={c.max}
            value={scores[c.key] ?? null}
            onChange={(n) => setScore(c.key, n)}
            disabled={submitting || published}
          />
          {fieldErrs[`scores.${c.key}`] ? (
            <AppText variant="caption" color="danger" style={styles.fieldError}>
              {fieldErrs[`scores.${c.key}`]}
            </AppText>
          ) : null}
        </View>
      ))}
      {fieldErrs.scores ? (
        <AppText variant="caption" color="danger" style={styles.fieldError}>
          {fieldErrs.scores}
        </AppText>
      ) : null}

      <TextField
        label="Remarks (optional)"
        type="multiline"
        placeholder="Strengths, suggestions, anything worth noting…"
        value={remarks}
        onChangeText={(v) => {
          setRemarks(v);
          if (fieldErrs.remarks) setFieldErrs((f) => ({ ...f, remarks: '' }));
        }}
        maxLength={REMARKS_MAX}
        error={fieldErrs.remarks}
        hint={`${remarks.length} / ${REMARKS_MAX}`}
        editable={!submitting && !published}
      />

      <View style={styles.finalNote}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
        <AppText variant="caption" color="muted" style={styles.flex}>
          Once submitted, scores are final. Nobody, including you and the admin, can edit them.
        </AppText>
      </View>
    </Screen>
  );
}

function DoneActions({ teamId }: { teamId: string }) {
  return (
    <View style={styles.doneActions}>
      <NextUpCard excludeTeamId={teamId} />
      <Button title="Next team" icon="keypad" size="lg" onPress={goNextTeam} />
      <Button title="Home" icon="home-outline" variant="secondary" size="lg" onPress={goHome} />
    </View>
  );
}

function SubmittedView({
  team,
  evaluation,
  criteria,
  maxPerJudge,
}: {
  team: JudgePublicTeam;
  evaluation: Evaluation;
  criteria: Criterion[];
  maxPerJudge: number;
}) {
  return (
    <Screen title="Scores submitted" back={false}>
      <View style={styles.successHero}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={48} color={colors.success} />
        </View>
        <AppText variant="headline" align="center">
          {team.name}
        </AppText>
        <AppText color="textSecondary" align="center">
          Your scores are saved and now appear in the team's report.
        </AppText>
      </View>
      <Card tone="success">
        <ScoreBreakdown evaluation={evaluation} criteria={criteria} maxPerJudge={maxPerJudge} />
      </Card>
      <DoneActions teamId={team.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  totalBlock: { flexShrink: 1 },
  submit: { minWidth: 180, flexShrink: 0 },
  fieldError: { marginTop: -spacing.sm, marginBottom: spacing.md, marginLeft: spacing.xs },
  finalNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  doneActions: { gap: spacing.md, marginTop: spacing.sm },
  successHero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.successDim,
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});

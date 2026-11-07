import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import type { PublicPerson } from '@/api/types';
import { accentFor, shade, textOn, tint } from '@/lib/teamColor';
import { fonts, palette } from '@/theme';

import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { TeamImage } from '../TeamImage';
import { Burst } from './Burst';

/** What the auto poster is built from. */
export interface AutoPosterData {
  teamName: string;
  projectTitle: string;
  projectDesc: string;
  imageUrl: string | null;
  color: string;
  members: PublicPerson[];
  /** Small line at the bottom, e.g. "Tech Arena · Project Expo 2026". */
  footer?: string;
}

/** Design size; the poster is drawn at this size and scaled to fit, so every poster has the same layout. */
const BASE_W = 360;
const BASE_H = 480;

/** Descriptions longer than this get the "long" layout: smaller image, more room for text. */
const LONG_DESC = 320;

/** Box geometry (in poster units) for each layout. */
const LAYOUT = {
  normal: { header: 132, ribbon: 120, imageTop: 156, imageW: 200, burst: 74, teamTop: 160, avatar: 26, descTop: 334 },
  long: { header: 116, ribbon: 104, imageTop: 134, imageW: 140, burst: 56, teamTop: 136, avatar: 22, descTop: 264 },
} as const;
const DESC_BOTTOM = 452; // just above the footer
const DESC_WIDTH = BASE_W - 36;
const LABEL_H = 24;

/**
 * Largest font size at which the whole description fits its box, so nothing is cut off (up to the
 * 1000-character limit). Estimates the wrap from an average glyph width; errs on the small side.
 */
function fitDesc(desc: string, boxH: number): { fontSize: number; lineHeight: number } {
  const paragraphs = desc.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  for (let fs = 15; fs >= 6.5; fs -= 0.5) {
    const perLine = Math.max(8, Math.floor(DESC_WIDTH / (fs * 0.58)));
    const lines = paragraphs.reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0);
    const lh = Math.round(fs * 1.3 * 10) / 10;
    if (lines * lh <= boxH) return { fontSize: fs, lineHeight: lh };
  }
  return { fontSize: 6.5, lineHeight: 8.5 };
}

function titleSize(title: string): number {
  const n = title.length;
  if (n <= 14) return 46;
  if (n <= 24) return 38;
  if (n <= 40) return 31;
  return 25;
}

/**
 * The auto-generated team poster: a fixed comic layout (title header, framed project image,
 * "The idea", "The team") painted in the team's own colour, so every team's poster looks different.
 */
export const ComicPoster = memo(function ComicPoster({ data, width }: { data: AutoPosterData; width: number }) {
  const k = width / BASE_W;
  const color = data.color;
  const fg = textOn(color);
  const paper = tint(color, 0.86);
  const dots = shade(color, 0.08);
  const accent = accentFor(color);
  const id = `p-${color.slice(1)}`;
  const people = data.members.slice(0, 5);
  const L = data.projectDesc.length > LONG_DESC ? LAYOUT.long : LAYOUT.normal;
  const desc = fitDesc(data.projectDesc, DESC_BOTTOM - L.descTop - LABEL_H);
  const tSize = Math.min(titleSize(data.projectTitle), L === LAYOUT.long ? 34 : 99);
  // Up to 5 people must fit between the image top and the description: shrink photos for big
  // teams, and use two columns on long-description posters (their column is shorter).
  const twoCols = L === LAYOUT.long && people.length > 3;
  const avatar = people.length > 3 ? 20 : L.avatar;

  return (
    <View style={{ width, height: width * (BASE_H / BASE_W), overflow: 'hidden' }}>
      <View
        style={[
          styles.page,
          {
            left: (width - BASE_W) / 2,
            top: (width * (BASE_H / BASE_W) - BASE_H) / 2,
            backgroundColor: paper,
            transform: [{ scale: k }],
          },
        ]}
      >
        <Svg style={StyleSheet.absoluteFill} width={BASE_W} height={BASE_H}>
          <Defs>
            <Pattern id={`${id}-paper`} width={10} height={10} patternUnits="userSpaceOnUse">
              <Circle cx={5} cy={5} r={1.1} fill={tint(color, 0.62)} />
            </Pattern>
            <Pattern id={`${id}-head`} width={11} height={11} patternUnits="userSpaceOnUse">
              <Circle cx={5.5} cy={5.5} r={1.7} fill={fg === palette.white ? tint(color, 0.2) : dots} />
            </Pattern>
          </Defs>
          <Rect width={BASE_W} height={BASE_H} fill={`url(#${id}-paper)`} />
          <Rect width={BASE_W} height={L.header} fill={color} />
          <Rect width={BASE_W} height={L.header} fill={`url(#${id}-head)`} />
        </Svg>

        {/* Header: expo sticker + project title in the team colour */}
        <View style={[styles.header, { height: L.header }]}>
          <View style={styles.kicker}>
            <AppText style={styles.kickerText}>PROJECT EXPO 2026</AppText>
          </View>
          <AppText
            numberOfLines={2}
            style={[
              styles.title,
              { fontSize: tSize, lineHeight: tSize * 1.02, color: fg },
              fg === palette.white ? styles.titleShadow : null,
            ]}
          >
            {data.projectTitle.toUpperCase()}
          </AppText>
        </View>

        {/* "By team" ribbon */}
        <View style={[styles.byRibbon, { top: L.ribbon, backgroundColor: palette.ink }]}>
          <AppText numberOfLines={1} style={[styles.byText, { color: accent === palette.red ? palette.yellow : accent }]}>
            {`BY ${data.teamName.toUpperCase()}`}
          </AppText>
        </View>

        {/* Project image, framed, with a burst */}
        <View style={[styles.imageWrap, { top: L.imageTop, width: L.imageW }]}>
          <View style={styles.frame}>
            <TeamImage url={data.imageUrl} aspectRatio={4 / 3} borderRadius={2} />
          </View>
          <Burst size={L.burst} color={accent} points={12} shadow={3} style={styles.burst}>
            <AppText style={[styles.burstText, { color: accent === palette.yellow ? palette.red : palette.white }]}>WOW!</AppText>
          </Burst>
        </View>

        {/* The idea */}
        <View style={[styles.section, { top: L.descTop }]}>
          <View style={[styles.label, { backgroundColor: palette.ink }]}>
            <AppText style={[styles.labelText, { color: accent === palette.red ? palette.yellow : accent }]}>THE IDEA</AppText>
          </View>
          <AppText style={[styles.desc, desc]}>
            {data.projectDesc}
          </AppText>
        </View>

        {/* The team */}
        <View style={[styles.teamRow, { top: L.teamTop, left: L.imageW + 48 }]}>
          <View style={[styles.label, { backgroundColor: palette.ink }]}>
            <AppText style={[styles.labelText, { color: accent === palette.red ? palette.yellow : accent }]}>THE TEAM</AppText>
          </View>
          <View style={[styles.people, twoCols ? styles.peopleGrid : null]}>
            {people.map((p, i) => (
              <View key={`${p.name}-${i}`} style={[styles.person, twoCols ? styles.personHalf : null]}>
                <View style={[styles.avatarRing, { borderColor: palette.ink, backgroundColor: color }]}>
                  <Avatar name={p.name} photoUrl={p.photoUrl} size={avatar} />
                </View>
                <AppText numberOfLines={1} style={styles.personName}>
                  {p.name.split(' ')[0]}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.footer, { backgroundColor: color }]}>
          <AppText style={[styles.footerText, { color: fg }]}>{data.footer ?? 'TECH ARENA · PROJECT EXPO 2026'}</AppText>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  page: { position: 'absolute', width: BASE_W, height: BASE_H, overflow: 'hidden' },
  header: { paddingHorizontal: 18, paddingTop: 12, borderBottomWidth: 4, borderBottomColor: palette.ink },
  kicker: {
    alignSelf: 'flex-start',
    backgroundColor: palette.yellow,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingHorizontal: 7,
    paddingVertical: 1,
    transform: [{ rotate: '-2deg' }],
    marginBottom: 8,
  },
  kickerText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, letterSpacing: 1.2, color: palette.ink },
  title: { fontFamily: fonts.display, letterSpacing: 1 },
  titleShadow: { textShadowColor: palette.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  byRibbon: {
    position: 'absolute',
    left: 14,
    maxWidth: 300,
    paddingHorizontal: 10,
    paddingVertical: 2,
    transform: [{ rotate: '-2deg' }],
  },
  byText: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, letterSpacing: 1 },
  imageWrap: { position: 'absolute', left: 22 },
  frame: {
    borderWidth: 3,
    borderColor: palette.ink,
    backgroundColor: palette.white,
    padding: 4,
    transform: [{ rotate: '-2.5deg' }],
    shadowColor: palette.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  },
  burst: { position: 'absolute', right: -30, bottom: -34, transform: [{ rotate: '10deg' }] },
  burstText: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, letterSpacing: 1 },
  section: { position: 'absolute', left: 18, right: 18, bottom: BASE_H - DESC_BOTTOM, overflow: 'hidden' },
  label: { alignSelf: 'flex-start', height: LABEL_H - 5, justifyContent: 'center', paddingHorizontal: 6, marginBottom: 5 },
  labelText: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, letterSpacing: 1 },
  desc: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 14, color: palette.ink },
  teamRow: { position: 'absolute', right: 10 },
  people: { gap: 3 },
  peopleGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 0 },
  personHalf: { width: '50%' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatarRing: { borderWidth: 2, borderRadius: 18, padding: 1 },
  personName: { flex: 1, fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, color: palette.ink },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, borderTopWidth: 3, borderTopColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  footerText: { fontFamily: fonts.display, fontSize: 14, lineHeight: 17, letterSpacing: 1.5 },
});

/** Builds the auto-poster data from any team shape plus its people (lead first). */
export function autoPosterFor(
  team: { name: string; projectTitle: string; projectDesc: string; imageUrl: string | null; color?: string | null },
  members: PublicPerson[],
  fallbackColor: string = palette.ink,
): AutoPosterData {
  return {
    teamName: team.name,
    projectTitle: team.projectTitle,
    projectDesc: team.projectDesc,
    imageUrl: team.imageUrl,
    color: team.color || fallbackColor,
    members,
  };
}

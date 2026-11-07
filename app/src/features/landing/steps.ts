import type { IconName } from '@/components/icons';

export const STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'person-add-outline', title: 'Register', text: 'The team lead signs up the team with the project, a project image, the poster and a profile photo.' },
  { icon: 'people-outline', title: 'Assemble', text: 'The lead adds teammates and sends them their login. Everyone adds a profile photo.' },
  { icon: 'list-outline', title: 'Queue', text: 'On expo day a random presentation order is drawn. Check the queue to see when you are up.' },
  { icon: 'keypad-outline', title: 'Judging', text: 'Judges type your 4-digit team code at your stall and score you. Scores are final.' },
  { icon: 'trophy-outline', title: 'Results', text: 'Your marks appear in your report live. The top 3 are revealed when results are published.' },
];

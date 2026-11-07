export interface Criterion {
  key: string;
  label: string;
  description: string;
  max: number;
}

export const CRITERIA: readonly Criterion[] = [
  { key: 'idea', label: 'Idea & Innovation', description: 'How novel and well thought out the core idea is', max: 10 },
  { key: 'working', label: 'Working Model', description: 'Does it actually work? Quality of the build / demo', max: 10 },
  { key: 'uniqueness', label: 'Uniqueness', description: 'How different it is from existing solutions', max: 10 },
  { key: 'impact', label: 'Impact & Feasibility', description: 'Real-world usefulness and how practical it is to deploy', max: 10 },
  { key: 'presentation', label: 'Presentation & Q&A', description: "Clarity of explanation and answers to judges' questions", max: 10 },
];

export const MAX_PER_JUDGE = CRITERIA.reduce((sum, c) => sum + c.max, 0);

import corpusPayload from './corpus.generated.json';

export const FEATURE_IDS = ['simple_past', 'present_participle', 'past_participle'] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export interface ExerciseWord {
  text: string;
  spaceAfter: boolean;
}

export interface Exercise {
  id: string;
  feature: FeatureId;
  sourceText: string;
  targetIndex: number;
  answer: string;
  replacement: string;
  words: ExerciseWord[];
  sourceSentenceId: string;
}

export interface CorpusMeta {
  source: string;
  version: string;
  sourceUrl: string;
  downloadUrl: string;
  sha256: string;
  license: string;
  licenseUrl: string;
  adaptation: string;
}

interface CorpusPayload {
  meta: CorpusMeta;
  exercises: Record<FeatureId, Exercise[]>;
}

const corpus = corpusPayload as CorpusPayload;

export const corpusMeta = corpus.meta;

export function isFeatureId(value: string): value is FeatureId {
  return FEATURE_IDS.some((feature) => feature === value);
}

export function exercisesFor(feature: FeatureId): readonly Exercise[] {
  return corpus.exercises[feature];
}

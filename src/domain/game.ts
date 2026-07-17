import type { Exercise, FeatureId } from '../data/corpus';

export interface FeatureCopy {
  id: FeatureId;
  line: string;
  name: string;
  shortName: string;
  tag: string;
  prompt: string;
}

export const FEATURE_COPY: Record<FeatureId, FeatureCopy> = {
  simple_past: {
    id: 'simple_past',
    line: '01',
    name: 'Past tense',
    shortName: 'past tense',
    tag: 'VBD',
    prompt: 'Find the verb that should be in the past tense.',
  },
  present_participle: {
    id: 'present_participle',
    line: '02',
    name: 'Present participles',
    shortName: 'present participle',
    tag: 'VBG',
    prompt: 'Find the verb that needs its -ing form.',
  },
  past_participle: {
    id: 'past_participle',
    line: '03',
    name: 'Past participles',
    shortName: 'past participle',
    tag: 'VBN',
    prompt: 'Find the verb that should be a past participle.',
  },
};

export type SelectionResult =
  | { kind: 'correct'; points: number; firstTry: boolean }
  | { kind: 'incorrect'; repeated: boolean }
  | { kind: 'ignored' };

export class ShiftSession {
  readonly exercises: Exercise[];
  readonly feature: FeatureId;
  index = 0;
  score = 0;
  streak = 0;
  bestStreak = 0;
  completed = false;
  answered = false;
  revealed = false;
  firstTryRepairs = 0;
  missedSentences = 0;
  private readonly wrongIndices = new Set<number>();

  constructor(exercises: readonly Exercise[], count = 8, random: () => number = Math.random) {
    if (exercises.length < count || count < 1) {
      throw new RangeError(`A shift needs at least ${count} exercises.`);
    }

    const shuffled = [...exercises];
    for (let current = shuffled.length - 1; current > 0; current -= 1) {
      const target = Math.floor(random() * (current + 1));
      const currentExercise = shuffled[current];
      const targetExercise = shuffled[target];
      if (!currentExercise || !targetExercise) throw new Error('Unable to shuffle the shift.');
      shuffled[current] = targetExercise;
      shuffled[target] = currentExercise;
    }

    this.exercises = shuffled.slice(0, count);
    const firstExercise = this.exercises[0];
    if (!firstExercise) throw new Error('The shift did not contain an exercise.');
    this.feature = firstExercise.feature;
  }

  get current(): Exercise {
    const exercise = this.exercises[this.index];
    if (!exercise) throw new Error('The current exercise is unavailable.');
    return exercise;
  }

  get total(): number {
    return this.exercises.length;
  }

  get wrongSelections(): ReadonlySet<number> {
    return this.wrongIndices;
  }

  selectWord(wordIndex: number): SelectionResult {
    if (this.answered || this.completed) return { kind: 'ignored' };
    if (wordIndex < 0 || wordIndex >= this.current.words.length) {
      throw new RangeError('Word index is outside the current sentence.');
    }

    if (wordIndex !== this.current.targetIndex) {
      const repeated = this.wrongIndices.has(wordIndex);
      this.wrongIndices.add(wordIndex);
      this.streak = 0;
      return { kind: 'incorrect', repeated };
    }

    const firstTry = this.wrongIndices.size === 0;
    const points = Math.max(2, 10 - this.wrongIndices.size * 3);
    this.score += points;
    this.answered = true;

    if (firstTry) {
      this.firstTryRepairs += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.streak = 0;
    }

    return { kind: 'correct', points, firstTry };
  }

  revealAnswer(): boolean {
    if (this.answered || this.completed) return false;
    this.answered = true;
    this.revealed = true;
    this.streak = 0;
    return true;
  }

  missCurrent(): boolean {
    if (this.answered || this.completed) return false;
    this.answered = true;
    this.revealed = true;
    this.streak = 0;
    this.missedSentences += 1;
    return true;
  }

  advance(): boolean {
    if (!this.answered || this.completed) return false;
    if (this.index === this.exercises.length - 1) {
      this.completed = true;
      return false;
    }

    this.index += 1;
    this.answered = false;
    this.revealed = false;
    this.wrongIndices.clear();
    return true;
  }
}

import { describe, expect, it } from 'vitest';
import { corpusMeta, exercisesFor, FEATURE_IDS } from '../src/data/corpus';

function reconstruct(words: readonly { text: string; spaceAfter: boolean }[]): string {
  return words
    .map((word) => `${word.text}${word.spaceAfter ? ' ' : ''}`)
    .join('')
    .trim();
}

describe('generated sentence corpus', () => {
  it('contains a healthy, balanced exercise pool', () => {
    for (const feature of FEATURE_IDS) {
      expect(exercisesFor(feature)).toHaveLength(36);
    }
  });

  it('contains valid targets and reconstructable source sentences', () => {
    const ids = new Set<string>();

    for (const feature of FEATURE_IDS) {
      for (const exercise of exercisesFor(feature)) {
        expect(ids.has(exercise.id)).toBe(false);
        ids.add(exercise.id);
        expect(exercise.feature).toBe(feature);
        expect(exercise.words[exercise.targetIndex]?.text).toBe(exercise.answer);
        expect(exercise.replacement.toLocaleLowerCase('en')).not.toBe(
          exercise.answer.toLocaleLowerCase('en'),
        );
        expect(reconstruct(exercise.words)).toBe(exercise.sourceText);
        expect(exercise.sourceSentenceId).toMatch(/^[nw]\d+$/u);
      }
    }
  });

  it('carries the pinned source and licensing metadata', () => {
    expect(corpusMeta.source).toBe('UD English PUD');
    expect(corpusMeta.version).toBe('2.18');
    expect(corpusMeta.sha256).toMatch(/^[a-f\d]{64}$/u);
    expect(corpusMeta.license).toBe('CC BY-SA 3.0');
    expect(corpusMeta.sourceUrl).toMatch(/^https:\/\//u);
    expect(corpusMeta.licenseUrl).toMatch(/^https:\/\//u);
  });
});

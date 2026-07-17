import { describe, expect, it } from 'vitest';
import type { Exercise } from '../src/data/corpus';
import { ShiftSession } from '../src/domain/game';

function exercise(id: string, targetIndex = 1): Exercise {
  return {
    id,
    feature: 'simple_past',
    sourceText: 'The crew inspected it.',
    targetIndex,
    answer: 'inspected',
    replacement: 'inspect',
    words: [
      { text: 'The', spaceAfter: true },
      { text: 'inspected', spaceAfter: true },
      { text: 'it', spaceAfter: false },
      { text: '.', spaceAfter: true },
    ],
    sourceSentenceId: `w${id}`,
  };
}

const exercises = Array.from({ length: 8 }, (_, index) => exercise(String(index)));

describe('ShiftSession', () => {
  it('awards ten points and extends the streak for a first-try repair', () => {
    const session = new ShiftSession(exercises, 8, () => 0.999);

    expect(session.selectWord(1)).toEqual({ kind: 'correct', points: 10, firstTry: true });
    expect(session.score).toBe(10);
    expect(session.streak).toBe(1);
    expect(session.bestStreak).toBe(1);
    expect(session.firstTryRepairs).toBe(1);
  });

  it('marks incorrect words once and reduces the repair score', () => {
    const session = new ShiftSession(exercises, 8, () => 0.999);

    expect(session.selectWord(0)).toEqual({ kind: 'incorrect', repeated: false });
    expect(session.selectWord(0)).toEqual({ kind: 'incorrect', repeated: true });
    expect(session.selectWord(1)).toEqual({ kind: 'correct', points: 7, firstTry: false });
    expect(session.score).toBe(7);
    expect(session.streak).toBe(0);
  });

  it('reveals an answer without awarding points', () => {
    const session = new ShiftSession(exercises, 8, () => 0.999);

    expect(session.revealAnswer()).toBe(true);
    expect(session.revealed).toBe(true);
    expect(session.answered).toBe(true);
    expect(session.score).toBe(0);
    expect(session.selectWord(1)).toEqual({ kind: 'ignored' });
  });

  it('records a sentence that reaches the end of the line unrepaired', () => {
    const session = new ShiftSession(exercises, 8, () => 0.999);

    expect(session.missCurrent()).toBe(true);
    expect(session.missedSentences).toBe(1);
    expect(session.revealed).toBe(true);
    expect(session.answered).toBe(true);
    expect(session.score).toBe(0);
    expect(session.advance()).toBe(true);
  });

  it('advances through the queue and finishes after the final repair', () => {
    const session = new ShiftSession(exercises, 8, () => 0.999);

    for (let index = 0; index < session.total; index += 1) {
      session.selectWord(1);
      const advanced = session.advance();
      expect(advanced).toBe(index < session.total - 1);
    }

    expect(session.completed).toBe(true);
    expect(session.score).toBe(80);
  });

  it('rejects undersized queues and invalid word positions', () => {
    expect(() => new ShiftSession(exercises.slice(0, 2), 3)).toThrow('at least 3');

    const session = new ShiftSession(exercises, 8, () => 0.999);
    expect(() => session.selectWord(99)).toThrow('outside the current sentence');
  });
});

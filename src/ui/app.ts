import { corpusMeta, exercisesFor, isFeatureId, type FeatureId } from '../data/corpus';
import { FEATURE_COPY, ShiftSession } from '../domain/game';

type FeedbackTone = 'neutral' | 'success' | 'error';

interface AppElements {
  landingView: HTMLElement;
  shiftForm: HTMLFormElement;
  shiftSummary: HTMLElement;
  practice: HTMLElement;
  practiceKicker: HTMLElement;
  scoreValue: HTMLElement;
  streakValue: HTMLElement;
  changeShift: HTMLButtonElement;
  productionPanel: HTMLElement;
  batchLabel: HTMLElement;
  productionPrompt: HTMLElement;
  progress: HTMLProgressElement;
  sentenceCarriage: HTMLElement;
  sentenceWords: HTMLElement;
  feedback: HTMLElement;
  movementStatus: HTMLElement;
  pauseButton: HTMLButtonElement;
  revealButton: HTMLButtonElement;
  sourceSentenceId: HTMLElement;
  corpusLink: HTMLAnchorElement;
  licenseLink: HTMLAnchorElement;
  shiftResult: HTMLElement;
  resultScore: HTMLElement;
  resultTitle: HTMLElement;
  resultMessage: HTMLElement;
  bestScore: HTMLElement;
  repeatShift: HTMLButtonElement;
  resultChangeShift: HTMLButtonElement;
}

const SHIFT_SIZE = 8;
const BEST_SCORE_KEY = 'sentencefactory:best-score';
const SUCCESS_HOLD_MS = 1_400;
const REVEAL_HOLD_MS = 900;
const SHIPPING_DURATION_MS = 1_600;

export class SentenceFactoryApp {
  private readonly elements: AppElements;
  private session: ShiftSession | null = null;
  private activeFeature: FeatureId = 'simple_past';
  private transitionTimer: number | null = null;
  private linePaused = false;
  private lineSpeed = 1;

  constructor() {
    this.elements = {
      landingView: element('#landing-view'),
      shiftForm: element<HTMLFormElement>('#shift-form'),
      shiftSummary: element('#shift-summary'),
      practice: element('#practice'),
      practiceKicker: element('#practice-kicker'),
      scoreValue: element('#score-value'),
      streakValue: element('#streak-value'),
      changeShift: element<HTMLButtonElement>('#change-shift'),
      productionPanel: element('#production-panel'),
      batchLabel: element('#batch-label'),
      productionPrompt: element('#production-prompt'),
      progress: element<HTMLProgressElement>('#shift-progress'),
      sentenceCarriage: element('#sentence-carriage'),
      sentenceWords: element('#sentence-words'),
      feedback: element('#feedback'),
      movementStatus: element('#movement-status'),
      pauseButton: element<HTMLButtonElement>('#pause-line'),
      revealButton: element<HTMLButtonElement>('#reveal-button'),
      sourceSentenceId: element('#source-sentence-id'),
      corpusLink: element<HTMLAnchorElement>('#corpus-link'),
      licenseLink: element<HTMLAnchorElement>('#license-link'),
      shiftResult: element('#shift-result'),
      resultScore: element('#result-score'),
      resultTitle: element('#result-title'),
      resultMessage: element('#result-message'),
      bestScore: element('#best-score'),
      repeatShift: element<HTMLButtonElement>('#repeat-shift'),
      resultChangeShift: element<HTMLButtonElement>('#result-change-shift'),
    };
  }

  mount(): void {
    this.elements.shiftForm.addEventListener('change', () => this.updateShiftSummary());
    this.elements.shiftForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.startShift(this.selectedFeature());
    });
    this.elements.sentenceWords.addEventListener('click', (event) => this.selectWord(event));
    this.elements.sentenceCarriage.addEventListener('animationend', (event) =>
      this.handleSentenceExit(event),
    );
    this.elements.pauseButton.addEventListener('click', () => this.toggleLine());
    this.elements.revealButton.addEventListener('click', () => this.revealAnswer());
    this.elements.changeShift.addEventListener('click', () => this.showShiftPicker());
    this.elements.resultChangeShift.addEventListener('click', () => this.showShiftPicker());
    this.elements.repeatShift.addEventListener('click', () => this.startShift(this.activeFeature));

    this.elements.corpusLink.href = corpusMeta.sourceUrl;
    this.elements.licenseLink.href = corpusMeta.licenseUrl;
    this.updateShiftSummary();
  }

  private selectedFeature(): FeatureId {
    const value = new FormData(this.elements.shiftForm).get('feature');
    if (typeof value !== 'string' || !isFeatureId(value)) return 'simple_past';
    return value;
  }

  private updateShiftSummary(): void {
    const copy = FEATURE_COPY[this.selectedFeature()];
    this.elements.shiftSummary.textContent = `${copy.name} · ${SHIFT_SIZE} sentences`;
  }

  private startShift(feature: FeatureId): void {
    this.clearTransition();
    this.activeFeature = feature;
    this.session = new ShiftSession(exercisesFor(feature), SHIFT_SIZE);
    this.lineSpeed = 1;
    this.linePaused = reducedMotion();
    const copy = FEATURE_COPY[feature];

    this.elements.practiceKicker.textContent = `Line ${copy.line} / ${copy.name}`;
    this.elements.landingView.hidden = true;
    this.elements.practice.hidden = false;
    this.elements.productionPanel.hidden = false;
    this.elements.shiftResult.hidden = true;
    document.body.classList.add('is-playing');
    window.scrollTo({ top: 0, behavior: 'auto' });
    this.updateLineState();
    this.renderExercise(true);
    this.elements.practice.focus({ preventScroll: true });
  }

  private renderExercise(
    startMovement: boolean,
    feedback?: { message: string; tone: FeedbackTone },
  ): void {
    const session = this.requireSession();
    const exercise = session.current;
    const copy = FEATURE_COPY[session.feature];

    this.elements.scoreValue.textContent = String(session.score);
    this.elements.streakValue.textContent = String(session.bestStreak);
    this.elements.batchLabel.textContent = `Sentence ${session.index + 1} of ${session.total}`;
    this.elements.productionPrompt.textContent = copy.prompt;
    this.elements.progress.max = session.total;
    this.elements.progress.value = session.index + 1;
    this.elements.progress.textContent = `${session.index + 1} of ${session.total}`;
    this.elements.sourceSentenceId.textContent = exercise.sourceSentenceId;
    this.elements.revealButton.disabled = session.answered;

    const fragment = document.createDocumentFragment();
    exercise.words.forEach((word, index) => {
      const isTarget = index === exercise.targetIndex;
      const text = isTarget && !session.answered ? exercise.replacement : word.text;
      const token = selectable(text)
        ? document.createElement('button')
        : document.createElement('span');

      token.className = 'sentence-token';
      token.textContent = text;
      if (word.spaceAfter) token.classList.add('has-space');

      if (token instanceof HTMLButtonElement) {
        token.type = 'button';
        token.dataset.wordIndex = String(index);
        token.disabled = session.answered || session.wrongSelections.has(index);
        token.setAttribute('aria-label', `Select “${text}”`);
      }
      if (session.wrongSelections.has(index)) token.classList.add('is-wrong');
      if (session.answered && isTarget) {
        token.classList.add(session.revealed ? 'is-revealed' : 'is-correct');
      }

      fragment.append(token);
    });

    this.elements.sentenceWords.replaceChildren(fragment);
    if (startMovement) this.startSentenceRun();

    if (feedback) {
      this.setFeedback(feedback.message, feedback.tone);
    } else if (!session.answered) {
      this.setFeedback('Tap the faulty verb before the sentence reaches the exit.', 'neutral');
    }
  }

  private selectWord(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button[data-word-index]');
    if (!button) return;

    const session = this.requireSession();
    const wordIndex = Number(button.dataset.wordIndex);
    const result = session.selectWord(wordIndex);

    if (result.kind === 'incorrect') {
      button.classList.add('is-wrong');
      button.disabled = true;
      if (!result.repeated) {
        this.lineSpeed = Math.min(2.2, this.lineSpeed + 0.2);
        this.applyRunSpeed();
      }
      this.setFeedback('Wrong word — the line is speeding up.', 'error');
      return;
    }
    if (result.kind !== 'correct') return;

    const { answer, replacement } = session.current;
    this.renderExercise(false);
    this.setFeedback(
      `Line repaired: “${replacement}” becomes “${answer}” here. +${result.points} points.`,
      'success',
    );
    this.shipAnsweredSentence(SUCCESS_HOLD_MS);
  }

  private revealAnswer(): void {
    const session = this.requireSession();
    if (!session.revealAnswer()) return;

    const { answer, replacement } = session.current;
    this.renderExercise(false);
    this.setFeedback(
      `Fix shown: “${replacement}” should be “${answer}” in this sentence.`,
      'neutral',
    );
    this.shipAnsweredSentence(REVEAL_HOLD_MS);
  }

  private toggleLine(): void {
    this.linePaused = !this.linePaused;
    this.updateLineState();
    if (!this.linePaused && !this.currentRunAnimation()) this.startSentenceRun();
  }

  private updateLineState(): void {
    this.elements.practice.classList.toggle('is-line-paused', this.linePaused);
    this.elements.pauseButton.setAttribute('aria-pressed', String(this.linePaused));
    this.elements.pauseButton.textContent = this.linePaused ? 'Resume line' : 'Pause line';
    this.elements.movementStatus.lastChild?.remove();
    this.elements.movementStatus.append(this.linePaused ? ' Line paused' : ' Line moving');
  }

  private startSentenceRun(): void {
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
    this.elements.sentenceCarriage.classList.remove('is-running', 'is-shipping');
    if (reducedMotion() && this.linePaused) return;

    const travelDistance = window.innerWidth + this.elements.sentenceCarriage.offsetWidth;
    const pixelsPerSecond = window.innerWidth <= 640 ? 65 : 110;
    const duration = Math.min(36_000, Math.max(18_000, (travelDistance / pixelsPerSecond) * 1_000));
    this.elements.sentenceCarriage.style.setProperty(
      '--sentence-run-duration',
      `${Math.round(duration)}ms`,
    );

    void this.elements.sentenceCarriage.offsetWidth;
    this.elements.sentenceCarriage.classList.add('is-running');
    this.applyRunSpeed();
    const animation = this.currentRunAnimation();
    if (animation && this.linePaused) {
      const timing = animation.effect?.getComputedTiming();
      const runDuration = typeof timing?.duration === 'number' ? timing.duration : duration;
      animation.currentTime = runDuration / 2;
    }
  }

  private applyRunSpeed(): void {
    const animation = this.currentRunAnimation();
    if (animation) animation.playbackRate = this.lineSpeed;
  }

  private currentRunAnimation(): CSSAnimation | undefined {
    return this.elements.sentenceCarriage
      .getAnimations()
      .find(
        (animation): animation is CSSAnimation =>
          animation instanceof CSSAnimation && animation.animationName === 'sentence-run',
      );
  }

  private shipAnsweredSentence(holdDuration: number): void {
    const animation = this.currentRunAnimation();
    if (!animation) {
      this.transitionTimer = window.setTimeout(() => this.advanceLine(), holdDuration);
      return;
    }

    animation.pause();
    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null;
      const timing = animation.effect?.getComputedTiming();
      const duration = typeof timing?.duration === 'number' ? timing.duration : 20_000;
      const elapsed = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
      const remaining = Math.max(1, duration - elapsed);

      this.elements.sentenceCarriage.classList.add('is-shipping');
      animation.playbackRate = remaining / SHIPPING_DURATION_MS;
      animation.play();
    }, holdDuration);
  }

  private handleSentenceExit(event: AnimationEvent): void {
    if (event.animationName !== 'sentence-run' || event.target !== this.elements.sentenceCarriage) {
      return;
    }

    const session = this.requireSession();
    if (session.answered) {
      this.advanceLine();
      return;
    }

    const { answer, replacement } = session.current;
    session.missCurrent();
    this.advanceLine({
      message: `Missed: “${replacement}” should have been “${answer}”.`,
      tone: 'error',
    });
  }

  private advanceLine(feedback?: { message: string; tone: FeedbackTone }): void {
    this.transitionTimer = null;
    const session = this.requireSession();
    const advanced = session.advance();
    if (advanced) {
      this.renderExercise(true, feedback);
      return;
    }
    if (session.completed) this.showResult();
  }

  private showResult(): void {
    this.clearTransition();
    const session = this.requireSession();
    const previousBest = readBestScore();
    const best = Math.max(previousBest, session.score);
    saveBestScore(best);

    this.elements.productionPanel.hidden = true;
    this.elements.shiftResult.hidden = false;
    this.elements.resultScore.textContent = String(session.score);
    this.elements.resultTitle.textContent = resultTitle(session.score);
    this.elements.resultMessage.textContent = `${session.firstTryRepairs} first-try repairs · ${session.missedSentences} missed.`;
    this.elements.bestScore.textContent =
      session.score > previousBest ? 'New factory best.' : `Factory best: ${best} quality points.`;
    this.elements.repeatShift.focus();
  }

  private showShiftPicker(): void {
    this.clearTransition();
    this.elements.practice.hidden = true;
    this.elements.landingView.hidden = false;
    document.body.classList.remove('is-playing');
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      this.elements.shiftForm
        .querySelector<HTMLInputElement>('input[name="feature"]:checked')
        ?.focus({ preventScroll: true });
    });
  }

  private clearTransition(): void {
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
    for (const animation of this.elements.sentenceCarriage.getAnimations()) animation.cancel();
    this.elements.sentenceCarriage.classList.remove('is-running', 'is-shipping');
  }

  private setFeedback(message: string, tone: FeedbackTone): void {
    this.elements.feedback.textContent = message;
    this.elements.feedback.dataset.tone = tone;
  }

  private requireSession(): ShiftSession {
    if (!this.session) throw new Error('No shift is currently active.');
    return this.session;
  }
}

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing required element: ${selector}`);
  return match;
}

function selectable(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resultTitle(score: number): string {
  if (score >= 72) return 'Precision shift.';
  if (score >= 52) return 'The line is clear.';
  return 'Repairs complete.';
}

function readBestScore(): number {
  try {
    const value = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Progress persistence is optional; the current shift still works without storage.
  }
}

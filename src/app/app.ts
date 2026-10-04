import { Component, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { AudioService } from './audio.service';
import { BASS_HINTS, HintCard, TREBLE_HINTS } from './hints';
import { BASS, Clef, LETTERS, Letter, NoteQuestion, TREBLE } from './notes';
import { loadBoard, RankRow, recordScore } from './scores';

type Phase = 'idle' | 'try' | 'correct';
type GameMode = 'timed' | 'challenge' | 'normal';
type Notice =
  | { kind: 'wipe'; score: number; rank: number | null }
  | { kind: 'rank'; score: number; rank: number }
  | { kind: 'confirm-restart' }
  | { kind: 'timeup'; score: number; rank: number | null };

const SCORE_KEY = 'note-adventure-score';
const SOUND_KEY = 'note-adventure-sound';
const ROUND_MS = 60_000;

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  private readonly audio = inject(AudioService);

  protected readonly letters = LETTERS;
  protected readonly space = 28;
  protected readonly bottom = 248;
  protected readonly noteX = 332;
  protected readonly clefSize = this.space * 4;
  protected readonly stemLength = this.space * 3.5;
  protected readonly staffLines = [0, 1, 2, 3, 4];
  protected readonly miniSpace = 22;
  protected readonly miniBottom = 124;

  protected readonly started = signal(false);
  protected readonly mode = signal<GameMode | null>(null);
  protected readonly score = signal(0);
  protected readonly normalStars = signal(0);
  protected readonly scorePop = signal(false);
  protected readonly soundOn = signal(true);
  protected readonly phase = signal<Phase>('idle');
  protected readonly question = signal<NoteQuestion>(TREBLE[4]);
  protected readonly wrong = signal<Letter[]>([]);
  protected readonly feedbackKey = signal(0);
  protected readonly round = signal(0);
  protected readonly confetti = signal<ConfettiPiece[]>([]);
  protected readonly hintOpen = signal(false);
  protected readonly secondsLeft = signal(60);
  protected readonly notice = signal<Notice | null>(null);
  protected readonly timedBoard = signal<RankRow[]>([]);
  protected readonly challengeBoard = signal<RankRow[]>([]);
  protected readonly normalBoard = signal<RankRow[]>([]);

  private locked = false;
  private nextSoundAt = 0;
  private celebrateTimer = 0;
  private popTimer = 0;
  private timerId = 0;
  private endsAt = 0;
  private submitted = false;
  private gained = false;
  private lastId = '';
  private lastClef: Clef | null = null;
  private clefRun = 0;

  constructor() {
    this.normalStars.set(this.readNumber(SCORE_KEY));
    this.refreshBoards();
    this.soundOn.set(localStorage.getItem(SOUND_KEY) !== 'off');
  }

  ngOnDestroy(): void {
    window.clearTimeout(this.celebrateTimer);
    window.clearTimeout(this.popTimer);
    this.stopTimer();
  }

  @HostListener('window:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (
      !this.started() ||
      this.notice() ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    const key = event.key.toUpperCase();
    if (
      key === 'C' ||
      key === 'D' ||
      key === 'E' ||
      key === 'F' ||
      key === 'G' ||
      key === 'A' ||
      key === 'B'
    ) {
      event.preventDefault();
      this.pick(key);
    }
  }

  protected toggleHint(): void {
    this.hintOpen.update((open) => !open);
  }

  protected hintCards(): HintCard[] {
    return this.question().clef === 'treble' ? TREBLE_HINTS : BASS_HINTS;
  }

  protected letterColor(letter: Letter): string {
    return this.letters.find((item) => item.id === letter)?.color ?? '#ffe08a';
  }

  protected miniLineY(index: number): number {
    return this.miniBottom - index * this.miniSpace;
  }

  protected miniNoteY(step: number): number {
    return this.miniBottom - step * (this.miniSpace / 2);
  }

  protected chooseMode(mode: GameMode): void {
    this.audio.unlock();
    this.notice.set(null);
    this.mode.set(mode);
    this.started.set(true);
    this.hintOpen.set(false);
    this.submitted = false;
    this.gained = false;
    this.score.set(mode === 'normal' ? this.readNumber(SCORE_KEY) : 0);
    this.deal();
    if (mode === 'timed') this.startTimer();
    else this.stopTimer();
  }

  protected restart(): void {
    if (this.notice()) return;
    this.notice.set({ kind: 'confirm-restart' });
  }

  protected cancelRestart(): void {
    if (this.notice()?.kind === 'confirm-restart') this.notice.set(null);
  }

  protected confirmRestart(): void {
    const finalScore = this.score();
    const mode = this.mode();
    const rank = mode === 'challenge' || mode === 'normal' ? this.remember(finalScore) : null;
    this.applyRestart();
    if (rank) this.notice.set({ kind: 'rank', score: finalScore, rank });
  }

  protected goHome(): void {
    const finalScore = this.score();
    const mode = this.mode();
    const rank = mode === 'challenge' || mode === 'normal' ? this.remember(finalScore) : null;
    this.leavePlay();
    if (rank) this.notice.set({ kind: 'rank', score: finalScore, rank });
  }

  protected dismissNotice(): void {
    const current = this.notice();
    this.notice.set(null);
    if (current?.kind === 'wipe') this.deal();
  }

  protected playAgain(): void {
    const mode = this.mode();
    if (mode) this.chooseMode(mode);
  }

  protected clock(): string {
    const total = this.secondsLeft();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  protected modeLabel(): string {
    switch (this.mode()) {
      case 'timed':
        return '一分钟';
      case 'challenge':
        return '闯关';
      default:
        return 'Normal';
    }
  }

  protected rankAt(board: RankRow[], index: number): number {
    const score = board[index]?.score ?? 0;
    return 1 + board.filter((row, rowIndex) => rowIndex < index && row.score > score).length;
  }

  protected activeBoard(): RankRow[] {
    switch (this.mode()) {
      case 'timed':
        return this.timedBoard();
      case 'challenge':
        return this.challengeBoard();
      case 'normal':
        return this.normalBoard();
      default:
        return [];
    }
  }

  protected toggleSound(): void {
    this.soundOn.update((on) => !on);
    localStorage.setItem(SOUND_KEY, this.soundOn() ? 'on' : 'off');
  }

  protected pick(letter: Letter): void {
    if (!this.started() || this.locked || this.notice() || this.wrong().includes(letter)) return;
    if (this.mode() === 'timed' && this.secondsLeft() <= 0) return;

    const current = this.question();
    if (letter === current.letter) {
      this.locked = true;
      this.phase.set('correct');
      this.feedbackKey.update((key) => key + 1);
      this.score.update((value) => value + 1);
      this.submitted = false;
      this.gained = true;
      if (this.mode() === 'normal') this.writeNumber(SCORE_KEY, this.score());
      this.scorePop.set(true);
      this.popTimer = window.setTimeout(() => this.scorePop.set(false), 450);
      this.burst();
      if (this.soundOn()) this.audio.cheer(current.frequency);
      this.celebrateTimer = window.setTimeout(() => {
        if (this.notice() || (this.mode() === 'timed' && this.secondsLeft() <= 0)) return;
        this.deal();
      }, 2400);
      return;
    }

    if (this.mode() === 'challenge') {
      this.failChallenge();
      return;
    }

    this.wrong.update((list) => [...list, letter]);
    this.phase.set('try');
    this.feedbackKey.update((key) => key + 1);
    if (this.soundOn() && performance.now() >= this.nextSoundAt) {
      this.audio.tryAgain();
      this.nextSoundAt = performance.now() + 520;
    }
  }

  protected isWrong(letter: Letter): boolean {
    return this.wrong().includes(letter);
  }

  protected lineY(index: number): number {
    return this.bottom - index * this.space;
  }

  protected yFor(step: number): string {
    return String(this.bottom - step * (this.space / 2));
  }

  /** Ledger line y inside the note's own coordinate space. */
  protected ledgerLocal(step: number): number {
    return (this.question().step - step) * (this.space / 2);
  }

  protected ledgers(): number[] {
    const step = this.question().step;
    const lines: number[] = [];
    if (step <= -2) {
      for (let cursor = -2; cursor >= step; cursor -= 2) lines.push(cursor);
    } else if (step >= 10) {
      for (let cursor = 10; cursor <= step; cursor += 2) lines.push(cursor);
    }
    return lines;
  }

  protected stemDown(): boolean {
    return this.question().step >= 4;
  }

  protected noteTransform(): string {
    return `translate(${this.noteX} ${this.yFor(this.question().step)})`;
  }

  protected clefChar(): string {
    return this.question().clef === 'treble' ? '\uE050' : '\uE062';
  }

  /** Bass-clef dots sit a little above Bravura's baseline, so place that baseline between the F line and the line below it. */
  protected clefBaseline(): number {
    return this.question().clef === 'bass' ? this.bottom - this.space * 2.5 : this.bottom;
  }

  protected staffLabel(): string {
    const name = this.question().clef === 'treble' ? '高音谱' : '低音谱';
    return `${name}，请选择这个音符`;
  }

  private failChallenge(): void {
    const finalScore = this.score();
    const rank = this.remember(finalScore);
    this.locked = true;
    this.phase.set('try');
    this.feedbackKey.update((key) => key + 1);
    this.score.set(0);
    this.scorePop.set(false);
    this.confetti.set([]);
    if (this.soundOn()) this.audio.tryAgain();
    this.notice.set({ kind: 'wipe', score: finalScore, rank });
  }

  private remember(score: number): number | null {
    const mode = this.mode();
    if (!mode || this.submitted || score <= 0) return null;
    if (mode === 'normal' && !this.gained) return null;
    this.submitted = true;
    const rank = recordScore(mode, score);
    this.refreshBoard(mode);
    return rank;
  }

  private refreshBoards(): void {
    this.timedBoard.set(loadBoard('timed'));
    this.challengeBoard.set(loadBoard('challenge'));
    this.normalBoard.set(loadBoard('normal'));
  }

  private refreshBoard(mode: GameMode): void {
    const rows = loadBoard(mode);
    if (mode === 'timed') this.timedBoard.set(rows);
    else if (mode === 'challenge') this.challengeBoard.set(rows);
    else this.normalBoard.set(rows);
  }

  private applyRestart(): void {
    window.clearTimeout(this.celebrateTimer);
    window.clearTimeout(this.popTimer);
    this.audio.stop();
    this.notice.set(null);
    this.score.set(0);
    this.scorePop.set(false);
    this.hintOpen.set(false);
    this.confetti.set([]);
    this.submitted = true;
    if (this.mode() === 'normal') {
      this.writeNumber(SCORE_KEY, 0);
      this.normalStars.set(0);
    }
    this.deal();
    if (this.mode() === 'timed') this.startTimer();
  }

  private leavePlay(): void {
    this.stopTimer();
    window.clearTimeout(this.celebrateTimer);
    window.clearTimeout(this.popTimer);
    this.audio.stop();
    this.locked = false;
    this.started.set(false);
    this.mode.set(null);
    this.hintOpen.set(false);
    this.confetti.set([]);
    this.phase.set('idle');
    this.notice.set(null);
    this.normalStars.set(this.readNumber(SCORE_KEY));
    this.refreshBoards();
  }

  private startTimer(): void {
    this.stopTimer();
    this.endsAt = Date.now() + ROUND_MS;
    this.secondsLeft.set(60);
    this.timerId = window.setInterval(() => this.tick(), 200);
  }

  private stopTimer(): void {
    window.clearInterval(this.timerId);
    this.timerId = 0;
  }

  private tick(): void {
    const left = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
    this.secondsLeft.set(left);
    if (left <= 0) this.finishTimed();
  }

  private finishTimed(): void {
    if (this.notice()?.kind === 'timeup') return;
    this.stopTimer();
    window.clearTimeout(this.celebrateTimer);
    this.secondsLeft.set(0);
    this.locked = true;
    const score = this.score();
    const rank = this.remember(score);
    this.notice.set({ kind: 'timeup', score, rank });
  }

  private deal(): void {
    window.clearTimeout(this.celebrateTimer);
    const next = this.pickQuestion();
    const id = `${next.clef}:${next.step}`;
    this.clefRun = next.clef === this.lastClef ? this.clefRun + 1 : 1;
    this.lastClef = next.clef;
    this.lastId = id;
    this.question.set(next);
    this.wrong.set([]);
    this.phase.set('idle');
    this.locked = false;
    this.round.update((value) => value + 1);
    this.confetti.set([]);
  }

  private pickQuestion(): NoteQuestion {
    let clef: Clef = Math.random() < 0.5 ? 'treble' : 'bass';
    if (this.clefRun >= 2 && this.lastClef) {
      clef = this.lastClef === 'treble' ? 'bass' : 'treble';
    }
    const pool = clef === 'treble' ? TREBLE : BASS;
    let choice = pool[Math.floor(Math.random() * pool.length)];
    let guard = 0;
    while (`${choice.clef}:${choice.step}` === this.lastId && guard < 6) {
      choice = pool[Math.floor(Math.random() * pool.length)];
      guard += 1;
    }
    return choice;
  }

  private burst(): void {
    const colors = ['#ff8fb3', '#ffd166', '#b6e86a', '#7ad7f5', '#d2b0ff', '#ff9f6b'];
    const pieces: ConfettiPiece[] = Array.from({ length: 26 }, (_, index) => ({
      id: this.round() * 100 + index,
      left: Math.random() * 100,
      color: colors[index % colors.length],
      delay: Math.random() * 0.18,
      drift: (Math.random() - 0.5) * 120,
    }));
    this.confetti.set(pieces);
  }

  private readNumber(key: string): number {
    const raw = Number(localStorage.getItem(key) ?? 0);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  }

  private writeNumber(key: string, value: number): void {
    localStorage.setItem(key, String(value));
  }
}

interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  delay: number;
  drift: number;
}

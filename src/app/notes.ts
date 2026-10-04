export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Clef = 'treble' | 'bass';

export interface NoteQuestion {
  clef: Clef;
  letter: Letter;
  /**
   * Diatonic steps above the bottom line of the staff.
   * 0 is the bottom line, 1 is the space above it, 2 is the next line.
   * -2 / -4 are one and two ledger lines below. 10 / 12 are one and two above.
   */
  step: number;
  frequency: number;
}

export interface LetterButton {
  id: Letter;
  solfege: string;
  color: string;
}

const hz = (midi: number): number =>
  Math.round(440 * 2 ** ((midi - 69) / 12) * 100) / 100;

const ORDER: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMI_AFTER: Record<Letter, number> = {
  C: 2,
  D: 2,
  E: 1,
  F: 2,
  G: 2,
  A: 2,
  B: 1,
};

function range(
  clef: Clef,
  bottomLetter: Letter,
  bottomMidi: number,
  lowStep: number,
  highStep: number,
): NoteQuestion[] {
  const byStep = new Map<number, { letter: Letter; midi: number }>();
  byStep.set(0, { letter: bottomLetter, midi: bottomMidi });

  let letter = bottomLetter;
  let midi = bottomMidi;
  for (let step = 1; step <= highStep; step += 1) {
    midi += SEMI_AFTER[letter];
    letter = ORDER[(ORDER.indexOf(letter) + 1) % 7];
    byStep.set(step, { letter, midi });
  }

  letter = bottomLetter;
  midi = bottomMidi;
  for (let step = -1; step >= lowStep; step -= 1) {
    const previous = ORDER[(ORDER.indexOf(letter) + 6) % 7];
    midi -= SEMI_AFTER[previous];
    letter = previous;
    byStep.set(step, { letter, midi });
  }

  const notes: NoteQuestion[] = [];
  for (let step = lowStep; step <= highStep; step += 1) {
    const item = byStep.get(step);
    if (!item) continue;
    notes.push({ clef, letter: item.letter, step, frequency: hz(item.midi) });
  }
  return notes;
}

/** Treble, from two ledger lines below (A3) to two ledger lines above (C6). */
export const TREBLE: NoteQuestion[] = range('treble', 'E', 64, -4, 12);

/** Bass, from two ledger lines below (C2) to two ledger lines above (E4). */
export const BASS: NoteQuestion[] = range('bass', 'G', 43, -4, 12);

export const LETTERS: LetterButton[] = [
  { id: 'C', solfege: 'do', color: '#ff9eb8' },
  { id: 'D', solfege: 're', color: '#ffc45c' },
  { id: 'E', solfege: 'mi', color: '#ffe56a' },
  { id: 'F', solfege: 'fa', color: '#b6e86a' },
  { id: 'G', solfege: 'soi', color: '#7ad7f5' },
  { id: 'A', solfege: 'la', color: '#8eb6ff' },
  { id: 'B', solfege: 'si', color: '#d2b0ff' },
];

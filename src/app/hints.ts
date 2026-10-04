import { Letter } from './notes';

export interface HintWord {
  initial: Letter;
  rest: string;
}

export interface HintMark {
  letter: Letter;
  /** Same step numbers as the big staff: 0 is the bottom line. */
  step: number;
}

export interface HintCard {
  id: 'face' | 'boy' | 'cows' | 'boys';
  kind: '线' | '间';
  bigLetters: boolean;
  words: HintWord[];
  /** Bottom to top, so the picture matches the staff. */
  marks: HintMark[];
}

export const TREBLE_HINTS: HintCard[] = [
  {
    id: 'face',
    kind: '间',
    bigLetters: true,
    words: [
      { initial: 'F', rest: '' },
      { initial: 'A', rest: '' },
      { initial: 'C', rest: '' },
      { initial: 'E', rest: '' },
    ],
    marks: [
      { letter: 'F', step: 1 },
      { letter: 'A', step: 3 },
      { letter: 'C', step: 5 },
      { letter: 'E', step: 7 },
    ],
  },
  {
    id: 'boy',
    kind: '线',
    bigLetters: false,
    words: [
      { initial: 'E', rest: 'very' },
      { initial: 'G', rest: 'ood' },
      { initial: 'B', rest: 'oy' },
      { initial: 'D', rest: 'oes' },
      { initial: 'F', rest: 'ine' },
    ],
    marks: [
      { letter: 'E', step: 0 },
      { letter: 'G', step: 2 },
      { letter: 'B', step: 4 },
      { letter: 'D', step: 6 },
      { letter: 'F', step: 8 },
    ],
  },
];

export const BASS_HINTS: HintCard[] = [
  {
    id: 'cows',
    kind: '间',
    bigLetters: false,
    words: [
      { initial: 'A', rest: 'll' },
      { initial: 'C', rest: 'ows' },
      { initial: 'E', rest: 'at' },
      { initial: 'G', rest: 'rass' },
    ],
    marks: [
      { letter: 'A', step: 1 },
      { letter: 'C', step: 3 },
      { letter: 'E', step: 5 },
      { letter: 'G', step: 7 },
    ],
  },
  {
    id: 'boys',
    kind: '线',
    bigLetters: false,
    words: [
      { initial: 'G', rest: 'ood' },
      { initial: 'B', rest: 'oys' },
      { initial: 'D', rest: 'o' },
      { initial: 'F', rest: 'ine' },
      { initial: 'A', rest: 'lways' },
    ],
    marks: [
      { letter: 'G', step: 0 },
      { letter: 'B', step: 2 },
      { letter: 'D', step: 4 },
      { letter: 'F', step: 6 },
      { letter: 'A', step: 8 },
    ],
  },
];

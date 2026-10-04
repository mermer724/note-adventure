export interface RankRow {
  score: number;
  at: number;
}

export type ScoreMode = 'timed' | 'challenge' | 'normal';

const TOP_COUNT = 3;

const KEYS: Record<ScoreMode, string> = {
  timed: 'note-adventure-timed-top',
  challenge: 'note-adventure-challenge-top',
  normal: 'note-adventure-normal-top',
};

export function loadBoard(mode: ScoreMode): RankRow[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS[mode]) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (row): row is RankRow =>
          !!row &&
          typeof row === 'object' &&
          typeof (row as RankRow).score === 'number' &&
          typeof (row as RankRow).at === 'number',
      )
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, TOP_COUNT);
  } catch {
    return [];
  }
}

/** Saves a finished score. Returns its rank when it enters the top 3. */
export function recordScore(mode: ScoreMode, score: number): number | null {
  if (score <= 0) return null;
  const board = loadBoard(mode);
  const qualifies = board.length < TOP_COUNT || score >= board[board.length - 1].score;
  if (!qualifies) return null;

  const next = [...board, { score, at: Date.now() }]
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, TOP_COUNT);
  localStorage.setItem(KEYS[mode], JSON.stringify(next));
  return 1 + next.filter((row) => row.score > score).length;
}

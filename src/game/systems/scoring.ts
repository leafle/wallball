import type { BattingSide, Score } from "../domain/rules";

export type ScoringResult = "single" | "double" | "triple" | "home-run";
export type RunnerId = string;

export interface Bases {
  first: RunnerId | null;
  second: RunnerId | null;
  third: RunnerId | null;
}

export interface ScoringState {
  score: Score;
  bases: Bases;
  battingSide: BattingSide;
}

export interface ScoringUpdate {
  score: Score;
  bases: Bases;
  runsScored: RunnerId[];
}

export const EMPTY_BASES: Bases = {
  first: null,
  second: null,
  third: null
};

const resultBaseAdvances: Record<ScoringResult, number> = {
  single: 1,
  double: 2,
  triple: 3,
  "home-run": 4
};

export function createScore(score: Partial<Score> = {}): Score {
  return {
    away: score.away ?? 0,
    home: score.home ?? 0
  };
}

export function applyScoringResult(
  state: ScoringState,
  result: ScoringResult,
  batterId: RunnerId
): ScoringUpdate {
  const advanceBy = resultBaseAdvances[result];
  const runsScored: RunnerId[] = [];
  const bases: Bases = { ...EMPTY_BASES };
  const runners = [
    { id: state.bases.third, base: 3 },
    { id: state.bases.second, base: 2 },
    { id: state.bases.first, base: 1 },
    { id: batterId, base: 0 }
  ];

  for (const runner of runners) {
    if (!runner.id) {
      continue;
    }

    const destination = runner.base + advanceBy;

    if (destination >= 4) {
      runsScored.push(runner.id);
    } else if (destination === 3) {
      bases.third = runner.id;
    } else if (destination === 2) {
      bases.second = runner.id;
    } else if (destination === 1) {
      bases.first = runner.id;
    }
  }

  return {
    score: {
      ...state.score,
      [state.battingSide]: state.score[state.battingSide] + runsScored.length
    },
    bases,
    runsScored
  };
}

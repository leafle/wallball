export type HalfInning = "top" | "bottom";
export type BattingSide = "away" | "home";

export interface InningState {
  inning: number;
  half: HalfInning;
  outs: number;
}

export interface Score {
  away: number;
  home: number;
}

export interface MatchState {
  teams: {
    away: string;
    home: string;
  };
  score: Score;
  inning: InningState;
  battingSide: BattingSide;
}

export const MAX_OUTS_PER_HALF_INNING = 3;

export const INITIAL_INNING_STATE: InningState = {
  inning: 1,
  half: "top",
  outs: 0
};

export function createMatchState({
  awayTeamId,
  homeTeamId
}: {
  awayTeamId: string;
  homeTeamId: string;
}): MatchState {
  return {
    teams: {
      away: awayTeamId,
      home: homeTeamId
    },
    score: {
      away: 0,
      home: 0
    },
    inning: { ...INITIAL_INNING_STATE },
    battingSide: "away"
  };
}

export function applyOut(state: MatchState): MatchState {
  const outs = state.inning.outs + 1;

  if (outs < MAX_OUTS_PER_HALF_INNING) {
    return {
      ...state,
      inning: {
        ...state.inning,
        outs
      }
    };
  }

  if (state.inning.half === "top") {
    return {
      ...state,
      battingSide: "home",
      inning: {
        inning: state.inning.inning,
        half: "bottom",
        outs: 0
      }
    };
  }

  return {
    ...state,
    battingSide: "away",
    inning: {
      inning: state.inning.inning + 1,
      half: "top",
      outs: 0
    }
  };
}

import type { HighScore } from "../domain/high-scores";
import { updateRunHighScoresFromMatch } from "../domain/high-scores";
import type {
  CompletedMatch,
  MatchEvent,
  MatchSummary
} from "../domain/match-summary";
import { generateMatchSummary } from "../domain/match-summary";
import type { BattingOrder } from "../domain/rosters";
import type { BattingSide, MatchState } from "../domain/rules";
import { applyOut, createMatchState } from "../domain/rules";
import type { BallResultKind } from "./ball-results";
import type { WallballHitResult } from "./fielding";
import type { Bases, RunnerId, ScoringResult } from "./scoring";
import { EMPTY_BASES, applyScoringResult } from "./scoring";

export type PlateAppearanceResult = BallResultKind | WallballHitResult;

export type MatchFlowBattingOrder = BattingOrder;

export interface MatchFlowState {
  match: MatchState;
  bases: Bases;
  battingOrder: MatchFlowBattingOrder;
  nextBatterIndex: Record<BattingSide, number>;
  events: MatchEvent[];
  completedInnings: number;
  maxInnings: number;
  scoreLimit: number | null;
}

export interface CreateMatchFlowStateInput {
  awayTeamId: string;
  homeTeamId: string;
  battingOrder: MatchFlowBattingOrder;
  maxInnings?: number;
  scoreLimit?: number;
}

export interface PlateAppearanceUpdate {
  state: MatchFlowState;
  batterId: RunnerId;
  result: PlateAppearanceResult;
  runsScored: RunnerId[];
  halfInningEnded: boolean;
  matchCompleted: boolean;
}

export interface RecordCompletedMatchOptions {
  id: string;
  playedAt: string;
  highScores?: HighScore[];
}

export interface RecordedMatch {
  match: CompletedMatch;
  summary: MatchSummary;
  highScores: HighScore[];
}

const scoringResults: readonly ScoringResult[] = [
  "single",
  "double",
  "triple",
  "home-run"
];

export function createMatchFlowState({
  awayTeamId,
  homeTeamId,
  battingOrder,
  maxInnings = 3,
  scoreLimit
}: CreateMatchFlowStateInput): MatchFlowState {
  validateBattingOrder("away", battingOrder.away);
  validateBattingOrder("home", battingOrder.home);
  validatePositiveInteger("maxInnings", maxInnings);

  if (scoreLimit !== undefined) {
    validatePositiveInteger("scoreLimit", scoreLimit);
  }

  return {
    match: createMatchState({ awayTeamId, homeTeamId }),
    bases: { ...EMPTY_BASES },
    battingOrder: {
      away: [...battingOrder.away],
      home: [...battingOrder.home]
    },
    nextBatterIndex: {
      away: 0,
      home: 0
    },
    events: [],
    completedInnings: 0,
    maxInnings,
    scoreLimit: scoreLimit ?? null
  };
}

export function getCurrentBatterId(state: MatchFlowState): RunnerId {
  const side = state.match.battingSide;
  const battingOrder = state.battingOrder[side];

  return battingOrder[
    state.nextBatterIndex[side] % battingOrder.length
  ] as RunnerId;
}

export function applyPlateAppearance(
  state: MatchFlowState,
  result: PlateAppearanceResult
): PlateAppearanceUpdate {
  const battingSide = state.match.battingSide;
  const batterId = getCurrentBatterId(state);
  const plateAppearanceEvent = createEvent(result, batterId, state);
  const nextBatterIndex = advanceBatterIndex(state, battingSide);

  if (isScoringResult(result)) {
    const scoringUpdate = applyScoringResult(
      {
        score: state.match.score,
        bases: state.bases,
        battingSide
      },
      result,
      batterId
    );
    const runEvents = scoringUpdate.runsScored.map((runnerId) =>
      createEvent("run", runnerId, state)
    );
    const nextState: MatchFlowState = {
      ...state,
      match: {
        ...state.match,
        score: scoringUpdate.score
      },
      bases: scoringUpdate.bases,
      nextBatterIndex,
      events: [...state.events, plateAppearanceEvent, ...runEvents]
    };

    return {
      state: nextState,
      batterId,
      result,
      runsScored: scoringUpdate.runsScored,
      halfInningEnded: false,
      matchCompleted: isMatchComplete(nextState)
    };
  }

  const nextMatch = applyOut(state.match);
  const halfInningEnded = didHalfInningEnd(state.match, nextMatch);
  const completedInnings =
    halfInningEnded && state.match.inning.half === "bottom"
      ? Math.max(state.completedInnings, state.match.inning.inning)
      : state.completedInnings;
  const nextState: MatchFlowState = {
    ...state,
    match: nextMatch,
    bases: halfInningEnded ? { ...EMPTY_BASES } : { ...state.bases },
    nextBatterIndex,
    events: [...state.events, plateAppearanceEvent],
    completedInnings
  };

  return {
    state: nextState,
    batterId,
    result,
    runsScored: [],
    halfInningEnded,
    matchCompleted: isMatchComplete(nextState)
  };
}

export function recordCompletedMatch(
  state: MatchFlowState,
  { id, playedAt, highScores = [] }: RecordCompletedMatchOptions
): RecordedMatch {
  const match: CompletedMatch = {
    id,
    playedAt,
    teams: { ...state.match.teams },
    score: { ...state.match.score },
    innings: state.completedInnings || state.match.inning.inning,
    events: state.events.map((event) => ({ ...event }))
  };
  const summary = generateMatchSummary(match);

  return {
    match,
    summary,
    highScores: applyRunsLeaderboard(highScores, match)
  };
}

export function isMatchComplete(state: MatchFlowState): boolean {
  return (
    state.completedInnings >= state.maxInnings ||
    (state.scoreLimit !== null &&
      (state.match.score.away >= state.scoreLimit ||
        state.match.score.home >= state.scoreLimit))
  );
}

function validateBattingOrder(side: BattingSide, battingOrder: RunnerId[]): void {
  if (battingOrder.length === 0) {
    throw new Error(`Expected at least one ${side} batter`);
  }
}

function validatePositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Expected ${name} to be a positive integer`);
  }
}

function advanceBatterIndex(
  state: MatchFlowState,
  side: BattingSide
): Record<BattingSide, number> {
  return {
    ...state.nextBatterIndex,
    [side]: (state.nextBatterIndex[side] + 1) % state.battingOrder[side].length
  };
}

function didHalfInningEnd(
  previousMatch: MatchState,
  nextMatch: MatchState
): boolean {
  return (
    previousMatch.inning.half !== nextMatch.inning.half ||
    previousMatch.inning.inning !== nextMatch.inning.inning
  );
}

export function isScoringResult(
  result: PlateAppearanceResult
): result is ScoringResult {
  return scoringResults.includes(result as ScoringResult);
}

function createEvent(
  kind: string,
  playerId: RunnerId,
  state: MatchFlowState
): MatchEvent {
  return {
    kind,
    playerId,
    inning: state.match.inning.inning
  };
}

function applyRunsLeaderboard(
  highScores: HighScore[],
  match: CompletedMatch
): HighScore[] {
  return updateRunHighScoresFromMatch(highScores, match);
}

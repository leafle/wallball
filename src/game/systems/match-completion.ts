import {
  readWallballPersistenceStatus,
  type WallballDataClient,
  type WallballPersistenceStatus
} from "../data/game-data-client";
import type { HighScore } from "../domain/high-scores";
import type { CompletedMatch, MatchSummary } from "../domain/match-summary";
import type { LocalMatchLoopState } from "./local-match-loop";
import { isMatchComplete, recordCompletedMatch } from "./match-flow";

export interface RecordLocalMatchCompletionOptions {
  dataClient: WallballDataClient;
  id: string;
  playedAt: string;
}

export interface RecordedLocalMatchCompletion {
  highScores: HighScore[];
  match: CompletedMatch;
  persistenceStatus: WallballPersistenceStatus;
  summary: MatchSummary;
}

export async function recordLocalMatchCompletion(
  state: LocalMatchLoopState,
  { dataClient, id, playedAt }: RecordLocalMatchCompletionOptions
): Promise<RecordedLocalMatchCompletion> {
  if (!isMatchComplete(state.flow)) {
    throw new Error("Cannot record an incomplete match");
  }

  const recorded = recordCompletedMatch(state.flow, {
    id,
    playedAt,
    highScores: await dataClient.getHighScores("runs")
  });
  const summary = await dataClient.recordMatch(recorded.match);

  return {
    highScores: await dataClient.getHighScores("runs"),
    match: recorded.match,
    persistenceStatus: readWallballPersistenceStatus(dataClient),
    summary
  };
}

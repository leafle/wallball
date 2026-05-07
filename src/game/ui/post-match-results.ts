import type { WallballPersistenceStatus } from "../data/game-data-client";
import type { HighScore } from "../domain/high-scores";
import type { MatchSummary } from "../domain/match-summary";
import type { PlaySceneLoopProjection } from "../scenes/play-scene-loop-adapter";

export type PostMatchRecordState = "idle" | "recording" | "recorded" | "failed";

export interface PostMatchPlayerLabel {
  displayName: string;
  id: string;
}

export interface ProjectPostMatchResultsPanelInput {
  errorMessage?: string | null;
  highScores: readonly HighScore[];
  persistenceStatus?: WallballPersistenceStatus | null;
  players: readonly PostMatchPlayerLabel[];
  projection: PlaySceneLoopProjection;
  recordState: PostMatchRecordState;
  summary: MatchSummary | null;
}

export interface PostMatchLeaderboardRow {
  detail: string;
  label: string;
  rank: number;
  value: string;
}

export interface PostMatchResultsPanelProjection {
  emptyLeaderboardText: string | null;
  finalScore: string;
  leaderboardRows: PostMatchLeaderboardRow[];
  matchupLabel: string;
  statusLabel: string;
  summaryRows: string[];
  title: string;
  winnerLabel: string;
}

const MAX_SUMMARY_ROWS = 3;
const MAX_LEADERBOARD_ROWS = 5;

export function projectPostMatchResultsPanel({
  errorMessage,
  highScores,
  persistenceStatus,
  players,
  projection,
  recordState,
  summary
}: ProjectPostMatchResultsPanelInput): PostMatchResultsPanelProjection {
  const completion = projection.completion;
  const leaderboardRows = highScores
    .slice(0, MAX_LEADERBOARD_ROWS)
    .map((score, index) => ({
      detail: score.matchId,
      label: playerDisplayName(players, score.playerId),
      rank: index + 1,
      value: `${score.value} ${score.value === 1 ? "run" : "runs"}`
    }));

  return {
    emptyLeaderboardText:
      leaderboardRows.length === 0 ? "Run leaders will appear after a final." : null,
    finalScore:
      completion?.finalScore ??
      `${projection.hud.awayTeamName} ${projection.hud.awayScore}, ${projection.hud.homeTeamName} ${projection.hud.homeScore}`,
    leaderboardRows,
    matchupLabel: `${projection.hud.pitcherName} vs ${projection.hud.batterName}`,
    statusLabel: statusLabel(recordState, persistenceStatus),
    summaryRows: projectSummaryRows({ errorMessage, recordState, summary }),
    title: completion ? "Final" : "Match Results",
    winnerLabel: completion
      ? completion.winnerTeamName
        ? `${completion.winnerTeamName} win`
        : "Tie exhibition"
      : "Play to the local score limit"
  };
}

function projectSummaryRows({
  errorMessage,
  recordState,
  summary
}: {
  errorMessage?: string | null;
  recordState: PostMatchRecordState;
  summary: MatchSummary | null;
}): string[] {
  if (recordState === "failed") {
    return [errorMessage ?? "Match result could not be recorded."];
  }

  if (recordState === "recording") {
    return ["Recording match summary..."];
  }

  if (!summary) {
    return [];
  }

  return summary.notableEvents.slice(0, MAX_SUMMARY_ROWS);
}

function statusLabel(
  recordState: PostMatchRecordState,
  persistenceStatus?: WallballPersistenceStatus | null
): string {
  if (recordState === "recording") {
    return "Recording";
  }

  if (recordState === "recorded") {
    if (persistenceStatus?.state === "queued") {
      return persistenceStatus.pendingWrites > 1
        ? `Queued (${persistenceStatus.pendingWrites})`
        : "Queued";
    }

    return "Recorded";
  }

  if (recordState === "failed") {
    return "Needs retry";
  }

  return "Live";
}

function playerDisplayName(
  players: readonly PostMatchPlayerLabel[],
  playerId: string
): string {
  return players.find((player) => player.id === playerId)?.displayName ?? playerId;
}

import type { CompletedMatch, MatchEvent } from "./match-summary";

export interface HighScore {
  category: string;
  playerId: string;
  value: number;
  matchId: string;
  recordedAt: string;
}

export interface HighScoreOptions {
  limitPerCategory?: number;
}

export function updateHighScores(
  currentScores: HighScore[],
  candidate: HighScore,
  { limitPerCategory = 10 }: HighScoreOptions = {}
): HighScore[] {
  const grouped = new Map<string, HighScore[]>();

  for (const score of [...currentScores, candidate]) {
    const scores = grouped.get(score.category) ?? [];
    scores.push(score);
    grouped.set(score.category, scores);
  }

  return [...grouped.values()]
    .flatMap((scores) =>
      scores
        .sort(
          (left, right) =>
            right.value - left.value ||
            left.recordedAt.localeCompare(right.recordedAt)
        )
        .slice(0, limitPerCategory)
    )
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        right.value - left.value ||
        left.recordedAt.localeCompare(right.recordedAt)
    );
}

export function getRunHighScoreCandidates(match: CompletedMatch): HighScore[] {
  return [...countRunsByPlayer(match.events).entries()].map(
    ([playerId, value]) => ({
      category: "runs",
      playerId,
      value,
      matchId: match.id,
      recordedAt: match.playedAt
    })
  );
}

export function updateRunHighScoresFromMatch(
  currentScores: HighScore[],
  match: CompletedMatch,
  options?: HighScoreOptions
): HighScore[] {
  return getRunHighScoreCandidates(match).reduce(
    (scores, candidate) => updateHighScores(scores, candidate, options),
    currentScores.map((score) => ({ ...score }))
  );
}

function countRunsByPlayer(events: MatchEvent[]): Map<string, number> {
  const runsByPlayer = new Map<string, number>();

  for (const event of events) {
    if (event.kind !== "run") {
      continue;
    }

    runsByPlayer.set(
      event.playerId,
      (runsByPlayer.get(event.playerId) ?? 0) + 1
    );
  }

  return runsByPlayer;
}

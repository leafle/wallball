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

import type { Score } from "./rules";

export interface MatchEvent {
  kind: string;
  playerId: string;
  inning: number;
}

export interface CompletedMatch {
  id: string;
  playedAt: string;
  teams: {
    away: string;
    home: string;
  };
  score: Score;
  innings: number;
  events: MatchEvent[];
}

export interface MatchSummary {
  id: string;
  playedAt: string;
  finalScore: string;
  winnerTeamId: string | null;
  loserTeamId: string | null;
  innings: number;
  notableEvents: string[];
}

export function generateMatchSummary(match: CompletedMatch): MatchSummary {
  const winnerTeamId =
    match.score.away === match.score.home
      ? null
      : match.score.away > match.score.home
        ? match.teams.away
        : match.teams.home;
  const loserTeamId =
    winnerTeamId === null
      ? null
      : winnerTeamId === match.teams.away
        ? match.teams.home
        : match.teams.away;

  return {
    id: match.id,
    playedAt: match.playedAt,
    finalScore: `${match.teams.away} ${match.score.away}, ${match.teams.home} ${match.score.home}`,
    winnerTeamId,
    loserTeamId,
    innings: match.innings,
    notableEvents: match.events.map(
      (event) => `${event.inning}: ${event.playerId} ${event.kind}`
    )
  };
}

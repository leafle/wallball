import type { HighScore } from "../domain/high-scores";
import type { InteractionCallout } from "../domain/friend-interactions";
import type { CompletedMatch } from "../domain/match-summary";
import { generateMatchSummary } from "../domain/match-summary";

export interface MatchHistoryTeamLabel {
  displayName: string;
  id: string;
}

export interface MatchHistoryPlayerLabel {
  displayName: string;
  id: string;
}

export interface MatchHistoryRivalryInput {
  callout: InteractionCallout | null;
  playerIds: readonly [string, string];
  teamIds: readonly [string, string];
}

export interface ProjectMatchHistoryScreenInput {
  highScores: readonly HighScore[];
  matches: readonly CompletedMatch[];
  players: readonly MatchHistoryPlayerLabel[];
  rivalry: MatchHistoryRivalryInput;
  teams: readonly MatchHistoryTeamLabel[];
}

export interface MatchHistoryRecentRow {
  detail: string;
  id: string;
  playedAtLabel: string;
  resultLabel: string;
  scoreLabel: string;
}

export interface MatchHistoryRivalryProjection {
  calloutText: string | null;
  matchupLabel: string;
  recentResultLabel: string;
  recordLabel: string;
  runLeaderLabel: string;
  title: string;
}

export interface MatchHistoryScreenProjection {
  emptyHistoryText: string | null;
  recentRows: MatchHistoryRecentRow[];
  rivalry: MatchHistoryRivalryProjection;
  statusLabel: string;
  title: string;
}

const MAX_RECENT_ROWS = 4;

export function projectMatchHistoryScreen({
  highScores,
  matches,
  players,
  rivalry,
  teams
}: ProjectMatchHistoryScreenInput): MatchHistoryScreenProjection {
  const recentMatches = sortMatchesByRecent(matches).slice(0, MAX_RECENT_ROWS);

  return {
    emptyHistoryText:
      matches.length === 0 ? "Recorded local matches will appear here." : null,
    recentRows: recentMatches.map((match) => projectRecentRow(match, teams)),
    rivalry: projectRivalry({
      highScores,
      matches,
      players,
      rivalry,
      teams
    }),
    statusLabel:
      matches.length === 0
        ? "No recorded matches"
        : `${matches.length} ${matches.length === 1 ? "recorded" : "recorded"}`,
    title: "Match History"
  };
}

function projectRecentRow(
  match: CompletedMatch,
  teams: readonly MatchHistoryTeamLabel[]
): MatchHistoryRecentRow {
  const summary = generateMatchSummary(match);

  return {
    detail: formatMatchDetail(summary.innings, summary.notableEvents[0]),
    id: summary.id,
    playedAtLabel: formatPlayedAt(summary.playedAt),
    resultLabel: summary.winnerTeamId
      ? `${teamDisplayName(teams, summary.winnerTeamId)} won`
      : "Tie",
    scoreLabel: formatScore(match, teams)
  };
}

function projectRivalry({
  highScores,
  matches,
  players,
  rivalry,
  teams
}: ProjectMatchHistoryScreenInput): MatchHistoryRivalryProjection {
  const [firstTeamId, secondTeamId] = rivalry.teamIds;
  const [firstPlayerId, secondPlayerId] = rivalry.playerIds;
  const rivalryMatches = sortMatchesByRecent(
    matches.filter((match) =>
      hasSameTeamPair(match, firstTeamId, secondTeamId)
    )
  );
  const latestRivalryMatch = rivalryMatches[0] ?? null;

  return {
    calloutText: rivalry.callout?.message ?? null,
    matchupLabel: `${teamDisplayName(teams, firstTeamId)} vs ${teamDisplayName(
      teams,
      secondTeamId
    )}`,
    recentResultLabel: latestRivalryMatch
      ? `Latest: ${formatScore(latestRivalryMatch, teams)}`
      : "Play a local match to start the rivalry.",
    recordLabel: formatRivalryRecord(rivalryMatches, rivalry.teamIds, teams),
    runLeaderLabel: formatRivalryRunLeader(highScores, rivalry.playerIds, players),
    title: `${playerDisplayName(players, firstPlayerId)} vs ${playerDisplayName(
      players,
      secondPlayerId
    )}`
  };
}

function sortMatchesByRecent(
  matches: readonly CompletedMatch[]
): CompletedMatch[] {
  return [...matches].sort((left, right) =>
    right.playedAt.localeCompare(left.playedAt)
  );
}

function hasSameTeamPair(
  match: CompletedMatch,
  firstTeamId: string,
  secondTeamId: string
): boolean {
  const matchTeams = new Set([match.teams.away, match.teams.home]);

  return matchTeams.has(firstTeamId) && matchTeams.has(secondTeamId);
}

function formatRivalryRecord(
  matches: readonly CompletedMatch[],
  [firstTeamId, secondTeamId]: readonly [string, string],
  teams: readonly MatchHistoryTeamLabel[]
): string {
  if (matches.length === 0) {
    return `No ${teamDisplayName(teams, firstTeamId)}/${teamDisplayName(
      teams,
      secondTeamId
    )} meetings yet`;
  }

  const wins = {
    [firstTeamId]: 0,
    [secondTeamId]: 0
  };
  let ties = 0;

  for (const match of matches) {
    const summary = generateMatchSummary(match);

    if (summary.winnerTeamId === firstTeamId) {
      wins[firstTeamId] += 1;
    } else if (summary.winnerTeamId === secondTeamId) {
      wins[secondTeamId] += 1;
    } else {
      ties += 1;
    }
  }

  const firstTeamName = teamDisplayName(teams, firstTeamId);
  const secondTeamName = teamDisplayName(teams, secondTeamId);
  const firstTeamWins = wins[firstTeamId];
  const secondTeamWins = wins[secondTeamId];
  const tieSuffix = ties > 0 ? `-${ties}` : "";

  if (secondTeamWins > firstTeamWins) {
    return `${secondTeamName} ${secondTeamWins}-${firstTeamWins}${tieSuffix} vs ${firstTeamName}`;
  }

  return `${firstTeamName} ${firstTeamWins}-${secondTeamWins}${tieSuffix} vs ${secondTeamName}`;
}

function formatRivalryRunLeader(
  highScores: readonly HighScore[],
  playerIds: readonly [string, string],
  players: readonly MatchHistoryPlayerLabel[]
): string {
  const playerSet = new Set<string>(playerIds);
  const leader = highScores
    .filter((score) => score.category === "runs" && playerSet.has(score.playerId))
    .sort(
      (left, right) =>
        right.value - left.value ||
        left.recordedAt.localeCompare(right.recordedAt)
    )[0];

  if (!leader) {
    return "Rivalry run leaders will appear after recorded runs.";
  }

  return `${playerDisplayName(players, leader.playerId)} leads rivalry runs with ${leader.value}`;
}

function formatMatchDetail(innings: number, notableEvent?: string): string {
  const inningLabel = `${innings} ${innings === 1 ? "inning" : "innings"}`;

  return notableEvent ? `${inningLabel} - ${notableEvent}` : inningLabel;
}

function formatScore(
  match: CompletedMatch,
  teams: readonly MatchHistoryTeamLabel[]
): string {
  return `${teamDisplayName(teams, match.teams.away)} ${
    match.score.away
  }, ${teamDisplayName(teams, match.teams.home)} ${match.score.home}`;
}

function formatPlayedAt(playedAt: string): string {
  return playedAt.slice(0, 10) || playedAt;
}

function teamDisplayName(
  teams: readonly MatchHistoryTeamLabel[],
  teamId: string
): string {
  return teams.find((team) => team.id === teamId)?.displayName ?? teamId;
}

function playerDisplayName(
  players: readonly MatchHistoryPlayerLabel[],
  playerId: string
): string {
  return players.find((player) => player.id === playerId)?.displayName ?? playerId;
}

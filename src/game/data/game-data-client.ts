import {
  loadInteractionPrompts,
  loadPredefinedRosters,
  type PlayerFixture,
  type TeamFixture
} from "./fixtures";
import {
  getInteractionContext,
  type InteractionContext,
  type InteractionPrompt,
  type PlayerMatchup
} from "../domain/friend-interactions";
import type { HighScore } from "../domain/high-scores";
import type { CompletedMatch, MatchSummary } from "../domain/match-summary";
import { generateMatchSummary } from "../domain/match-summary";

export interface WallballDataClient {
  getHighScores(category?: string): Promise<HighScore[]>;
  getInteractionContext(matchup: PlayerMatchup): Promise<InteractionContext>;
  getMatchHistory(playerId?: string): Promise<CompletedMatch[]>;
  listPlayers(): Promise<PlayerFixture[]>;
  listTeams(): Promise<TeamFixture[]>;
  recordMatch(match: CompletedMatch): Promise<MatchSummary>;
}

export interface FixtureWallballDataOptions {
  highScores?: HighScore[];
  matches?: CompletedMatch[];
  prompts?: InteractionPrompt[];
  rosters?: TeamFixture[];
}

export function createFixtureWallballDataClient({
  highScores = [],
  matches = [],
  prompts = loadInteractionPrompts(),
  rosters = loadPredefinedRosters()
}: FixtureWallballDataOptions = {}): WallballDataClient {
  const state = {
    highScores: highScores.map(cloneHighScore),
    matches: matches.map(cloneCompletedMatch),
    prompts: prompts.map(cloneInteractionPrompt),
    rosters: rosters.map(cloneTeamFixture)
  };

  return {
    async getHighScores(category) {
      return state.highScores
        .filter((score) => !category || score.category === category)
        .map(cloneHighScore);
    },
    async getInteractionContext(matchup) {
      return getInteractionContext({
        matchup,
        prompts: state.prompts.map(cloneInteractionPrompt),
        matchHistory: state.matches.map(cloneCompletedMatch)
      });
    },
    async getMatchHistory(playerId) {
      return state.matches
        .filter(
          (match) =>
            !playerId || match.events.some((event) => event.playerId === playerId)
        )
        .map(cloneCompletedMatch);
    },
    async listPlayers() {
      return flattenPlayers(state.rosters).map(clonePlayerFixture);
    },
    async listTeams() {
      return state.rosters.map(cloneTeamFixture);
    },
    async recordMatch(match) {
      const persistedMatch = cloneCompletedMatch(match);
      state.matches.push(persistedMatch);

      return generateMatchSummary(persistedMatch);
    }
  };
}

export function cloneTeamFixture(team: TeamFixture): TeamFixture {
  return {
    ...team,
    players: team.players.map(clonePlayerFixture)
  };
}

export function clonePlayerFixture(player: PlayerFixture): PlayerFixture {
  return {
    ...player,
    tags: [...player.tags]
  };
}

export function cloneCompletedMatch(match: CompletedMatch): CompletedMatch {
  return {
    ...match,
    teams: { ...match.teams },
    score: { ...match.score },
    events: match.events.map((event) => ({ ...event }))
  };
}

export function cloneHighScore(score: HighScore): HighScore {
  return { ...score };
}

export function cloneInteractionPrompt(
  prompt: InteractionPrompt
): InteractionPrompt {
  return {
    ...prompt,
    playerIds: prompt.playerIds ? [...prompt.playerIds] : undefined,
    tags: [...prompt.tags]
  };
}

function flattenPlayers(rosters: TeamFixture[]): PlayerFixture[] {
  const players = new Map<string, PlayerFixture>();

  for (const team of rosters) {
    for (const player of team.players) {
      players.set(player.id, clonePlayerFixture(player));
    }
  }

  return [...players.values()];
}

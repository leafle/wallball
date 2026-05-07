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
import { updateRunHighScoresFromMatch } from "../domain/high-scores";
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

export type WallballPersistenceState = "queued" | "synced";

export interface WallballPersistenceStatus {
  pendingWrites: number;
  state: WallballPersistenceState;
}

export interface ResilientWallballDataClient extends WallballDataClient {
  getPersistenceStatus(): WallballPersistenceStatus;
  retryPendingWrites(): Promise<WallballPersistenceStatus>;
}

export interface ResilientWallballDataOptions {
  fallback?: WallballDataClient;
  primary: WallballDataClient;
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
      state.highScores = updateRunHighScoresFromMatch(
        state.highScores,
        persistedMatch
      );

      return generateMatchSummary(persistedMatch);
    }
  };
}

export function createResilientWallballDataClient({
  fallback = createFixtureWallballDataClient(),
  primary
}: ResilientWallballDataOptions): ResilientWallballDataClient {
  let pendingMatches: CompletedMatch[] = [];
  let retryInFlight: Promise<WallballPersistenceStatus> | null = null;

  function getPersistenceStatus(): WallballPersistenceStatus {
    return {
      pendingWrites: pendingMatches.length,
      state: pendingMatches.length > 0 ? "queued" : "synced"
    };
  }

  async function retryPendingWrites(): Promise<WallballPersistenceStatus> {
    retryInFlight ??= flushPendingWrites().finally(() => {
      retryInFlight = null;
    });

    return retryInFlight;
  }

  async function flushPendingWrites(): Promise<WallballPersistenceStatus> {
    if (pendingMatches.length === 0) {
      return getPersistenceStatus();
    }

    const remainingMatches: CompletedMatch[] = [];

    for (const [index, pendingMatch] of pendingMatches.entries()) {
      try {
        await primary.recordMatch(cloneCompletedMatch(pendingMatch));
      } catch {
        remainingMatches.push(
          cloneCompletedMatch(pendingMatch),
          ...pendingMatches.slice(index + 1).map(cloneCompletedMatch)
        );
        pendingMatches = remainingMatches;
        return getPersistenceStatus();
      }
    }

    pendingMatches = [];
    return getPersistenceStatus();
  }

  async function readWithFallback<T>(
    readPrimary: () => Promise<T>,
    readFallback: () => Promise<T>
  ): Promise<T> {
    await retryPendingWrites();

    if (pendingMatches.length === 0) {
      try {
        return await readPrimary();
      } catch {
        // Fall through to the local mirror when the primary service is down.
      }
    }

    return readFallback();
  }

  return {
    getPersistenceStatus,
    async getHighScores(category) {
      return readWithFallback(
        () => primary.getHighScores(category),
        () => fallback.getHighScores(category)
      );
    },
    async getInteractionContext(matchup) {
      return readWithFallback(
        () => primary.getInteractionContext(matchup),
        () => fallback.getInteractionContext(matchup)
      );
    },
    async getMatchHistory(playerId) {
      return readWithFallback(
        () => primary.getMatchHistory(playerId),
        () => fallback.getMatchHistory(playerId)
      );
    },
    async listPlayers() {
      return readWithFallback(
        () => primary.listPlayers(),
        () => fallback.listPlayers()
      );
    },
    async listTeams() {
      return readWithFallback(
        () => primary.listTeams(),
        () => fallback.listTeams()
      );
    },
    async recordMatch(match) {
      await retryPendingWrites();

      if (pendingMatches.length > 0) {
        pendingMatches.push(cloneCompletedMatch(match));
        return fallback.recordMatch(match);
      }

      try {
        const summary = await primary.recordMatch(match);
        await fallback.recordMatch(match);
        return summary;
      } catch {
        pendingMatches.push(cloneCompletedMatch(match));
        return fallback.recordMatch(match);
      }
    },
    retryPendingWrites
  };
}

export function readWallballPersistenceStatus(
  client: WallballDataClient
): WallballPersistenceStatus {
  if (
    "getPersistenceStatus" in client &&
    typeof client.getPersistenceStatus === "function"
  ) {
    return client.getPersistenceStatus();
  }

  return {
    pendingWrites: 0,
    state: "synced"
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

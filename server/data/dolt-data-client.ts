import type {
  InteractionPrompt,
  PlayerMatchup
} from "../../src/game/domain/friend-interactions";
import { getInteractionContext } from "../../src/game/domain/friend-interactions";
import type { HighScore } from "../../src/game/domain/high-scores";
import { getRunHighScoreCandidates } from "../../src/game/domain/high-scores";
import type {
  CompletedMatch,
  MatchEvent
} from "../../src/game/domain/match-summary";
import { generateMatchSummary } from "../../src/game/domain/match-summary";
import type {
  PlayerFixture,
  TeamFixture
} from "../../src/game/data/fixtures";
import type {
  WallballDataClient
} from "../../src/game/data/game-data-client";
import {
  cloneCompletedMatch,
  cloneInteractionPrompt,
  clonePlayerFixture,
  cloneTeamFixture
} from "../../src/game/data/game-data-client";
import { spawnSync } from "node:child_process";

export interface DoltCliWallballDataClientOptions {
  cwd: string;
  doltPath?: string;
}

export interface DoltFixtureSeedInput {
  prompts: InteractionPrompt[];
  rosters: TeamFixture[];
}

interface DoltRow {
  [key: string]: unknown;
}

interface DoltQueryOutput {
  rows?: DoltRow[];
}

export interface DoltCliWallballDataClient extends WallballDataClient {
  execute(sql: string): Promise<void>;
  query(sql: string): Promise<DoltRow[]>;
}

const predefinedTeamOrder = ["champions", "woodland", "team-cainer", "ej"];

export function createDoltCliWallballDataClient({
  cwd,
  doltPath = "dolt"
}: DoltCliWallballDataClientOptions): DoltCliWallballDataClient {
  const client: DoltCliWallballDataClient = {
    async execute(sql) {
      runDoltSql({ cwd, doltPath, sql, returnsRows: false });
    },
    async getHighScores(category) {
      const rows = await client.query(
        `SELECT category, player_id, value, match_id, recorded_at
         FROM high_scores
         ${category ? `WHERE category = ${sqlString(category)}` : ""}
         ORDER BY category, value DESC, recorded_at`
      );

      return rows.map(rowToHighScore);
    },
    async getInteractionContext(matchup: PlayerMatchup) {
      return getInteractionContext({
        matchup,
        prompts: await listInteractionPrompts(client),
        matchHistory: await client.getMatchHistory()
      });
    },
    async getMatchHistory(playerId) {
      const rows = await client.query(
        `SELECT id, played_at, away_team_id, home_team_id, away_score, home_score, innings
         FROM matches
         ${
           playerId
             ? `WHERE EXISTS (
                  SELECT 1 FROM match_events
                  WHERE match_events.match_id = matches.id
                    AND match_events.player_id = ${sqlString(playerId)}
                )`
             : ""
         }
         ORDER BY played_at DESC, id`
      );
      const matches: CompletedMatch[] = [];

      for (const row of rows) {
        matches.push({
          id: stringField(row, "id"),
          playedAt: stringField(row, "played_at"),
          teams: {
            away: stringField(row, "away_team_id"),
            home: stringField(row, "home_team_id")
          },
          score: {
            away: numberField(row, "away_score"),
            home: numberField(row, "home_score")
          },
          innings: numberField(row, "innings"),
          events: await listMatchEvents(client, stringField(row, "id"))
        });
      }

      return matches;
    },
    async listPlayers() {
      const players = new Map<string, PlayerFixture>();

      for (const team of await client.listTeams()) {
        for (const player of team.players) {
          players.set(player.id, clonePlayerFixture(player));
        }
      }

      return [...players.values()];
    },
    async listTeams() {
      const rows = await client.query(
        `SELECT
           teams.id AS team_id,
           teams.display_name AS team_display_name,
           players.id AS player_id,
           players.display_name AS player_display_name,
           players.tags AS player_tags,
           team_players.batting_order AS batting_order
         FROM teams
         LEFT JOIN team_players ON team_players.team_id = teams.id
         LEFT JOIN players ON players.id = team_players.player_id
         ORDER BY teams.id, team_players.batting_order`
      );
      const teams = new Map<string, TeamFixture>();

      for (const row of rows) {
        const teamId = stringField(row, "team_id");
        const team =
          teams.get(teamId) ??
          createTeamFixture(teamId, stringField(row, "team_display_name"));
        const playerId = optionalStringField(row, "player_id");

        if (playerId) {
          team.players.push({
            id: playerId,
            displayName: stringField(row, "player_display_name"),
            battingOrder: numberField(row, "batting_order"),
            tags: jsonArrayField(row, "player_tags")
          });
        }

        teams.set(teamId, team);
      }

      return [...teams.values()]
        .sort(compareTeams)
        .map((team) => ({
          ...team,
          players: [...team.players]
            .sort((left, right) => left.battingOrder - right.battingOrder)
            .map(clonePlayerFixture)
        }));
    },
    async query(sql) {
      return runDoltSql({ cwd, doltPath, sql, returnsRows: true });
    },
    async recordMatch(match) {
      const persistedMatch = cloneCompletedMatch(match);
      const summary = generateMatchSummary(persistedMatch);

      await client.execute(
        `INSERT INTO matches (
           id,
           played_at,
           away_team_id,
           home_team_id,
           away_score,
           home_score,
           innings,
           winner_team_id,
           loser_team_id
         ) VALUES (
           ${sqlString(persistedMatch.id)},
           ${sqlString(toSqlTimestamp(persistedMatch.playedAt))},
           ${sqlString(persistedMatch.teams.away)},
           ${sqlString(persistedMatch.teams.home)},
           ${persistedMatch.score.away},
           ${persistedMatch.score.home},
           ${persistedMatch.innings},
           ${sqlNullable(summary.winnerTeamId)},
           ${sqlNullable(summary.loserTeamId)}
         )`
      );

      for (const [eventIndex, event] of persistedMatch.events.entries()) {
        await client.execute(
          `INSERT INTO match_events (
             match_id,
             event_index,
             kind,
             player_id,
             inning
           ) VALUES (
             ${sqlString(persistedMatch.id)},
             ${eventIndex},
             ${sqlString(event.kind)},
             ${sqlString(event.playerId)},
             ${event.inning}
           )`
        );
      }

      for (const score of getRunHighScoreCandidates(persistedMatch)) {
        await client.execute(
          `INSERT INTO high_scores (
             category,
             player_id,
             value,
             match_id,
             recorded_at
           ) VALUES (
             ${sqlString(score.category)},
             ${sqlString(score.playerId)},
             ${score.value},
             ${sqlString(score.matchId)},
             ${sqlString(toSqlTimestamp(score.recordedAt))}
           )`
        );
      }

      return summary;
    }
  };

  return client;
}

export async function seedDoltFixtureData(
  client: DoltCliWallballDataClient,
  { prompts, rosters }: DoltFixtureSeedInput
): Promise<void> {
  for (const team of rosters.map(cloneTeamFixture)) {
    await client.execute(
      `INSERT IGNORE INTO teams (id, display_name)
       VALUES (${sqlString(team.id)}, ${sqlString(team.displayName)})`
    );

    for (const player of team.players) {
      await client.execute(
        `INSERT IGNORE INTO players (id, display_name, tags)
         VALUES (
           ${sqlString(player.id)},
           ${sqlString(player.displayName)},
           ${sqlJson(player.tags)}
         )`
      );
      await client.execute(
        `INSERT IGNORE INTO team_players (team_id, player_id, batting_order)
         VALUES (
           ${sqlString(team.id)},
           ${sqlString(player.id)},
           ${player.battingOrder}
         )`
      );
    }
  }

  for (const prompt of prompts.map(cloneInteractionPrompt)) {
    await client.execute(
      `INSERT IGNORE INTO interaction_prompts (
         id,
         trigger_kind,
         message,
         tags,
         batter_player_id,
         pitcher_player_id,
         player_ids
       ) VALUES (
         ${sqlString(prompt.id)},
         ${sqlString(prompt.trigger)},
         ${sqlString(prompt.message)},
         ${sqlJson(prompt.tags)},
         ${sqlNullable(prompt.batterId)},
         ${sqlNullable(prompt.pitcherId)},
         ${sqlJson(prompt.playerIds ?? null)}
       )`
    );
  }
}

function runDoltSql({
  cwd,
  doltPath,
  returnsRows,
  sql
}: {
  cwd: string;
  doltPath: string;
  returnsRows: boolean;
  sql: string;
}): DoltRow[] {
  const result = spawnSync(
    doltPath,
    returnsRows ? ["sql", "-r", "json", "-q", sql] : ["sql", "-q", sql],
    {
      cwd,
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }

  if (!returnsRows || result.stdout.trim().length === 0) {
    return [];
  }

  return (JSON.parse(result.stdout) as DoltQueryOutput).rows ?? [];
}

async function listMatchEvents(
  client: DoltCliWallballDataClient,
  matchId: string
): Promise<MatchEvent[]> {
  const rows = await client.query(
    `SELECT kind, player_id, inning
     FROM match_events
     WHERE match_id = ${sqlString(matchId)}
     ORDER BY event_index`
  );

  return rows.map((row) => ({
    kind: stringField(row, "kind"),
    playerId: stringField(row, "player_id"),
    inning: numberField(row, "inning")
  }));
}

async function listInteractionPrompts(
  client: DoltCliWallballDataClient
): Promise<InteractionPrompt[]> {
  const rows = await client.query(
    `SELECT id, trigger_kind, message, tags, batter_player_id, pitcher_player_id, player_ids
     FROM interaction_prompts
     WHERE enabled = TRUE
     ORDER BY id`
  );

  return rows.map((row) => ({
    id: stringField(row, "id"),
    trigger: interactionTriggerField(row, "trigger_kind"),
    message: stringField(row, "message"),
    tags: jsonArrayField(row, "tags"),
    batterId: optionalStringField(row, "batter_player_id"),
    pitcherId: optionalStringField(row, "pitcher_player_id"),
    playerIds: optionalJsonArrayField(row, "player_ids")
  }));
}

function rowToHighScore(row: DoltRow): HighScore {
  return {
    category: stringField(row, "category"),
    playerId: stringField(row, "player_id"),
    value: numberField(row, "value"),
    matchId: stringField(row, "match_id"),
    recordedAt: stringField(row, "recorded_at")
  };
}

function createTeamFixture(id: string, displayName: string): TeamFixture {
  return {
    id,
    displayName,
    players: []
  };
}

function compareTeams(left: TeamFixture, right: TeamFixture): number {
  const leftIndex = predefinedTeamOrder.indexOf(left.id);
  const rightIndex = predefinedTeamOrder.indexOf(right.id);

  if (leftIndex >= 0 && rightIndex >= 0) {
    return leftIndex - rightIndex;
  }

  if (leftIndex >= 0) {
    return -1;
  }

  if (rightIndex >= 0) {
    return 1;
  }

  return left.id.localeCompare(right.id);
}

function stringField(row: DoltRow, key: string): string {
  const value = row[key];

  if (typeof value !== "string") {
    throw new Error(`Expected string field ${key}`);
  }

  return value;
}

function optionalStringField(row: DoltRow, key: string): string | undefined {
  const value = row[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberField(row: DoltRow, key: string): number {
  const value = row[key];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return Number(value);
  }

  throw new Error(`Expected number field ${key}`);
}

function interactionTriggerField(
  row: DoltRow,
  key: string
): InteractionPrompt["trigger"] {
  const value = stringField(row, key);

  if (value !== "player-matchup" && value !== "match-history") {
    throw new Error(`Expected interaction trigger field ${key}`);
  }

  return value;
}

function jsonArrayField(row: DoltRow, key: string): string[] {
  const value = row[key];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error(`Expected string array field ${key}`);
  }

  return [...parsed];
}

function optionalJsonArrayField(
  row: DoltRow,
  key: string
): string[] | undefined {
  const value = row[key];

  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return jsonArrayField(row, key);
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullable(value: string | null | undefined): string {
  return value ? sqlString(value) : "NULL";
}

function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value));
}

function toSqlTimestamp(value: string): string {
  return value.replace("T", " ").replace(/\.\d{3}Z$/, "");
}

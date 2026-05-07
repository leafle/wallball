import type { CompletedMatch } from "./match-summary";

export type LocalSeriesFormat = "best-of-three" | "first-to";

export interface LocalSeriesStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface LocalSeriesMatchup {
  awayTeamId: string;
  homeTeamId: string;
}

export interface LocalSeries {
  awayTeamId: string;
  completedAt?: string;
  completedMatchIds: string[];
  format: LocalSeriesFormat;
  homeTeamId: string;
  id: string;
  startedAt: string;
  targetWins: number;
  wins: {
    away: number;
    home: number;
  };
}

export interface CreateLocalSeriesInput extends LocalSeriesMatchup {
  format: LocalSeriesFormat;
  id: string;
  startedAt: string;
  targetWins?: number;
}

export interface LocalSeriesPersistenceOptions {
  storage?: LocalSeriesStorage | null;
  validTeamIds?: readonly string[];
}

export interface LocalSeriesTeamLabel {
  displayName: string;
  id: string;
}

export interface ProjectLocalSeriesPanelInput {
  selectedMatchup: LocalSeriesMatchup;
  series: LocalSeries | null;
  teams: readonly LocalSeriesTeamLabel[];
}

export interface LocalSeriesDetailRow {
  label: string;
  value: string;
}

export interface LocalSeriesPanelProjection {
  canReset: boolean;
  completed: boolean;
  detailRows: LocalSeriesDetailRow[];
  modeLabel: string;
  nextMatchLabel: string;
  scoreLabel: string;
  statusLabel: string;
  title: string;
  winnerLabel: string;
}

const LOCAL_SERIES_STORAGE_KEY = "wallball.localSeries.v1";
const BEST_OF_THREE_TARGET_WINS = 2;
const DEFAULT_FIRST_TO_TARGET_WINS = 3;

export function createLocalSeries(input: CreateLocalSeriesInput): LocalSeries {
  return {
    awayTeamId: input.awayTeamId,
    completedMatchIds: [],
    format: input.format,
    homeTeamId: input.homeTeamId,
    id: input.id,
    startedAt: input.startedAt,
    targetWins:
      input.format === "best-of-three"
        ? BEST_OF_THREE_TARGET_WINS
        : normalizeTargetWins(input.targetWins),
    wins: {
      away: 0,
      home: 0
    }
  };
}

export function updateLocalSeriesFromCompletedMatch(
  series: LocalSeries,
  match: CompletedMatch
): LocalSeries {
  if (
    series.completedAt ||
    series.completedMatchIds.includes(match.id) ||
    match.teams.away !== series.awayTeamId ||
    match.teams.home !== series.homeTeamId
  ) {
    return series;
  }

  const wins = {
    ...series.wins
  };

  if (match.score.away > match.score.home) {
    wins.away += 1;
  } else if (match.score.home > match.score.away) {
    wins.home += 1;
  }

  const completedAt =
    wins.away >= series.targetWins || wins.home >= series.targetWins
      ? match.playedAt
      : undefined;

  return {
    ...series,
    completedAt,
    completedMatchIds: [...series.completedMatchIds, match.id],
    wins
  };
}

export function projectLocalSeriesPanel({
  selectedMatchup,
  series,
  teams
}: ProjectLocalSeriesPanelInput): LocalSeriesPanelProjection {
  if (!series) {
    const awayName = teamDisplayName(teams, selectedMatchup.awayTeamId);
    const homeName = teamDisplayName(teams, selectedMatchup.homeTeamId);
    const matchupLabel = `${awayName} vs ${homeName}`;

    return {
      canReset: false,
      completed: false,
      detailRows: [
        {
          label: "Next match",
          value: matchupLabel
        },
        {
          label: "Series format",
          value: "Choose Best of 3 or First to N"
        }
      ],
      modeLabel: "No active series",
      nextMatchLabel: `Next match: ${matchupLabel}`,
      scoreLabel: "No active series",
      statusLabel: "Not started",
      title: "Local Series",
      winnerLabel: "Start a local series from the selected matchup."
    };
  }

  const awayName = teamDisplayName(teams, series.awayTeamId);
  const homeName = teamDisplayName(teams, series.homeTeamId);
  const winnerName = seriesWinnerName(series, awayName, homeName);
  const matchupLabel = `${awayName} vs ${homeName}`;
  const completed = Boolean(series.completedAt);

  return {
    canReset: true,
    completed,
    detailRows: [
      {
        label: "Format",
        value: formatMode(series)
      },
      {
        label: "Recorded",
        value: formatRecordedCount(series.completedMatchIds.length)
      },
      {
        label: completed ? "Winner" : "Next match",
        value: completed ? (winnerName ?? "Tie") : matchupLabel
      }
    ],
    modeLabel: formatMode(series),
    nextMatchLabel: completed
      ? winnerName
        ? `Series complete: ${winnerName} won.`
        : "Series complete."
      : `Next match: ${matchupLabel}`,
    scoreLabel: `${awayName} ${series.wins.away}, ${homeName} ${series.wins.home}`,
    statusLabel: completed ? "Complete" : "In progress",
    title: "Local Series",
    winnerLabel: completed
      ? winnerName
        ? `${winnerName} won the series.`
        : "The series is complete."
      : formatWinsNeeded(series, awayName, homeName)
  };
}

export function loadLocalSeriesState(
  options: LocalSeriesPersistenceOptions = {}
): LocalSeries | null {
  const storage = options.storage ?? getBrowserLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(LOCAL_SERIES_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return normalizeLocalSeries(JSON.parse(raw), options.validTeamIds);
  } catch {
    return null;
  }
}

export function saveLocalSeriesState(
  series: LocalSeries,
  options: LocalSeriesPersistenceOptions = {}
): void {
  const storage = options.storage ?? getBrowserLocalStorage();
  const normalized = normalizeLocalSeries(series, options.validTeamIds);

  if (!storage || !normalized) {
    return;
  }

  try {
    storage.setItem(LOCAL_SERIES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Local storage can be unavailable; callers still keep in-memory state.
  }
}

export function clearLocalSeriesState(
  options: Pick<LocalSeriesPersistenceOptions, "storage"> = {}
): void {
  const storage = options.storage ?? getBrowserLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(LOCAL_SERIES_STORAGE_KEY);
  } catch {
    // Missing storage should not prevent resetting the in-memory state.
  }
}

function normalizeLocalSeries(
  input: unknown,
  validTeamIds: readonly string[] | undefined
): LocalSeries | null {
  if (!isRecord(input)) {
    return null;
  }

  const awayTeamId = readTeamId(input.awayTeamId, validTeamIds);
  const homeTeamId = readTeamId(input.homeTeamId, validTeamIds);
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const startedAt =
    typeof input.startedAt === "string" && input.startedAt ? input.startedAt : null;
  const format =
    input.format === "best-of-three" || input.format === "first-to"
      ? input.format
      : null;

  if (!awayTeamId || !homeTeamId || !id || !startedAt || !format) {
    return null;
  }

  const targetWins =
    format === "best-of-three"
      ? BEST_OF_THREE_TARGET_WINS
      : normalizeTargetWins(input.targetWins);
  const completedAt =
    typeof input.completedAt === "string" && input.completedAt
      ? input.completedAt
      : undefined;

  return {
    awayTeamId,
    ...(completedAt ? { completedAt } : {}),
    completedMatchIds: Array.isArray(input.completedMatchIds)
      ? input.completedMatchIds.filter(
          (matchId): matchId is string =>
            typeof matchId === "string" && matchId.length > 0
        )
      : [],
    format,
    homeTeamId,
    id,
    startedAt,
    targetWins,
    wins: normalizeWins(input.wins)
  };
}

function normalizeWins(value: unknown): LocalSeries["wins"] {
  const source = isRecord(value) ? value : {};

  return {
    away: readWinCount(source.away),
    home: readWinCount(source.home)
  };
}

function readWinCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function normalizeTargetWins(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : DEFAULT_FIRST_TO_TARGET_WINS;
}

function readTeamId(
  value: unknown,
  validTeamIds: readonly string[] | undefined
): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (validTeamIds && !validTeamIds.includes(value)) {
    return null;
  }

  return value;
}

function formatMode(series: LocalSeries): string {
  return series.format === "best-of-three"
    ? "Best of 3"
    : `First to ${series.targetWins}`;
}

function formatRecordedCount(count: number): string {
  return `${count} ${count === 1 ? "match" : "matches"}`;
}

function formatWinsNeeded(
  series: LocalSeries,
  awayName: string,
  homeName: string
): string {
  if (series.wins.away > series.wins.home) {
    return formatWinsRemaining(awayName, series.targetWins - series.wins.away);
  }

  if (series.wins.home > series.wins.away) {
    return formatWinsRemaining(homeName, series.targetWins - series.wins.home);
  }

  return `First team to ${series.targetWins} wins takes the series.`;
}

function formatWinsRemaining(teamName: string, winsRemaining: number): string {
  return `${teamName} need ${winsRemaining} more ${
    winsRemaining === 1 ? "win" : "wins"
  }.`;
}

function seriesWinnerName(
  series: LocalSeries,
  awayName: string,
  homeName: string
): string | null {
  if (series.wins.away >= series.targetWins) {
    return awayName;
  }

  if (series.wins.home >= series.targetWins) {
    return homeName;
  }

  return null;
}

function teamDisplayName(
  teams: readonly LocalSeriesTeamLabel[],
  teamId: string
): string {
  return teams.find((team) => team.id === teamId)?.displayName ?? teamId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBrowserLocalStorage(): LocalSeriesStorage | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  return localStorage;
}

import type { MatchSummary } from "../domain/match-summary";
import type { LocalMatchEvent } from "../systems/local-match-loop";

export interface LocalMatchEventPlayerLabel {
  displayName: string;
  id: string;
}

export interface LocalMatchEventPanelGameProjection {
  awayTeamName: string;
  homeTeamName: string;
  phaseKind: string;
}

export interface ProjectLocalMatchEventPanelInput {
  events: readonly LocalMatchEvent[];
  players: readonly LocalMatchEventPlayerLabel[];
  projection: LocalMatchEventPanelGameProjection;
  summary: MatchSummary | null;
}

export type LocalMatchEventRowTone =
  | "complete"
  | "neutral"
  | "positive"
  | "warning";

export interface LocalMatchEventRow {
  id: string;
  label: string;
  meta: string;
  tone: LocalMatchEventRowTone;
}

export interface LocalMatchEventPanelProjection {
  emptyText: string | null;
  recentRows: LocalMatchEventRow[];
  statusLabel: string;
  summaryRows: string[];
  title: string;
}

const MAX_RECENT_ROWS = 6;
const MAX_SUMMARY_ROWS = 4;

export function projectLocalMatchEventPanel({
  events,
  players,
  projection,
  summary
}: ProjectLocalMatchEventPanelInput): LocalMatchEventPanelProjection {
  const completed = projection.phaseKind === "match-completed";

  return {
    emptyText: events.length === 0 ? "Events appear after the first pitch." : null,
    recentRows: [...events]
      .slice(-MAX_RECENT_ROWS)
      .reverse()
      .map((event) => projectEventRow(event, players, projection)),
    statusLabel: statusLabel(events.length, completed),
    summaryRows: summary?.notableEvents.slice(0, MAX_SUMMARY_ROWS) ?? [],
    title: completed ? "Replay Summary" : "Event Log"
  };
}

function projectEventRow(
  event: LocalMatchEvent,
  players: readonly LocalMatchEventPlayerLabel[],
  projection: LocalMatchEventPanelGameProjection
): LocalMatchEventRow {
  return {
    id: String(event.sequence),
    label: eventLabel(event, players, projection),
    meta: `${capitalize(event.half)} ${String(event.inning)}`,
    tone: eventTone(event)
  };
}

function eventLabel(
  event: LocalMatchEvent,
  players: readonly LocalMatchEventPlayerLabel[],
  projection: LocalMatchEventPanelGameProjection
): string {
  if (event.kind === "match-completed") {
    return event.score
      ? `Final: ${projection.awayTeamName} ${event.score.away}, ${projection.homeTeamName} ${event.score.home}`
      : "Match complete";
  }

  if (event.kind === "inning-change") {
    return `${capitalize(event.half)} ${String(event.inning)} begins`;
  }

  if (event.kind === "recovery") {
    if (event.recoveryKind === "recovered" && event.fielderId) {
      return `${playerDisplayName(players, event.fielderId)} recovered the ball`;
    }

    return "Ball loose";
  }

  if (event.kind === "run") {
    return event.playerId
      ? `${playerDisplayName(players, event.playerId)} scored`
      : "Run scored";
  }

  if (event.kind === "out") {
    return event.playerId
      ? `${playerDisplayName(players, event.playerId)} out`
      : "Out recorded";
  }

  if (event.kind === "contact") {
    return `${formatContactQuality(event.contactQuality)}: ${formatResult(
      event.result
    )}`;
  }

  if (event.kind === "target-hit") {
    return "Target hit";
  }

  if (event.kind === "wall-hit") {
    return "Wall hit";
  }

  if (event.kind === "swing") {
    return event.playerId
      ? `${playerDisplayName(players, event.playerId)} swung`
      : "Swing";
  }

  return event.playerId
    ? `Pitch to ${playerDisplayName(players, event.playerId)}`
    : "Pitch";
}

function eventTone(event: LocalMatchEvent): LocalMatchEventRowTone {
  if (event.kind === "match-completed") {
    return "complete";
  }

  if (event.kind === "out") {
    return "warning";
  }

  if (isPositiveEvent(event)) {
    return "positive";
  }

  return "neutral";
}

function isPositiveEvent(event: LocalMatchEvent): boolean {
  return (
    event.kind === "run" ||
    event.kind === "target-hit" ||
    (event.kind === "recovery" && event.recoveryKind === "recovered") ||
    (event.kind === "contact" &&
      event.result !== "out" &&
      event.result !== "miss")
  );
}

function statusLabel(eventCount: number, completed: boolean): string {
  if (eventCount > 0) {
    return `${String(eventCount)} ${eventCount === 1 ? "event" : "events"}`;
  }

  return completed ? "Final" : "Live";
}

function formatResult(result: LocalMatchEvent["result"]): string {
  return result ? result.replace("-", " ") : "in play";
}

function formatContactQuality(
  quality: LocalMatchEvent["contactQuality"]
): string {
  if (!quality || quality === "none") {
    return "No contact";
  }

  return `${capitalize(quality)} contact`;
}

function playerDisplayName(
  players: readonly LocalMatchEventPlayerLabel[],
  playerId: string
): string {
  return players.find((player) => player.id === playerId)?.displayName ?? playerId;
}

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

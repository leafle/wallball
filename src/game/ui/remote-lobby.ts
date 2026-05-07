import {
  applyRemoteSnapshotToLocalLoop,
  createRemoteLocalLoopBridge
} from "../remote/local-loop-bridge";
import type {
  RemoteAssignment,
  RemoteIntentEvent,
  RemoteIntentKind,
  RemotePlayerSide,
  RemoteRoomSnapshot
} from "../remote/room-store";

export type RemoteLobbyChecklistState = "ready" | "waiting";

export interface RemoteLobbyTeamLabel {
  displayName: string;
  id: string;
}

export interface ProjectRemoteLobbyChecklistInput {
  assignment: RemoteAssignment | null;
  snapshot: RemoteRoomSnapshot | null;
  teams: readonly RemoteLobbyTeamLabel[];
}

export interface RemoteLobbyChecklistRow {
  detail: string;
  label: string;
  state: RemoteLobbyChecklistState;
}

export interface RemoteLobbyChecklistProjection {
  assignmentLabel: string;
  bridgeLabel: string;
  checklistRows: RemoteLobbyChecklistRow[];
  roomCodeLabel: string;
  statusLabel: string;
  title: string;
}

export function projectRemoteLobbyChecklist({
  assignment,
  snapshot,
  teams
}: ProjectRemoteLobbyChecklistInput): RemoteLobbyChecklistProjection {
  if (!snapshot) {
    return {
      assignmentLabel: "Local controls",
      bridgeLabel: "Remote bridge idle",
      checklistRows: [
        {
          detail: "Create or join when the remote room service is available.",
          label: "Create or join",
          state: "waiting"
        },
        {
          detail: "Choose teams locally or create a remote room.",
          label: "Selected matchup",
          state: "waiting"
        },
        participantRowWithoutRoom("away"),
        participantRowWithoutRoom("home"),
        intentRowWithoutRoom("Pitch intents", "pitch"),
        intentRowWithoutRoom("Swing intents", "swing"),
        intentRowWithoutRoom("Fielding intents", "fielding")
      ],
      roomCodeLabel: "No room",
      statusLabel: "Local play available",
      title: "Remote Lobby"
    };
  }

  const bridge = applyRemoteSnapshotToLocalLoop(
    createRemoteLocalLoopBridge(snapshot),
    snapshot
  );
  const pitchIntent = latestIntent(snapshot, ["pitch"]);
  const swingIntent = latestIntent(snapshot, ["swing"]);
  const fieldingIntent = latestIntent(snapshot, [
    "fielder-move",
    "recover-ball"
  ]);
  const allParticipantsReady = bridge.readySides.away && bridge.readySides.home;
  const allIntentsConnected =
    pitchIntent !== null && swingIntent !== null && fieldingIntent !== null;

  return {
    assignmentLabel: assignment
      ? `${titleCase(assignment.role)} - ${assignment.side} controls`
      : "Spectating room",
    bridgeLabel: `${bridge.appliedVersions.length} remote ${pluralize(
      bridge.appliedVersions.length,
      "intent"
    )} synced through deterministic bridge`,
    checklistRows: [
      {
        detail: `Room ${snapshot.code} connected`,
        label: "Create or join",
        state: "ready"
      },
      {
        detail: matchupLabel(snapshot, teams),
        label: "Selected matchup",
        state: "ready"
      },
      participantReadyRow(snapshot, "away", bridge.readySides.away),
      participantReadyRow(snapshot, "home", bridge.readySides.home),
      intentReadyRow("Pitch intents", pitchIntent, "pitch"),
      intentReadyRow("Swing intents", swingIntent, "swing"),
      intentReadyRow("Fielding intents", fieldingIntent, "fielding")
    ],
    roomCodeLabel: snapshot.code,
    statusLabel:
      allParticipantsReady && allIntentsConnected
        ? "Ready to start remote loop"
        : "Remote room connected",
    title: "Remote Lobby"
  };
}

function participantRowWithoutRoom(
  side: RemotePlayerSide
): RemoteLobbyChecklistRow {
  return {
    detail: "Waiting for a remote room before checking readiness.",
    label: `${sideLabel(side)} ready`,
    state: "waiting"
  };
}

function participantReadyRow(
  snapshot: RemoteRoomSnapshot,
  side: RemotePlayerSide,
  ready: boolean
): RemoteLobbyChecklistRow {
  const player = snapshot.players[side];
  const label = `${sideLabel(side)} ready`;

  if (!player) {
    return {
      detail: `Waiting for ${side} player`,
      label,
      state: "waiting"
    };
  }

  if (!ready) {
    return {
      detail: `${player.displayName} joined; waiting for Ready`,
      label,
      state: "waiting"
    };
  }

  return {
    detail: `${player.displayName} ready`,
    label,
    state: "ready"
  };
}

function intentRowWithoutRoom(
  label: string,
  intentLabel: "pitch" | "swing" | "fielding"
): RemoteLobbyChecklistRow {
  return {
    detail: `Waiting for first remote ${intentLabel}${
      intentLabel === "fielding" ? " input" : ""
    }.`,
    label,
    state: "waiting"
  };
}

function intentReadyRow(
  label: string,
  intent: RemoteIntentEvent | null,
  intentLabel: "pitch" | "swing" | "fielding"
): RemoteLobbyChecklistRow {
  if (!intent) {
    return intentRowWithoutRoom(label, intentLabel);
  }

  return {
    detail: `${titleCase(intentLabel)} event #${String(intent.version)} synced`,
    label,
    state: "ready"
  };
}

function latestIntent(
  snapshot: RemoteRoomSnapshot,
  kinds: readonly RemoteIntentKind[]
): RemoteIntentEvent | null {
  const kindSet = new Set(kinds);

  return (
    snapshot.intents
      .filter((intent) => kindSet.has(intent.kind))
      .sort((left, right) => right.version - left.version)[0] ?? null
  );
}

function matchupLabel(
  snapshot: RemoteRoomSnapshot,
  teams: readonly RemoteLobbyTeamLabel[]
): string {
  return `${teamName(snapshot.teams.away, teams)} at ${teamName(
    snapshot.teams.home,
    teams
  )}`;
}

function teamName(
  teamId: string,
  teams: readonly RemoteLobbyTeamLabel[]
): string {
  return teams.find((team) => team.id === teamId)?.displayName ?? teamId;
}

function sideLabel(side: RemotePlayerSide): string {
  return titleCase(side);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

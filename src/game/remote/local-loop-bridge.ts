import { loadPredefinedRosters } from "../data/fixtures";
import type { TeamRoster } from "../domain/rosters";
import type { FieldBounds, Fielder } from "../systems/fielding";
import {
  advanceLocalMatchLoop,
  createLocalMatchLoopState,
  type CreateLocalMatchLoopStateInput,
  type LocalMatchLoopAction,
  type LocalMatchLoopState
} from "../systems/local-match-loop";
import type {
  RemoteIntentEvent,
  RemoteIntentPayloadValue,
  RemotePlayerSide,
  RemoteRoomSnapshot
} from "./room-store";

export interface RemoteLocalLoopBridgeOptions {
  fieldBounds?: FieldBounds;
  fielders?: readonly Fielder[];
  maxRecoverySpeed?: number;
  recoveryRadius?: number;
  timeOriginMs?: number;
}

export interface RemoteLocalLoopBridge {
  appliedVersions: number[];
  fieldBounds: FieldBounds;
  lastAppliedVersion: number;
  lastSequenceBySide: Record<RemotePlayerSide, number>;
  loop: LocalMatchLoopState;
  readySides: Record<RemotePlayerSide, boolean>;
  timeOriginMs: number;
}

interface RemoteIntentContext {
  fieldBounds: FieldBounds;
  timeOriginMs: number;
}

const DEFAULT_FIELD_BOUNDS: FieldBounds = {
  minX: 320,
  maxX: 960,
  minY: 210,
  maxY: 620
};

const DEFAULT_TIME_ORIGIN_MS = 0;

export function createRemoteLocalLoopBridge(
  snapshot: RemoteRoomSnapshot,
  options: RemoteLocalLoopBridgeOptions = {}
): RemoteLocalLoopBridge {
  const loop = createLocalMatchLoopState({
    awayRoster: getRoster(snapshot.teams.away),
    homeRoster: getRoster(snapshot.teams.home),
    fielders: options.fielders,
    maxRecoverySpeed: options.maxRecoverySpeed,
    recoveryRadius: options.recoveryRadius
  } satisfies CreateLocalMatchLoopStateInput);

  return {
    appliedVersions: [],
    fieldBounds: cloneFieldBounds(options.fieldBounds ?? DEFAULT_FIELD_BOUNDS),
    lastAppliedVersion: 0,
    lastSequenceBySide: {
      away: 0,
      home: 0
    },
    loop,
    readySides: {
      away: false,
      home: false
    },
    timeOriginMs: options.timeOriginMs ?? DEFAULT_TIME_ORIGIN_MS
  };
}

export function applyRemoteSnapshotToLocalLoop(
  bridge: RemoteLocalLoopBridge,
  snapshot: RemoteRoomSnapshot,
  options: RemoteLocalLoopBridgeOptions = {}
): RemoteLocalLoopBridge {
  const context = {
    fieldBounds: options.fieldBounds ?? bridge.fieldBounds,
    timeOriginMs: options.timeOriginMs ?? bridge.timeOriginMs
  };

  return snapshot.intents
    .slice()
    .sort((left, right) => left.version - right.version)
    .reduce(
      (currentBridge, intent) =>
        applyRemoteIntentToLocalLoop(currentBridge, intent, context),
      bridge
    );
}

export function remoteIntentToLocalMatchAction(
  loop: LocalMatchLoopState,
  intent: RemoteIntentEvent,
  options: RemoteLocalLoopBridgeOptions = {}
): LocalMatchLoopAction | null {
  return toLocalMatchAction(loop, intent, {
    fieldBounds: options.fieldBounds ?? DEFAULT_FIELD_BOUNDS,
    timeOriginMs: options.timeOriginMs ?? DEFAULT_TIME_ORIGIN_MS
  });
}

function applyRemoteIntentToLocalLoop(
  bridge: RemoteLocalLoopBridge,
  intent: RemoteIntentEvent,
  context: RemoteIntentContext
): RemoteLocalLoopBridge {
  if (
    intent.version <= bridge.lastAppliedVersion ||
    intent.sequence <= bridge.lastSequenceBySide[intent.side]
  ) {
    return bridge;
  }

  const readySides =
    intent.kind === "ready"
      ? {
          ...bridge.readySides,
          [intent.side]: true
        }
      : bridge.readySides;
  const action = toLocalMatchAction(bridge.loop, intent, context);
  const loop = action ? advanceLocalMatchLoop(bridge.loop, action) : bridge.loop;

  return {
    appliedVersions: [...bridge.appliedVersions, intent.version],
    fieldBounds: bridge.fieldBounds,
    lastAppliedVersion: intent.version,
    lastSequenceBySide: {
      ...bridge.lastSequenceBySide,
      [intent.side]: intent.sequence
    },
    loop,
    readySides,
    timeOriginMs: bridge.timeOriginMs
  };
}

function toLocalMatchAction(
  loop: LocalMatchLoopState,
  intent: RemoteIntentEvent,
  context: RemoteIntentContext
): LocalMatchLoopAction | null {
  if (intent.kind === "ready") {
    return null;
  }

  if (intent.kind === "pitch") {
    return {
      type: "pitch",
      idealContactMs: readNumber(intent.payload, "idealContactMs", 180),
      pitchStartedAtMs: eventTimeMs(intent, context.timeOriginMs),
      pitchX: readNumber(intent.payload, "pitchX", 0),
      targetX: readNumber(intent.payload, "targetX", 0)
    };
  }

  if (intent.kind === "swing") {
    return {
      type: "swing",
      swingAtMs: swingAtMs(loop, intent, context.timeOriginMs)
    };
  }

  if (intent.kind === "recover-ball") {
    return {
      type: "recover-ball"
    };
  }

  return {
    type: "move-fielder",
    bounds: context.fieldBounds,
    elapsedMs: readNumber(intent.payload, "elapsedMs", 0),
    fielderId: readString(
      intent.payload,
      "fielderId",
      loop.fielders[0]?.id ?? intent.side
    ),
    input: {
      axisX: readNumber(intent.payload, "axisX", 0),
      axisY: readNumber(intent.payload, "axisY", 0)
    }
  };
}

function swingAtMs(
  loop: LocalMatchLoopState,
  intent: RemoteIntentEvent,
  timeOriginMs: number
): number {
  const timingMs = readOptionalNumber(intent.payload, "timingMs");

  if (timingMs !== null && loop.currentPitch) {
    return (
      loop.currentPitch.pitchStartedAtMs +
      loop.currentPitch.idealContactMs +
      timingMs
    );
  }

  return eventTimeMs(intent, timeOriginMs);
}

function eventTimeMs(
  intent: RemoteIntentEvent,
  timeOriginMs: number
): number {
  const payloadTime = readOptionalNumber(intent.payload, "timeMs");

  if (payloadTime !== null) {
    return payloadTime;
  }

  return timeOriginMs + intent.version;
}

function readNumber(
  payload: Record<string, RemoteIntentPayloadValue>,
  key: string,
  fallback: number
): number {
  const value = readOptionalNumber(payload, key);

  return value ?? fallback;
}

function readOptionalNumber(
  payload: Record<string, RemoteIntentPayloadValue>,
  key: string
): number | null {
  const value = payload[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(
  payload: Record<string, RemoteIntentPayloadValue>,
  key: string,
  fallback: string
): string {
  const value = payload[key];

  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function getRoster(teamId: string): TeamRoster {
  const roster = loadPredefinedRosters().find((team) => team.id === teamId);

  if (!roster) {
    throw new Error(`Missing remote local-loop roster: ${teamId}`);
  }

  return roster;
}

function cloneFieldBounds(bounds: FieldBounds): FieldBounds {
  return {
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    minX: bounds.minX,
    minY: bounds.minY
  };
}

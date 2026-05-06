import type { CompletedMatch, MatchSummary } from "../domain/match-summary";
import { generateMatchSummary } from "../domain/match-summary";
import type { BattingSide } from "../domain/rules";

export type RemotePlayerRole = "host" | "guest";
export type RemotePlayerSide = BattingSide;
export type RemoteIntentKind = "pitch" | "swing" | "fielder-move" | "ready";
export type RemoteIntentPayloadValue = string | number | boolean | null;

export interface RemoteRoomTeamIds {
  away: string;
  home: string;
}

export interface RemotePlayer {
  displayName: string;
  joinedAt: string;
  role: RemotePlayerRole;
  side: RemotePlayerSide;
}

export interface RemoteAssignment {
  role: RemotePlayerRole;
  side: RemotePlayerSide;
}

export interface RemoteIntentInput {
  code: string;
  side: RemotePlayerSide;
  kind: RemoteIntentKind;
  sequence: number;
  payload?: Record<string, RemoteIntentPayloadValue>;
}

export interface RemoteIntentEvent {
  id: string;
  code: string;
  kind: RemoteIntentKind;
  payload: Record<string, RemoteIntentPayloadValue>;
  sequence: number;
  side: RemotePlayerSide;
  version: number;
  createdAt: string;
}

export interface RemoteRoomSnapshot {
  code: string;
  createdAt: string;
  teams: RemoteRoomTeamIds;
  sharePath: string;
  players: Record<RemotePlayerSide, RemotePlayer | null>;
  intents: RemoteIntentEvent[];
  recordedMatches: MatchSummary[];
  version: number;
}

export interface CreateRemoteRoomInput {
  awayTeamId: string;
  homeTeamId: string;
  hostDisplayName: string;
}

export interface JoinRemoteRoomInput {
  code: string;
  guestDisplayName: string;
}

export interface RemoteRoomResult {
  assignment: RemoteAssignment;
  snapshot: RemoteRoomSnapshot;
}

export interface RemoteRoomStoreOptions {
  codeFactory?: () => string;
  now?: () => string;
}

export interface SnapshotOptions {
  sinceVersion?: number;
}

export type RemoteRoomListener = (snapshot: RemoteRoomSnapshot) => void;
export type UnsubscribeRemoteRoom = () => void;

interface RemoteRoomState {
  code: string;
  createdAt: string;
  teams: RemoteRoomTeamIds;
  players: Record<RemotePlayerSide, RemotePlayer | null>;
  intents: RemoteIntentEvent[];
  recordedMatches: MatchSummary[];
  version: number;
}

export interface RemoteRoomStore {
  appendIntent(input: RemoteIntentInput): RemoteIntentEvent;
  createRoom(input: CreateRemoteRoomInput): RemoteRoomResult;
  getSnapshot(code: string, options?: SnapshotOptions): RemoteRoomSnapshot;
  joinRoom(input: JoinRemoteRoomInput): RemoteRoomResult;
  recordMatch(code: string, match: CompletedMatch): MatchSummary;
  subscribe(
    code: string,
    listener: RemoteRoomListener
  ): UnsubscribeRemoteRoom;
}

export function createRemoteRoomStore(
  options: RemoteRoomStoreOptions = {}
): RemoteRoomStore {
  const codeFactory = options.codeFactory ?? generateRoomCode;
  const now = options.now ?? (() => new Date().toISOString());
  const rooms = new Map<string, RemoteRoomState>();
  const subscribers = new Map<string, Set<RemoteRoomListener>>();

  function createRoom(input: CreateRemoteRoomInput): RemoteRoomResult {
    const code = reserveRoomCode(rooms, codeFactory);
    const createdAt = now();
    const room: RemoteRoomState = {
      code,
      createdAt,
      teams: {
        away: input.awayTeamId,
        home: input.homeTeamId
      },
      players: {
        away: createPlayer(input.hostDisplayName, createdAt, "host", "away"),
        home: null
      },
      intents: [],
      recordedMatches: [],
      version: 0
    };

    rooms.set(code, room);

    return {
      assignment: {
        role: "host",
        side: "away"
      },
      snapshot: toSnapshot(room)
    };
  }

  function joinRoom(input: JoinRemoteRoomInput): RemoteRoomResult {
    const room = requireRoom(rooms, input.code);

    if (room.players.home) {
      throw new Error(`Remote room ${room.code} is full`);
    }

    room.players.home = createPlayer(
      input.guestDisplayName,
      now(),
      "guest",
      "home"
    );

    notify(room.code);

    return {
      assignment: {
        role: "guest",
        side: "home"
      },
      snapshot: toSnapshot(room)
    };
  }

  function appendIntent(input: RemoteIntentInput): RemoteIntentEvent {
    const room = requireRoom(rooms, input.code);

    if (!room.players[input.side]) {
      throw new Error(
        `Cannot append ${input.side} intent before that player joins`
      );
    }

    room.version += 1;

    const event: RemoteIntentEvent = {
      id: `${room.code}-${String(room.version).padStart(4, "0")}`,
      code: room.code,
      kind: input.kind,
      payload: { ...(input.payload ?? {}) },
      sequence: input.sequence,
      side: input.side,
      version: room.version,
      createdAt: now()
    };

    room.intents.push(event);
    notify(room.code);

    return { ...event, payload: { ...event.payload } };
  }

  function getSnapshot(
    code: string,
    { sinceVersion = 0 }: SnapshotOptions = {}
  ): RemoteRoomSnapshot {
    return toSnapshot(requireRoom(rooms, code), sinceVersion);
  }

  function recordMatch(code: string, match: CompletedMatch): MatchSummary {
    const room = requireRoom(rooms, code);
    const summary = generateMatchSummary(match);

    room.version += 1;
    room.recordedMatches.push(summary);
    notify(room.code);

    return { ...summary, notableEvents: [...summary.notableEvents] };
  }

  function subscribe(
    code: string,
    listener: RemoteRoomListener
  ): UnsubscribeRemoteRoom {
    const room = requireRoom(rooms, code);
    const listeners = subscribers.get(room.code) ?? new Set<RemoteRoomListener>();

    listeners.add(listener);
    subscribers.set(room.code, listeners);
    listener(toSnapshot(room));

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        subscribers.delete(room.code);
      }
    };
  }

  function notify(code: string): void {
    const listeners = subscribers.get(code);

    if (!listeners) {
      return;
    }

    const snapshot = toSnapshot(requireRoom(rooms, code));

    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  return {
    appendIntent,
    createRoom,
    getSnapshot,
    joinRoom,
    recordMatch,
    subscribe
  };
}

function createPlayer(
  displayName: string,
  joinedAt: string,
  role: RemotePlayerRole,
  side: RemotePlayerSide
): RemotePlayer {
  return {
    displayName,
    joinedAt,
    role,
    side
  };
}

function reserveRoomCode(
  rooms: Map<string, RemoteRoomState>,
  codeFactory: () => string
): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = normalizeCode(codeFactory());

    if (!rooms.has(code)) {
      return code;
    }
  }

  throw new Error("Unable to allocate a unique remote room code");
}

function requireRoom(
  rooms: Map<string, RemoteRoomState>,
  code: string
): RemoteRoomState {
  const normalizedCode = normalizeCode(code);
  const room = rooms.get(normalizedCode);

  if (!room) {
    throw new Error(`Remote room ${normalizedCode} was not found`);
  }

  return room;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function toSnapshot(
  room: RemoteRoomState,
  sinceVersion = 0
): RemoteRoomSnapshot {
  return {
    code: room.code,
    createdAt: room.createdAt,
    teams: { ...room.teams },
    sharePath: `/?room=${room.code}`,
    players: {
      away: clonePlayer(room.players.away),
      home: clonePlayer(room.players.home)
    },
    intents: room.intents
      .filter((intent) => intent.version > sinceVersion)
      .map((intent) => ({ ...intent, payload: { ...intent.payload } })),
    recordedMatches: room.recordedMatches.map((summary) => ({
      ...summary,
      notableEvents: [...summary.notableEvents]
    })),
    version: room.version
  };
}

function clonePlayer(player: RemotePlayer | null): RemotePlayer | null {
  return player ? { ...player } : null;
}

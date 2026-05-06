import type { CompletedMatch, MatchEvent } from "../domain/match-summary";
import type {
  RemoteIntentKind,
  RemoteIntentPayloadValue,
  RemotePlayerSide,
  RemoteRoomStore
} from "./room-store";

export interface RemoteRoomApiRequest {
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

export interface RemoteRoomApiResponse {
  status: number;
  body: unknown;
}

export interface RemoteRoomApi {
  handle(request: RemoteRoomApiRequest): Promise<RemoteRoomApiResponse>;
}

const remoteRoomPath = /^\/api\/remote\/rooms\/([^/]+)(?:\/([^/]+))?$/;
const remoteIntentKinds: RemoteIntentKind[] = [
  "pitch",
  "swing",
  "fielder-move",
  "recover-ball",
  "ready"
];
const remotePlayerSides: RemotePlayerSide[] = ["away", "home"];

export function createRemoteRoomApi(store: RemoteRoomStore): RemoteRoomApi {
  async function handle(
    request: RemoteRoomApiRequest
  ): Promise<RemoteRoomApiResponse> {
    try {
      return routeRequest(store, request);
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { handle };
}

function routeRequest(
  store: RemoteRoomStore,
  request: RemoteRoomApiRequest
): RemoteRoomApiResponse {
  if (request.method === "POST" && request.path === "/api/remote/rooms") {
    const body = asRecord(request.body);

    return {
      status: 201,
      body: store.createRoom({
        awayTeamId: readString(body, "awayTeamId"),
        homeTeamId: readString(body, "homeTeamId"),
        hostDisplayName: readString(body, "hostDisplayName")
      })
    };
  }

  const roomMatch = request.path.match(remoteRoomPath);

  if (!roomMatch) {
    return {
      status: 404,
      body: {
        error: `Route ${request.method} ${request.path} was not found`
      }
    };
  }

  const code = decodeURIComponent(roomMatch[1] ?? "");
  const action = roomMatch[2];

  if (request.method === "GET" && !action) {
    return {
      status: 200,
      body: store.getSnapshot(code, {
        sinceVersion: readOptionalNumber(request.query, "sinceVersion")
      })
    };
  }

  if (request.method === "POST" && action === "join") {
    const body = asRecord(request.body);

    return {
      status: 200,
      body: store.joinRoom({
        code,
        guestDisplayName: readString(body, "guestDisplayName")
      })
    };
  }

  if (request.method === "POST" && action === "intents") {
    const body = asRecord(request.body);

    return {
      status: 202,
      body: store.appendIntent({
        code,
        side: readSide(body, "side"),
        kind: readIntentKind(body, "kind"),
        sequence: readNumber(body, "sequence"),
        payload: readPayload(body["payload"])
      })
    };
  }

  if (request.method === "POST" && action === "matches") {
    return {
      status: 201,
      body: store.recordMatch(code, readCompletedMatch(request.body))
    };
  }

  return {
    status: 404,
    body: {
      error: `Route ${request.method} ${request.path} was not found`
    }
  };
}

function errorResponse(error: unknown): RemoteRoomApiResponse {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (message.includes("was not found")) {
    return {
      status: 404,
      body: { error: message }
    };
  }

  if (message.includes("full") || message.includes("before that player joins")) {
    return {
      status: 409,
      body: { error: message }
    };
  }

  return {
    status: 400,
    body: { error: message }
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a JSON object body");
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Expected string field ${key}`);
  }

  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected number field ${key}`);
  }

  return value;
}

function readOptionalNumber(
  query: Record<string, string | undefined> | undefined,
  key: string
): number | undefined {
  const value = query?.[key];

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric query field ${key}`);
  }

  return parsed;
}

function readSide(
  record: Record<string, unknown>,
  key: string
): RemotePlayerSide {
  const value = readString(record, key);

  if (!remotePlayerSides.includes(value as RemotePlayerSide)) {
    throw new Error(`Expected side to be one of ${remotePlayerSides.join(", ")}`);
  }

  return value as RemotePlayerSide;
}

function readIntentKind(
  record: Record<string, unknown>,
  key: string
): RemoteIntentKind {
  const value = readString(record, key);

  if (!remoteIntentKinds.includes(value as RemoteIntentKind)) {
    throw new Error(
      `Expected kind to be one of ${remoteIntentKinds.join(", ")}`
    );
  }

  return value as RemoteIntentKind;
}

function readPayload(
  value: unknown
): Record<string, RemoteIntentPayloadValue> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = asRecord(value);
  const payload: Record<string, RemoteIntentPayloadValue> = {};

  for (const [key, payloadValue] of Object.entries(record)) {
    if (
      typeof payloadValue === "string" ||
      typeof payloadValue === "number" ||
      typeof payloadValue === "boolean" ||
      payloadValue === null
    ) {
      payload[key] = payloadValue;
      continue;
    }

    throw new Error(`Expected scalar intent payload field ${key}`);
  }

  return payload;
}

function readCompletedMatch(value: unknown): CompletedMatch {
  const body = asRecord(value);
  const teams = asRecord(body["teams"]);
  const score = asRecord(body["score"]);

  return {
    id: readString(body, "id"),
    playedAt: readString(body, "playedAt"),
    teams: {
      away: readString(teams, "away"),
      home: readString(teams, "home")
    },
    score: {
      away: readNumber(score, "away"),
      home: readNumber(score, "home")
    },
    innings: readNumber(body, "innings"),
    events: readMatchEvents(body["events"])
  };
}

function readMatchEvents(value: unknown): MatchEvent[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected match events array");
  }

  return value.map((eventValue) => {
    const event = asRecord(eventValue);

    return {
      kind: readString(event, "kind"),
      playerId: readString(event, "playerId"),
      inning: readNumber(event, "inning")
    };
  });
}

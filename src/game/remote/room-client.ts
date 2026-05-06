import type { CompletedMatch, MatchSummary } from "../domain/match-summary";
import type {
  CreateRemoteRoomInput,
  JoinRemoteRoomInput,
  RemoteIntentEvent,
  RemoteIntentInput,
  RemoteRoomResult,
  RemoteRoomSnapshot
} from "./room-store";

export type RemoteFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface RemoteEventSource {
  close(): void;
  onmessage: ((event: MessageEvent<string>) => void) | null;
}

export interface RemoteRoomClientOptions {
  fetch?: RemoteFetch;
  createEventSource?: (url: string) => RemoteEventSource;
}

export interface RemoteRoomClient {
  createRoom(input: CreateRemoteRoomInput): Promise<RemoteRoomResult>;
  getSnapshot(
    code: string,
    options?: { sinceVersion?: number }
  ): Promise<RemoteRoomSnapshot>;
  joinRoom(input: JoinRemoteRoomInput): Promise<RemoteRoomResult>;
  recordMatch(code: string, match: CompletedMatch): Promise<MatchSummary>;
  sendIntent(input: RemoteIntentInput): Promise<RemoteIntentEvent>;
  subscribe(
    code: string,
    listener: (snapshot: RemoteRoomSnapshot) => void
  ): () => void;
}

const jsonHeaders = {
  "Content-Type": "application/json"
};

export function createRemoteRoomClient(
  options: RemoteRoomClientOptions = {}
): RemoteRoomClient {
  const fetchJson = options.fetch ?? fetch;
  const createEventSource =
    options.createEventSource ?? ((url: string) => new EventSource(url));

  return {
    createRoom(input) {
      return postJson(fetchJson, "/api/remote/rooms", input);
    },

    getSnapshot(code, { sinceVersion } = {}) {
      const query =
        sinceVersion === undefined ? "" : `?sinceVersion=${sinceVersion}`;

      return getJson(fetchJson, `/api/remote/rooms/${code}${query}`);
    },

    joinRoom(input) {
      return postJson(fetchJson, `/api/remote/rooms/${input.code}/join`, {
        guestDisplayName: input.guestDisplayName
      });
    },

    recordMatch(code, match) {
      return postJson(fetchJson, `/api/remote/rooms/${code}/matches`, match);
    },

    sendIntent({ code, kind, payload, sequence, side }) {
      return postJson(fetchJson, `/api/remote/rooms/${code}/intents`, {
        side,
        kind,
        sequence,
        payload
      });
    },

    subscribe(code, listener) {
      const source = createEventSource(`/api/remote/rooms/${code}/events`);

      source.onmessage = (event) => {
        listener(JSON.parse(event.data) as RemoteRoomSnapshot);
      };

      return () => {
        source.close();
      };
    }
  };
}

async function postJson<T>(
  fetchJson: RemoteFetch,
  url: string,
  body: unknown
): Promise<T> {
  return readJson<T>(
    await fetchJson(url, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body)
    })
  );
}

async function getJson<T>(fetchJson: RemoteFetch, url: string): Promise<T> {
  return readJson<T>(await fetchJson(url));
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | { error?: unknown };

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Remote room request failed with ${response.status}`;

    throw new Error(message);
  }

  return body as T;
}

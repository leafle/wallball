import { describe, expect, it } from "vitest";

import { createRemoteRoomClient } from "./room-client";
import type { RemoteRoomSnapshot } from "./room-store";

describe("remote room client", () => {
  it("posts room creation and intent payloads to the remote API", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = createRemoteRoomClient({
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });

        return jsonResponse({
          ok: true
        });
      }
    });

    await client.createRoom({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      hostDisplayName: "Brandon"
    });
    await client.sendIntent({
      code: "AB12CD",
      side: "home",
      kind: "swing",
      sequence: 1,
      payload: {
        timingMs: -12
      }
    });

    expect(calls).toEqual([
      {
        url: "/api/remote/rooms",
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            awayTeamId: "champions",
            homeTeamId: "woodland",
            hostDisplayName: "Brandon"
          })
        }
      },
      {
        url: "/api/remote/rooms/AB12CD/intents",
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            side: "home",
            kind: "swing",
            sequence: 1,
            payload: {
              timingMs: -12
            }
          })
        }
      }
    ]);
  });

  it("subscribes to server-sent room snapshots", () => {
    const snapshots: RemoteRoomSnapshot[] = [];
    const eventSource = new FakeEventSource();
    const client = createRemoteRoomClient({
      fetch: async () => jsonResponse({}),
      createEventSource: (url) => {
        eventSource.url = url;

        return eventSource;
      }
    });

    const unsubscribe = client.subscribe("AB12CD", (snapshot) => {
      snapshots.push(snapshot);
    });

    eventSource.emit({
      code: "AB12CD",
      createdAt: "2026-05-06T17:30:00.000Z",
      teams: {
        away: "champions",
        home: "woodland"
      },
      sharePath: "/?room=AB12CD",
      players: {
        away: null,
        home: null
      },
      intents: [],
      recordedMatches: [],
      version: 2
    });
    unsubscribe();

    expect(eventSource.url).toBe("/api/remote/rooms/AB12CD/events");
    expect(eventSource.closed).toBe(true);
    expect(snapshots.map((snapshot) => snapshot.version)).toEqual([2]);
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}

class FakeEventSource {
  closed = false;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  url = "";

  close(): void {
    this.closed = true;
  }

  emit(snapshot: RemoteRoomSnapshot): void {
    this.onmessage?.({
      data: JSON.stringify(snapshot)
    } as MessageEvent<string>);
  }
}

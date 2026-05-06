import { describe, expect, it } from "vitest";

import { createRemoteRoomApi } from "./room-api";
import { createRemoteRoomStore } from "./room-store";

describe("remote room api", () => {
  it("creates, joins, syncs intents, and records matches through JSON routes", async () => {
    const api = createRemoteRoomApi(
      createRemoteRoomStore({
        codeFactory: () => "AB12CD",
        now: () => "2026-05-06T17:30:00.000Z"
      })
    );

    const created = await api.handle({
      method: "POST",
      path: "/api/remote/rooms",
      body: {
        awayTeamId: "champions",
        homeTeamId: "woodland",
        hostDisplayName: "Brandon"
      }
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      assignment: {
        role: "host",
        side: "away"
      },
      snapshot: {
        code: "AB12CD"
      }
    });

    const joined = await api.handle({
      method: "POST",
      path: "/api/remote/rooms/AB12CD/join",
      body: {
        guestDisplayName: "Danny"
      }
    });

    expect(joined.status).toBe(200);
    expect(joined.body).toMatchObject({
      assignment: {
        role: "guest",
        side: "home"
      }
    });

    const intent = await api.handle({
      method: "POST",
      path: "/api/remote/rooms/AB12CD/intents",
      body: {
        side: "home",
        kind: "swing",
        sequence: 1,
        payload: {
          timingMs: -12
        }
      }
    });

    expect(intent.status).toBe(202);
    expect(intent.body).toMatchObject({
      version: 1,
      side: "home",
      kind: "swing"
    });

    const snapshot = await api.handle({
      method: "GET",
      path: "/api/remote/rooms/AB12CD",
      query: {
        sinceVersion: "0"
      }
    });

    expect(snapshot.status).toBe(200);
    expect(snapshot.body).toMatchObject({
      version: 1,
      intents: [
        {
          version: 1,
          side: "home",
          kind: "swing"
        }
      ]
    });

    const recorded = await api.handle({
      method: "POST",
      path: "/api/remote/rooms/AB12CD/matches",
      body: {
        id: "remote-match-1",
        playedAt: "2026-05-06T17:45:00.000Z",
        teams: {
          away: "champions",
          home: "woodland"
        },
        score: {
          away: 8,
          home: 6
        },
        innings: 3,
        events: []
      }
    });

    expect(recorded.status).toBe(201);
    expect(recorded.body).toMatchObject({
      id: "remote-match-1",
      finalScore: "champions 8, woodland 6"
    });
  });

  it("returns JSON errors for missing rooms instead of leaking exceptions", async () => {
    const api = createRemoteRoomApi(createRemoteRoomStore());

    await expect(
      api.handle({
        method: "GET",
        path: "/api/remote/rooms/MISSING"
      })
    ).resolves.toEqual({
      status: 404,
      body: {
        error: "Remote room MISSING was not found"
      }
    });
  });
});

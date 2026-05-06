import { describe, expect, it } from "vitest";

import { createRemoteRoomStore } from "./room-store";

describe("remote room store", () => {
  it("creates a shareable room with the host assigned to the away side", () => {
    const store = createRemoteRoomStore({
      codeFactory: () => "AB12CD",
      now: () => "2026-05-06T17:30:00.000Z"
    });

    const created = store.createRoom({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      hostDisplayName: "Brandon"
    });

    expect(created.assignment).toEqual({
      role: "host",
      side: "away"
    });
    expect(created.snapshot).toMatchObject({
      code: "AB12CD",
      createdAt: "2026-05-06T17:30:00.000Z",
      teams: {
        away: "champions",
        home: "woodland"
      },
      sharePath: "/?room=AB12CD",
      version: 0
    });
    expect(created.snapshot.players.away).toMatchObject({
      displayName: "Brandon",
      role: "host",
      side: "away"
    });
  });

  it("joins the second phone as the home side and rejects a third player", () => {
    const store = createRemoteRoomStore({
      codeFactory: () => "AB12CD",
      now: () => "2026-05-06T17:30:00.000Z"
    });

    store.createRoom({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      hostDisplayName: "Brandon"
    });

    const joined = store.joinRoom({
      code: "ab12cd",
      guestDisplayName: "Danny"
    });

    expect(joined.assignment).toEqual({
      role: "guest",
      side: "home"
    });
    expect(joined.snapshot.players.home).toMatchObject({
      displayName: "Danny",
      role: "guest",
      side: "home"
    });
    expect(() =>
      store.joinRoom({
        code: "AB12CD",
        guestDisplayName: "Late Player"
      })
    ).toThrow("Remote room AB12CD is full");
  });

  it("orders player intents with monotonic versions for synchronization", () => {
    const store = createRemoteRoomStore({
      codeFactory: () => "AB12CD",
      now: () => "2026-05-06T17:30:00.000Z"
    });

    store.createRoom({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      hostDisplayName: "Brandon"
    });
    store.joinRoom({
      code: "AB12CD",
      guestDisplayName: "Danny"
    });

    const pitch = store.appendIntent({
      code: "AB12CD",
      side: "away",
      kind: "pitch",
      sequence: 1,
      payload: {
        targetX: 630,
        speed: 42
      }
    });
    const swing = store.appendIntent({
      code: "AB12CD",
      side: "home",
      kind: "swing",
      sequence: 1,
      payload: {
        timingMs: -18
      }
    });

    expect(pitch.version).toBe(1);
    expect(swing.version).toBe(2);
    expect(store.getSnapshot("AB12CD").intents).toEqual([pitch, swing]);
    expect(store.getSnapshot("AB12CD", { sinceVersion: 1 }).intents).toEqual([
      swing
    ]);
  });

  it("records completed remote matches through the shared summary model", () => {
    const store = createRemoteRoomStore({
      codeFactory: () => "AB12CD",
      now: () => "2026-05-06T17:30:00.000Z"
    });

    store.createRoom({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      hostDisplayName: "Brandon"
    });

    const summary = store.recordMatch("AB12CD", {
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
      events: [
        {
          kind: "remote-swing",
          playerId: "brandon",
          inning: 2
        }
      ]
    });

    expect(summary).toMatchObject({
      id: "remote-match-1",
      finalScore: "champions 8, woodland 6",
      winnerTeamId: "champions",
      loserTeamId: "woodland"
    });
    expect(store.getSnapshot("AB12CD").recordedMatches).toEqual([summary]);
  });

  it("notifies subscribers when synchronized room state changes", () => {
    const store = createRemoteRoomStore({
      codeFactory: () => "AB12CD",
      now: () => "2026-05-06T17:30:00.000Z"
    });

    store.createRoom({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      hostDisplayName: "Brandon"
    });

    const versions: number[] = [];
    const unsubscribe = store.subscribe("AB12CD", (snapshot) => {
      versions.push(snapshot.version);
    });

    store.appendIntent({
      code: "AB12CD",
      side: "away",
      kind: "ready",
      sequence: 1
    });
    store.recordMatch("AB12CD", {
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
    });
    unsubscribe();
    store.appendIntent({
      code: "AB12CD",
      side: "away",
      kind: "ready",
      sequence: 2
    });

    expect(versions).toEqual([0, 1, 2]);
  });
});

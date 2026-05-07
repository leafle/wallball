import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadPredefinedRosters } from "../src/game/data/fixtures";
import {
  applyRemoteSnapshotToLocalLoop,
  createRemoteLocalLoopBridge
} from "../src/game/remote/local-loop-bridge";
import {
  createRemoteRoomApi,
  type RemoteRoomApi
} from "../src/game/remote/room-api";
import {
  createRemoteRoomClient,
  type RemoteFetch
} from "../src/game/remote/room-client";
import { createRemoteRoomStore } from "../src/game/remote/room-store";
import { projectRemoteLobbyChecklist } from "../src/game/ui/remote-lobby";

describe("remote gameplay room smoke flow", () => {
  it("is exposed as a documented remote smoke script", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { scripts: Record<string, string> };
    const devSetup = readFileSync(
      new URL("../docs/dev-setup.md", import.meta.url),
      "utf8"
    );

    expect(packageJson.scripts["smoke:remote"]).toBe(
      "vitest run tests/remote-room-smoke.test.ts"
    );
    expect(devSetup).toContain("npm run smoke:remote");
    expect(devSetup).toContain(
      "does not require auth, matchmaking, or production networking"
    );
  });

  it("drives create, join, intents, bridge sync, and match recording through the remote client", async () => {
    const api = createRemoteRoomApi(
      createRemoteRoomStore({
        codeFactory: () => "AB12CD",
        now: () => "2026-05-07T14:30:00.000Z"
      })
    );
    const fetch = createApiFetch(api);
    const hostClient = createRemoteRoomClient({ fetch });
    const guestClient = createRemoteRoomClient({ fetch });
    const teams = loadPredefinedRosters().map(({ displayName, id }) => ({
      displayName,
      id
    }));

    const created = await hostClient.createRoom({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      hostDisplayName: "Brandon"
    });

    expect(created.assignment).toEqual({ role: "host", side: "away" });
    expect(
      projectRemoteLobbyChecklist({
        assignment: null,
        snapshot: null,
        teams
      }).statusLabel
    ).toBe("Local play available");
    await expect(
      hostClient.sendIntent({
        code: created.snapshot.code,
        kind: "ready",
        sequence: 1,
        side: "home"
      })
    ).rejects.toThrow("Cannot append home intent before that player joins");

    const joined = await guestClient.joinRoom({
      code: "ab12cd",
      guestDisplayName: "Danny"
    });

    expect(joined.assignment).toEqual({ role: "guest", side: "home" });

    await hostClient.sendIntent({
      code: created.snapshot.code,
      kind: "ready",
      sequence: 1,
      side: created.assignment.side
    });
    await guestClient.sendIntent({
      code: created.snapshot.code,
      kind: "ready",
      sequence: 1,
      side: joined.assignment.side
    });
    await guestClient.sendIntent({
      code: created.snapshot.code,
      kind: "pitch",
      payload: {
        idealContactMs: 180,
        pitchX: 0,
        targetX: 0
      },
      sequence: 2,
      side: joined.assignment.side
    });
    await hostClient.sendIntent({
      code: created.snapshot.code,
      kind: "swing",
      payload: {
        timingMs: 0
      },
      sequence: 2,
      side: created.assignment.side
    });
    await guestClient.sendIntent({
      code: created.snapshot.code,
      kind: "fielder-move",
      payload: {
        axisX: 1,
        axisY: 0,
        elapsedMs: 500,
        fielderId: "al"
      },
      sequence: 3,
      side: joined.assignment.side
    });
    await guestClient.sendIntent({
      code: created.snapshot.code,
      kind: "recover-ball",
      sequence: 4,
      side: joined.assignment.side
    });

    const snapshot = await hostClient.getSnapshot(created.snapshot.code);
    const bridged = applyRemoteSnapshotToLocalLoop(
      createRemoteLocalLoopBridge(snapshot, {
        fielders: [
          {
            id: "al",
            position: {
              x: 520,
              y: 260
            },
            speed: 240
          }
        ],
        maxRecoverySpeed: 1_000,
        recoveryRadius: 600
      }),
      snapshot
    );
    const lobby = projectRemoteLobbyChecklist({
      assignment: created.assignment,
      snapshot,
      teams
    });

    expect(snapshot.intents.map((intent) => intent.kind)).toEqual([
      "ready",
      "ready",
      "pitch",
      "swing",
      "fielder-move",
      "recover-ball"
    ]);
    expect(bridged.readySides).toEqual({ away: true, home: true });
    expect(bridged.appliedVersions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(bridged.loop.flow.match.score).toEqual({ away: 1, home: 0 });
    expect(bridged.loop.phase.kind).toBe("ready-for-at-bat");
    expect(lobby.statusLabel).toBe("Ready to start remote loop");

    const summary = await hostClient.recordMatch(snapshot.code, {
      events: snapshot.intents.map((intent) => ({
        inning: 1,
        kind: intent.kind,
        playerId: intent.side
      })),
      id: "remote-smoke-1",
      innings: 1,
      playedAt: "2026-05-07T14:35:00.000Z",
      score: bridged.loop.flow.match.score,
      teams: snapshot.teams
    });
    const recorded = await guestClient.getSnapshot(snapshot.code);

    expect(summary).toMatchObject({
      finalScore: "champions 1, woodland 0",
      winnerTeamId: "champions"
    });
    expect(recorded.recordedMatches).toEqual([summary]);
  });
});

function createApiFetch(api: RemoteRoomApi): RemoteFetch {
  return async (input, init) => {
    const url = new URL(String(input), "http://wallball.local");
    const result = await api.handle({
      body: parseBody(init?.body),
      method: init?.method ?? "GET",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries())
    });

    return {
      json: async () => result.body,
      ok: result.status >= 200 && result.status < 300,
      status: result.status
    } as Response;
  };
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string" || body.trim() === "") {
    return undefined;
  }

  return JSON.parse(body) as unknown;
}

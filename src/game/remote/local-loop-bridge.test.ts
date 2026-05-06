import { describe, expect, it } from "vitest";

import type { RemoteIntentEvent, RemoteRoomSnapshot } from "./room-store";
import {
  applyRemoteSnapshotToLocalLoop,
  createRemoteLocalLoopBridge
} from "./local-loop-bridge";

describe("remote local loop bridge", () => {
  it("translates ordered remote intents into deterministic local loop actions", () => {
    const bridge = createRemoteLocalLoopBridge(createSnapshot([]), {
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
      recoveryRadius: 600,
      timeOriginMs: 1_000
    });

    const bridged = applyRemoteSnapshotToLocalLoop(
      bridge,
      createSnapshot([
        intent(1, "away", "ready", 1),
        intent(2, "home", "ready", 1),
        intent(3, "home", "pitch", 2, {
          idealContactMs: 180,
          pitchX: 0,
          targetX: 0
        }),
        intent(4, "away", "swing", 2, {
          timingMs: 0
        }),
        intent(5, "home", "recover-ball", 3)
      ])
    );

    expect(bridged.readySides).toEqual({
      away: true,
      home: true
    });
    expect(bridged.appliedVersions).toEqual([1, 2, 3, 4, 5]);
    expect(bridged.loop.flow.match.score).toEqual({
      away: 1,
      home: 0
    });
    expect(bridged.loop.lastPlay?.plateAppearance).toMatchObject({
      batterId: "cainer",
      result: "home-run",
      runsScored: ["cainer"]
    });
  });

  it("maps fielding direction payloads and ignores duplicate side sequences", () => {
    const bridge = createRemoteLocalLoopBridge(createSnapshot([]), {
      fieldBounds: {
        minX: 0,
        maxX: 600,
        minY: 0,
        maxY: 720
      },
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
      timeOriginMs: 1_000
    });

    const bridged = applyRemoteSnapshotToLocalLoop(
      bridge,
      createSnapshot([
        intent(1, "home", "fielder-move", 1, {
          axisX: 1,
          axisY: 0,
          elapsedMs: 500,
          fielderId: "al"
        }),
        intent(2, "home", "fielder-move", 1, {
          axisX: -1,
          axisY: 0,
          elapsedMs: 500,
          fielderId: "al"
        })
      ])
    );

    expect(bridged.appliedVersions).toEqual([1]);
    expect(bridged.lastSequenceBySide.home).toBe(1);
    expect(bridged.loop.fielders[0]?.position).toEqual({
      x: 600,
      y: 260
    });
  });
});

function createSnapshot(intents: RemoteIntentEvent[]): RemoteRoomSnapshot {
  return {
    code: "AB12CD",
    createdAt: "2026-05-06T20:30:00.000Z",
    intents,
    players: {
      away: {
        displayName: "Brandon",
        joinedAt: "2026-05-06T20:30:00.000Z",
        role: "host",
        side: "away"
      },
      home: {
        displayName: "Danny",
        joinedAt: "2026-05-06T20:31:00.000Z",
        role: "guest",
        side: "home"
      }
    },
    recordedMatches: [],
    sharePath: "/?room=AB12CD",
    teams: {
      away: "champions",
      home: "woodland"
    },
    version: intents.at(-1)?.version ?? 0
  };
}

function intent(
  version: number,
  side: RemoteIntentEvent["side"],
  kind: RemoteIntentEvent["kind"],
  sequence: number,
  payload: RemoteIntentEvent["payload"] = {}
): RemoteIntentEvent {
  return {
    code: "AB12CD",
    createdAt: `2026-05-06T20:30:0${version}.000Z`,
    id: `AB12CD-${String(version).padStart(4, "0")}`,
    kind,
    payload,
    sequence,
    side,
    version
  };
}

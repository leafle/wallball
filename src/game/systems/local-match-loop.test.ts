import { describe, expect, it } from "vitest";

import { loadPredefinedRosters } from "../data/fixtures";
import type { TeamRoster } from "../domain/rosters";
import {
  advanceLocalMatchLoop,
  createLocalMatchLoopState,
  type LocalMatchLoopState
} from "./local-match-loop";

const fielders = [
  {
    id: "al",
    position: {
      x: 520,
      y: 260
    },
    speed: 240
  }
];

describe("local match loop", () => {
  it("initializes from predefined rosters and scores a recovered wall-target hit", () => {
    const state = createTestLoopState();

    expect(state.phase).toEqual({
      kind: "ready-for-at-bat",
      batterId: "cainer"
    });

    const pitched = pitch(state);

    expect(pitched.phase).toEqual({
      kind: "pitch-in-flight",
      batterId: "cainer"
    });

    const swung = swing(pitched, 1_180);

    expect(swung.phase.kind).toBe("awaiting-recovery");
    expect(swung.lastPlay?.ballResult.kind).toBe("home-run");
    expect(swung.lastPlay?.wallCollision).toMatchObject({
      kind: "wall-collision",
      targetHit: true
    });

    const recovered = recover(swung);

    expect(recovered.phase).toEqual({
      kind: "ready-for-at-bat",
      batterId: "minkus"
    });
    expect(recovered.flow.match.score).toEqual({
      away: 1,
      home: 0
    });
    expect(recovered.lastPlay?.recovery).toMatchObject({
      kind: "recovered",
      fielderId: "al"
    });
    expect(recovered.lastPlay?.plateAppearance).toMatchObject({
      batterId: "cainer",
      result: "home-run",
      runsScored: ["cainer"]
    });
  });

  it("turns recovered weak contact into an out and advances the batting order", () => {
    const recovered = pitchSwingRecover(createTestLoopState(), 1_300);

    expect(recovered.phase).toEqual({
      kind: "ready-for-at-bat",
      batterId: "minkus"
    });
    expect(recovered.flow.match.inning).toEqual({
      inning: 1,
      half: "top",
      outs: 1
    });
    expect(recovered.lastPlay?.plateAppearance).toMatchObject({
      batterId: "cainer",
      result: "out",
      runsScored: []
    });
  });

  it("advances to the home half after the third recovered out", () => {
    const firstOut = pitchSwingRecover(createTestLoopState(), 1_300);
    const secondOut = pitchSwingRecover(firstOut, 1_300);
    const thirdOut = pitchSwingRecover(secondOut, 1_300);

    expect(thirdOut.flow.match.inning).toEqual({
      inning: 1,
      half: "bottom",
      outs: 0
    });
    expect(thirdOut.flow.match.battingSide).toBe("home");
    expect(thirdOut.phase).toEqual({
      kind: "ready-for-at-bat",
      batterId: "al"
    });
    expect(thirdOut.lastPlay?.plateAppearance).toMatchObject({
      result: "out",
      halfInningEnded: true
    });
  });

  it("moves a fielder from directional gameplay input", () => {
    const state = createTestLoopState();
    const moved = advanceLocalMatchLoop(state, {
      type: "move-fielder",
      fielderId: "al",
      input: {
        axisX: 1,
        axisY: 0
      },
      elapsedMs: 500,
      bounds: {
        minX: 0,
        maxX: 1_000,
        minY: 0,
        maxY: 700
      }
    });

    expect(moved.fielders[0]?.position).toEqual({
      x: 640,
      y: 260
    });
    expect(state.fielders[0]?.position).toEqual({
      x: 520,
      y: 260
    });
  });

  it("enters a completed phase when the score limit is reached", () => {
    const completed = pitchSwingRecover(
      createLocalMatchLoopState({
        awayRoster: getRoster("champions"),
        homeRoster: getRoster("woodland"),
        fielders,
        maxRecoverySpeed: 1_000,
        recoveryRadius: 600,
        scoreLimit: 1
      }),
      1_180
    );

    expect(completed.lastPlay?.plateAppearance).toMatchObject({
      batterId: "cainer",
      matchCompleted: true,
      result: "home-run",
      runsScored: ["cainer"]
    });
    expect(completed.phase).toEqual({
      kind: "match-completed",
      result: {
        loserTeamId: "woodland",
        score: {
          away: 1,
          home: 0
        },
        winnerTeamId: "champions"
      }
    });
    expect(() =>
      advanceLocalMatchLoop(completed, {
        type: "pitch",
        pitchStartedAtMs: 2_000,
        idealContactMs: 180,
        pitchX: 0,
        targetX: 0
      })
    ).toThrow("Cannot advance a completed match");
  });
});

function createTestLoopState(): LocalMatchLoopState {
  return createLocalMatchLoopState({
    awayRoster: getRoster("champions"),
    homeRoster: getRoster("woodland"),
    fielders,
    recoveryRadius: 600,
    maxRecoverySpeed: 1_000
  });
}

function getRoster(teamId: string): TeamRoster {
  const roster = loadPredefinedRosters().find((team) => team.id === teamId);

  if (!roster) {
    throw new Error(`Missing test roster: ${teamId}`);
  }

  return roster;
}

function pitch(state: LocalMatchLoopState): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "pitch",
    pitchStartedAtMs: 1_000,
    idealContactMs: 180,
    pitchX: 0,
    targetX: 0
  });
}

function swing(
  state: LocalMatchLoopState,
  swingAtMs: number
): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "swing",
    swingAtMs
  });
}

function recover(state: LocalMatchLoopState): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "recover-ball"
  });
}

function pitchSwingRecover(
  state: LocalMatchLoopState,
  swingAtMs: number
): LocalMatchLoopState {
  return recover(swing(pitch(state), swingAtMs));
}

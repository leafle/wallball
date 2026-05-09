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

  it("turns recovered weak contact into a fly out and advances the batting order", () => {
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
      result: "fly-out",
      runsScored: []
    });
  });

  it("keeps scoreless recovered hits from being recorded as outs", () => {
    const recovered = recover(
      swing(
        pitch(createTestLoopState(), {
          pitchX: 0.75
        }),
        1_260
      )
    );

    expect(recovered.lastPlay?.plateAppearance).toMatchObject({
      batterId: "cainer",
      result: "single",
      runsScored: [],
      halfInningEnded: false
    });
    expect(recovered.flow.match.inning).toEqual({
      inning: 1,
      half: "top",
      outs: 0
    });
    expect(recovered.flow.bases).toEqual({
      first: "cainer",
      second: null,
      third: null
    });
    expect(recovered.eventLog.map((event) => event.kind)).toEqual([
      "pitch",
      "swing",
      "contact",
      "recovery"
    ]);
  });

  it("uses fielding facts to resolve the recovered wallball hit result", () => {
    const recovered = recover(
      swing(pitch(createTestLoopState()), 1_180),
      {
        bounced: true,
        fieldedAtY: 610,
        fieldedBy: "fielder",
        hitFence: false,
        overFence: false
      }
    );

    expect(recovered.lastPlay?.plateAppearance).toMatchObject({
      batterId: "cainer",
      result: "double",
      runsScored: []
    });
    expect(recovered.flow.bases).toEqual({
      first: null,
      second: "cainer",
      third: null
    });
  });

  it("resolves a swung miss by carrying the pitch to the wall inside the strike-zone square", () => {
    const swung = swing(pitch(createTestLoopState()), 1_500);

    expect(swung.phase).toEqual({
      kind: "ready-for-at-bat",
      batterId: "minkus"
    });
    expect(swung.lastPlay?.ballResult.kind).toBe("miss");
    expect(swung.lastPlay?.pitchOutcome).toEqual({
      source: "swung-miss",
      zone: "inside-strike-zone"
    });
    expect(swung.lastPlay?.wallCollision).toMatchObject({
      kind: "wall-collision",
      targetHit: true,
      collisionPoint: {
        x: 520,
        y: 120
      }
    });
    expect(swung.eventLog).toContainEqual(
      expect.objectContaining({
        kind: "target-hit",
        result: "miss",
        targetHit: true
      })
    );
  });

  it("classifies a swung miss outside the wall strike-zone square", () => {
    const swung = swing(
      pitch(createTestLoopState(), {
        pitchX: 0.75
      }),
      1_500
    );

    expect(swung.lastPlay?.pitchOutcome).toEqual({
      source: "swung-miss",
      zone: "outside-strike-zone"
    });
    expect(swung.lastPlay?.wallCollision).toMatchObject({
      kind: "wall-collision",
      targetHit: false,
      collisionPoint: {
        x: 580,
        y: 120
      }
    });
    expect(swung.eventLog).toContainEqual(
      expect.objectContaining({
        kind: "wall-hit",
        result: "miss",
        targetHit: false
      })
    );
  });

  it("resolves a taken pitch at the wall without recording a swing", () => {
    const taken = takePitch(pitch(createTestLoopState()));

    expect(taken.phase).toEqual({
      kind: "ready-for-at-bat",
      batterId: "minkus"
    });
    expect(taken.lastPlay?.pitchOutcome).toEqual({
      source: "taken",
      zone: "inside-strike-zone"
    });
    expect(taken.lastPlay?.wallCollision).toMatchObject({
      kind: "wall-collision",
      targetHit: true
    });
    expect(taken.eventLog.map((event) => event.kind)).toEqual([
      "pitch",
      "take",
      "target-hit",
      "out"
    ]);
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
      result: "fly-out",
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

  it("records notable pitch, contact, wall, recovery, run, and completion events", () => {
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

    expect(completed.eventLog.map((event) => event.kind)).toEqual([
      "pitch",
      "swing",
      "contact",
      "target-hit",
      "recovery",
      "run",
      "match-completed"
    ]);
    expect(completed.eventLog).toContainEqual(
      expect.objectContaining({
        contactQuality: "perfect",
        half: "top",
        inning: 1,
        kind: "contact",
        playerId: "cainer",
        result: "home-run"
      })
    );
    expect(completed.eventLog.at(-1)).toMatchObject({
      kind: "match-completed",
      playerId: null,
      score: {
        away: 1,
        home: 0
      }
    });
  });

  it("records outs and inning changes when the side is retired", () => {
    const firstOut = pitchSwingRecover(createTestLoopState(), 1_300);
    const secondOut = pitchSwingRecover(firstOut, 1_300);
    const thirdOut = pitchSwingRecover(secondOut, 1_300);

    expect(thirdOut.eventLog.map((event) => event.kind)).toEqual([
      "pitch",
      "swing",
      "contact",
      "recovery",
      "out",
      "pitch",
      "swing",
      "contact",
      "recovery",
      "out",
      "pitch",
      "swing",
      "contact",
      "recovery",
      "out",
      "inning-change"
    ]);
    expect(thirdOut.eventLog.at(-1)).toMatchObject({
      half: "bottom",
      inning: 1,
      kind: "inning-change",
      playerId: null
    });
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

function pitch(
  state: LocalMatchLoopState,
  overrides: {
    pitchX?: number;
    targetX?: number;
  } = {}
): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "pitch",
    pitchStartedAtMs: 1_000,
    idealContactMs: 180,
    pitchX: 0,
    targetX: 0,
    ...overrides
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

function recover(
  state: LocalMatchLoopState,
  hitResult?: {
    bounced: boolean;
    fieldedAtY: number;
    fieldedBy: "fielder" | "pitcher";
    hitFence: boolean;
    overFence: boolean;
  }
): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "recover-ball",
    hitResult
  });
}

function takePitch(state: LocalMatchLoopState): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "take-pitch"
  });
}

function pitchSwingRecover(
  state: LocalMatchLoopState,
  swingAtMs: number
): LocalMatchLoopState {
  return recover(swing(pitch(state), swingAtMs));
}

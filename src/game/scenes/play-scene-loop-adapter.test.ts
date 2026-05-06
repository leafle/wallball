import { describe, expect, it } from "vitest";

import {
  advancePlaySceneLoopAdapter,
  applyPlaySceneControlIntent,
  createPlaySceneLoopAdapter,
  projectPlaySceneLoopState
} from "./play-scene-loop-adapter";

describe("play scene local loop adapter", () => {
  it("projects a manually controlled pitch, swing, and recovery cycle for Phaser rendering", () => {
    const initial = createPlaySceneLoopAdapter({ startedAtMs: 1_000 });
    const initialProjection = projectPlaySceneLoopState(initial);

    expect(initialProjection.hud).toMatchObject({
      awayScore: 0,
      awayTeamName: "Champions",
      batterName: "Cainer",
      homeScore: 0,
      homeTeamName: "Woodland",
      inning: 1,
      outs: 0,
      pitcherName: "Danny"
    });
    expect(initialProjection.ball.position).toEqual({ x: 520, y: 360 });
    expect(initialProjection.wallTarget).toEqual({
      center: { x: 520, y: 120 },
      height: 80,
      width: 80
    });

    const pitched = applyPlaySceneControlIntent(
      initial,
      {
        kind: "pitch",
        source: "keyboard"
      },
      1_000
    );

    expect(projectPlaySceneLoopState(pitched).phase.kind).toBe("pitch-in-flight");

    const swung = applyPlaySceneControlIntent(
      pitched,
      {
        kind: "swing",
        source: "keyboard"
      },
      1_180
    );
    const swungProjection = projectPlaySceneLoopState(swung);

    expect(swungProjection.phase.kind).toBe("awaiting-recovery");
    expect(swungProjection.lastResult).toBe("home-run");
    expect(swungProjection.ball.position).toEqual(swung.loop.ball.position);

    const recovered = advancePlaySceneLoopAdapter(swung, 1_500);
    const recoveredProjection = projectPlaySceneLoopState(recovered);

    expect(recovered.loop.lastPlay?.plateAppearance).toMatchObject({
      batterId: "cainer",
      result: "home-run",
      runsScored: ["cainer"]
    });
    expect(recoveredProjection.hud).toMatchObject({
      awayScore: 1,
      batterName: "Minkus",
      homeScore: 0,
      pitcherName: "Danny"
    });
    expect(recoveredProjection.fielders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "al",
          position: { x: 520, y: 260 }
        })
      ])
    );
  });

  it("maps pitch and swing controls onto the deterministic loop actions", () => {
    const initial = createPlaySceneLoopAdapter({
      pitchDurationMs: 200,
      recoveryDelayMs: 300,
      startedAtMs: 1_000
    });

    const pitched = applyPlaySceneControlIntent(
      initial,
      {
        kind: "pitch",
        source: "keyboard"
      },
      1_000
    );

    expect(projectPlaySceneLoopState(pitched).phase.kind).toBe("pitch-in-flight");

    const swung = applyPlaySceneControlIntent(
      pitched,
      {
        kind: "swing",
        source: "keyboard"
      },
      1_140
    );

    expect(projectPlaySceneLoopState(swung).phase.kind).toBe("awaiting-recovery");
    expect(swung.loop.lastPlay?.swingTimingMs).toBe(-60);

    const recovered = advancePlaySceneLoopAdapter(swung, 1_440);

    expect(projectPlaySceneLoopState(recovered).phase.kind).toBe(
      "ready-for-at-bat"
    );
  });

  it("moves the controlled fielder while fielding input is held", () => {
    const initial = createPlaySceneLoopAdapter({ startedAtMs: 0 });
    const moving = applyPlaySceneControlIntent(
      initial,
      {
        axisX: 1,
        axisY: 0,
        kind: "fielder-move",
        source: "touch"
      },
      0
    );

    const advanced = advancePlaySceneLoopAdapter(moving, 500);
    const stopped = applyPlaySceneControlIntent(
      advanced,
      {
        axisX: 0,
        axisY: 0,
        kind: "fielder-move",
        source: "touch"
      },
      500
    );
    const stable = advancePlaySceneLoopAdapter(stopped, 1_000);

    expect(projectPlaySceneLoopState(advanced).fielders[0]).toMatchObject({
      id: "al",
      position: {
        x: 640,
        y: 260
      }
    });
    expect(projectPlaySceneLoopState(stable).fielders[0]).toMatchObject({
      id: "al",
      position: {
        x: 640,
        y: 260
      }
    });
  });

  it("projects a typed completion result when controls reach the local score limit", () => {
    const initial = createPlaySceneLoopAdapter({
      scoreLimit: 1,
      startedAtMs: 1_000
    });
    const pitched = applyPlaySceneControlIntent(
      initial,
      {
        kind: "pitch",
        source: "keyboard"
      },
      1_000
    );
    const swung = applyPlaySceneControlIntent(
      pitched,
      {
        kind: "swing",
        source: "keyboard"
      },
      1_180
    );
    const completed = advancePlaySceneLoopAdapter(swung, 1_500);
    const projection = projectPlaySceneLoopState(completed);

    expect(projection.phase.kind).toBe("match-completed");
    expect(projection.hud.completionText).toBe("Final: Champions 1, Woodland 0");
    expect(projection.completion).toEqual({
      finalScore: "Champions 1, Woodland 0",
      loserTeamId: "woodland",
      loserTeamName: "Woodland",
      winnerTeamId: "champions",
      winnerTeamName: "Champions"
    });
    expect(
      projectPlaySceneLoopState(
        applyPlaySceneControlIntent(
          completed,
          {
            kind: "pitch",
            source: "keyboard"
          },
          2_000
        )
      ).phase.kind
    ).toBe("match-completed");
  });
});

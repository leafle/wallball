import { describe, expect, it } from "vitest";

import {
  advancePlaySceneLoopAdapter,
  createPlaySceneLoopAdapter,
  projectPlaySceneLoopState
} from "./play-scene-loop-adapter";

describe("play scene local loop adapter", () => {
  it("projects a deterministic pitch, swing, and recovery cycle for Phaser rendering", () => {
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

    const pitched = advancePlaySceneLoopAdapter(initial, 1_000);

    expect(projectPlaySceneLoopState(pitched).phase.kind).toBe("pitch-in-flight");

    const swung = advancePlaySceneLoopAdapter(pitched, 1_180);
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
});

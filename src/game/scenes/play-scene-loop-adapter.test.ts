import { describe, expect, it } from "vitest";

import {
  advancePlaySceneLoopAdapter,
  applyPlaySceneControlIntent,
  createPlaySceneLoopAdapter,
  projectPlaySceneLoopState,
  selectPlaySceneLoopTeam,
  startPlaySceneLoopAdapter
} from "./play-scene-loop-adapter";

describe("play scene local loop adapter", () => {
  it("assists solo play with a deterministic default pitch after the pitch delay", () => {
    const initial = createPlaySceneLoopAdapter({
      pitchDurationMs: 200,
      soloAssist: {
        enabled: true,
        pitchDelayMs: 400
      },
      startedAtMs: 1_000
    });

    expect(
      projectPlaySceneLoopState(advancePlaySceneLoopAdapter(initial, 1_399)).phase
        .kind
    ).toBe("ready-for-at-bat");

    const pitched = advancePlaySceneLoopAdapter(initial, 1_400);

    expect(projectPlaySceneLoopState(pitched).phase.kind).toBe("pitch-in-flight");
    expect(pitched.loop.currentPitch).toMatchObject({
      idealContactMs: 200,
      pitchStartedAtMs: 1_400,
      pitchX: 0,
      targetX: 0
    });

    expect(
      projectPlaySceneLoopState(
        advancePlaySceneLoopAdapter(
          createPlaySceneLoopAdapter({
            soloAssist: false,
            startedAtMs: 1_000
          }),
          2_000
        )
      ).phase.kind
    ).toBe("ready-for-at-bat");
  });

  it("assists solo fielding by moving the nearest fielder into recovery range", () => {
    const initial = createPlaySceneLoopAdapter({
      fieldBounds: {
        minX: 0,
        maxX: 1_280,
        minY: 0,
        maxY: 720
      },
      fielders: [
        {
          id: "al",
          position: {
            x: 320,
            y: 620
          },
          speed: 2_000
        }
      ],
      maxRecoverySpeed: 10_000,
      recoveryDelayMs: 100,
      recoveryRadius: 16,
      soloAssist: {
        enabled: true,
        fieldingRecovery: true,
        pitchDelayMs: 400
      },
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
      1_300
    );

    const recovered = advancePlaySceneLoopAdapter(swung, 1_600);

    expect(projectPlaySceneLoopState(recovered).phase.kind).toBe(
      "ready-for-at-bat"
    );
    expect(recovered.loop.lastPlay?.recovery).toMatchObject({
      kind: "recovered",
      fielderId: "al"
    });
    expect(recovered.loop.fielders[0]?.position).not.toEqual({
      x: 320,
      y: 620
    });
  });

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

  it("projects deterministic friend matchup callouts from player and pitcher IDs", () => {
    const initial = createPlaySceneLoopAdapter({ startedAtMs: 1_000 });
    const afterCainer = scorePlateAppearance(initial, 1_000);
    const afterMinkus = scorePlateAppearance(afterCainer, 2_000);
    const projection = projectPlaySceneLoopState(afterMinkus);

    expect(projection.hud).toMatchObject({
      batterName: "Brandon",
      pitcherName: "Danny",
      calloutText: "Brandon digs in while Danny works fast."
    });
    expect(projection.callout).toEqual({
      id: "brandon-vs-danny",
      message: "Brandon digs in while Danny works fast.",
      playerIds: ["brandon", "danny"],
      tags: ["matchup", "pace"],
      trigger: "player-matchup"
    });
  });

  it("selects predefined teams and starts a fresh deterministic loop", () => {
    const initial = createPlaySceneLoopAdapter({ startedAtMs: 1_000 });
    const withAway = selectPlaySceneLoopTeam(initial, {
      side: "away",
      teamId: "team-cainer"
    });
    const selected = selectPlaySceneLoopTeam(withAway, {
      side: "home",
      teamId: "ej"
    });

    expect(projectPlaySceneLoopState(selected).setup).toEqual({
      awayTeamId: "team-cainer",
      awayTeamName: "Team Cainer",
      homeTeamId: "ej",
      homeTeamName: "EJ",
      teams: [
        { id: "champions", displayName: "Champions" },
        { id: "woodland", displayName: "Woodland" },
        { id: "team-cainer", displayName: "Team Cainer" },
        { id: "ej", displayName: "EJ" }
      ]
    });

    const started = startPlaySceneLoopAdapter(selected, 2_000);

    expect(started.awayRoster.id).toBe("team-cainer");
    expect(started.homeRoster.id).toBe("ej");
    expect(projectPlaySceneLoopState(started).hud).toMatchObject({
      awayScore: 0,
      awayTeamName: "Team Cainer",
      batterName: "Rich",
      homeScore: 0,
      homeTeamName: "EJ",
      pitcherName: "Nick"
    });
    expect(projectPlaySceneLoopState(started).fielders[0]).toMatchObject({
      id: "bobby",
      displayName: "Bobby"
    });
  });

  it("restarting preserves selected teams while clearing score, outs, and batter order", () => {
    const selected = selectPlaySceneLoopTeam(
      selectPlaySceneLoopTeam(createPlaySceneLoopAdapter({ startedAtMs: 1_000 }), {
        side: "away",
        teamId: "team-cainer"
      }),
      {
        side: "home",
        teamId: "ej"
      }
    );
    const started = startPlaySceneLoopAdapter(selected, 1_000);
    const pitched = applyPlaySceneControlIntent(
      started,
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
    const scored = advancePlaySceneLoopAdapter(swung, 1_500);

    expect(projectPlaySceneLoopState(scored).hud.awayScore).toBe(1);

    const restarted = startPlaySceneLoopAdapter(scored, 5_000);

    expect(projectPlaySceneLoopState(restarted).hud).toMatchObject({
      awayScore: 0,
      awayTeamName: "Team Cainer",
      batterName: "Rich",
      homeScore: 0,
      homeTeamName: "EJ",
      inning: 1,
      outs: 0
    });
  });
});

function scorePlateAppearance(
  adapter: ReturnType<typeof createPlaySceneLoopAdapter>,
  pitchStartedAtMs: number
): ReturnType<typeof createPlaySceneLoopAdapter> {
  const pitched = applyPlaySceneControlIntent(
    adapter,
    {
      kind: "pitch",
      source: "keyboard"
    },
    pitchStartedAtMs
  );
  const swung = applyPlaySceneControlIntent(
    pitched,
    {
      kind: "swing",
      source: "keyboard"
    },
    pitchStartedAtMs + 180
  );

  return advancePlaySceneLoopAdapter(swung, pitchStartedAtMs + 500);
}

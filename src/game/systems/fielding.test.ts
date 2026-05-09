import { describe, expect, it } from "vitest";

import {
  moveFielder,
  resolveWallballHitResult,
  resolveBallRecovery,
  type Fielder
} from "./fielding";

const baseFielder: Fielder = {
  id: "minkus",
  position: {
    x: 500,
    y: 420
  },
  speed: 240
};

describe("fielding movement", () => {
  it("moves a fielder from normalized directional input", () => {
    expect(
      moveFielder({
        fielder: baseFielder,
        input: {
          axisX: 1,
          axisY: -1
        },
        elapsedMs: 500,
        bounds: {
          minX: 160,
          maxX: 1120,
          minY: 220,
          maxY: 660
        }
      })
    ).toEqual({
      ...baseFielder,
      position: {
        x: 584.852814,
        y: 335.147186
      }
    });
  });

  it("clamps movement to the playable field bounds", () => {
    expect(
      moveFielder({
        fielder: baseFielder,
        input: {
          axisX: -1,
          axisY: 1
        },
        elapsedMs: 2_000,
        bounds: {
          minX: 360,
          maxX: 520,
          minY: 400,
          maxY: 500
        }
      }).position
    ).toEqual({
      x: 360,
      y: 500
    });
  });
});

describe("ball recovery", () => {
  it("assigns recovery to the nearest fielder inside the pickup radius", () => {
    expect(
      resolveBallRecovery({
        fielders: [
          baseFielder,
          {
            id: "brandon",
            position: {
              x: 620,
              y: 420
            },
            speed: 220
          }
        ],
        ball: {
          position: {
            x: 616,
            y: 423
          },
          velocity: {
            x: 2,
            y: -1
          }
        },
        recoveryRadius: 32,
        maxRecoverySpeed: 8
      })
    ).toEqual({
      kind: "recovered",
      fielderId: "brandon",
      distance: 5
    });
  });

  it("leaves a fast ball loose until it slows enough to recover", () => {
    expect(
      resolveBallRecovery({
        fielders: [baseFielder],
        ball: {
          position: {
            x: 505,
            y: 420
          },
          velocity: {
            x: 20,
            y: 0
          }
        },
        recoveryRadius: 32,
        maxRecoverySpeed: 8
      })
    ).toEqual({
      kind: "loose",
      nearestFielderId: "minkus",
      distance: 5
    });
  });
});

describe("wallball hit results", () => {
  const fieldLayout = {
    infieldLineY: 360,
    outfieldLineY: 520,
    fenceY: 680
  };

  it("turns a no-bounce catch into a fly out", () => {
    expect(
      resolveWallballHitResult({
        bounced: false,
        fieldedAtY: 300,
        fieldedBy: "fielder",
        fieldLayout,
        hitFence: false,
        overFence: false
      })
    ).toBe("fly-out");
  });

  it("turns a bounced pitcher fielding before the infield line into a ground out", () => {
    expect(
      resolveWallballHitResult({
        bounced: true,
        fieldedAtY: 320,
        fieldedBy: "pitcher",
        fieldLayout,
        hitFence: false,
        overFence: false
      })
    ).toBe("ground-out");
  });

  it("turns bounced balls fielded between the infield and outfield lines into singles", () => {
    expect(
      resolveWallballHitResult({
        bounced: true,
        fieldedAtY: 430,
        fieldedBy: "fielder",
        fieldLayout,
        hitFence: false,
        overFence: false
      })
    ).toBe("single");
  });

  it("turns bounced balls fielded between the outfield line and fence into doubles", () => {
    expect(
      resolveWallballHitResult({
        bounced: true,
        fieldedAtY: 610,
        fieldedBy: "fielder",
        fieldLayout,
        hitFence: false,
        overFence: false
      })
    ).toBe("double");
  });

  it("turns bounced fence contact into a triple", () => {
    expect(
      resolveWallballHitResult({
        bounced: true,
        fieldedAtY: 675,
        fieldedBy: "fielder",
        fieldLayout,
        hitFence: true,
        overFence: false
      })
    ).toBe("triple");
  });

  it("turns over-fence balls into home runs", () => {
    expect(
      resolveWallballHitResult({
        bounced: true,
        fieldedAtY: 700,
        fieldedBy: "fielder",
        fieldLayout,
        hitFence: false,
        overFence: true
      })
    ).toBe("home-run");
  });
});

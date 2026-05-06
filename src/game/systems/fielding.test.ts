import { describe, expect, it } from "vitest";

import {
  moveFielder,
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

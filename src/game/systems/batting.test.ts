import { describe, expect, it } from "vitest";

import {
  calculateBattingLaunch,
  calculateSwingTimingMs
} from "./batting";

describe("batting timing", () => {
  it("measures swing timing relative to the ideal contact moment", () => {
    expect(
      calculateSwingTimingMs({
        pitchStartedAtMs: 1_000,
        swingAtMs: 1_120,
        idealContactMs: 180
      })
    ).toBe(-60);
  });
});

describe("batting launch", () => {
  it("turns solid early contact into a left-pulled launch toward the wall", () => {
    const launch = calculateBattingLaunch({
      swingTimingMs: -80,
      pitchX: -0.2,
      targetX: 0,
      wallTargetHit: false
    });

    expect(launch.result).toMatchObject({
      kind: "single",
      contactQuality: "solid"
    });
    expect(launch.velocity.x).toBeLessThan(0);
    expect(launch.velocity.y).toBeLessThan(0);
    expect(launch.speed).toBeGreaterThan(500);
  });

  it("keeps the ball dead when swing timing misses the pitch", () => {
    expect(
      calculateBattingLaunch({
        swingTimingMs: 220,
        pitchX: 0,
        targetX: 0,
        wallTargetHit: true
      })
    ).toMatchObject({
      result: {
        kind: "miss",
        contactQuality: "none",
        launchAngleDegrees: 0
      },
      velocity: {
        x: 0,
        y: 0
      },
      speed: 0
    });
  });
});

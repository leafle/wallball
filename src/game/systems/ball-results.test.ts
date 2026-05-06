import { describe, expect, it } from "vitest";

import { calculateBallResult } from "./ball-results";

describe("ball result calculations", () => {
  it("turns centered timing and target contact into a home run", () => {
    expect(
      calculateBallResult({
        swingTimingMs: 12,
        pitchX: 0,
        targetX: 0,
        wallTargetHit: true
      })
    ).toEqual({
      kind: "home-run",
      contactQuality: "perfect",
      launchAngleDegrees: 38
    });
  });

  it("turns playable but imperfect contact into a single", () => {
    expect(
      calculateBallResult({
        swingTimingMs: -80,
        pitchX: -0.2,
        targetX: 0,
        wallTargetHit: false
      })
    ).toMatchObject({
      kind: "single",
      contactQuality: "solid"
    });
  });

  it("records a miss when timing is too late", () => {
    expect(
      calculateBallResult({
        swingTimingMs: 181,
        pitchX: 0,
        targetX: 0,
        wallTargetHit: true
      })
    ).toEqual({
      kind: "miss",
      contactQuality: "none",
      launchAngleDegrees: 0
    });
  });
});

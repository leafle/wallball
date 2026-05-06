import { describe, expect, it } from "vitest";

import { calculateWallRebound } from "./ball-physics";

describe("rebound calculations", () => {
  it("reflects the incoming vector across the wall normal", () => {
    expect(
      calculateWallRebound({
        velocity: { x: 12, y: -18 },
        wallNormal: { x: 0, y: 1 },
        restitution: 0.8
      })
    ).toEqual({
      x: 9.6,
      y: 14.4
    });
  });

  it("normalizes non-unit wall normals before calculating the rebound", () => {
    expect(
      calculateWallRebound({
        velocity: { x: 10, y: 0 },
        wallNormal: { x: -2, y: 0 },
        restitution: 1
      })
    ).toEqual({
      x: -10,
      y: 0
    });
  });
});

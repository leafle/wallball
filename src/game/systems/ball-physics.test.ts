import { describe, expect, it } from "vitest";

import {
  calculateWallRebound,
  resolveWallTargetCollision
} from "./ball-physics";

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

describe("wall target collision", () => {
  it("rebounds from the wall and reports target contact when the collision point is inside the target", () => {
    expect(
      resolveWallTargetCollision({
        ball: {
          position: { x: 500, y: 180 },
          velocity: { x: 120, y: -300 }
        },
        elapsedMs: 300,
        wall: {
          point: { x: 0, y: 120 },
          normal: { x: 0, y: 1 }
        },
        target: {
          center: { x: 520, y: 120 },
          width: 80,
          height: 80
        },
        restitution: 0.75
      })
    ).toEqual({
      kind: "wall-collision",
      targetHit: true,
      collisionPoint: { x: 524, y: 120 },
      position: { x: 533, y: 142.5 },
      velocity: { x: 90, y: 225 }
    });
  });

  it("rebounds from the wall without target contact when the collision point misses the target", () => {
    expect(
      resolveWallTargetCollision({
        ball: {
          position: { x: 760, y: 180 },
          velocity: { x: 0, y: -240 }
        },
        elapsedMs: 500,
        wall: {
          point: { x: 0, y: 120 },
          normal: { x: 0, y: 1 }
        },
        target: {
          center: { x: 520, y: 120 },
          width: 80,
          height: 80
        },
        restitution: 0.5
      })
    ).toMatchObject({
      kind: "wall-collision",
      targetHit: false,
      collisionPoint: { x: 760, y: 120 },
      velocity: { x: 0, y: 120 }
    });
  });

  it("advances the ball without rebounding when it does not reach the wall this frame", () => {
    expect(
      resolveWallTargetCollision({
        ball: {
          position: { x: 500, y: 260 },
          velocity: { x: 90, y: -120 }
        },
        elapsedMs: 500,
        wall: {
          point: { x: 0, y: 120 },
          normal: { x: 0, y: 1 }
        },
        target: {
          center: { x: 520, y: 120 },
          width: 80,
          height: 80
        },
        restitution: 0.75
      })
    ).toEqual({
      kind: "no-wall-collision",
      targetHit: false,
      position: { x: 545, y: 200 },
      velocity: { x: 90, y: -120 }
    });
  });
});

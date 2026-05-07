import type {
  Vector2,
  WallPlane,
  WallTarget,
  WallTargetCollision
} from "./ball-physics";
import { resolveWallTargetCollision } from "./ball-physics";

export type PitchWallOutcomeSource = "swung-miss" | "taken";
export type PitchWallZone = "inside-strike-zone" | "outside-strike-zone";

export interface PitchWallLocation {
  pitchX: number;
  targetX: number;
}

export interface PitchWallOutcome {
  source: PitchWallOutcomeSource;
  zone: PitchWallZone;
}

export interface ResolvePitchWallOutcomeInput {
  ballStart: Vector2;
  elapsedMs: number;
  pitch: PitchWallLocation;
  restitution: number;
  source: PitchWallOutcomeSource;
  target: WallTarget;
  wall: WallPlane;
}

export interface ResolvedPitchWallOutcome extends PitchWallOutcome {
  wallCollision: WallTargetCollision;
}

export function resolvePitchWallOutcome({
  ballStart,
  elapsedMs,
  pitch,
  restitution,
  source,
  target,
  wall
}: ResolvePitchWallOutcomeInput): ResolvedPitchWallOutcome {
  const velocity = calculatePitchWallVelocity({
    ballStart,
    elapsedMs,
    pitch,
    target,
    wall
  });
  const wallCollision = resolveWallTargetCollision({
    ball: {
      position: cloneVector(ballStart),
      velocity
    },
    elapsedMs,
    wall,
    target,
    restitution
  });

  return {
    source,
    zone:
      wallCollision.kind === "wall-collision" && wallCollision.targetHit
        ? "inside-strike-zone"
        : "outside-strike-zone",
    wallCollision
  };
}

function calculatePitchWallVelocity({
  ballStart,
  elapsedMs,
  pitch,
  target,
  wall
}: Omit<ResolvePitchWallOutcomeInput, "restitution" | "source">): Vector2 {
  if (elapsedMs <= 0) {
    throw new Error("Expected pitch wall travel time to be positive");
  }

  const elapsedSeconds = elapsedMs / 1_000;
  const normal = normalize(wall.normal);
  const tangent = {
    x: normal.y,
    y: -normal.x
  };
  const pitchOffset = pitch.pitchX - pitch.targetX;
  const targetPoint = {
    x: target.center.x + tangent.x * pitchOffset * target.width,
    y: target.center.y + tangent.y * pitchOffset * target.width
  };
  const wallDistance = signedDistanceToWall(targetPoint, wall.point, normal);
  const contactPoint = {
    x: targetPoint.x - normal.x * wallDistance,
    y: targetPoint.y - normal.y * wallDistance
  };

  return {
    x: round((contactPoint.x - ballStart.x) / elapsedSeconds),
    y: round((contactPoint.y - ballStart.y) / elapsedSeconds)
  };
}

function signedDistanceToWall(
  position: Vector2,
  wallPoint: Vector2,
  normal: Vector2
): number {
  return (
    (position.x - wallPoint.x) * normal.x +
    (position.y - wallPoint.y) * normal.y
  );
}

function normalize(vector: Vector2): Vector2 {
  const length = Math.hypot(vector.x, vector.y);

  if (length === 0) {
    throw new Error("Cannot resolve pitch wall contact with a zero-length normal");
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

function cloneVector(vector: Vector2): Vector2 {
  return {
    x: vector.x,
    y: vector.y
  };
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

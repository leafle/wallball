export interface Vector2 {
  x: number;
  y: number;
}

export interface BallPhysicsSnapshot {
  position: Vector2;
  velocity: Vector2;
}

export interface WallPlane {
  point: Vector2;
  normal: Vector2;
}

export interface WallTarget {
  center: Vector2;
  width: number;
  height: number;
}

export interface WallReboundInput {
  velocity: Vector2;
  wallNormal: Vector2;
  restitution: number;
}

export interface WallTargetCollisionInput {
  ball: BallPhysicsSnapshot;
  elapsedMs: number;
  wall: WallPlane;
  target: WallTarget;
  restitution: number;
}

export interface WallCollision {
  kind: "wall-collision";
  targetHit: boolean;
  collisionPoint: Vector2;
  position: Vector2;
  velocity: Vector2;
}

export interface NoWallCollision {
  kind: "no-wall-collision";
  targetHit: false;
  position: Vector2;
  velocity: Vector2;
}

export type WallTargetCollision = WallCollision | NoWallCollision;

export function calculateWallRebound({
  velocity,
  wallNormal,
  restitution
}: WallReboundInput): Vector2 {
  const normal = normalize(wallNormal);
  const dot = velocity.x * normal.x + velocity.y * normal.y;

  return {
    x: round((velocity.x - 2 * dot * normal.x) * restitution),
    y: round((velocity.y - 2 * dot * normal.y) * restitution)
  };
}

export function resolveWallTargetCollision({
  ball,
  elapsedMs,
  wall,
  target,
  restitution
}: WallTargetCollisionInput): WallTargetCollision {
  const elapsedSeconds = elapsedMs / 1_000;
  const nextPosition = advancePosition(ball.position, ball.velocity, elapsedSeconds);
  const normal = normalize(wall.normal);
  const startDistance = signedDistanceToWall(ball.position, wall.point, normal);
  const endDistance = signedDistanceToWall(nextPosition, wall.point, normal);

  if (elapsedMs <= 0 || startDistance < 0 || endDistance > 0) {
    return {
      kind: "no-wall-collision",
      targetHit: false,
      position: nextPosition,
      velocity: ball.velocity
    };
  }

  const distanceDelta = startDistance - endDistance;

  if (distanceDelta <= 0) {
    return {
      kind: "no-wall-collision",
      targetHit: false,
      position: nextPosition,
      velocity: ball.velocity
    };
  }

  const collisionRatio = startDistance / distanceDelta;
  const collisionPoint = interpolatePosition(
    ball.position,
    nextPosition,
    collisionRatio
  );
  const velocity = calculateWallRebound({
    velocity: ball.velocity,
    wallNormal: normal,
    restitution
  });
  const remainingSeconds = elapsedSeconds * (1 - collisionRatio);

  return {
    kind: "wall-collision",
    targetHit: containsPoint(target, collisionPoint),
    collisionPoint,
    position: advancePosition(collisionPoint, velocity, remainingSeconds),
    velocity
  };
}

function advancePosition(
  position: Vector2,
  velocity: Vector2,
  elapsedSeconds: number
): Vector2 {
  return {
    x: round(position.x + velocity.x * elapsedSeconds),
    y: round(position.y + velocity.y * elapsedSeconds)
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

function interpolatePosition(
  start: Vector2,
  end: Vector2,
  ratio: number
): Vector2 {
  return {
    x: round(start.x + (end.x - start.x) * ratio),
    y: round(start.y + (end.y - start.y) * ratio)
  };
}

function containsPoint(target: WallTarget, point: Vector2): boolean {
  return (
    Math.abs(point.x - target.center.x) <= target.width / 2 &&
    Math.abs(point.y - target.center.y) <= target.height / 2
  );
}

function normalize(vector: Vector2): Vector2 {
  const length = Math.hypot(vector.x, vector.y);

  if (length === 0) {
    throw new Error("Cannot calculate rebound with a zero-length wall normal");
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

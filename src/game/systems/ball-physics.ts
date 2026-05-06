export interface Vector2 {
  x: number;
  y: number;
}

export interface WallReboundInput {
  velocity: Vector2;
  wallNormal: Vector2;
  restitution: number;
}

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

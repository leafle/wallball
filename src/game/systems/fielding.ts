import type { Vector2 } from "./ball-physics";

export interface Fielder {
  id: string;
  position: Vector2;
  speed: number;
}

export interface FieldingInput {
  axisX: number;
  axisY: number;
}

export interface FieldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MoveFielderInput {
  fielder: Fielder;
  input: FieldingInput;
  elapsedMs: number;
  bounds: FieldBounds;
}

export interface BallSnapshot {
  position: Vector2;
  velocity: Vector2;
}

export interface BallRecoveryInput {
  fielders: Fielder[];
  ball: BallSnapshot;
  recoveryRadius: number;
  maxRecoverySpeed: number;
}

export interface RecoveredBall {
  kind: "recovered";
  fielderId: string;
  distance: number;
}

export interface LooseBall {
  kind: "loose";
  nearestFielderId: string | null;
  distance: number | null;
}

export type BallRecovery = RecoveredBall | LooseBall;

export function moveFielder({
  fielder,
  input,
  elapsedMs,
  bounds
}: MoveFielderInput): Fielder {
  const direction = normalizeInput(input);
  const distance = fielder.speed * (elapsedMs / 1_000);

  return {
    ...fielder,
    position: {
      x: round(
        clamp(fielder.position.x + direction.x * distance, bounds.minX, bounds.maxX)
      ),
      y: round(
        clamp(fielder.position.y + direction.y * distance, bounds.minY, bounds.maxY)
      )
    }
  };
}

export function resolveBallRecovery({
  fielders,
  ball,
  recoveryRadius,
  maxRecoverySpeed
}: BallRecoveryInput): BallRecovery {
  const nearest = findNearestFielder(fielders, ball.position);

  if (!nearest) {
    return {
      kind: "loose",
      nearestFielderId: null,
      distance: null
    };
  }

  if (
    nearest.distance <= recoveryRadius &&
    vectorLength(ball.velocity) <= maxRecoverySpeed
  ) {
    return {
      kind: "recovered",
      fielderId: nearest.fielder.id,
      distance: round(nearest.distance)
    };
  }

  return {
    kind: "loose",
    nearestFielderId: nearest.fielder.id,
    distance: round(nearest.distance)
  };
}

function normalizeInput(input: FieldingInput): Vector2 {
  const length = vectorLength({ x: input.axisX, y: input.axisY });

  if (length === 0) {
    return {
      x: 0,
      y: 0
    };
  }

  const divisor = Math.max(1, length);

  return {
    x: input.axisX / divisor,
    y: input.axisY / divisor
  };
}

function findNearestFielder(
  fielders: Fielder[],
  position: Vector2
): { fielder: Fielder; distance: number } | null {
  return fielders.reduce<{ fielder: Fielder; distance: number } | null>(
    (nearest, fielder) => {
      const distance = vectorDistance(fielder.position, position);

      if (!nearest || distance < nearest.distance) {
        return {
          fielder,
          distance
        };
      }

      return nearest;
    },
    null
  );
}

function vectorDistance(left: Vector2, right: Vector2): number {
  return vectorLength({
    x: left.x - right.x,
    y: left.y - right.y
  });
}

function vectorLength(vector: Vector2): number {
  return Math.hypot(vector.x, vector.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

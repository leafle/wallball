import type { Vector2 } from "./ball-physics";
import {
  calculateBallResult,
  type BallResult,
  type BallResultInput,
  type ContactQuality
} from "./ball-results";

export interface SwingTimingInput {
  pitchStartedAtMs: number;
  swingAtMs: number;
  idealContactMs: number;
}

export interface BattingLaunchInput extends BallResultInput {
  speedScale?: number;
}

export interface BattingLaunch {
  result: BallResult;
  velocity: Vector2;
  speed: number;
}

const MISS_TIMING_MS = 180;
const QUALITY_SPEEDS: Record<ContactQuality, number> = {
  none: 0,
  weak: 320,
  solid: 560,
  perfect: 740
};

export function calculateSwingTimingMs({
  pitchStartedAtMs,
  swingAtMs,
  idealContactMs
}: SwingTimingInput): number {
  return round(swingAtMs - (pitchStartedAtMs + idealContactMs));
}

export function calculateBattingLaunch({
  speedScale = 1,
  ...input
}: BattingLaunchInput): BattingLaunch {
  const result = calculateBallResult(input);
  const speed = round(QUALITY_SPEEDS[result.contactQuality] * speedScale);

  if (speed === 0) {
    return {
      result,
      velocity: {
        x: 0,
        y: 0
      },
      speed
    };
  }

  const timingPull = clamp(input.swingTimingMs / MISS_TIMING_MS, -1, 1) * 0.45;
  const pitchOffset = (input.pitchX - input.targetX) * 0.7;
  const lateral = clamp(timingPull + pitchOffset, -0.75, 0.75);
  const forwardShare = Math.max(0.35, 1 - Math.abs(lateral) * 0.4);

  return {
    result,
    velocity: {
      x: round(lateral * speed),
      y: round(-Math.cos(degreesToRadians(result.launchAngleDegrees)) * speed * forwardShare)
    },
    speed
  };
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

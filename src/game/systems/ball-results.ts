export type BallResultKind = "miss" | "out" | "single" | "double" | "home-run";
export type ContactQuality = "none" | "weak" | "solid" | "perfect";

export interface BallResultInput {
  swingTimingMs: number;
  pitchX: number;
  targetX: number;
  wallTargetHit: boolean;
}

export interface BallResult {
  kind: BallResultKind;
  contactQuality: ContactQuality;
  launchAngleDegrees: number;
}

const MISS_TIMING_MS = 180;
const PERFECT_TIMING_MS = 25;
const SOLID_TIMING_MS = 100;
const CENTERED_PITCH_DISTANCE = 0.1;

export function calculateBallResult({
  swingTimingMs,
  pitchX,
  targetX,
  wallTargetHit
}: BallResultInput): BallResult {
  const timingError = Math.abs(swingTimingMs);
  const pitchDistance = Math.abs(pitchX - targetX);

  if (timingError > MISS_TIMING_MS) {
    return {
      kind: "miss",
      contactQuality: "none",
      launchAngleDegrees: 0
    };
  }

  if (
    timingError <= PERFECT_TIMING_MS &&
    pitchDistance <= CENTERED_PITCH_DISTANCE &&
    wallTargetHit
  ) {
    return {
      kind: "home-run",
      contactQuality: "perfect",
      launchAngleDegrees: 38
    };
  }

  if (timingError <= SOLID_TIMING_MS) {
    return {
      kind: wallTargetHit ? "double" : "single",
      contactQuality: "solid",
      launchAngleDegrees: 24
    };
  }

  return {
    kind: "out",
    contactQuality: "weak",
    launchAngleDegrees: 12
  };
}

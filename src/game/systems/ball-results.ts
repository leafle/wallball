import {
  DEFAULT_GAMEPLAY_TUNING,
  type GameplaySwingTuning
} from "../gameplay-tuning";

export type BallResultKind = "miss" | "out" | "single" | "double" | "home-run";
export type ContactQuality = "none" | "weak" | "solid" | "perfect";

export interface BallResultInput {
  swingTuning?: GameplaySwingTuning;
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

export function calculateBallResult({
  swingTuning = DEFAULT_GAMEPLAY_TUNING.swing,
  swingTimingMs,
  pitchX,
  targetX,
  wallTargetHit
}: BallResultInput): BallResult {
  const timingError = Math.abs(swingTimingMs);
  const pitchDistance = Math.abs(pitchX - targetX);

  if (timingError > swingTuning.missTimingMs) {
    return {
      kind: "miss",
      contactQuality: "none",
      launchAngleDegrees: 0
    };
  }

  if (
    timingError <= swingTuning.perfectTimingMs &&
    pitchDistance <= swingTuning.centeredPitchDistance &&
    wallTargetHit
  ) {
    return {
      kind: "home-run",
      contactQuality: "perfect",
      launchAngleDegrees: 38
    };
  }

  if (timingError <= swingTuning.solidTimingMs) {
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

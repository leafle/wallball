export interface GameplayPitchTuning {
  durationMs: number;
  nextDelayMs: number;
  wallRestitution: number;
  wallTravelMs: number;
}

export interface GameplaySwingTuning {
  centeredPitchDistance: number;
  missTimingMs: number;
  perfectTimingMs: number;
  pullTimingMs: number;
  solidTimingMs: number;
}

export interface GameplayScoringTuning {
  scoreLimit: number;
}

export interface GameplayRecoveryTuning {
  delayMs: number;
  localMaxBallSpeed: number;
  localRadius: number;
  sceneMaxBallSpeed: number;
  sceneRadius: number;
}

export interface GameplayAssistTuning {
  enabled: boolean;
  fieldingRecovery: boolean;
  pitchDelayMs: number;
}

export interface GameplayTuningConfig {
  assist: GameplayAssistTuning;
  pitch: GameplayPitchTuning;
  recovery: GameplayRecoveryTuning;
  scoring: GameplayScoringTuning;
  swing: GameplaySwingTuning;
}

export interface GameplayTuningConfigInput {
  assist?: Partial<GameplayAssistTuning>;
  pitch?: Partial<GameplayPitchTuning>;
  recovery?: Partial<GameplayRecoveryTuning>;
  scoring?: Partial<GameplayScoringTuning>;
  swing?: Partial<GameplaySwingTuning>;
}

export const DEFAULT_GAMEPLAY_TUNING: GameplayTuningConfig = {
  assist: {
    enabled: true,
    fieldingRecovery: true,
    pitchDelayMs: 640
  },
  pitch: {
    durationMs: 180,
    nextDelayMs: 640,
    wallRestitution: 0.75,
    wallTravelMs: 600
  },
  recovery: {
    delayMs: 300,
    localMaxBallSpeed: 8,
    localRadius: 32,
    sceneMaxBallSpeed: 1_000,
    sceneRadius: 600
  },
  scoring: {
    scoreLimit: 3
  },
  swing: {
    centeredPitchDistance: 0.1,
    missTimingMs: 180,
    perfectTimingMs: 25,
    pullTimingMs: 180,
    solidTimingMs: 100
  }
};

export function createGameplayTuningConfig(
  input: GameplayTuningConfigInput = {}
): GameplayTuningConfig {
  const config = {
    assist: {
      ...DEFAULT_GAMEPLAY_TUNING.assist,
      ...input.assist
    },
    pitch: {
      ...DEFAULT_GAMEPLAY_TUNING.pitch,
      ...input.pitch
    },
    recovery: {
      ...DEFAULT_GAMEPLAY_TUNING.recovery,
      ...input.recovery
    },
    scoring: {
      ...DEFAULT_GAMEPLAY_TUNING.scoring,
      ...input.scoring
    },
    swing: {
      ...DEFAULT_GAMEPLAY_TUNING.swing,
      ...input.swing
    }
  };

  validateNonNegative("assist.pitchDelayMs", config.assist.pitchDelayMs);
  validatePositive("pitch.durationMs", config.pitch.durationMs);
  validatePositive("pitch.nextDelayMs", config.pitch.nextDelayMs);
  validatePositive("pitch.wallTravelMs", config.pitch.wallTravelMs);
  validatePositive("pitch.wallRestitution", config.pitch.wallRestitution);
  validatePositive("recovery.delayMs", config.recovery.delayMs);
  validatePositive("recovery.localMaxBallSpeed", config.recovery.localMaxBallSpeed);
  validatePositive("recovery.localRadius", config.recovery.localRadius);
  validatePositive("recovery.sceneMaxBallSpeed", config.recovery.sceneMaxBallSpeed);
  validatePositive("recovery.sceneRadius", config.recovery.sceneRadius);
  validatePositive("scoring.scoreLimit", config.scoring.scoreLimit);
  validatePositive("swing.missTimingMs", config.swing.missTimingMs);
  validatePositive("swing.perfectTimingMs", config.swing.perfectTimingMs);
  validatePositive("swing.pullTimingMs", config.swing.pullTimingMs);
  validatePositive("swing.solidTimingMs", config.swing.solidTimingMs);
  validateNonNegative(
    "swing.centeredPitchDistance",
    config.swing.centeredPitchDistance
  );

  return config;
}

function validatePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Expected ${name} to be positive`);
  }
}

function validateNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Expected ${name} to be non-negative`);
  }
}

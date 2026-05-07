import type Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "./dimensions";
import type { GameplayPreferences } from "./preferences";
import {
  WALLBALL_PLAY_SCENE_CONFIG,
  createWallballPlaySceneConfig
} from "./scenes/play-scene";

export { GAME_HEIGHT, GAME_WIDTH } from "./dimensions";
export {
  DEFAULT_GAMEPLAY_TUNING,
  createGameplayTuningConfig,
  type GameplayAssistTuning,
  type GameplayPitchTuning,
  type GameplayRecoveryTuning,
  type GameplayScoringTuning,
  type GameplaySwingTuning,
  type GameplayTuningConfig,
  type GameplayTuningConfigInput
} from "./gameplay-tuning";

// Keep this module deterministic under Vitest's Node environment; Phaser's
// runtime import expects browser globals before the game shell exists.
const PHASER_AUTO_RENDERER = 0;
const PHASER_SCALE_FIT = 3;
const PHASER_SCALE_CENTER_BOTH = 1;

export interface BaseGameConfigOptions {
  gameplayPreferences?: GameplayPreferences;
}

export function createBaseGameConfig(
  options: BaseGameConfigOptions = {}
): Phaser.Types.Core.GameConfig {
  return {
    type: PHASER_AUTO_RENDERER,
    parent: "game",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#101820",
    scene: [
      options.gameplayPreferences
        ? createWallballPlaySceneConfig({
            preferences: options.gameplayPreferences
          })
        : WALLBALL_PLAY_SCENE_CONFIG
    ],
    scale: {
      mode: PHASER_SCALE_FIT,
      autoCenter: PHASER_SCALE_CENTER_BOTH
    }
  };
}

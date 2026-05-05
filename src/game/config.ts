import type Phaser from "phaser";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Keep this module deterministic under Vitest's Node environment; Phaser's
// runtime import expects browser globals before the game shell exists.
const PHASER_AUTO_RENDERER = 0;
const PHASER_SCALE_FIT = 3;
const PHASER_SCALE_CENTER_BOTH = 1;

export function createBaseGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: PHASER_AUTO_RENDERER,
    parent: "game",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#101820",
    scene: [],
    scale: {
      mode: PHASER_SCALE_FIT,
      autoCenter: PHASER_SCALE_CENTER_BOTH
    }
  };
}

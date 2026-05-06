import type Phaser from "phaser";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const BOOT_SCENE_KEY = "boot";

// Keep this module deterministic under Vitest's Node environment; Phaser's
// runtime import expects browser globals before the game shell exists.
const PHASER_AUTO_RENDERER = 0;
const PHASER_SCALE_FIT = 3;
const PHASER_SCALE_CENTER_BOTH = 1;

interface SceneObject {
  setOrigin?: (x: number, y?: number) => SceneObject;
  setStrokeStyle?: (
    lineWidth: number,
    color: number,
    alpha?: number
  ) => SceneObject;
}

interface BootSceneContext {
  add: {
    rectangle: (
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
      alpha?: number
    ) => SceneObject;
    text: (
      x: number,
      y: number,
      text: string,
      style: Record<string, string>
    ) => SceneObject;
  };
}

export const BOOT_SCENE_CONFIG = {
  key: BOOT_SCENE_KEY,
  create: createBootScene
};

export function createBaseGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: PHASER_AUTO_RENDERER,
    parent: "game",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#101820",
    scene: [BOOT_SCENE_CONFIG],
    scale: {
      mode: PHASER_SCALE_FIT,
      autoCenter: PHASER_SCALE_CENTER_BOTH
    }
  };
}

function createBootScene(this: BootSceneContext): void {
  this.add.rectangle(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2,
    GAME_WIDTH,
    GAME_HEIGHT,
    0x101820
  );
  this.add.rectangle(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2,
    GAME_WIDTH - 96,
    GAME_HEIGHT - 96,
    0x1f2d28,
    0.96
  ).setStrokeStyle?.(4, 0x4cb7a5, 0.75);
  this.add.text(GAME_WIDTH / 2, 258, "Wallball", {
    color: "#fffaf0",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "54px",
    fontStyle: "bold"
  }).setOrigin?.(0.5);
  this.add.text(GAME_WIDTH / 2, 328, "Phaser shell ready", {
    color: "#f5c84b",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "30px"
  }).setOrigin?.(0.5);
  this.add.text(GAME_WIDTH / 2, 386, "1280 x 720 responsive canvas", {
    color: "#d8d1c0",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "22px"
  }).setOrigin?.(0.5);
}

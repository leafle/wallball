import { describe, expect, it } from "vitest";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  createBaseGameConfig
} from "./config";
import {
  WALLBALL_PLAY_SCENE_CONFIG,
  WALLBALL_PLAY_SCENE_KEY
} from "./scenes/play-scene";

describe("createBaseGameConfig", () => {
  it("uses the fixed 1280 by 720 logical resolution from the design", () => {
    expect(GAME_WIDTH).toBe(1280);
    expect(GAME_HEIGHT).toBe(720);

    const config = createBaseGameConfig();

    expect(config.width).toBe(GAME_WIDTH);
    expect(config.height).toBe(GAME_HEIGHT);
  });

  it("sets up the Phaser host with responsive scaling", () => {
    expect(createBaseGameConfig()).toMatchObject({
      parent: "game",
      backgroundColor: "#101820",
      type: 0,
      scale: {
        mode: 3,
        autoCenter: 1
      }
    });
  });

  it("registers the visible Wallball play scene for the canvas smoke test", () => {
    const config = createBaseGameConfig();

    expect(config.scene).toEqual([WALLBALL_PLAY_SCENE_CONFIG]);
    expect(WALLBALL_PLAY_SCENE_CONFIG.key).toBe(WALLBALL_PLAY_SCENE_KEY);
  });
});

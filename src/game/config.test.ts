import { describe, expect, it } from "vitest";

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  createBaseGameConfig
} from "./config";

describe("createBaseGameConfig", () => {
  it("uses the fixed 1280 by 720 logical resolution from the design", () => {
    expect(GAME_WIDTH).toBe(1280);
    expect(GAME_HEIGHT).toBe(720);

    const config = createBaseGameConfig();

    expect(config.width).toBe(GAME_WIDTH);
    expect(config.height).toBe(GAME_HEIGHT);
  });

  it("sets up the Phaser host without instantiating the game shell yet", () => {
    expect(createBaseGameConfig()).toMatchObject({
      parent: "game",
      backgroundColor: "#101820",
      type: 0,
      scene: [],
      scale: {
        mode: 3,
        autoCenter: 1
      }
    });
  });
});

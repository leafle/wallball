import { describe, expect, it } from "vitest";

import {
  DEFAULT_GAMEPLAY_TUNING,
  GAME_HEIGHT,
  GAME_WIDTH,
  createGameplayTuningConfig,
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

  it("exposes typed gameplay tuning defaults and nested overrides", () => {
    expect(DEFAULT_GAMEPLAY_TUNING).toMatchObject({
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
    });

    expect(
      createGameplayTuningConfig({
        assist: {
          pitchDelayMs: 125
        },
        pitch: {
          durationMs: 240
        },
        scoring: {
          scoreLimit: 2
        }
      })
    ).toMatchObject({
      assist: {
        enabled: true,
        fieldingRecovery: true,
        pitchDelayMs: 125
      },
      pitch: {
        durationMs: 240,
        nextDelayMs: 640
      },
      scoring: {
        scoreLimit: 2
      }
    });
  });
});

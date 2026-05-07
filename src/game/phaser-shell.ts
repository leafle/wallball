import type Phaser from "phaser";

import { createBaseGameConfig } from "./config";
import type { GameplayControlIntent } from "./input/game-controls";
import type { GameplayPreferences } from "./preferences";
import {
  dispatchWallballPlaySceneControlIntent,
  WALLBALL_PLAY_SCENE_KEY,
  updateWallballPlayScenePreferences
} from "./scenes/play-scene";

type WallballPlaySceneControlTarget = ThisParameterType<
  typeof dispatchWallballPlaySceneControlIntent
>;

export interface PhaserGameLike {
  destroy(removeCanvas?: boolean): void;
  scene?: {
    get?: (key: string) => unknown;
    getScene?: (key: string) => unknown;
  };
}

export interface PhaserRuntime {
  Game: new (config: Phaser.Types.Core.GameConfig) => PhaserGameLike;
}

export interface MountedPhaserGameShell {
  dispatchControlIntent: (
    intent: GameplayControlIntent,
    timeMs?: number
  ) => void;
  destroy: () => void;
  game: PhaserGameLike;
  setGameplayPreferences: (preferences: GameplayPreferences) => void;
}

type LoadPhaserRuntime = () => Promise<PhaserRuntime>;

export interface MountPhaserGameShellOptions {
  preferences?: GameplayPreferences;
}

export async function mountPhaserGameShell(
  optionsOrLoadRuntime: MountPhaserGameShellOptions | LoadPhaserRuntime = {},
  fallbackLoadRuntime: LoadPhaserRuntime = loadPhaserRuntime
): Promise<MountedPhaserGameShell> {
  const options =
    typeof optionsOrLoadRuntime === "function" ? {} : optionsOrLoadRuntime;
  const loadRuntime =
    typeof optionsOrLoadRuntime === "function"
      ? optionsOrLoadRuntime
      : fallbackLoadRuntime;
  const runtime = await loadRuntime();
  const game = new runtime.Game(
    createBaseGameConfig({
      gameplayPreferences: options.preferences
    })
  );

  return {
    dispatchControlIntent: (intent, timeMs = currentTimeMs()) => {
      const scene = getWallballPlayScene(game);

      if (scene && typeof scene === "object") {
        dispatchWallballPlaySceneControlIntent.call(
          scene as WallballPlaySceneControlTarget,
          intent,
          timeMs
        );
      }
    },
    destroy: () => {
      game.destroy(true);
    },
    game,
    setGameplayPreferences: (preferences) => {
      const scene = getWallballPlayScene(game);

      if (scene && typeof scene === "object") {
        updateWallballPlayScenePreferences.call(
          scene as WallballPlaySceneControlTarget,
          preferences
        );
      }
    }
  };
}

function getWallballPlayScene(game: PhaserGameLike): unknown {
  const sceneManager = game.scene;

  if (typeof sceneManager?.getScene === "function") {
    return sceneManager.getScene(WALLBALL_PLAY_SCENE_KEY);
  }

  if (typeof sceneManager?.get === "function") {
    return sceneManager.get(WALLBALL_PLAY_SCENE_KEY);
  }

  return null;
}

async function loadPhaserRuntime(): Promise<PhaserRuntime> {
  const runtime = await import("phaser");
  const maybeDefault = runtime.default as unknown;

  if (hasGameConstructor(runtime)) {
    return runtime;
  }

  if (hasGameConstructor(maybeDefault)) {
    return maybeDefault;
  }

  throw new Error("Phaser runtime did not expose Game");
}

function currentTimeMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function hasGameConstructor(value: unknown): value is PhaserRuntime {
  return (
    typeof value === "object" &&
    value !== null &&
    "Game" in value &&
    typeof value.Game === "function"
  );
}

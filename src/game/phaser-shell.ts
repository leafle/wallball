import type Phaser from "phaser";

import { createBaseGameConfig } from "./config";

export interface PhaserGameLike {
  destroy(removeCanvas?: boolean): void;
}

export interface PhaserRuntime {
  Game: new (config: Phaser.Types.Core.GameConfig) => PhaserGameLike;
}

export interface MountedPhaserGameShell {
  destroy: () => void;
  game: PhaserGameLike;
}

type LoadPhaserRuntime = () => Promise<PhaserRuntime>;

export async function mountPhaserGameShell(
  loadRuntime: LoadPhaserRuntime = loadPhaserRuntime
): Promise<MountedPhaserGameShell> {
  const runtime = await loadRuntime();
  const game = new runtime.Game(createBaseGameConfig());

  return {
    destroy: () => {
      game.destroy(true);
    },
    game
  };
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

function hasGameConstructor(value: unknown): value is PhaserRuntime {
  return (
    typeof value === "object" &&
    value !== null &&
    "Game" in value &&
    typeof value.Game === "function"
  );
}

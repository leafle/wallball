import { describe, expect, it } from "vitest";

import { createBaseGameConfig } from "./config";
import { mountPhaserGameShell } from "./phaser-shell";

describe("mountPhaserGameShell", () => {
  it("constructs a Phaser game with the base shell config", async () => {
    const createdConfigs: unknown[] = [];
    class FakeGame {
      constructor(config: unknown) {
        createdConfigs.push(config);
      }

      destroy(): void {
        // no-op fake
      }
    }

    await mountPhaserGameShell(async () => ({
      Game: FakeGame
    }));

    expect(createdConfigs).toEqual([createBaseGameConfig()]);
  });

  it("returns a cleanup function that destroys the game instance", async () => {
    let destroyCalls = 0;
    class FakeGame {
      destroy(removeCanvas: boolean): void {
        if (removeCanvas) {
          destroyCalls += 1;
        }
      }
    }

    const mounted = await mountPhaserGameShell(async () => ({
      Game: FakeGame
    }));

    mounted.destroy();

    expect(destroyCalls).toBe(1);
  });
});

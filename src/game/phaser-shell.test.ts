import { describe, expect, it } from "vitest";

import { createBaseGameConfig } from "./config";
import { mountPhaserGameShell } from "./phaser-shell";
import { createWallballPlayScene } from "./scenes/play-scene";

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

  it("returns a dispatcher for gameplay controls on the play scene", async () => {
    let requestedSceneKey = "";
    const scene = createFakeSceneContext();
    createWallballPlayScene.call(scene);
    class FakeGame {
      scene = {
        get: (key: string) => {
          requestedSceneKey = key;

          return scene;
        }
      };

      destroy(): void {
        // no-op fake
      }
    }

    const mounted = await mountPhaserGameShell(async () => ({
      Game: FakeGame
    }));

    mounted.dispatchControlIntent(
      {
        kind: "pitch",
        source: "keyboard"
      },
      1_000
    );

    expect(requestedSceneKey).toBe("wallball-play");
    expect(scene.wallballPlay?.adapter.loop.phase.kind).toBe("pitch-in-flight");
  });

  it("dispatches through Phaser scene managers that expose getScene", async () => {
    let requestedSceneKey = "";
    const scene = createFakeSceneContext();
    createWallballPlayScene.call(scene);
    class FakeGame {
      scene = {
        getScene: (key: string) => {
          requestedSceneKey = key;

          return scene;
        }
      };

      destroy(): void {
        // no-op fake
      }
    }

    const mounted = await mountPhaserGameShell(async () => ({
      Game: FakeGame
    }));

    mounted.dispatchControlIntent(
      {
        kind: "pitch",
        source: "keyboard"
      },
      1_000
    );

    expect(requestedSceneKey).toBe("wallball-play");
    expect(scene.wallballPlay?.adapter.loop.phase.kind).toBe("pitch-in-flight");
  });
});

function createFakeSceneContext(): ThisParameterType<
  typeof createWallballPlayScene
> {
  const sceneObject: SceneObject = {
    setOrigin: () => sceneObject,
    setPosition: () => sceneObject,
    setRotation: () => sceneObject,
    setStrokeStyle: () => sceneObject,
    setText: () => sceneObject
  };

  return {
    add: {
      circle: () => sceneObject,
      rectangle: () => sceneObject,
      text: () => sceneObject
    }
  };
}

interface SceneObject {
  setOrigin: () => SceneObject;
  setPosition: () => SceneObject;
  setRotation: () => SceneObject;
  setStrokeStyle: () => SceneObject;
  setText: () => SceneObject;
}

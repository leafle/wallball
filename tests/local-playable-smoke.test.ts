import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  mountPhaserGameShell,
  type PhaserRuntime
} from "../src/game/phaser-shell";
import {
  createWallballPlayScene,
  updateWallballPlayScene,
  WALLBALL_PLAY_SCENE_KEY,
  WALLBALL_PLAY_SCENE_PROJECTION_EVENT,
  type WallballPlaySceneProjectionEventDetail
} from "../src/game/scenes/play-scene";

type FakePlaySceneRuntime = NonNullable<FakeSceneContext["wallballPlay"]>;

interface DrawCall {
  kind: "circle" | "rectangle" | "text";
  height?: number;
  onPointerDown?: () => void;
  radius?: number;
  text?: string;
  width?: number;
  x?: number;
  y?: number;
}

interface FakeSceneObject {
  on: (event: string, callback: () => void) => FakeSceneObject;
  setPosition: (x: number, y: number) => FakeSceneObject;
  setInteractive: () => FakeSceneObject;
  setOrigin: () => FakeSceneObject;
  setRotation: () => FakeSceneObject;
  setStrokeStyle: () => FakeSceneObject;
  setText: (text: string) => FakeSceneObject;
}

interface FakeSceneContext {
  add: {
    circle: (
      x: number,
      y: number,
      radius: number,
      color: number,
      alpha?: number
    ) => FakeSceneObject;
    rectangle: (
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
      alpha?: number
    ) => FakeSceneObject;
    text: (
      x: number,
      y: number,
      text: string,
      style: Record<string, string>
    ) => FakeSceneObject;
  };
  wallballPlay?: FakePlaySceneRuntime;
  wallballProjectionTarget?: Pick<EventTarget, "dispatchEvent">;
}

describe("local playable smoke command", () => {
  it("is exposed as a documented local smoke script", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { scripts: Record<string, string> };
    const devSetup = readFileSync(
      new URL("../docs/dev-setup.md", import.meta.url),
      "utf8"
    );

    expect(packageJson.scripts["smoke:local"]).toBe(
      "vitest run tests/local-playable-smoke.test.ts"
    );
    expect(devSetup).toContain("npm run smoke:local");
    expect(devSetup).toContain("does not require remote multiplayer or Dolt");
  });

  it("starts local play, drives controls, shows score, and reports no console errors", async () => {
    const calls: DrawCall[] = [];
    const projections: WallballPlaySceneProjectionEventDetail[] = [];
    const scene = createFakeSceneContext(calls, projections);
    const fakeRuntime = createFakePhaserRuntime(scene);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const mounted = await mountPhaserGameShell(async () => fakeRuntime.runtime);

      mounted.dispatchControlIntent(
        {
          kind: "pitch",
          source: "keyboard"
        },
        1_000
      );
      mounted.dispatchControlIntent(
        {
          kind: "swing",
          source: "keyboard"
        },
        1_180
      );
      mounted.dispatchControlIntent(
        {
          axisX: 1,
          axisY: 0,
          kind: "fielder-move",
          source: "keyboard"
        },
        1_250
      );
      mounted.dispatchControlIntent(
        {
          axisX: 0,
          axisY: 0,
          kind: "fielder-move",
          source: "keyboard"
        },
        1_280
      );

      updateWallballPlayScene.call(scene, 1_500, 0);

      expect(projections.at(-1)).toMatchObject({
        loop: {
          phase: {
            kind: "ready-for-at-bat"
          }
        },
        projection: {
          hud: {
            awayScore: 1,
            batterName: "Minkus",
            homeScore: 0
          },
          lastResult: "home-run"
        }
      });
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "text", text: "Champions 1" }),
          expect.objectContaining({ kind: "text", text: "Woodland 0" }),
          expect.objectContaining({ kind: "text", text: "1 run scored" }),
          expect.objectContaining({ kind: "text", text: "Ball recovered" })
        ])
      );
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();

      mounted.destroy();

      expect(fakeRuntime.destroyCalls()).toBe(1);
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  });
});

function createFakeSceneContext(
  calls: DrawCall[],
  projections: WallballPlaySceneProjectionEventDetail[]
): FakeSceneContext {
  const sceneObject: FakeSceneObject = {
    on: () => sceneObject,
    setPosition: () => sceneObject,
    setInteractive: () => sceneObject,
    setOrigin: () => sceneObject,
    setRotation: () => sceneObject,
    setStrokeStyle: () => sceneObject,
    setText: () => sceneObject
  };

  return {
    add: {
      circle: (x, y, radius) => {
        calls.push({ kind: "circle", radius, x, y });

        return sceneObject;
      },
      rectangle: (x, y, width, height) => {
        calls.push({ height, kind: "rectangle", width, x, y });

        return sceneObject;
      },
      text: (x, y, text) => {
        const call: DrawCall = { kind: "text", text, x, y };
        const textObject: FakeSceneObject = {
          ...sceneObject,
          on: (event, callback) => {
            if (event === "pointerdown") {
              call.onPointerDown = callback;
            }

            return textObject;
          },
          setInteractive: () => textObject,
          setText: (nextText) => {
            call.text = nextText;

            return textObject;
          }
        };

        calls.push(call);

        return textObject;
      }
    },
    wallballProjectionTarget: {
      dispatchEvent: (event) => {
        if (event.type === WALLBALL_PLAY_SCENE_PROJECTION_EVENT) {
          projections.push(
            (event as CustomEvent<WallballPlaySceneProjectionEventDetail>).detail
          );
        }

        return true;
      }
    }
  };
}

function createFakePhaserRuntime(scene: FakeSceneContext): {
  destroyCalls: () => number;
  runtime: PhaserRuntime;
} {
  let destroyCount = 0;

  class FakeGame {
    scene = {
      getScene: (key: string) =>
        key === WALLBALL_PLAY_SCENE_KEY ? scene : null
    };

    constructor() {
      createWallballPlayScene.call(scene);
    }

    destroy(removeCanvas?: boolean): void {
      if (removeCanvas) {
        destroyCount += 1;
      }
    }
  }

  return {
    destroyCalls: () => destroyCount,
    runtime: {
      Game: FakeGame
    }
  };
}

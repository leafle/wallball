import { describe, expect, it } from "vitest";

import {
  createWallballPlayScene,
  dispatchWallballPlaySceneControlIntent,
  updateWallballPlayScene
} from "./play-scene";

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
}

describe("createWallballPlayScene", () => {
  it("draws the play view and compact HUD without a real browser canvas", () => {
    const calls: DrawCall[] = [];

    createWallballPlayScene.call(createFakeSceneContext(calls));

    expect(
      calls.filter((call) => call.kind === "rectangle").length
    ).toBeGreaterThanOrEqual(8);
    expect(
      calls.filter((call) => call.kind === "circle").length
    ).toBeGreaterThanOrEqual(5);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          height: 80,
          kind: "rectangle",
          width: 80,
          x: 520,
          y: 120
        }),
        expect.objectContaining({
          kind: "circle",
          radius: 12,
          x: 520,
          y: 360
        }),
        expect.objectContaining({ kind: "text", text: "Inning 1" }),
        expect.objectContaining({ kind: "text", text: "Champions 0" }),
        expect.objectContaining({ kind: "text", text: "Woodland 0" }),
        expect.objectContaining({ kind: "text", text: "Outs 0" }),
        expect.objectContaining({ kind: "text", text: "Batter Cainer" }),
        expect.objectContaining({ kind: "text", text: "Danny vs Cainer" })
      ])
    );
  });

  it("dispatches gameplay controls into the local loop and refreshes the HUD", () => {
    const calls: DrawCall[] = [];
    const scene = createFakeSceneContext(calls);

    createWallballPlayScene.call(scene);
    dispatchWallballPlaySceneControlIntent.call(
      scene,
      {
        kind: "pitch",
        source: "keyboard"
      },
      1_000
    );
    dispatchWallballPlaySceneControlIntent.call(
      scene,
      {
        kind: "swing",
        source: "keyboard"
      },
      1_180
    );
    updateWallballPlayScene.call(scene, 1_500, 0);

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "text", text: "Champions 1" }),
        expect.objectContaining({ kind: "text", text: "Woodland 0" }),
        expect.objectContaining({ kind: "text", text: "Batter Minkus" }),
        expect.objectContaining({ kind: "text", text: "Danny vs Minkus" })
      ])
    );
  });

  it("draws local setup controls and restarts with selected teams", () => {
    const calls: DrawCall[] = [];
    const scene = createFakeSceneContext(calls);

    createWallballPlayScene.call(scene);
    triggerText(calls, "Away Champions");
    triggerText(calls, "Home Woodland");
    triggerText(calls, "Start / Restart");

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "text", text: "Away Woodland" }),
        expect.objectContaining({ kind: "text", text: "Home Team Cainer" }),
        expect.objectContaining({ kind: "text", text: "Woodland 0" }),
        expect.objectContaining({ kind: "text", text: "Team Cainer 0" }),
        expect.objectContaining({ kind: "text", text: "Batter Al" }),
        expect.objectContaining({ kind: "text", text: "JSack vs Al" })
      ])
    );
  });
});

function createFakeSceneContext(calls: DrawCall[]): FakeSceneContext {
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
      text: (_x, _y, text) => {
        const call: DrawCall = { kind: "text", text };
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
    }
  };
}

function triggerText(calls: DrawCall[], text: string): void {
  const call = calls.find((candidate) => candidate.text === text);

  if (!call?.onPointerDown) {
    throw new Error(`Missing pointer handler for ${text}`);
  }

  call.onPointerDown();
}

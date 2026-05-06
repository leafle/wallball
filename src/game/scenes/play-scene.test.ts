import { describe, expect, it } from "vitest";

import {
  createWallballPlayScene,
  updateWallballPlayScene
} from "./play-scene";

interface DrawCall {
  kind: "circle" | "rectangle" | "text";
  height?: number;
  radius?: number;
  text?: string;
  width?: number;
  x?: number;
  y?: number;
}

interface FakeSceneObject {
  setPosition: (x: number, y: number) => FakeSceneObject;
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

  it("advances the deterministic loop on update and refreshes the HUD", () => {
    const calls: DrawCall[] = [];
    const scene = createFakeSceneContext(calls);

    createWallballPlayScene.call(scene);
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
});

function createFakeSceneContext(calls: DrawCall[]): FakeSceneContext {
  const sceneObject: FakeSceneObject = {
    setPosition: () => sceneObject,
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

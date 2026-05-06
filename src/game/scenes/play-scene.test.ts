import { describe, expect, it } from "vitest";

import { createWallballPlayScene } from "./play-scene";

interface DrawCall {
  kind: "circle" | "rectangle" | "text";
  text?: string;
}

interface FakeSceneObject {
  setOrigin: () => FakeSceneObject;
  setRotation: () => FakeSceneObject;
  setStrokeStyle: () => FakeSceneObject;
}

interface FakeSceneContext {
  add: {
    circle: () => FakeSceneObject;
    rectangle: () => FakeSceneObject;
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
        expect.objectContaining({ kind: "text", text: "Inning 1" }),
        expect.objectContaining({ kind: "text", text: "Champions 0" }),
        expect.objectContaining({ kind: "text", text: "Woodland 0" }),
        expect.objectContaining({ kind: "text", text: "Outs 0" }),
        expect.objectContaining({ kind: "text", text: "Batter Cainer" }),
        expect.objectContaining({ kind: "text", text: "Danny vs Cainer" })
      ])
    );
  });
});

function createFakeSceneContext(calls: DrawCall[]): FakeSceneContext {
  const sceneObject: FakeSceneObject = {
    setOrigin: () => sceneObject,
    setRotation: () => sceneObject,
    setStrokeStyle: () => sceneObject
  };

  return {
    add: {
      circle: () => {
        calls.push({ kind: "circle" });

        return sceneObject;
      },
      rectangle: () => {
        calls.push({ kind: "rectangle" });

        return sceneObject;
      },
      text: (_x, _y, text) => {
        calls.push({ kind: "text", text });

        return sceneObject;
      }
    }
  };
}

import { describe, expect, it } from "vitest";

import {
  createWallballPlayScene,
  dispatchWallballPlaySceneControlIntent,
  WALLBALL_PLAY_SCENE_PROJECTION_EVENT,
  updateWallballPlayScenePreferences,
  type WallballPlaySceneProjectionEventDetail,
  updateWallballPlayScene
} from "./play-scene";
import { DEFAULT_GAMEPLAY_PREFERENCES } from "../preferences";
import type {
  LocalMatchAudioCue,
  LocalMatchAudioCueOutput
} from "../systems/local-match-audio";

type FakePlaySceneRuntime = NonNullable<
  ThisParameterType<typeof createWallballPlayScene>["wallballPlay"]
>;

interface DrawCall {
  alpha?: number;
  color?: number;
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
        expect.objectContaining({ kind: "text", text: "Danny vs Cainer" }),
        expect.objectContaining({ kind: "text", text: "Pause" }),
        expect.objectContaining({ kind: "text", text: "Restart" })
      ])
    );
  });

  it("uses the documented wall-facing playfield palette", () => {
    const calls: DrawCall[] = [];

    createWallballPlayScene.call(createFakeSceneContext(calls));

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: 0x38b94a,
          height: 524,
          kind: "rectangle",
          width: 1184,
          x: 640,
          y: 418
        }),
        expect.objectContaining({
          color: 0x7b3f2a,
          height: 180,
          kind: "rectangle",
          width: 910,
          x: 640,
          y: 146
        }),
        expect.objectContaining({
          color: 0x8f938a,
          height: 330,
          kind: "rectangle",
          width: 440,
          x: 640,
          y: 482
        }),
        expect.objectContaining({
          color: 0x9a755b,
          height: 38,
          kind: "rectangle",
          width: 132,
          x: 640,
          y: 598
        })
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

  it("emits typed projection snapshots for the post-match panel", () => {
    const calls: DrawCall[] = [];
    const projectionEvents: WallballPlaySceneProjectionEventDetail[] = [];
    const scene = createFakeSceneContext(calls);
    scene.wallballProjectionTarget = {
      dispatchEvent: (event) => {
        if (event.type === WALLBALL_PLAY_SCENE_PROJECTION_EVENT) {
          projectionEvents.push(
            (event as CustomEvent<WallballPlaySceneProjectionEventDetail>).detail
          );
        }

        return true;
      }
    };

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

    expect(projectionEvents.at(-1)).toMatchObject({
      loop: {
        phase: {
          kind: "ready-for-at-bat"
        }
      },
      projection: {
        hud: {
          awayScore: 1,
          batterName: "Minkus"
        }
      }
    });
  });

  it("renders friend matchup callouts below essential score and batter text", () => {
    const calls: DrawCall[] = [];
    const scene = createFakeSceneContext(calls);

    createWallballPlayScene.call(scene);
    scorePlateAppearance(scene, 1_000);
    scorePlateAppearance(scene, 2_000);

    const callout = calls.find(
      (call) =>
        call.kind === "text" &&
        call.text === "Brandon digs in while Danny works fast."
    );

    expect(callout).toEqual(
      expect.objectContaining({
        kind: "text",
        text: "Brandon digs in while Danny works fast.",
        x: 52,
        y: 122
      })
    );
    expect(callout?.y).toBeGreaterThan(
      Math.max(
        yForText(calls, "Champions 2"),
        yForText(calls, "Woodland 0"),
        yForText(calls, "Batter Brandon"),
        yForText(calls, "Danny vs Brandon")
      )
    );
  });

  it("renders gameplay feedback without covering the critical HUD or target", () => {
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

    expect(textCall(calls, "Pitch in flight")).toEqual(
      expect.objectContaining({
        x: 52,
        y: 622
      })
    );

    dispatchWallballPlaySceneControlIntent.call(
      scene,
      {
        kind: "swing",
        source: "keyboard"
      },
      1_180
    );

    expect(textCall(calls, "Swing: perfect contact")).toEqual(
      expect.objectContaining({
        x: 52,
        y: 622
      })
    );
    expect(textCall(calls, "Recover the ball")).toEqual(
      expect.objectContaining({
        x: 52,
        y: 650
      })
    );
    expect(textCall(calls, "Target hit")).toEqual(
      expect.objectContaining({
        x: 584,
        y: 202
      })
    );
    expect(textCall(calls, "Target hit").x).toBeGreaterThan(560);

    updateWallballPlayScene.call(scene, 1_500, 0);

    expect(textCall(calls, "1 run scored")).toEqual(
      expect.objectContaining({
        x: 52,
        y: 622
      })
    );
    expect(textCall(calls, "Ball recovered")).toEqual(
      expect.objectContaining({
        x: 52,
        y: 650
      })
    );
    expect(textCall(calls, "1 run scored").y).toBeGreaterThan(
      Math.max(
        yForText(calls, "Champions 1"),
        yForText(calls, "Woodland 0"),
        yForText(calls, "Batter Minkus"),
        yForText(calls, "Danny vs Minkus")
      )
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

  it("applies local preferences to setup, solo assist, and reduced feedback rendering", () => {
    const calls: DrawCall[] = [];
    const scene = createFakeSceneContext(calls);

    createWallballPlayScene.call(scene, {
      preferences: {
        ...DEFAULT_GAMEPLAY_PREFERENCES,
        preferredMatchup: {
          awayTeamId: "ej",
          homeTeamId: "team-cainer"
        },
        reducedFeedbackIntensity: true,
        soloAssistEnabled: false
      }
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "text", text: "Away EJ" }),
        expect.objectContaining({ kind: "text", text: "Home Team Cainer" }),
        expect.objectContaining({ kind: "text", text: "EJ 0" }),
        expect.objectContaining({ kind: "text", text: "Team Cainer 0" })
      ])
    );
    expect(scene.wallballPlay?.adapter.soloAssist.enabled).toBe(false);

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

    expect(textCall(calls, "Swing: perfect contact")).toEqual(
      expect.objectContaining({
        x: 52,
        y: 622
      })
    );
    expect(calls.some((call) => call.text === "Recover the ball")).toBe(false);
    expect(calls.some((call) => call.text === "Target hit")).toBe(false);
  });

  it("plays local audio cues only after user controls unlock audio", () => {
    const calls: DrawCall[] = [];
    const audioOutput = createRecordingAudioOutput();
    const scene = createFakeSceneContext(calls);

    createWallballPlayScene.call(scene, {
      audioOutput
    });
    updateWallballPlayScene.call(scene, 10_000, 0);

    expect(audioOutput.played).toEqual([]);

    dispatchWallballPlaySceneControlIntent.call(
      scene,
      {
        kind: "swing",
        source: "keyboard"
      },
      10_180
    );

    expect(audioOutput.played.map((entry) => entry.cue.kind)).toEqual([
      "swing",
      "contact",
      "wall-hit"
    ]);
  });

  it("keeps muted audio silent without replaying stale cues after unmute", () => {
    const calls: DrawCall[] = [];
    const audioOutput = createRecordingAudioOutput();
    const scene = createFakeSceneContext(calls);

    createWallballPlayScene.call(scene, {
      audioOutput,
      preferences: {
        ...DEFAULT_GAMEPLAY_PREFERENCES,
        audioMuted: true,
        soloAssistEnabled: false
      }
    });
    dispatchWallballPlaySceneControlIntent.call(
      scene,
      {
        kind: "pitch",
        source: "keyboard"
      },
      1_000
    );
    updateWallballPlayScenePreferences.call(scene, {
      ...DEFAULT_GAMEPLAY_PREFERENCES,
      audioMuted: false,
      reducedFeedbackIntensity: true,
      soloAssistEnabled: false
    });
    dispatchWallballPlaySceneControlIntent.call(
      scene,
      {
        kind: "swing",
        source: "keyboard"
      },
      1_180
    );

    expect(audioOutput.played).toEqual([
      {
        cue: {
          kind: "swing",
          sequence: 2
        },
        reducedIntensity: true
      },
      {
        cue: {
          kind: "contact",
          sequence: 3
        },
        reducedIntensity: true
      },
      {
        cue: {
          kind: "wall-hit",
          sequence: 4
        },
        reducedIntensity: true
      }
    ]);
  });

  it("toggles pause state and quick restarts through local scene controls", () => {
    const calls: DrawCall[] = [];
    const scene = createFakeSceneContext(calls);

    createWallballPlayScene.call(scene);
    dispatchWallballPlaySceneControlIntent.call(
      scene,
      {
        kind: "pause-toggle",
        source: "keyboard"
      },
      100
    );
    updateWallballPlayScene.call(scene, 2_000, 0);

    expect(scene.wallballPlay?.adapter.runState.kind).toBe("paused");
    expect(scene.wallballPlay?.adapter.loop.phase.kind).toBe("ready-for-at-bat");
    expect(calls).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: "Resume" })])
    );

    triggerText(calls, "Restart");

    expect(scene.wallballPlay?.adapter.runState.kind).toBe("running");
    expect(scene.wallballPlay?.adapter.loop.phase.kind).toBe("ready-for-at-bat");
    expect(calls).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: "Pause" })])
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
      circle: (x, y, radius, color, alpha) => {
        calls.push({ alpha, color, kind: "circle", radius, x, y });

        return sceneObject;
      },
      rectangle: (x, y, width, height, color, alpha) => {
        calls.push({ alpha, color, height, kind: "rectangle", width, x, y });

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
    }
  };
}

function createRecordingAudioOutput(): LocalMatchAudioCueOutput & {
  played: { cue: LocalMatchAudioCue; reducedIntensity: boolean }[];
} {
  const played: { cue: LocalMatchAudioCue; reducedIntensity: boolean }[] = [];

  return {
    played,
    playCue: (cue, options) => {
      played.push({
        cue,
        reducedIntensity: options.reducedIntensity
      });
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

function scorePlateAppearance(scene: FakeSceneContext, pitchStartedAtMs: number): void {
  dispatchWallballPlaySceneControlIntent.call(
    scene,
    {
      kind: "pitch",
      source: "keyboard"
    },
    pitchStartedAtMs
  );
  dispatchWallballPlaySceneControlIntent.call(
    scene,
    {
      kind: "swing",
      source: "keyboard"
    },
    pitchStartedAtMs + 180
  );
  updateWallballPlayScene.call(scene, pitchStartedAtMs + 500, 0);
}

function yForText(calls: DrawCall[], text: string): number {
  const call = textCall(calls, text);

  if (typeof call?.y !== "number") {
    throw new Error(`Missing y position for ${text}`);
  }

  return call.y;
}

function textCall(calls: DrawCall[], text: string): DrawCall {
  const call = calls.find(
    (candidate) => candidate.kind === "text" && candidate.text === text
  );

  if (!call) {
    throw new Error(`Missing text call for ${text}`);
  }

  return call;
}

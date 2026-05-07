import { describe, expect, it } from "vitest";

import {
  combineFieldingInputs,
  fieldingInputFromKeys,
  getGameplayControlHelpItems,
  isFieldingKey,
  keyboardActionForKey,
  shouldIgnoreGameplayKeyboardTarget
} from "./game-controls";

describe("desktop gameplay controls", () => {
  it("maps pitch and swing keys to discrete actions", () => {
    expect(keyboardActionForKey({ code: "Space", key: " " })).toBe("swing");
    expect(keyboardActionForKey({ code: "Enter", key: "Enter" })).toBe(
      "pitch"
    );
    expect(keyboardActionForKey({ code: "KeyP", key: "p" })).toBe("pitch");
    expect(keyboardActionForKey({ code: "Escape", key: "Escape" })).toBe(
      "pause-toggle"
    );
    expect(keyboardActionForKey({ code: "KeyR", key: "r" })).toBe("restart");
    expect(keyboardActionForKey({ code: "KeyX", key: "x" })).toBeNull();
  });

  it("maps arrows and WASD to fielder movement axes", () => {
    expect(fieldingInputFromKeys(["ArrowLeft", "KeyW"])).toEqual({
      axisX: -1,
      axisY: -1
    });
    expect(fieldingInputFromKeys(["KeyA", "KeyD", "ArrowDown"])).toEqual({
      axisX: 0,
      axisY: 1
    });
    expect(isFieldingKey("KeyS")).toBe(true);
    expect(isFieldingKey("Space")).toBe(false);
  });

  it("projects reusable control help metadata from the same key bindings", () => {
    expect(getGameplayControlHelpItems()).toEqual([
      {
        action: "pitch",
        keyboard: "Enter or P",
        label: "Pitch",
        touch: "Pitch button"
      },
      {
        action: "swing",
        keyboard: "Space",
        label: "Swing",
        touch: "Swing button"
      },
      {
        action: "fielder-move",
        keyboard: "Arrow keys or WASD",
        label: "Fielding",
        touch: "Fielding pad"
      },
      {
        action: "pause-toggle",
        keyboard: "Escape",
        label: "Pause / Resume",
        touch: "Pause button"
      },
      {
        action: "restart",
        keyboard: "R",
        label: "Quick Restart",
        touch: "Start / Restart button"
      }
    ]);
  });

  it("does not intercept focused form controls or buttons", () => {
    expect(shouldIgnoreGameplayKeyboardTarget(target("BUTTON"))).toBe(true);
    expect(shouldIgnoreGameplayKeyboardTarget(target("INPUT"))).toBe(true);
    expect(shouldIgnoreGameplayKeyboardTarget(target("SELECT"))).toBe(true);
    expect(shouldIgnoreGameplayKeyboardTarget(target("TEXTAREA"))).toBe(true);
    expect(shouldIgnoreGameplayKeyboardTarget(target("DIV", true))).toBe(true);
    expect(shouldIgnoreGameplayKeyboardTarget(target("DIV"))).toBe(false);
  });
});

describe("touch gameplay controls", () => {
  it("combines simultaneous fielding touch zones into a clamped vector", () => {
    expect(
      combineFieldingInputs([
        {
          axisX: 1,
          axisY: 0
        },
        {
          axisX: 0,
          axisY: -1
        },
        {
          axisX: 1,
          axisY: 0
        }
      ])
    ).toEqual({
      axisX: 1,
      axisY: -1
    });
  });
});

function target(tagName: string, isContentEditable = false): EventTarget {
  const fakeTarget: EventTarget & {
    isContentEditable: boolean;
    tagName: string;
  } = {
    addEventListener: () => {
      // no-op fake
    },
    dispatchEvent: () => true,
    isContentEditable,
    removeEventListener: () => {
      // no-op fake
    },
    tagName
  };

  return fakeTarget;
}

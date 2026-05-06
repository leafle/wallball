import { describe, expect, it } from "vitest";

import { applyOut, createMatchState } from "./rules";

describe("inning transitions", () => {
  it("switches from top to bottom when the away side makes three outs", () => {
    const state = createMatchState({
      awayTeamId: "champions",
      homeTeamId: "woodland"
    });

    const afterThirdOut = applyOut(applyOut(applyOut(state)));

    expect(afterThirdOut.inning).toEqual({
      inning: 1,
      half: "bottom",
      outs: 0
    });
    expect(afterThirdOut.battingSide).toBe("home");
  });

  it("increments the inning after the home side makes three outs", () => {
    const state = {
      ...createMatchState({
        awayTeamId: "champions",
        homeTeamId: "woodland"
      }),
      battingSide: "home" as const,
      inning: {
        inning: 1,
        half: "bottom" as const,
        outs: 2
      }
    };

    expect(applyOut(state).inning).toEqual({
      inning: 2,
      half: "top",
      outs: 0
    });
  });
});

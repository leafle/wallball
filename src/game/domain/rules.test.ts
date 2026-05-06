import { describe, expect, it } from "vitest";

import {
  INITIAL_INNING_STATE,
  MAX_OUTS_PER_HALF_INNING,
  applyOut,
  createMatchState
} from "./rules";

describe("rules", () => {
  it("starts a match in the top of the first with no outs", () => {
    expect(INITIAL_INNING_STATE).toEqual({
      inning: 1,
      half: "top",
      outs: 0
    });

    expect(
      createMatchState({
        awayTeamId: "champions",
        homeTeamId: "woodland"
      })
    ).toMatchObject({
      teams: {
        away: "champions",
        home: "woodland"
      },
      score: {
        away: 0,
        home: 0
      },
      inning: INITIAL_INNING_STATE
    });
  });

  it("uses three outs as the half-inning transition threshold", () => {
    expect(MAX_OUTS_PER_HALF_INNING).toBe(3);
  });

  it("tracks ordinary outs without switching sides early", () => {
    const state = createMatchState({
      awayTeamId: "champions",
      homeTeamId: "woodland"
    });

    expect(applyOut(state).inning).toEqual({
      inning: 1,
      half: "top",
      outs: 1
    });
  });
});

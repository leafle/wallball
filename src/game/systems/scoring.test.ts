import { describe, expect, it } from "vitest";

import {
  EMPTY_BASES,
  applyScoringResult,
  createScore
} from "./scoring";

describe("scoring", () => {
  it("advances baserunners and scores forced runners", () => {
    const result = applyScoringResult(
      {
        score: createScore(),
        bases: {
          first: "cainer",
          second: "minkus",
          third: "brandon"
        },
        battingSide: "away"
      },
      "single",
      "al"
    );

    expect(result).toEqual({
      score: {
        away: 1,
        home: 0
      },
      bases: {
        first: "al",
        second: "cainer",
        third: "minkus"
      },
      runsScored: ["brandon"]
    });
  });

  it("clears the bases and scores the batter on a home run", () => {
    const result = applyScoringResult(
      {
        score: createScore({ home: 2 }),
        bases: {
          first: "al",
          second: null,
          third: "regen"
        },
        battingSide: "home"
      },
      "home-run",
      "danny"
    );

    expect(result).toEqual({
      score: {
        away: 0,
        home: 5
      },
      bases: EMPTY_BASES,
      runsScored: ["regen", "al", "danny"]
    });
  });
});

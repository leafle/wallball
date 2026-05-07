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

  it("advances runners two bases on doubles", () => {
    const result = applyScoringResult(
      {
        score: createScore({ away: 1 }),
        bases: {
          first: "cainer",
          second: "minkus",
          third: "brandon"
        },
        battingSide: "away"
      },
      "double",
      "al"
    );

    expect(result).toEqual({
      score: {
        away: 3,
        home: 0
      },
      bases: {
        first: null,
        second: "al",
        third: "cainer"
      },
      runsScored: ["brandon", "minkus"]
    });
  });

  it("advances runners three bases on triples", () => {
    const result = applyScoringResult(
      {
        score: createScore({ home: 2 }),
        bases: {
          first: "cainer",
          second: "minkus",
          third: "brandon"
        },
        battingSide: "home"
      },
      "triple",
      "al"
    );

    expect(result).toEqual({
      score: {
        away: 0,
        home: 5
      },
      bases: {
        first: null,
        second: null,
        third: "al"
      },
      runsScored: ["brandon", "minkus", "cainer"]
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

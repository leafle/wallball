import { describe, expect, it } from "vitest";

import { generateMatchSummary } from "./match-summary";

describe("match summary generation", () => {
  it("summarizes the winner, loser, final score, and notable events", () => {
    expect(
      generateMatchSummary({
        id: "match-42",
        playedAt: "2026-05-06T16:00:00.000Z",
        teams: {
          away: "champions",
          home: "woodland"
        },
        score: {
          away: 9,
          home: 6
        },
        innings: 3,
        events: [
          {
            kind: "home-run",
            playerId: "brandon",
            inning: 2
          },
          {
            kind: "high-score",
            playerId: "cainer",
            inning: 3
          }
        ]
      })
    ).toEqual({
      id: "match-42",
      playedAt: "2026-05-06T16:00:00.000Z",
      finalScore: "champions 9, woodland 6",
      winnerTeamId: "champions",
      loserTeamId: "woodland",
      innings: 3,
      notableEvents: [
        "2: brandon home-run",
        "3: cainer high-score"
      ]
    });
  });

  it("marks tied exhibition results without inventing a winner", () => {
    expect(
      generateMatchSummary({
        id: "match-43",
        playedAt: "2026-05-06T17:00:00.000Z",
        teams: {
          away: "team-cainer",
          home: "ej"
        },
        score: {
          away: 5,
          home: 5
        },
        innings: 2,
        events: []
      })
    ).toMatchObject({
      winnerTeamId: null,
      loserTeamId: null,
      finalScore: "team-cainer 5, ej 5"
    });
  });
});

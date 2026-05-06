import { describe, expect, it } from "vitest";

import { updateHighScores } from "./high-scores";

describe("high score updates", () => {
  it("adds a new score and sorts highest value first", () => {
    expect(
      updateHighScores(
        [
          {
            category: "runs",
            playerId: "minkus",
            value: 4,
            matchId: "match-1",
            recordedAt: "2026-05-01T12:00:00.000Z"
          }
        ],
        {
          category: "runs",
          playerId: "brandon",
          value: 7,
          matchId: "match-2",
          recordedAt: "2026-05-02T12:00:00.000Z"
        }
      )
    ).toEqual([
      {
        category: "runs",
        playerId: "brandon",
        value: 7,
        matchId: "match-2",
        recordedAt: "2026-05-02T12:00:00.000Z"
      },
      {
        category: "runs",
        playerId: "minkus",
        value: 4,
        matchId: "match-1",
        recordedAt: "2026-05-01T12:00:00.000Z"
      }
    ]);
  });

  it("keeps only the configured number of records per category", () => {
    const updated = updateHighScores(
      [
        {
          category: "runs",
          playerId: "a",
          value: 5,
          matchId: "match-a",
          recordedAt: "2026-05-01T12:00:00.000Z"
        },
        {
          category: "runs",
          playerId: "b",
          value: 4,
          matchId: "match-b",
          recordedAt: "2026-05-01T12:00:00.000Z"
        }
      ],
      {
        category: "runs",
        playerId: "c",
        value: 3,
        matchId: "match-c",
        recordedAt: "2026-05-01T12:00:00.000Z"
      },
      { limitPerCategory: 2 }
    );

    expect(updated.map((score) => score.playerId)).toEqual(["a", "b"]);
  });
});

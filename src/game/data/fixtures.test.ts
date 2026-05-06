import { describe, expect, it } from "vitest";

import { loadInteractionPrompts, loadPredefinedRosters } from "./fixtures";

describe("predefined roster loading", () => {
  it("loads the four v0 teams with stable team ids", () => {
    expect(loadPredefinedRosters().map((team) => team.id)).toEqual([
      "champions",
      "woodland",
      "team-cainer",
      "ej"
    ]);
  });

  it("loads the friend group players in batting order", () => {
    const champions = loadPredefinedRosters().find(
      (team) => team.id === "champions"
    );

    expect(champions).toEqual({
      id: "champions",
      displayName: "Champions",
      players: [
        {
          id: "cainer",
          displayName: "Cainer",
          battingOrder: 1,
          tags: ["champions"]
        },
        {
          id: "minkus",
          displayName: "Minkus",
          battingOrder: 2,
          tags: ["champions"]
        },
        {
          id: "brandon",
          displayName: "Brandon",
          battingOrder: 3,
          tags: ["champions"]
        }
      ]
    });
  });

  it("loads the first data-driven friend interaction prompts", () => {
    expect(loadInteractionPrompts()).toEqual([
      {
        id: "brandon-vs-danny",
        trigger: "player-matchup",
        batterId: "brandon",
        pitcherId: "danny",
        message: "Brandon digs in while Danny works fast.",
        tags: ["matchup", "pace"]
      },
      {
        id: "cainer-vs-al-history",
        trigger: "match-history",
        playerIds: ["cainer", "al"],
        message: "Cainer and Al have history here: {finalScore} in {matchId}.",
        tags: ["history", "rivalry"]
      }
    ]);
  });
});

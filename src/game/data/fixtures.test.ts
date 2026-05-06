import { describe, expect, it } from "vitest";

import { loadPredefinedRosters } from "./fixtures";

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
});

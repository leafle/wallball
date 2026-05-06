import { describe, expect, it } from "vitest";

import { loadPredefinedRosters } from "../data/fixtures";
import { createBattingOrderFromRosters } from "./rosters";

describe("roster domain types", () => {
  it("derives a match batting order from predefined team rosters", () => {
    const rosters = loadPredefinedRosters();
    const champions = rosters.find((team) => team.id === "champions");
    const woodland = rosters.find((team) => team.id === "woodland");

    expect(champions).toBeDefined();
    expect(woodland).toBeDefined();
    expect(
      createBattingOrderFromRosters({
        away: champions!,
        home: woodland!
      })
    ).toEqual({
      away: ["cainer", "minkus", "brandon"],
      home: ["al", "danny", "regen"]
    });
  });
});

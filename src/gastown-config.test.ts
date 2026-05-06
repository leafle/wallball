import { describe, expect, it } from "vitest";

import redirectContent from "../.beads/redirect?raw";

describe("Gas Town beads redirect", () => {
  it("uses the canonical rig-local beads database from any worktree", () => {
    const redirect = redirectContent.trim();

    expect(redirect).toBe("/Users/brsmyth/co/wallball/mayor/rig/.beads");
  });
});

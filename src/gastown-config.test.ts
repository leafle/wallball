import { describe, expect, it } from "vitest";

import redirectContent from "../.beads/redirect?raw";

describe("Gas Town beads redirect", () => {
  it("points polecat worktrees at the rig-local beads database", () => {
    const redirect = redirectContent.trim();

    expect(redirect).toBe("../../../mayor/rig/.beads");
  });
});

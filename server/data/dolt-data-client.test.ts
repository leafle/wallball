import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { loadInteractionPrompts, loadPredefinedRosters } from "../../src/game/data/fixtures";
import {
  createDoltCliWallballDataClient,
  seedDoltFixtureData
} from "./dolt-data-client";

const hasDolt = spawnSync("dolt", ["version"], {
  encoding: "utf8"
}).status === 0;
const describeWithDolt = hasDolt ? describe : describe.skip;

describeWithDolt("Dolt CLI Wallball data client", () => {
  it("seeds fixture rosters and reads them through the typed boundary", async () => {
    const fixture = createDoltFixture();
    const client = createDoltCliWallballDataClient({ cwd: fixture.cwd });

    try {
      await seedDoltFixtureData(client, {
        prompts: loadInteractionPrompts(),
        rosters: loadPredefinedRosters()
      });

      await expect(client.listTeams()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "champions",
            players: [
              expect.objectContaining({
                id: "cainer",
                battingOrder: 1
              }),
              expect.objectContaining({
                id: "minkus",
                battingOrder: 2
              }),
              expect.objectContaining({
                id: "brandon",
                battingOrder: 3
              })
            ]
          })
        ])
      );
      await expect(client.listPlayers()).resolves.toEqual(
        expect.arrayContaining([
          {
            id: "danny",
            displayName: "Danny",
            battingOrder: 2,
            tags: ["woodland"]
          }
        ])
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("records matches and returns interaction context from Dolt-backed rows", async () => {
    const fixture = createDoltFixture();
    const client = createDoltCliWallballDataClient({ cwd: fixture.cwd });

    try {
      await seedDoltFixtureData(client, {
        prompts: loadInteractionPrompts(),
        rosters: loadPredefinedRosters()
      });
      const summary = await client.recordMatch({
        id: "dolt-match-1",
        playedAt: "2026-05-06T18:00:00.000Z",
        teams: {
          away: "champions",
          home: "woodland"
        },
        score: {
          away: 6,
          home: 5
        },
        innings: 2,
        events: [
          {
            kind: "run",
            playerId: "cainer",
            inning: 1
          },
          {
            kind: "pitch",
            playerId: "al",
            inning: 1
          }
        ]
      });

      await expect(client.getMatchHistory("al")).resolves.toHaveLength(1);
      await expect(
        client.getInteractionContext({
          batterId: "cainer",
          pitcherId: "al"
        })
      ).resolves.toMatchObject({
        matchHistoryCallout: {
          sourceMatchId: "dolt-match-1"
        }
      });
      expect(summary.finalScore).toBe("champions 6, woodland 5");
    } finally {
      fixture.cleanup();
    }
  });
});

function createDoltFixture(): { cleanup: () => void; cwd: string } {
  const cwd = mkdtempSync(join(tmpdir(), "wallball-dolt-client-"));
  const schema = readFileSync("server/data/schema.sql", "utf8");
  runDolt(cwd, ["init", "--name", "wallball-test", "--email", "test@example.com"]);
  runDolt(cwd, ["sql"], schema);

  return {
    cwd,
    cleanup: () => rmSync(cwd, { force: true, recursive: true })
  };
}

function runDolt(cwd: string, args: string[], input?: string): void {
  const result = spawnSync("dolt", args, {
    cwd,
    encoding: "utf8",
    input
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

import { describe, expect, it } from "vitest";

import type { CompletedMatch } from "../domain/match-summary";
import {
  createFixtureWallballDataClient,
  createResilientWallballDataClient,
  readWallballPersistenceStatus,
  type WallballDataClient
} from "./game-data-client";

describe("fixture Wallball data client", () => {
  it("exposes predefined teams and players through the typed boundary", async () => {
    const client = createFixtureWallballDataClient();

    await expect(client.listTeams()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "champions",
          displayName: "Champions",
          players: expect.arrayContaining([
            expect.objectContaining({
              id: "cainer",
              battingOrder: 1
            })
          ])
        })
      ])
    );
    await expect(client.listPlayers()).resolves.toEqual(
      expect.arrayContaining([
        {
          id: "brandon",
          displayName: "Brandon",
          battingOrder: 3,
          tags: ["champions"]
        }
      ])
    );
  });

  it("records match history without mutating caller-owned match objects", async () => {
    const client = createFixtureWallballDataClient();
    const match = {
      id: "match-1",
      playedAt: "2026-05-06T18:00:00.000Z",
      teams: {
        away: "champions",
        home: "woodland"
      },
      score: {
        away: 3,
        home: 1
      },
      innings: 1,
      events: [
        {
          kind: "run",
          playerId: "brandon",
          inning: 1
        }
      ]
    };

    const summary = await client.recordMatch(match);
    match.events[0].kind = "mutated";

    await expect(client.getMatchHistory("brandon")).resolves.toEqual([
      {
        id: "match-1",
        playedAt: "2026-05-06T18:00:00.000Z",
        teams: {
          away: "champions",
          home: "woodland"
        },
        score: {
          away: 3,
          home: 1
        },
        innings: 1,
        events: [
          {
            kind: "run",
            playerId: "brandon",
            inning: 1
          }
        ]
      }
    ]);
    expect(summary.finalScore).toBe("champions 3, woodland 1");
  });

  it("updates runs high scores when recording a match", async () => {
    const client = createFixtureWallballDataClient({
      highScores: [
        {
          category: "runs",
          playerId: "minkus",
          value: 1,
          matchId: "match-previous",
          recordedAt: "2026-05-05T18:00:00.000Z"
        }
      ]
    });

    await client.recordMatch({
      id: "match-2",
      playedAt: "2026-05-06T18:00:00.000Z",
      teams: {
        away: "champions",
        home: "woodland"
      },
      score: {
        away: 2,
        home: 0
      },
      innings: 1,
      events: [
        {
          kind: "home-run",
          playerId: "cainer",
          inning: 1
        },
        {
          kind: "run",
          playerId: "cainer",
          inning: 1
        },
        {
          kind: "run",
          playerId: "cainer",
          inning: 1
        }
      ]
    });

    await expect(client.getHighScores("runs")).resolves.toEqual([
      {
        category: "runs",
        playerId: "cainer",
        value: 2,
        matchId: "match-2",
        recordedAt: "2026-05-06T18:00:00.000Z"
      },
      {
        category: "runs",
        playerId: "minkus",
        value: 1,
        matchId: "match-previous",
        recordedAt: "2026-05-05T18:00:00.000Z"
      }
    ]);
  });

  it("queues match records and updates fallback high scores when the primary client is unavailable", async () => {
    const client = createResilientWallballDataClient({
      primary: createUnavailableDataClient()
    });

    const summary = await client.recordMatch(scoredMatch("queued-match", 2));

    expect(summary).toMatchObject({
      id: "queued-match",
      finalScore: "champions 2, woodland 0"
    });
    expect(readWallballPersistenceStatus(client)).toEqual({
      pendingWrites: 1,
      state: "queued"
    });
    await expect(client.getMatchHistory("cainer")).resolves.toMatchObject([
      {
        id: "queued-match",
        score: {
          away: 2,
          home: 0
        }
      }
    ]);
    await expect(client.getHighScores("runs")).resolves.toEqual([
      {
        category: "runs",
        playerId: "cainer",
        value: 2,
        matchId: "queued-match",
        recordedAt: "2026-05-06T18:00:00.000Z"
      }
    ]);
  });

  it("retries queued matches deterministically when the primary client recovers", async () => {
    const primary = createFixtureWallballDataClient();
    let primaryAvailable = false;
    const client = createResilientWallballDataClient({
      primary: createAvailabilityGatedDataClient(primary, () => primaryAvailable)
    });

    await client.recordMatch(scoredMatch("retry-match", 3));
    primaryAvailable = true;

    await expect(client.retryPendingWrites()).resolves.toEqual({
      pendingWrites: 0,
      state: "synced"
    });
    expect(readWallballPersistenceStatus(client)).toEqual({
      pendingWrites: 0,
      state: "synced"
    });
    await expect(primary.getMatchHistory("cainer")).resolves.toMatchObject([
      {
        id: "retry-match",
        score: {
          away: 3,
          home: 0
        }
      }
    ]);
    await expect(client.getHighScores("runs")).resolves.toEqual([
      {
        category: "runs",
        playerId: "cainer",
        value: 3,
        matchId: "retry-match",
        recordedAt: "2026-05-06T18:00:00.000Z"
      }
    ]);
  });

  it("coalesces concurrent retry attempts for the same queued match", async () => {
    const primary = createFixtureWallballDataClient();
    let primaryAvailable = false;
    let recordAttempts = 0;
    const client = createResilientWallballDataClient({
      primary: createAvailabilityGatedDataClient(
        primary,
        () => primaryAvailable,
        () => {
          recordAttempts += 1;
        }
      )
    });

    await client.recordMatch(scoredMatch("concurrent-retry-match", 1));
    primaryAvailable = true;
    await Promise.all([
      client.getHighScores("runs"),
      client.getMatchHistory(),
      client.getInteractionContext({
        batterId: "cainer",
        pitcherId: "al"
      })
    ]);

    expect(recordAttempts).toBe(1);
    await expect(primary.getMatchHistory("cainer")).resolves.toHaveLength(1);
  });

  it("derives interaction context from fixture prompts and stored history", async () => {
    const client = createFixtureWallballDataClient({
      matches: [
        {
          id: "match-history-1",
          playedAt: "2026-05-06T18:00:00.000Z",
          teams: {
            away: "champions",
            home: "woodland"
          },
          score: {
            away: 4,
            home: 2
          },
          innings: 1,
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
        }
      ]
    });

    await expect(
      client.getInteractionContext({
        batterId: "cainer",
        pitcherId: "al"
      })
    ).resolves.toMatchObject({
      matchHistoryCallout: {
        id: "cainer-vs-al-history",
        sourceMatchId: "match-history-1"
      }
    });
  });
});

function scoredMatch(id: string, runs: number): CompletedMatch {
  return {
    id,
    playedAt: "2026-05-06T18:00:00.000Z",
    teams: {
      away: "champions",
      home: "woodland"
    },
    score: {
      away: runs,
      home: 0
    },
    innings: 1,
    events: Array.from({ length: runs }, () => ({
      kind: "run",
      playerId: "cainer",
      inning: 1
    }))
  };
}

function createUnavailableDataClient(): WallballDataClient {
  return createAvailabilityGatedDataClient(
    createFixtureWallballDataClient(),
    () => false
  );
}

function createAvailabilityGatedDataClient(
  delegate: WallballDataClient,
  isAvailable: () => boolean,
  onRecordMatch: () => void = () => {}
): WallballDataClient {
  function assertAvailable(): void {
    if (!isAvailable()) {
      throw new Error("data service unavailable");
    }
  }

  return {
    async getHighScores(category) {
      assertAvailable();
      return delegate.getHighScores(category);
    },
    async getInteractionContext(matchup) {
      assertAvailable();
      return delegate.getInteractionContext(matchup);
    },
    async getMatchHistory(playerId) {
      assertAvailable();
      return delegate.getMatchHistory(playerId);
    },
    async listPlayers() {
      assertAvailable();
      return delegate.listPlayers();
    },
    async listTeams() {
      assertAvailable();
      return delegate.listTeams();
    },
    async recordMatch(match) {
      assertAvailable();
      onRecordMatch();
      return delegate.recordMatch(match);
    }
  };
}

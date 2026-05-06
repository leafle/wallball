import { describe, expect, it } from "vitest";

import { createFixtureWallballDataClient } from "./game-data-client";

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

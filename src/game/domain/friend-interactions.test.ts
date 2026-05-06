import { describe, expect, it } from "vitest";

import { getInteractionContext } from "./friend-interactions";

describe("friend interactions", () => {
  it("selects an exact batter-versus-pitcher matchup callout", () => {
    expect(
      getInteractionContext({
        matchup: {
          batterId: "brandon",
          pitcherId: "danny"
        },
        prompts: [
          {
            id: "wrong-pitcher",
            trigger: "player-matchup",
            batterId: "brandon",
            pitcherId: "regen",
            message: "Brandon waits on Regen.",
            tags: ["matchup"]
          },
          {
            id: "brandon-danny",
            trigger: "player-matchup",
            batterId: "brandon",
            pitcherId: "danny",
            message: "Brandon digs in while Danny works fast.",
            tags: ["matchup", "pace"]
          }
        ]
      })
    ).toEqual({
      matchupCallout: {
        id: "brandon-danny",
        trigger: "player-matchup",
        message: "Brandon digs in while Danny works fast.",
        playerIds: ["brandon", "danny"],
        tags: ["matchup", "pace"]
      },
      matchHistoryCallout: null,
      callouts: [
        {
          id: "brandon-danny",
          trigger: "player-matchup",
          message: "Brandon digs in while Danny works fast.",
          playerIds: ["brandon", "danny"],
          tags: ["matchup", "pace"]
        }
      ]
    });
  });

  it("selects the latest shared match-history callout and fills template values", () => {
    const context = getInteractionContext({
      matchup: {
        batterId: "brandon",
        pitcherId: "danny"
      },
      prompts: [
        {
          id: "rematch-history",
          trigger: "match-history",
          playerIds: ["danny", "brandon"],
          message: "Last time these two crossed: {finalScore} in {matchId}.",
          tags: ["history", "rematch"]
        }
      ],
      matchHistory: [
        {
          id: "match-old",
          playedAt: "2026-05-01T12:00:00.000Z",
          teams: {
            away: "champions",
            home: "woodland"
          },
          score: {
            away: 7,
            home: 6
          },
          innings: 3,
          events: [
            {
              kind: "single",
              playerId: "brandon",
              inning: 1
            },
            {
              kind: "strikeout",
              playerId: "danny",
              inning: 2
            }
          ]
        },
        {
          id: "match-unrelated",
          playedAt: "2026-05-04T12:00:00.000Z",
          teams: {
            away: "champions",
            home: "ej"
          },
          score: {
            away: 4,
            home: 2
          },
          innings: 3,
          events: [
            {
              kind: "double",
              playerId: "brandon",
              inning: 1
            }
          ]
        },
        {
          id: "match-new",
          playedAt: "2026-05-05T12:00:00.000Z",
          teams: {
            away: "champions",
            home: "woodland"
          },
          score: {
            away: 8,
            home: 4
          },
          innings: 3,
          events: [
            {
              kind: "wall-shot",
              playerId: "danny",
              inning: 1
            },
            {
              kind: "home-run",
              playerId: "brandon",
              inning: 3
            }
          ]
        }
      ]
    });

    expect(context.matchHistoryCallout).toEqual({
      id: "rematch-history",
      trigger: "match-history",
      message: "Last time these two crossed: champions 8, woodland 4 in match-new.",
      playerIds: ["brandon", "danny"],
      tags: ["history", "rematch"],
      sourceMatchId: "match-new"
    });
    expect(context.callouts).toEqual([context.matchHistoryCallout]);
  });
});

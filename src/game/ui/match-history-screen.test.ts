import { describe, expect, it } from "vitest";

import type { HighScore } from "../domain/high-scores";
import type { CompletedMatch } from "../domain/match-summary";
import { projectMatchHistoryScreen } from "./match-history-screen";

describe("match history screen projection", () => {
  it("projects recent matches and a stable rivalry head-to-head summary", () => {
    expect(
      projectMatchHistoryScreen({
        highScores: [
          score("cainer", 3, "match-new"),
          score("al", 1, "match-old")
        ],
        matches: [
          match({
            id: "match-old",
            playedAt: "2026-05-04T18:00:00.000Z",
            score: {
              away: 3,
              home: 1
            }
          }),
          match({
            id: "match-new",
            playedAt: "2026-05-06T18:00:00.000Z",
            score: {
              away: 4,
              home: 2
            }
          }),
          match({
            id: "match-unrelated",
            playedAt: "2026-05-05T18:00:00.000Z",
            score: {
              away: 2,
              home: 5
            },
            teams: {
              away: "team-cainer",
              home: "ej"
            }
          })
        ],
        players,
        rivalry: {
          callout: {
            id: "cainer-vs-al-history",
            trigger: "match-history",
            message:
              "Cainer and Al have history here: Champions 4, Woodland 2 in match-new.",
            playerIds: ["cainer", "al"],
            tags: ["history", "rivalry"],
            sourceMatchId: "match-new"
          },
          playerIds: ["cainer", "al"],
          teamIds: ["champions", "woodland"]
        },
        teams
      })
    ).toEqual({
      emptyHistoryText: null,
      recentRows: [
        {
          detail: "1 inning - 1: cainer run",
          id: "match-new",
          playedAtLabel: "2026-05-06",
          resultLabel: "Champions won",
          scoreLabel: "Champions 4, Woodland 2"
        },
        {
          detail: "1 inning - 1: cainer run",
          id: "match-unrelated",
          playedAtLabel: "2026-05-05",
          resultLabel: "EJ won",
          scoreLabel: "Team Cainer 2, EJ 5"
        },
        {
          detail: "1 inning - 1: cainer run",
          id: "match-old",
          playedAtLabel: "2026-05-04",
          resultLabel: "Champions won",
          scoreLabel: "Champions 3, Woodland 1"
        }
      ],
      rivalry: {
        calloutText:
          "Cainer and Al have history here: Champions 4, Woodland 2 in match-new.",
        matchupLabel: "Champions vs Woodland",
        recentResultLabel: "Latest: Champions 4, Woodland 2",
        recordLabel: "Champions 2-0 vs Woodland",
        runLeaderLabel: "Cainer leads rivalry runs with 3",
        title: "Cainer vs Al"
      },
      statusLabel: "3 recorded",
      title: "Match History"
    });
  });

  it("keeps empty history and rivalry states compact", () => {
    expect(
      projectMatchHistoryScreen({
        highScores: [],
        matches: [],
        players,
        rivalry: {
          callout: null,
          playerIds: ["cainer", "al"],
          teamIds: ["champions", "woodland"]
        },
        teams
      })
    ).toMatchObject({
      emptyHistoryText: "Recorded local matches will appear here.",
      recentRows: [],
      rivalry: {
        calloutText: null,
        matchupLabel: "Champions vs Woodland",
        recentResultLabel: "Play a local match to start the rivalry.",
        recordLabel: "No Champions/Woodland meetings yet",
        runLeaderLabel: "Rivalry run leaders will appear after recorded runs.",
        title: "Cainer vs Al"
      },
      statusLabel: "No recorded matches"
    });
  });
});

const players = [
  {
    id: "cainer",
    displayName: "Cainer"
  },
  {
    id: "al",
    displayName: "Al"
  }
];

const teams = [
  {
    id: "champions",
    displayName: "Champions"
  },
  {
    id: "woodland",
    displayName: "Woodland"
  },
  {
    id: "team-cainer",
    displayName: "Team Cainer"
  },
  {
    id: "ej",
    displayName: "EJ"
  }
];

function score(playerId: string, value: number, matchId: string): HighScore {
  return {
    category: "runs",
    matchId,
    playerId,
    recordedAt: "2026-05-06T18:00:00.000Z",
    value
  };
}

function match({
  id,
  playedAt,
  score,
  teams = {
    away: "champions",
    home: "woodland"
  }
}: Pick<CompletedMatch, "id" | "playedAt" | "score"> &
  Partial<Pick<CompletedMatch, "teams">>): CompletedMatch {
  return {
    events: [
      {
        kind: "run",
        inning: 1,
        playerId: "cainer"
      }
    ],
    id,
    innings: 1,
    playedAt,
    score,
    teams
  };
}

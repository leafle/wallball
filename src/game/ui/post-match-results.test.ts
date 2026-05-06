import { describe, expect, it } from "vitest";

import type { HighScore } from "../domain/high-scores";
import type { MatchSummary } from "../domain/match-summary";
import type { PlaySceneLoopProjection } from "../scenes/play-scene-loop-adapter";
import { projectPostMatchResultsPanel } from "./post-match-results";

describe("post-match results panel projection", () => {
  it("projects final score, winner, matchup, summary, and leaderboard rows", () => {
    expect(
      projectPostMatchResultsPanel({
        highScores: [
          score("cainer", 2, "local-match-1"),
          score("minkus", 1, "previous-match")
        ],
        players: [
          {
            id: "cainer",
            displayName: "Cainer"
          },
          {
            id: "minkus",
            displayName: "Minkus"
          }
        ],
        projection: completedProjection,
        recordState: "recorded",
        summary: completedSummary
      })
    ).toEqual({
      emptyLeaderboardText: null,
      finalScore: "Champions 2, Woodland 1",
      leaderboardRows: [
        {
          detail: "local-match-1",
          label: "Cainer",
          rank: 1,
          value: "2 runs"
        },
        {
          detail: "previous-match",
          label: "Minkus",
          rank: 2,
          value: "1 run"
        }
      ],
      matchupLabel: "Danny vs Cainer",
      statusLabel: "Recorded",
      summaryRows: ["1: cainer home-run", "1: cainer run"],
      title: "Final",
      winnerLabel: "Champions win"
    });
  });

  it("keeps the panel useful before a match is completed", () => {
    expect(
      projectPostMatchResultsPanel({
        highScores: [],
        players: [],
        projection: {
          ...completedProjection,
          completion: null,
          hud: {
            ...completedProjection.hud,
            awayScore: 0,
            completionText: null,
            homeScore: 0
          },
          phase: {
            kind: "ready-for-at-bat",
            batterId: "cainer"
          }
        },
        recordState: "idle",
        summary: null
      })
    ).toMatchObject({
      finalScore: "Champions 0, Woodland 0",
      matchupLabel: "Danny vs Cainer",
      statusLabel: "Live",
      title: "Match Results",
      winnerLabel: "Play to the local score limit"
    });
  });
});

const completedSummary: MatchSummary = {
  id: "local-match-1",
  playedAt: "2026-05-06T20:30:00.000Z",
  finalScore: "champions 2, woodland 1",
  winnerTeamId: "champions",
  loserTeamId: "woodland",
  innings: 1,
  notableEvents: ["1: cainer home-run", "1: cainer run"]
};

const completedProjection: PlaySceneLoopProjection = {
  ball: {
    position: {
      x: 520,
      y: 120
    },
    velocity: {
      x: 0,
      y: 0
    }
  },
  completion: {
    finalScore: "Champions 2, Woodland 1",
    loserTeamId: "woodland",
    loserTeamName: "Woodland",
    winnerTeamId: "champions",
    winnerTeamName: "Champions"
  },
  fielders: [],
  hud: {
    awayScore: 2,
    awayTeamName: "Champions",
    batterName: "Cainer",
    completionText: "Final: Champions 2, Woodland 1",
    half: "top",
    homeScore: 1,
    homeTeamName: "Woodland",
    inning: 1,
    outs: 0,
    pitcherName: "Danny"
  },
  lastResult: "home-run",
  phase: {
    kind: "match-completed",
    result: {
      loserTeamId: "woodland",
      score: {
        away: 2,
        home: 1
      },
      winnerTeamId: "champions"
    }
  },
  setup: {
    awayTeamId: "champions",
    awayTeamName: "Champions",
    homeTeamId: "woodland",
    homeTeamName: "Woodland",
    teams: [
      {
        id: "champions",
        displayName: "Champions"
      },
      {
        id: "woodland",
        displayName: "Woodland"
      }
    ]
  },
  wallTarget: {
    center: {
      x: 520,
      y: 120
    },
    height: 80,
    width: 80
  }
};

function score(playerId: string, value: number, matchId: string): HighScore {
  return {
    category: "runs",
    matchId,
    playerId,
    recordedAt: "2026-05-06T20:30:00.000Z",
    value
  };
}

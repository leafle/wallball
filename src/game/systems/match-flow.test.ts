import { describe, expect, it } from "vitest";

import { EMPTY_BASES } from "./scoring";
import {
  applyPlateAppearance,
  createMatchFlowState,
  recordCompletedMatch
} from "./match-flow";

describe("match flow", () => {
  it("wires scoring results into score, bases, events, and batting order", () => {
    const state = createMatchFlowState({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      battingOrder: {
        away: ["cainer", "minkus", "brandon"],
        home: ["al", "danny", "regen"]
      }
    });

    const single = applyPlateAppearance(state, "single");
    const homeRun = applyPlateAppearance(single.state, "home-run");

    expect(homeRun.state.match.score).toEqual({
      away: 2,
      home: 0
    });
    expect(homeRun.state.bases).toEqual(EMPTY_BASES);
    expect(homeRun.state.nextBatterIndex.away).toBe(2);
    expect(homeRun.state.events).toEqual([
      {
        kind: "single",
        playerId: "cainer",
        inning: 1
      },
      {
        kind: "home-run",
        playerId: "minkus",
        inning: 1
      },
      {
        kind: "run",
        playerId: "cainer",
        inning: 1
      },
      {
        kind: "run",
        playerId: "minkus",
        inning: 1
      }
    ]);
  });

  it("turns out results into half-inning transitions and clears stranded runners", () => {
    const state = createMatchFlowState({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      battingOrder: {
        away: ["cainer", "minkus", "brandon"],
        home: ["al", "danny", "regen"]
      }
    });

    const withRunner = applyPlateAppearance(state, "single").state;
    const firstOut = applyPlateAppearance(withRunner, "out");
    const secondOut = applyPlateAppearance(firstOut.state, "miss");
    const thirdOut = applyPlateAppearance(secondOut.state, "out");

    expect(thirdOut.halfInningEnded).toBe(true);
    expect(thirdOut.matchCompleted).toBe(false);
    expect(thirdOut.state.match.inning).toEqual({
      inning: 1,
      half: "bottom",
      outs: 0
    });
    expect(thirdOut.state.match.battingSide).toBe("home");
    expect(thirdOut.state.bases).toEqual(EMPTY_BASES);
    expect(thirdOut.state.nextBatterIndex).toEqual({
      away: 1,
      home: 0
    });
  });

  it("records completed matches and updates the runs leaderboard", () => {
    const baseState = createMatchFlowState({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      battingOrder: {
        away: ["cainer", "minkus", "brandon"],
        home: ["al", "danny", "regen"]
      },
      maxInnings: 1
    });
    const state = {
      ...baseState,
      completedInnings: 1,
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
      ],
      match: {
        ...baseState.match,
        score: {
          away: 2,
          home: 0
        }
      }
    };

    const recorded = recordCompletedMatch(state, {
      id: "match-99",
      playedAt: "2026-05-06T18:00:00.000Z",
      highScores: [
        {
          category: "runs",
          playerId: "minkus",
          value: 1,
          matchId: "match-12",
          recordedAt: "2026-05-05T18:00:00.000Z"
        }
      ]
    });

    expect(recorded.match).toMatchObject({
      id: "match-99",
      playedAt: "2026-05-06T18:00:00.000Z",
      teams: {
        away: "champions",
        home: "woodland"
      },
      score: {
        away: 2,
        home: 0
      },
      innings: 1
    });
    expect(recorded.summary).toMatchObject({
      id: "match-99",
      finalScore: "champions 2, woodland 0",
      winnerTeamId: "champions"
    });
    expect(recorded.highScores).toEqual([
      {
        category: "runs",
        playerId: "cainer",
        value: 2,
        matchId: "match-99",
        recordedAt: "2026-05-06T18:00:00.000Z"
      },
      {
        category: "runs",
        playerId: "minkus",
        value: 1,
        matchId: "match-12",
        recordedAt: "2026-05-05T18:00:00.000Z"
      }
    ]);
  });
});

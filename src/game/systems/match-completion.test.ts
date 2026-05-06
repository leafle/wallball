import { describe, expect, it } from "vitest";

import { createFixtureWallballDataClient } from "../data/game-data-client";
import { loadPredefinedRosters } from "../data/fixtures";
import type { TeamRoster } from "../domain/rosters";
import {
  advanceLocalMatchLoop,
  createLocalMatchLoopState,
  type LocalMatchLoopState
} from "./local-match-loop";
import { recordLocalMatchCompletion } from "./match-completion";

const fielders = [
  {
    id: "al",
    position: {
      x: 520,
      y: 260
    },
    speed: 240
  }
];

describe("local match completion recording", () => {
  it("records a completed local match through the typed data client", async () => {
    const completed = pitchSwingRecover(createScoreLimitLoopState());
    const client = createFixtureWallballDataClient();

    const result = await recordLocalMatchCompletion(completed, {
      dataClient: client,
      id: "local-match-1",
      playedAt: "2026-05-06T18:00:00.000Z"
    });

    expect(result.summary).toEqual({
      id: "local-match-1",
      playedAt: "2026-05-06T18:00:00.000Z",
      finalScore: "champions 1, woodland 0",
      winnerTeamId: "champions",
      loserTeamId: "woodland",
      innings: 1,
      notableEvents: ["1: cainer home-run", "1: cainer run"]
    });
    expect(result.highScores).toEqual([
      {
        category: "runs",
        playerId: "cainer",
        value: 1,
        matchId: "local-match-1",
        recordedAt: "2026-05-06T18:00:00.000Z"
      }
    ]);
    await expect(client.getMatchHistory("cainer")).resolves.toMatchObject([
      {
        id: "local-match-1",
        score: {
          away: 1,
          home: 0
        }
      }
    ]);
  });

  it("rejects incomplete local matches before writing data", async () => {
    const client = createFixtureWallballDataClient();

    await expect(
      recordLocalMatchCompletion(createScoreLimitLoopState(), {
        dataClient: client,
        id: "local-match-2",
        playedAt: "2026-05-06T18:00:00.000Z"
      })
    ).rejects.toThrow("Cannot record an incomplete match");
    await expect(client.getMatchHistory()).resolves.toEqual([]);
  });
});

function createScoreLimitLoopState(): LocalMatchLoopState {
  return createLocalMatchLoopState({
    awayRoster: getRoster("champions"),
    homeRoster: getRoster("woodland"),
    fielders,
    maxRecoverySpeed: 1_000,
    recoveryRadius: 600,
    scoreLimit: 1
  });
}

function getRoster(teamId: string): TeamRoster {
  const roster = loadPredefinedRosters().find((team) => team.id === teamId);

  if (!roster) {
    throw new Error(`Missing test roster: ${teamId}`);
  }

  return roster;
}

function pitch(state: LocalMatchLoopState): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "pitch",
    pitchStartedAtMs: 1_000,
    idealContactMs: 180,
    pitchX: 0,
    targetX: 0
  });
}

function swing(state: LocalMatchLoopState): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "swing",
    swingAtMs: 1_180
  });
}

function recover(state: LocalMatchLoopState): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "recover-ball"
  });
}

function pitchSwingRecover(state: LocalMatchLoopState): LocalMatchLoopState {
  return recover(swing(pitch(state)));
}

import { describe, expect, it } from "vitest";

import { loadPredefinedRosters } from "../data/fixtures";
import type { TeamRoster } from "../domain/rosters";
import {
  advanceLocalMatchLoop,
  createLocalMatchLoopState,
  type LocalMatchLoopState
} from "./local-match-loop";
import { projectLocalMatchFeedback } from "./local-match-feedback";

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

describe("local match visual feedback projection", () => {
  it("projects pitch and swing feedback from deterministic loop state", () => {
    const pitched = pitch(createTestLoopState());

    expect(projectLocalMatchFeedback(pitched)).toMatchObject({
      primary: {
        anchor: "field",
        kind: "pitch",
        text: "Pitch in flight",
        tone: "neutral"
      },
      result: null,
      wall: null
    });

    const swung = swing(pitched, 1_180);

    expect(projectLocalMatchFeedback(swung)).toMatchObject({
      primary: {
        anchor: "batter",
        kind: "swing-contact",
        text: "Swing: perfect contact",
        tone: "positive"
      },
      result: null,
      secondary: {
        anchor: "field",
        kind: "recovery",
        text: "Recover the ball",
        tone: "neutral"
      },
      wall: {
        anchor: "wall",
        kind: "target-hit",
        text: "Target hit",
        tone: "positive"
      }
    });
  });

  it("projects recovery, run, out, and match-complete feedback", () => {
    const missed = swing(pitch(createTestLoopState()), 1_500);

    expect(projectLocalMatchFeedback(missed)).toMatchObject({
      primary: {
        kind: "swing-miss",
        text: "Swing missed",
        tone: "warning"
      },
      result: {
        kind: "out",
        text: "Out recorded"
      }
    });

    const scored = recover(swing(pitch(createTestLoopState()), 1_180));

    expect(projectLocalMatchFeedback(scored)).toMatchObject({
      primary: {
        kind: "run",
        text: "1 run scored"
      },
      result: {
        kind: "run",
        text: "1 run scored"
      },
      secondary: {
        kind: "recovery",
        text: "Ball recovered"
      }
    });

    const out = recover(swing(pitch(createTestLoopState()), 1_300));

    expect(projectLocalMatchFeedback(out)).toMatchObject({
      primary: {
        kind: "out",
        text: "Out recorded",
        tone: "warning"
      },
      result: {
        kind: "out",
        text: "Out recorded"
      }
    });

    const completed = recover(
      swing(
        pitch(
          createTestLoopState({
            scoreLimit: 1
          })
        ),
        1_180
      )
    );

    expect(projectLocalMatchFeedback(completed)).toMatchObject({
      primary: {
        anchor: "results",
        kind: "match-complete",
        text: "Match complete",
        tone: "complete"
      },
      result: {
        kind: "run",
        text: "1 run scored"
      }
    });
  });
});

function createTestLoopState({
  scoreLimit
}: {
  scoreLimit?: number;
} = {}): LocalMatchLoopState {
  return createLocalMatchLoopState({
    awayRoster: getRoster("champions"),
    homeRoster: getRoster("woodland"),
    fielders,
    maxRecoverySpeed: 1_000,
    recoveryRadius: 600,
    scoreLimit
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
    idealContactMs: 180,
    pitchStartedAtMs: 1_000,
    pitchX: 0,
    targetX: 0
  });
}

function swing(
  state: LocalMatchLoopState,
  swingAtMs: number
): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "swing",
    swingAtMs
  });
}

function recover(state: LocalMatchLoopState): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "recover-ball"
  });
}

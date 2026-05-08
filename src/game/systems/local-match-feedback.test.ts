import { describe, expect, it } from "vitest";

import { loadPredefinedRosters } from "../data/fixtures";
import type { TeamRoster } from "../domain/rosters";
import {
  advanceLocalMatchLoop,
  createLocalMatchLoopState,
  type LocalMatchLoopState
} from "./local-match-loop";
import { projectLocalMatchFeedback } from "./local-match-feedback";
import type { PlateAppearanceResult } from "./match-flow";

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
        text: "Home run - 1 run scored, score 1-0"
      },
      result: {
        kind: "run",
        text: "Home run - 1 run scored, score 1-0"
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
        text: "Home run - 1 run scored, score 1-0"
      }
    });
  });

  it("projects pitch wall-zone outcomes for missed and taken pitches", () => {
    const takenInside = takePitch(pitch(createTestLoopState()));

    expect(projectLocalMatchFeedback(takenInside)).toMatchObject({
      primary: {
        kind: "take",
        text: "Pitch taken",
        tone: "neutral"
      },
      result: {
        kind: "out",
        text: "Out recorded"
      },
      wall: {
        kind: "target-hit",
        text: "Pitch inside zone",
        tone: "warning"
      }
    });

    const missedOutside = swing(
      pitch(createTestLoopState(), {
        pitchX: 0.75
      }),
      1_500
    );

    expect(projectLocalMatchFeedback(missedOutside)).toMatchObject({
      primary: {
        kind: "swing-miss",
        text: "Swing missed"
      },
      result: {
        kind: "out",
        text: "Out recorded"
      },
      wall: {
        kind: "wall-hit",
        text: "Pitch outside zone",
        tone: "neutral"
      }
    });
  });

  it("projects scoreless hits and scoring hit details from plate appearance results", () => {
    const scorelessSingle = recover(
      swing(
        pitch(createTestLoopState(), {
          pitchX: 0.75
        }),
        1_260
      )
    );

    expect(projectLocalMatchFeedback(scorelessSingle)).toMatchObject({
      primary: {
        kind: "hit",
        text: "Single",
        tone: "positive"
      },
      result: {
        kind: "hit",
        text: "Single",
        tone: "positive"
      }
    });

    expect(
      projectLocalMatchFeedback(
        withPlateAppearanceResult(scorelessSingle, "double")
      ).result
    ).toMatchObject({
      kind: "hit",
      text: "Double",
      tone: "positive"
    });

    expect(
      projectLocalMatchFeedback(
        withPlateAppearanceResult(scorelessSingle, "triple")
      ).result
    ).toMatchObject({
      kind: "hit",
      text: "Triple",
      tone: "positive"
    });

    const scoringHomeRun = recover(swing(pitch(createTestLoopState()), 1_180));

    expect(projectLocalMatchFeedback(scoringHomeRun)).toMatchObject({
      primary: {
        kind: "run",
        text: "Home run - 1 run scored, score 1-0",
        tone: "positive"
      },
      result: {
        kind: "run",
        text: "Home run - 1 run scored, score 1-0",
        tone: "positive"
      }
    });
  });

  it("projects inning changes in completed out feedback", () => {
    const firstOut = recover(swing(pitch(createTestLoopState()), 1_300));
    const secondOut = recover(swing(pitch(firstOut), 1_300));
    const thirdOut = recover(swing(pitch(secondOut), 1_300));

    expect(projectLocalMatchFeedback(thirdOut)).toMatchObject({
      primary: {
        kind: "out",
        text: "Side retired - Bottom 1 begins",
        tone: "warning"
      },
      result: {
        kind: "out",
        text: "Side retired - Bottom 1 begins",
        tone: "warning"
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

function pitch(
  state: LocalMatchLoopState,
  overrides: {
    pitchX?: number;
    targetX?: number;
  } = {}
): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "pitch",
    idealContactMs: 180,
    pitchStartedAtMs: 1_000,
    pitchX: 0,
    targetX: 0,
    ...overrides
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

function takePitch(state: LocalMatchLoopState): LocalMatchLoopState {
  return advanceLocalMatchLoop(state, {
    type: "take-pitch"
  });
}

function withPlateAppearanceResult(
  state: LocalMatchLoopState,
  result: PlateAppearanceResult
): LocalMatchLoopState {
  if (!state.lastPlay?.plateAppearance) {
    throw new Error("Expected state to include a completed plate appearance");
  }

  return {
    ...state,
    lastPlay: {
      ...state.lastPlay,
      plateAppearance: {
        ...state.lastPlay.plateAppearance,
        result
      }
    }
  };
}

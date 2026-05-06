import type { TeamRoster } from "../domain/rosters";
import { createBattingOrderFromRosters } from "../domain/rosters";
import type { Score } from "../domain/rules";
import type {
  BallPhysicsSnapshot,
  Vector2,
  WallPlane,
  WallTarget,
  WallTargetCollision
} from "./ball-physics";
import { resolveWallTargetCollision } from "./ball-physics";
import {
  calculateBattingLaunch,
  calculateSwingTimingMs,
  type BattingLaunch
} from "./batting";
import type { BallResult, BallResultKind } from "./ball-results";
import type {
  BallRecovery,
  FieldBounds,
  FieldingInput,
  Fielder
} from "./fielding";
import { moveFielder, resolveBallRecovery } from "./fielding";
import type { MatchFlowState, PlateAppearanceUpdate } from "./match-flow";
import {
  applyPlateAppearance,
  createMatchFlowState,
  getCurrentBatterId
} from "./match-flow";

export type LocalMatchPhase =
  | {
      kind: "ready-for-at-bat";
      batterId: string;
    }
  | {
      kind: "pitch-in-flight";
      batterId: string;
    }
  | {
      kind: "awaiting-recovery";
      batterId: string;
    }
  | {
      kind: "match-completed";
      result: LocalMatchCompletionResult;
    };

export interface LocalMatchCompletionResult {
  loserTeamId: string | null;
  score: Score;
  winnerTeamId: string | null;
}

export interface LocalPitch {
  pitchStartedAtMs: number;
  idealContactMs: number;
  pitchX: number;
  targetX: number;
}

export type LocalPlateAppearance = Omit<PlateAppearanceUpdate, "state">;

export interface LocalMatchPlay {
  batterId: string;
  pitch: LocalPitch;
  swingTimingMs: number;
  battingLaunch: BattingLaunch;
  ballResult: BallResult;
  wallCollision: WallTargetCollision;
  recovery: BallRecovery | null;
  plateAppearance: LocalPlateAppearance | null;
}

export interface LocalMatchLoopSettings {
  ballStart: Vector2;
  wall: WallPlane;
  wallTarget: WallTarget;
  wallElapsedMs: number;
  wallRestitution: number;
  recoveryRadius: number;
  maxRecoverySpeed: number;
}

export interface LocalMatchLoopState {
  flow: MatchFlowState;
  phase: LocalMatchPhase;
  fielders: Fielder[];
  ball: BallPhysicsSnapshot;
  currentPitch: LocalPitch | null;
  lastPlay: LocalMatchPlay | null;
  settings: LocalMatchLoopSettings;
}

export interface CreateLocalMatchLoopStateInput {
  awayRoster: TeamRoster;
  homeRoster: TeamRoster;
  fielders?: readonly Fielder[];
  maxInnings?: number;
  scoreLimit?: number;
  ballStart?: Vector2;
  wall?: WallPlane;
  wallTarget?: WallTarget;
  wallElapsedMs?: number;
  wallRestitution?: number;
  recoveryRadius?: number;
  maxRecoverySpeed?: number;
}

export interface PitchLocalMatchAction extends LocalPitch {
  type: "pitch";
}

export interface SwingLocalMatchAction {
  type: "swing";
  swingAtMs: number;
}

export interface RecoverBallLocalMatchAction {
  type: "recover-ball";
}

export interface MoveFielderLocalMatchAction {
  type: "move-fielder";
  fielderId: string;
  input: FieldingInput;
  elapsedMs: number;
  bounds: FieldBounds;
}

export type LocalMatchLoopAction =
  | PitchLocalMatchAction
  | SwingLocalMatchAction
  | RecoverBallLocalMatchAction
  | MoveFielderLocalMatchAction;

const DEFAULT_BALL_START: Vector2 = {
  x: 520,
  y: 360
};
const DEFAULT_WALL: WallPlane = {
  point: {
    x: 0,
    y: 120
  },
  normal: {
    x: 0,
    y: 1
  }
};
const DEFAULT_WALL_TARGET: WallTarget = {
  center: {
    x: 520,
    y: 120
  },
  width: 80,
  height: 80
};

export function createLocalMatchLoopState({
  awayRoster,
  homeRoster,
  fielders = [],
  maxInnings,
  scoreLimit,
  ballStart = DEFAULT_BALL_START,
  wall = DEFAULT_WALL,
  wallTarget = DEFAULT_WALL_TARGET,
  wallElapsedMs = 600,
  wallRestitution = 0.75,
  recoveryRadius = 32,
  maxRecoverySpeed = 8
}: CreateLocalMatchLoopStateInput): LocalMatchLoopState {
  const battingOrder = createBattingOrderFromRosters({
    away: awayRoster,
    home: homeRoster
  });
  const flow = createMatchFlowState({
    awayTeamId: awayRoster.id,
    homeTeamId: homeRoster.id,
    battingOrder,
    maxInnings,
    scoreLimit
  });

  return {
    flow,
    phase: readyForAtBat(flow),
    fielders: fielders.map(cloneFielder),
    ball: {
      position: cloneVector(ballStart),
      velocity: {
        x: 0,
        y: 0
      }
    },
    currentPitch: null,
    lastPlay: null,
    settings: {
      ballStart: cloneVector(ballStart),
      wall: cloneWall(wall),
      wallTarget: cloneWallTarget(wallTarget),
      wallElapsedMs,
      wallRestitution,
      recoveryRadius,
      maxRecoverySpeed
    }
  };
}

export function advanceLocalMatchLoop(
  state: LocalMatchLoopState,
  action: LocalMatchLoopAction
): LocalMatchLoopState {
  if (state.phase.kind === "match-completed") {
    throw new Error("Cannot advance a completed match");
  }

  if (action.type === "pitch") {
    return pitchLocalMatch(state, action);
  }

  if (action.type === "swing") {
    return swingAtPitch(state, action);
  }

  if (action.type === "move-fielder") {
    return moveLocalFielder(state, action);
  }

  return recoverBall(state);
}

function pitchLocalMatch(
  state: LocalMatchLoopState,
  action: PitchLocalMatchAction
): LocalMatchLoopState {
  if (state.phase.kind !== "ready-for-at-bat") {
    throw new Error("Cannot pitch unless the loop is ready for an at-bat");
  }

  const pitch = {
    pitchStartedAtMs: action.pitchStartedAtMs,
    idealContactMs: action.idealContactMs,
    pitchX: action.pitchX,
    targetX: action.targetX
  };

  return {
    ...state,
    phase: {
      kind: "pitch-in-flight",
      batterId: state.phase.batterId
    },
    ball: {
      position: cloneVector(state.settings.ballStart),
      velocity: {
        x: 0,
        y: 0
      }
    },
    currentPitch: pitch
  };
}

function swingAtPitch(
  state: LocalMatchLoopState,
  action: SwingLocalMatchAction
): LocalMatchLoopState {
  if (state.phase.kind !== "pitch-in-flight" || !state.currentPitch) {
    throw new Error("Cannot swing unless a pitch is in flight");
  }

  const swingTimingMs = calculateSwingTimingMs({
    pitchStartedAtMs: state.currentPitch.pitchStartedAtMs,
    swingAtMs: action.swingAtMs,
    idealContactMs: state.currentPitch.idealContactMs
  });
  const preliminaryLaunch = calculateBattingLaunch({
    swingTimingMs,
    pitchX: state.currentPitch.pitchX,
    targetX: state.currentPitch.targetX,
    wallTargetHit: false
  });
  const preliminaryCollision = resolveWallTargetCollision({
    ball: {
      position: cloneVector(state.settings.ballStart),
      velocity: preliminaryLaunch.velocity
    },
    elapsedMs: state.settings.wallElapsedMs,
    wall: state.settings.wall,
    target: state.settings.wallTarget,
    restitution: state.settings.wallRestitution
  });
  const battingLaunch = calculateBattingLaunch({
    swingTimingMs,
    pitchX: state.currentPitch.pitchX,
    targetX: state.currentPitch.targetX,
    wallTargetHit: preliminaryCollision.targetHit
  });
  const wallCollision = resolveWallTargetCollision({
    ball: {
      position: cloneVector(state.settings.ballStart),
      velocity: battingLaunch.velocity
    },
    elapsedMs: state.settings.wallElapsedMs,
    wall: state.settings.wall,
    target: state.settings.wallTarget,
    restitution: state.settings.wallRestitution
  });
  const play: LocalMatchPlay = {
    batterId: state.phase.batterId,
    pitch: state.currentPitch,
    swingTimingMs,
    battingLaunch,
    ballResult: battingLaunch.result,
    wallCollision,
    recovery: null,
    plateAppearance: null
  };
  const nextState = {
    ...state,
    ball: {
      position: wallCollision.position,
      velocity: wallCollision.velocity
    },
    currentPitch: null,
    lastPlay: play
  };

  if (battingLaunch.result.kind === "miss") {
    return finishPlateAppearance(nextState, "miss", null);
  }

  return {
    ...nextState,
    phase: {
      kind: "awaiting-recovery",
      batterId: state.phase.batterId
    }
  };
}

function recoverBall(state: LocalMatchLoopState): LocalMatchLoopState {
  if (state.phase.kind !== "awaiting-recovery" || !state.lastPlay) {
    throw new Error("Cannot recover the ball unless a batted ball is in play");
  }

  const recovery = resolveBallRecovery({
    fielders: state.fielders,
    ball: state.ball,
    recoveryRadius: state.settings.recoveryRadius,
    maxRecoverySpeed: state.settings.maxRecoverySpeed
  });

  if (recovery.kind === "loose") {
    return {
      ...state,
      lastPlay: {
        ...state.lastPlay,
        recovery
      }
    };
  }

  return finishPlateAppearance(state, state.lastPlay.ballResult.kind, recovery);
}

function moveLocalFielder(
  state: LocalMatchLoopState,
  action: MoveFielderLocalMatchAction
): LocalMatchLoopState {
  if (action.elapsedMs <= 0) {
    return state;
  }

  let fielderMoved = false;
  const fielders = state.fielders.map((fielder) => {
    if (fielder.id !== action.fielderId) {
      return fielder;
    }

    fielderMoved = true;

    return moveFielder({
      fielder,
      input: action.input,
      elapsedMs: action.elapsedMs,
      bounds: action.bounds
    });
  });

  if (!fielderMoved) {
    return state;
  }

  return {
    ...state,
    fielders
  };
}

function finishPlateAppearance(
  state: LocalMatchLoopState,
  result: BallResultKind,
  recovery: BallRecovery | null
): LocalMatchLoopState {
  if (!state.lastPlay) {
    throw new Error("Cannot finish a plate appearance without play context");
  }

  const plateAppearance = applyPlateAppearance(state.flow, result);

  return {
    ...state,
    flow: plateAppearance.state,
    phase: plateAppearance.matchCompleted
      ? matchCompleted(plateAppearance.state)
      : readyForAtBat(plateAppearance.state),
    currentPitch: null,
    lastPlay: {
      ...state.lastPlay,
      recovery,
      plateAppearance: {
        batterId: plateAppearance.batterId,
        result: plateAppearance.result,
        runsScored: [...plateAppearance.runsScored],
        halfInningEnded: plateAppearance.halfInningEnded,
        matchCompleted: plateAppearance.matchCompleted
      }
    }
  };
}

function matchCompleted(flow: MatchFlowState): LocalMatchPhase {
  const { away, home } = flow.match.teams;
  const { score } = flow.match;
  const winnerTeamId =
    score.away === score.home ? null : score.away > score.home ? away : home;
  const loserTeamId =
    winnerTeamId === null ? null : winnerTeamId === away ? home : away;

  return {
    kind: "match-completed",
    result: {
      loserTeamId,
      score: { ...score },
      winnerTeamId
    }
  };
}

function readyForAtBat(flow: MatchFlowState): LocalMatchPhase {
  return {
    kind: "ready-for-at-bat",
    batterId: getCurrentBatterId(flow)
  };
}

function cloneFielder(fielder: Fielder): Fielder {
  return {
    ...fielder,
    position: cloneVector(fielder.position)
  };
}

function cloneWall(wall: WallPlane): WallPlane {
  return {
    point: cloneVector(wall.point),
    normal: cloneVector(wall.normal)
  };
}

function cloneWallTarget(target: WallTarget): WallTarget {
  return {
    center: cloneVector(target.center),
    width: target.width,
    height: target.height
  };
}

function cloneVector(vector: Vector2): Vector2 {
  return {
    x: vector.x,
    y: vector.y
  };
}

import type { TeamRoster } from "../domain/rosters";
import { createBattingOrderFromRosters } from "../domain/rosters";
import type { HalfInning, Score } from "../domain/rules";
import {
  DEFAULT_GAMEPLAY_TUNING,
  type GameplaySwingTuning
} from "../gameplay-tuning";
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
import type { BallResult, BallResultKind, ContactQuality } from "./ball-results";
import type {
  BallRecovery,
  FieldBounds,
  FieldingInput,
  Fielder
} from "./fielding";
import { moveFielder, resolveBallRecovery } from "./fielding";
import type {
  MatchFlowState,
  PlateAppearanceResult,
  PlateAppearanceUpdate
} from "./match-flow";
import {
  applyPlateAppearance,
  createMatchFlowState,
  getCurrentBatterId
} from "./match-flow";
import {
  resolvePitchWallOutcome,
  type PitchWallOutcome,
  type PitchWallOutcomeSource,
  type ResolvedPitchWallOutcome
} from "./pitch-flow";

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

export type LocalMatchEventKind =
  | "pitch"
  | "swing"
  | "take"
  | "contact"
  | "wall-hit"
  | "target-hit"
  | "recovery"
  | "out"
  | "run"
  | "inning-change"
  | "match-completed";

export interface LocalMatchEvent {
  contactQuality?: ContactQuality;
  fielderId?: string | null;
  half: HalfInning;
  inning: number;
  kind: LocalMatchEventKind;
  playerId: string | null;
  recoveryKind?: BallRecovery["kind"];
  result?: PlateAppearanceResult;
  runsScored?: string[];
  score?: Score;
  sequence: number;
  targetHit?: boolean;
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
  swingTimingMs: number | null;
  battingLaunch: BattingLaunch | null;
  ballResult: BallResult;
  wallCollision: WallTargetCollision;
  pitchOutcome: PitchWallOutcome | null;
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
  swingTuning: GameplaySwingTuning;
}

export interface LocalMatchLoopState {
  flow: MatchFlowState;
  phase: LocalMatchPhase;
  eventLog: LocalMatchEvent[];
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
  swingTuning?: GameplaySwingTuning;
}

export interface PitchLocalMatchAction extends LocalPitch {
  type: "pitch";
}

export interface SwingLocalMatchAction {
  type: "swing";
  swingAtMs: number;
}

export interface TakePitchLocalMatchAction {
  type: "take-pitch";
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
  | TakePitchLocalMatchAction
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
  wallElapsedMs = DEFAULT_GAMEPLAY_TUNING.pitch.wallTravelMs,
  wallRestitution = DEFAULT_GAMEPLAY_TUNING.pitch.wallRestitution,
  recoveryRadius = DEFAULT_GAMEPLAY_TUNING.recovery.localRadius,
  maxRecoverySpeed = DEFAULT_GAMEPLAY_TUNING.recovery.localMaxBallSpeed,
  swingTuning = DEFAULT_GAMEPLAY_TUNING.swing
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
    eventLog: [],
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
      maxRecoverySpeed,
      swingTuning: cloneSwingTuning(swingTuning)
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

  if (action.type === "take-pitch") {
    return takePitchAtWall(state);
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
    currentPitch: pitch,
    eventLog: appendLocalMatchEvents(state, [
      localEvent(state, "pitch", state.phase.batterId)
    ])
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
    swingTuning: state.settings.swingTuning,
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
    swingTuning: state.settings.swingTuning,
    wallTargetHit: preliminaryCollision.targetHit
  });
  const resolvedPitchOutcome =
    battingLaunch.result.kind === "miss"
      ? resolvePitchWallOutcomeForState(state, "swung-miss")
      : null;
  const wallCollision =
    resolvedPitchOutcome?.wallCollision ??
    resolveWallTargetCollision({
      ball: {
        position: cloneVector(state.settings.ballStart),
        velocity: battingLaunch.velocity
      },
      elapsedMs: state.settings.wallElapsedMs,
      wall: state.settings.wall,
      target: state.settings.wallTarget,
      restitution: state.settings.wallRestitution
    });
  const pitchOutcome = resolvedPitchOutcome
    ? summarizePitchOutcome(resolvedPitchOutcome)
    : null;
  const play: LocalMatchPlay = {
    batterId: state.phase.batterId,
    pitch: state.currentPitch,
    swingTimingMs,
    battingLaunch,
    ballResult: battingLaunch.result,
    wallCollision,
    pitchOutcome,
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
    eventLog: appendLocalMatchEvents(
      state,
      createSwingEvents(state, battingLaunch.result, wallCollision, pitchOutcome)
    ),
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

function takePitchAtWall(state: LocalMatchLoopState): LocalMatchLoopState {
  if (state.phase.kind !== "pitch-in-flight" || !state.currentPitch) {
    throw new Error("Cannot take a pitch unless a pitch is in flight");
  }

  const resolvedPitchOutcome = resolvePitchWallOutcomeForState(state, "taken");
  const pitchOutcome = summarizePitchOutcome(resolvedPitchOutcome);
  const ballResult = missedPitchResult();
  const play: LocalMatchPlay = {
    batterId: state.phase.batterId,
    pitch: state.currentPitch,
    swingTimingMs: null,
    battingLaunch: null,
    ballResult,
    wallCollision: resolvedPitchOutcome.wallCollision,
    pitchOutcome,
    recovery: null,
    plateAppearance: null
  };
  const nextState = {
    ...state,
    ball: {
      position: resolvedPitchOutcome.wallCollision.position,
      velocity: resolvedPitchOutcome.wallCollision.velocity
    },
    currentPitch: null,
    eventLog: appendLocalMatchEvents(
      state,
      createTakenPitchEvents(state, ballResult, resolvedPitchOutcome.wallCollision)
    ),
    lastPlay: play
  };

  return finishPlateAppearance(nextState, "miss", null);
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
      eventLog: appendLocalMatchEvents(state, [
        recoveryEvent(state, recovery)
      ]),
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
    eventLog: appendLocalMatchEvents(
      state,
      createPlateAppearanceEvents(state, plateAppearance, recovery)
    ),
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

type LocalMatchEventDraft = Omit<LocalMatchEvent, "sequence">;

function createSwingEvents(
  state: LocalMatchLoopState,
  result: BallResult,
  wallCollision: WallTargetCollision,
  pitchOutcome: PitchWallOutcome | null
): LocalMatchEventDraft[] {
  const batterId =
    state.phase.kind === "pitch-in-flight" ? state.phase.batterId : null;
  const events: LocalMatchEventDraft[] = [
    localEvent(state, "swing", batterId, {
      result: result.kind
    }),
    localEvent(state, "contact", batterId, {
      contactQuality: result.contactQuality,
      result: result.kind
    })
  ];
  const wallEvent = createWallContactEvent(
    state,
    batterId,
    result.kind,
    wallCollision,
    result.kind !== "miss" || pitchOutcome !== null
  );

  if (wallEvent) {
    events.push(wallEvent);
  }

  return events;
}

function createTakenPitchEvents(
  state: LocalMatchLoopState,
  result: BallResult,
  wallCollision: WallTargetCollision
): LocalMatchEventDraft[] {
  const batterId =
    state.phase.kind === "pitch-in-flight" ? state.phase.batterId : null;
  const events = [
    localEvent(state, "take", batterId, {
      result: result.kind
    })
  ];
  const wallEvent = createWallContactEvent(
    state,
    batterId,
    result.kind,
    wallCollision,
    true
  );

  if (wallEvent) {
    events.push(wallEvent);
  }

  return events;
}

function createWallContactEvent(
  state: LocalMatchLoopState,
  batterId: string | null,
  result: BallResultKind,
  wallCollision: WallTargetCollision,
  shouldRecord: boolean
): LocalMatchEventDraft | null {
  if (!shouldRecord || wallCollision.kind !== "wall-collision") {
    return null;
  }

  return localEvent(
    state,
    wallCollision.targetHit ? "target-hit" : "wall-hit",
    batterId,
    {
      result,
      targetHit: wallCollision.targetHit
    }
  );
}

function createPlateAppearanceEvents(
  state: LocalMatchLoopState,
  plateAppearance: PlateAppearanceUpdate,
  recovery: BallRecovery | null
): LocalMatchEventDraft[] {
  const events: LocalMatchEventDraft[] = [];

  if (recovery) {
    events.push(recoveryEvent(state, recovery));
  }

  if (plateAppearance.runsScored.length > 0) {
    for (const runnerId of plateAppearance.runsScored) {
      events.push(
        localEvent(state, "run", runnerId, {
          result: plateAppearance.result,
          runsScored: [runnerId],
          score: cloneScore(plateAppearance.state.match.score)
        })
      );
    }
  } else {
    events.push(
      localEvent(state, "out", plateAppearance.batterId, {
        result: plateAppearance.result,
        score: cloneScore(plateAppearance.state.match.score)
      })
    );
  }

  if (plateAppearance.halfInningEnded) {
    events.push({
      half: plateAppearance.state.match.inning.half,
      inning: plateAppearance.state.match.inning.inning,
      kind: "inning-change",
      playerId: null,
      score: cloneScore(plateAppearance.state.match.score)
    });
  }

  if (plateAppearance.matchCompleted) {
    events.push({
      half: plateAppearance.state.match.inning.half,
      inning: plateAppearance.state.match.inning.inning,
      kind: "match-completed",
      playerId: null,
      score: cloneScore(plateAppearance.state.match.score)
    });
  }

  return events;
}

function recoveryEvent(
  state: LocalMatchLoopState,
  recovery: BallRecovery
): LocalMatchEventDraft {
  return localEvent(state, "recovery", recoveryFielderId(recovery), {
    fielderId: recoveryFielderId(recovery),
    recoveryKind: recovery.kind
  });
}

function recoveryFielderId(recovery: BallRecovery): string | null {
  return recovery.kind === "recovered"
    ? recovery.fielderId
    : recovery.nearestFielderId;
}

function localEvent(
  state: LocalMatchLoopState,
  kind: LocalMatchEventKind,
  playerId: string | null,
  detail: Partial<
    Omit<LocalMatchEventDraft, "half" | "inning" | "kind" | "playerId">
  > = {}
): LocalMatchEventDraft {
  return {
    half: state.flow.match.inning.half,
    inning: state.flow.match.inning.inning,
    kind,
    playerId,
    ...detail
  };
}

function appendLocalMatchEvents(
  state: LocalMatchLoopState,
  events: LocalMatchEventDraft[]
): LocalMatchEvent[] {
  return [
    ...state.eventLog.map(cloneLocalMatchEvent),
    ...events.map((event, index) =>
      cloneLocalMatchEvent({
        ...event,
        sequence: state.eventLog.length + index + 1
      })
    )
  ];
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

function cloneSwingTuning(tuning: GameplaySwingTuning): GameplaySwingTuning {
  return { ...tuning };
}

function cloneLocalMatchEvent(event: LocalMatchEvent): LocalMatchEvent {
  return {
    ...event,
    runsScored: event.runsScored ? [...event.runsScored] : undefined,
    score: event.score ? cloneScore(event.score) : undefined
  };
}

function cloneScore(score: Score): Score {
  return {
    away: score.away,
    home: score.home
  };
}

function cloneVector(vector: Vector2): Vector2 {
  return {
    x: vector.x,
    y: vector.y
  };
}

function resolvePitchWallOutcomeForState(
  state: LocalMatchLoopState,
  source: PitchWallOutcomeSource
): ResolvedPitchWallOutcome {
  if (!state.currentPitch) {
    throw new Error("Cannot resolve pitch wall outcome without a current pitch");
  }

  return resolvePitchWallOutcome({
    ballStart: state.settings.ballStart,
    elapsedMs: state.settings.wallElapsedMs,
    pitch: state.currentPitch,
    restitution: state.settings.wallRestitution,
    source,
    target: state.settings.wallTarget,
    wall: state.settings.wall
  });
}

function summarizePitchOutcome({
  source,
  zone
}: ResolvedPitchWallOutcome): PitchWallOutcome {
  return {
    source,
    zone
  };
}

function missedPitchResult(): BallResult {
  return {
    kind: "miss",
    contactQuality: "none",
    launchAngleDegrees: 0
  };
}

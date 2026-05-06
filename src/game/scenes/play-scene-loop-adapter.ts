import { loadPredefinedRosters } from "../data/fixtures";
import type { PlayerProfile, TeamRoster } from "../domain/rosters";
import type { HalfInning } from "../domain/rules";
import type {
  FieldingInput,
  GameplayControlIntent
} from "../input/game-controls";
import type {
  BallPhysicsSnapshot,
  Vector2,
  WallTarget
} from "../systems/ball-physics";
import type { BallResultKind } from "../systems/ball-results";
import type { FieldBounds, Fielder } from "../systems/fielding";
import {
  advanceLocalMatchLoop,
  createLocalMatchLoopState,
  type LocalMatchCompletionResult,
  type LocalMatchLoopState,
  type LocalMatchPhase
} from "../systems/local-match-loop";
import { getCurrentBatterId } from "../systems/match-flow";

export interface PlaySceneLoopAdapter {
  awayRoster: TeamRoster;
  controlledFielderId: string | null;
  fieldBounds: FieldBounds;
  fieldingInput: FieldingInput;
  homeRoster: TeamRoster;
  lastAdvancedAtMs: number;
  loop: LocalMatchLoopState;
  nextActionAtMs: number;
  nextPitchDelayMs: number;
  pitchDurationMs: number;
  recoveryDelayMs: number;
}

export interface CreatePlaySceneLoopAdapterInput {
  awayTeamId?: string;
  controlledFielderId?: string;
  fieldBounds?: FieldBounds;
  fielders?: readonly Fielder[];
  homeTeamId?: string;
  nextPitchDelayMs?: number;
  pitchDurationMs?: number;
  recoveryDelayMs?: number;
  scoreLimit?: number;
  startedAtMs?: number;
}

export interface PlaySceneLoopProjection {
  ball: BallPhysicsSnapshot;
  completion: PlaySceneCompletionProjection | null;
  fielders: PlaySceneFielderProjection[];
  hud: PlaySceneHudProjection;
  lastResult: BallResultKind | null;
  phase: LocalMatchPhase;
  wallTarget: WallTarget;
}

export interface PlaySceneCompletionProjection {
  finalScore: string;
  loserTeamId: string | null;
  loserTeamName: string | null;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
}

export interface PlaySceneHudProjection {
  awayScore: number;
  awayTeamName: string;
  batterName: string;
  half: HalfInning;
  homeScore: number;
  homeTeamName: string;
  inning: number;
  outs: number;
  pitcherName: string;
  completionText: string | null;
}

export interface PlaySceneFielderProjection {
  displayName: string;
  id: string;
  position: Vector2;
}

const DEFAULT_AWAY_TEAM_ID = "champions";
const DEFAULT_HOME_TEAM_ID = "woodland";
const DEFAULT_NEXT_PITCH_DELAY_MS = 640;
const DEFAULT_PITCH_DURATION_MS = 180;
const DEFAULT_RECOVERY_DELAY_MS = 300;
const DEFAULT_SCORE_LIMIT = 3;
const DEFAULT_FIELD_BOUNDS: FieldBounds = {
  minX: 320,
  maxX: 960,
  minY: 210,
  maxY: 620
};
const EMPTY_FIELDING_INPUT: FieldingInput = {
  axisX: 0,
  axisY: 0
};

const DEFAULT_FIELDERS: readonly Fielder[] = [
  {
    id: "al",
    position: {
      x: 520,
      y: 260
    },
    speed: 240
  },
  {
    id: "danny",
    position: {
      x: 430,
      y: 318
    },
    speed: 220
  },
  {
    id: "regen",
    position: {
      x: 850,
      y: 316
    },
    speed: 220
  }
];

export function createPlaySceneLoopAdapter({
  awayTeamId = DEFAULT_AWAY_TEAM_ID,
  controlledFielderId,
  fieldBounds = DEFAULT_FIELD_BOUNDS,
  fielders = DEFAULT_FIELDERS,
  homeTeamId = DEFAULT_HOME_TEAM_ID,
  nextPitchDelayMs = DEFAULT_NEXT_PITCH_DELAY_MS,
  pitchDurationMs = DEFAULT_PITCH_DURATION_MS,
  recoveryDelayMs = DEFAULT_RECOVERY_DELAY_MS,
  scoreLimit = DEFAULT_SCORE_LIMIT,
  startedAtMs = 0
}: CreatePlaySceneLoopAdapterInput = {}): PlaySceneLoopAdapter {
  const rosters = loadPredefinedRosters();
  const awayRoster = findRoster(rosters, awayTeamId);
  const homeRoster = findRoster(rosters, homeTeamId);

  return {
    awayRoster,
    controlledFielderId: controlledFielderId ?? fielders[0]?.id ?? null,
    fieldBounds: cloneFieldBounds(fieldBounds),
    fieldingInput: cloneFieldingInput(EMPTY_FIELDING_INPUT),
    homeRoster,
    lastAdvancedAtMs: startedAtMs,
    loop: createLocalMatchLoopState({
      awayRoster,
      homeRoster,
      fielders,
      maxRecoverySpeed: 1_000,
      recoveryRadius: 600,
      scoreLimit
    }),
    nextActionAtMs: startedAtMs,
    nextPitchDelayMs,
    pitchDurationMs,
    recoveryDelayMs
  };
}

export function advancePlaySceneLoopAdapter(
  adapter: PlaySceneLoopAdapter,
  timeMs: number
): PlaySceneLoopAdapter {
  if (adapter.loop.phase.kind === "match-completed") {
    return adapter;
  }

  const movedAdapter = moveControlledFielder(adapter, timeMs);

  if (
    movedAdapter.loop.phase.kind !== "awaiting-recovery" ||
    timeMs < movedAdapter.nextActionAtMs
  ) {
    return movedAdapter;
  }

  const recoveredLoop = advanceLocalMatchLoop(movedAdapter.loop, {
    type: "recover-ball"
  });

  return {
    ...movedAdapter,
    loop: recoveredLoop,
    nextActionAtMs:
      recoveredLoop.phase.kind === "awaiting-recovery"
        ? timeMs + movedAdapter.recoveryDelayMs
        : timeMs + movedAdapter.nextPitchDelayMs
  };
}

export function applyPlaySceneControlIntent(
  adapter: PlaySceneLoopAdapter,
  intent: GameplayControlIntent,
  timeMs: number
): PlaySceneLoopAdapter {
  const current = advancePlaySceneLoopAdapter(adapter, timeMs);

  if (current.loop.phase.kind === "match-completed") {
    return current;
  }

  if (intent.kind === "fielder-move") {
    return {
      ...current,
      controlledFielderId:
        current.controlledFielderId ?? current.loop.fielders[0]?.id ?? null,
      fieldingInput: {
        axisX: intent.axisX,
        axisY: intent.axisY
      }
    };
  }

  if (intent.kind === "pitch") {
    return applyPitchControl(current, timeMs);
  }

  return applySwingControl(current, timeMs);
}

export function projectPlaySceneLoopState(
  adapter: PlaySceneLoopAdapter
): PlaySceneLoopProjection {
  const { flow } = adapter.loop;
  const batterId = getProjectedBatterId(adapter);
  const fieldingRoster = getFieldingRoster(adapter);
  const pitcher = getPitcher(fieldingRoster);
  const completion = projectCompletion(adapter);

  return {
    ball: {
      position: cloneVector(adapter.loop.ball.position),
      velocity: cloneVector(adapter.loop.ball.velocity)
    },
    completion,
    fielders: adapter.loop.fielders.map((fielder) => ({
      displayName: getPlayerName(adapter, fielder.id),
      id: fielder.id,
      position: cloneVector(fielder.position)
    })),
    hud: {
      awayScore: flow.match.score.away,
      awayTeamName: adapter.awayRoster.displayName,
      batterName: getPlayerName(adapter, batterId),
      half: flow.match.inning.half,
      homeScore: flow.match.score.home,
      homeTeamName: adapter.homeRoster.displayName,
      inning: flow.match.inning.inning,
      outs: flow.match.inning.outs,
      pitcherName: pitcher.displayName,
      completionText: completion ? `Final: ${completion.finalScore}` : null
    },
    lastResult: adapter.loop.lastPlay?.ballResult.kind ?? null,
    phase: {
      ...adapter.loop.phase
    },
    wallTarget: {
      center: cloneVector(adapter.loop.settings.wallTarget.center),
      height: adapter.loop.settings.wallTarget.height,
      width: adapter.loop.settings.wallTarget.width
    }
  };
}

function applyPitchControl(
  adapter: PlaySceneLoopAdapter,
  timeMs: number
): PlaySceneLoopAdapter {
  if (adapter.loop.phase.kind !== "ready-for-at-bat") {
    return adapter;
  }

  return {
    ...adapter,
    loop: advanceLocalMatchLoop(adapter.loop, {
      type: "pitch",
      idealContactMs: adapter.pitchDurationMs,
      pitchStartedAtMs: timeMs,
      pitchX: 0,
      targetX: 0
    }),
    nextActionAtMs: timeMs + adapter.pitchDurationMs
  };
}

function applySwingControl(
  adapter: PlaySceneLoopAdapter,
  timeMs: number
): PlaySceneLoopAdapter {
  if (adapter.loop.phase.kind !== "pitch-in-flight") {
    return adapter;
  }

  return {
    ...adapter,
    loop: advanceLocalMatchLoop(adapter.loop, {
      type: "swing",
      swingAtMs: timeMs
    }),
    nextActionAtMs: timeMs + adapter.recoveryDelayMs
  };
}

function moveControlledFielder(
  adapter: PlaySceneLoopAdapter,
  timeMs: number
): PlaySceneLoopAdapter {
  const elapsedMs = Math.max(0, timeMs - adapter.lastAdvancedAtMs);
  const nextAdapter = {
    ...adapter,
    lastAdvancedAtMs: Math.max(adapter.lastAdvancedAtMs, timeMs)
  };

  if (
    elapsedMs === 0 ||
    !adapter.controlledFielderId ||
    isIdleFieldingInput(adapter.fieldingInput)
  ) {
    return nextAdapter;
  }

  return {
    ...nextAdapter,
    loop: advanceLocalMatchLoop(adapter.loop, {
      type: "move-fielder",
      fielderId: adapter.controlledFielderId,
      input: adapter.fieldingInput,
      elapsedMs,
      bounds: adapter.fieldBounds
    })
  };
}

function isIdleFieldingInput(input: FieldingInput): boolean {
  return input.axisX === 0 && input.axisY === 0;
}

function getProjectedBatterId(adapter: PlaySceneLoopAdapter): string {
  if (adapter.loop.phase.kind !== "match-completed") {
    return adapter.loop.phase.batterId;
  }

  return adapter.loop.lastPlay?.batterId ?? getCurrentBatterId(adapter.loop.flow);
}

function projectCompletion(
  adapter: PlaySceneLoopAdapter
): PlaySceneCompletionProjection | null {
  if (adapter.loop.phase.kind !== "match-completed") {
    return null;
  }

  const result = adapter.loop.phase.result;

  return {
    finalScore: formatFinalScore(adapter, result),
    loserTeamId: result.loserTeamId,
    loserTeamName: result.loserTeamId
      ? getTeamName(adapter, result.loserTeamId)
      : null,
    winnerTeamId: result.winnerTeamId,
    winnerTeamName: result.winnerTeamId
      ? getTeamName(adapter, result.winnerTeamId)
      : null
  };
}

function formatFinalScore(
  adapter: PlaySceneLoopAdapter,
  result: LocalMatchCompletionResult
): string {
  return `${adapter.awayRoster.displayName} ${result.score.away}, ${adapter.homeRoster.displayName} ${result.score.home}`;
}

function findRoster(rosters: TeamRoster[], teamId: string): TeamRoster {
  const roster = rosters.find((team) => team.id === teamId);

  if (!roster) {
    throw new Error(`Missing play-scene roster: ${teamId}`);
  }

  return roster;
}

function getFieldingRoster(adapter: PlaySceneLoopAdapter): TeamRoster {
  return adapter.loop.flow.match.battingSide === "away"
    ? adapter.homeRoster
    : adapter.awayRoster;
}

function getPitcher(roster: TeamRoster): PlayerProfile {
  const players = getPlayersByBattingOrder(roster);

  return players[1] ?? players[0];
}

function getPlayerName(
  adapter: PlaySceneLoopAdapter,
  playerId: string
): string {
  const player = [...adapter.awayRoster.players, ...adapter.homeRoster.players].find(
    (candidate) => candidate.id === playerId
  );

  return player?.displayName ?? playerId;
}

function getTeamName(adapter: PlaySceneLoopAdapter, teamId: string): string {
  if (adapter.awayRoster.id === teamId) {
    return adapter.awayRoster.displayName;
  }

  if (adapter.homeRoster.id === teamId) {
    return adapter.homeRoster.displayName;
  }

  return teamId;
}

function getPlayersByBattingOrder(roster: TeamRoster): PlayerProfile[] {
  return [...roster.players].sort(
    (left, right) => left.battingOrder - right.battingOrder
  );
}

function cloneVector(vector: Vector2): Vector2 {
  return {
    x: vector.x,
    y: vector.y
  };
}

function cloneFieldingInput(input: FieldingInput): FieldingInput {
  return {
    axisX: input.axisX,
    axisY: input.axisY
  };
}

function cloneFieldBounds(bounds: FieldBounds): FieldBounds {
  return {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: bounds.maxY
  };
}

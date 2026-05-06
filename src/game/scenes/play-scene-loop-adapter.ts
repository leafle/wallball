import { loadInteractionPrompts, loadPredefinedRosters } from "../data/fixtures";
import {
  getInteractionContext,
  type InteractionCallout
} from "../domain/friend-interactions";
import type { PlayerProfile, TeamRoster } from "../domain/rosters";
import type { HalfInning } from "../domain/rules";
import {
  createGameplayTuningConfig,
  type GameplayAssistTuning,
  type GameplayTuningConfig,
  type GameplayTuningConfigInput
} from "../gameplay-tuning";
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
  scoreLimit: number;
  setup: PlaySceneMatchSetupState;
  soloAssist: PlaySceneSoloAssistSettings;
  tuning: GameplayTuningConfig;
}

export interface CreatePlaySceneLoopAdapterInput {
  awayTeamId?: string;
  controlledFielderId?: string;
  fieldBounds?: FieldBounds;
  fielders?: readonly Fielder[];
  homeTeamId?: string;
  maxRecoverySpeed?: number;
  nextPitchDelayMs?: number;
  pitchDurationMs?: number;
  recoveryDelayMs?: number;
  recoveryRadius?: number;
  scoreLimit?: number;
  soloAssist?: PlaySceneSoloAssistInput;
  startedAtMs?: number;
  tuning?: GameplayTuningConfigInput;
}

export type PlaySceneSoloAssistInput =
  | boolean
  | Partial<PlaySceneSoloAssistSettings>;

export interface PlaySceneSoloAssistSettings {
  enabled: boolean;
  fieldingRecovery: boolean;
  pitchDelayMs: number;
}

export interface PlaySceneLoopProjection {
  ball: BallPhysicsSnapshot;
  callout: InteractionCallout | null;
  completion: PlaySceneCompletionProjection | null;
  fielders: PlaySceneFielderProjection[];
  hud: PlaySceneHudProjection;
  lastResult: BallResultKind | null;
  phase: LocalMatchPhase;
  setup: PlaySceneSetupProjection;
  wallTarget: WallTarget;
}

export type PlaySceneSetupSide = "away" | "home";

export interface PlaySceneTeamOption {
  id: string;
  displayName: string;
}

export interface PlaySceneMatchSetupState {
  awayTeamId: string;
  homeTeamId: string;
  teams: PlaySceneTeamOption[];
}

export interface SelectPlaySceneTeamInput {
  side: PlaySceneSetupSide;
  teamId: string;
}

export interface PlaySceneSetupProjection extends PlaySceneMatchSetupState {
  awayTeamName: string;
  homeTeamName: string;
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
  calloutText: string | null;
  completionText: string | null;
  half: HalfInning;
  homeScore: number;
  homeTeamName: string;
  inning: number;
  outs: number;
  pitcherName: string;
}

export interface PlaySceneFielderProjection {
  displayName: string;
  id: string;
  position: Vector2;
}

const DEFAULT_AWAY_TEAM_ID = "champions";
const DEFAULT_HOME_TEAM_ID = "woodland";
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

const DEFAULT_FIELDER_SLOTS: readonly Omit<Fielder, "id">[] = [
  {
    position: {
      x: 520,
      y: 260
    },
    speed: 240
  },
  {
    position: {
      x: 430,
      y: 318
    },
    speed: 220
  },
  {
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
  fielders,
  homeTeamId = DEFAULT_HOME_TEAM_ID,
  maxRecoverySpeed,
  nextPitchDelayMs,
  pitchDurationMs,
  recoveryDelayMs,
  recoveryRadius,
  scoreLimit,
  soloAssist,
  startedAtMs = 0,
  tuning
}: CreatePlaySceneLoopAdapterInput = {}): PlaySceneLoopAdapter {
  const gameplayTuning = createGameplayTuningConfig(tuning);
  const resolvedNextPitchDelayMs =
    nextPitchDelayMs ?? gameplayTuning.pitch.nextDelayMs;
  const resolvedPitchDurationMs = pitchDurationMs ?? gameplayTuning.pitch.durationMs;
  const resolvedRecoveryDelayMs = recoveryDelayMs ?? gameplayTuning.recovery.delayMs;
  const resolvedRecoveryRadius = recoveryRadius ?? gameplayTuning.recovery.sceneRadius;
  const resolvedMaxRecoverySpeed =
    maxRecoverySpeed ?? gameplayTuning.recovery.sceneMaxBallSpeed;
  const resolvedScoreLimit = scoreLimit ?? gameplayTuning.scoring.scoreLimit;
  const rosters = loadPredefinedRosters();
  const setup = createPlaySceneMatchSetupState({
    awayTeamId,
    homeTeamId,
    rosters
  });
  const awayRoster = findRoster(rosters, setup.awayTeamId);
  const homeRoster = findRoster(rosters, setup.homeTeamId);
  const matchFielders = fielders ?? createDefaultFielders(homeRoster);
  const soloAssistSettings = normalizeSoloAssist(
    soloAssist ?? gameplayTuning.assist,
    gameplayTuning.assist
  );

  return {
    awayRoster,
    controlledFielderId: controlledFielderId ?? matchFielders[0]?.id ?? null,
    fieldBounds: cloneFieldBounds(fieldBounds),
    fieldingInput: cloneFieldingInput(EMPTY_FIELDING_INPUT),
    homeRoster,
    lastAdvancedAtMs: startedAtMs,
    loop: createLocalMatchLoopState({
      awayRoster,
      homeRoster,
      fielders: matchFielders,
      maxRecoverySpeed: resolvedMaxRecoverySpeed,
      recoveryRadius: resolvedRecoveryRadius,
      scoreLimit: resolvedScoreLimit,
      swingTuning: gameplayTuning.swing,
      wallElapsedMs: gameplayTuning.pitch.wallTravelMs,
      wallRestitution: gameplayTuning.pitch.wallRestitution
    }),
    nextActionAtMs: soloAssistSettings.enabled
      ? startedAtMs + soloAssistSettings.pitchDelayMs
      : startedAtMs,
    nextPitchDelayMs: resolvedNextPitchDelayMs,
    pitchDurationMs: resolvedPitchDurationMs,
    recoveryDelayMs: resolvedRecoveryDelayMs,
    scoreLimit: resolvedScoreLimit,
    setup,
    soloAssist: soloAssistSettings,
    tuning: gameplayTuning
  };
}

export function selectPlaySceneLoopTeam(
  adapter: PlaySceneLoopAdapter,
  { side, teamId }: SelectPlaySceneTeamInput
): PlaySceneLoopAdapter {
  assertKnownTeam(adapter.setup, teamId);

  return {
    ...adapter,
    setup: {
      ...adapter.setup,
      [side === "away" ? "awayTeamId" : "homeTeamId"]: teamId
    }
  };
}

export function startPlaySceneLoopAdapter(
  adapter: PlaySceneLoopAdapter,
  startedAtMs = adapter.lastAdvancedAtMs
): PlaySceneLoopAdapter {
  return createPlaySceneLoopAdapter({
    awayTeamId: adapter.setup.awayTeamId,
    fieldBounds: adapter.fieldBounds,
    homeTeamId: adapter.setup.homeTeamId,
    nextPitchDelayMs: adapter.nextPitchDelayMs,
    pitchDurationMs: adapter.pitchDurationMs,
    recoveryDelayMs: adapter.recoveryDelayMs,
    scoreLimit: adapter.scoreLimit,
    soloAssist: adapter.soloAssist,
    startedAtMs,
    tuning: adapter.tuning
  });
}

export function advancePlaySceneLoopAdapter(
  adapter: PlaySceneLoopAdapter,
  timeMs: number
): PlaySceneLoopAdapter {
  if (adapter.loop.phase.kind === "match-completed") {
    return adapter;
  }

  const elapsedMs = Math.max(0, timeMs - adapter.lastAdvancedAtMs);
  let movedAdapter = moveControlledFielder(adapter, timeMs);
  movedAdapter = applySoloPitchAssist(movedAdapter, timeMs);

  if (
    movedAdapter.loop.phase.kind !== "awaiting-recovery" ||
    timeMs < movedAdapter.nextActionAtMs
  ) {
    return movedAdapter;
  }

  const fieldedAdapter = moveAssistedFielderTowardBall(movedAdapter, elapsedMs);
  const recoveredLoop = advanceLocalMatchLoop(fieldedAdapter.loop, {
    type: "recover-ball"
  });

  return {
    ...fieldedAdapter,
    loop: recoveredLoop,
    nextActionAtMs:
      recoveredLoop.phase.kind === "awaiting-recovery"
        ? timeMs + fieldedAdapter.recoveryDelayMs
        : timeMs + fieldedAdapter.nextPitchDelayMs
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
  const callout = projectInteractionCallout(batterId, pitcher.id);

  return {
    ball: {
      position: cloneVector(adapter.loop.ball.position),
      velocity: cloneVector(adapter.loop.ball.velocity)
    },
    callout,
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
      calloutText: callout?.message ?? null,
      completionText: completion ? `Final: ${completion.finalScore}` : null,
      half: flow.match.inning.half,
      homeScore: flow.match.score.home,
      homeTeamName: adapter.homeRoster.displayName,
      inning: flow.match.inning.inning,
      outs: flow.match.inning.outs,
      pitcherName: pitcher.displayName
    },
    lastResult: adapter.loop.lastPlay?.ballResult.kind ?? null,
    phase: {
      ...adapter.loop.phase
    },
    setup: projectSetup(adapter.setup),
    wallTarget: {
      center: cloneVector(adapter.loop.settings.wallTarget.center),
      height: adapter.loop.settings.wallTarget.height,
      width: adapter.loop.settings.wallTarget.width
    }
  };
}

function projectInteractionCallout(
  batterId: string,
  pitcherId: string
): InteractionCallout | null {
  const context = getInteractionContext({
    matchup: {
      batterId,
      pitcherId
    },
    prompts: loadInteractionPrompts()
  });

  return context.callouts[0] ?? null;
}

function createPlaySceneMatchSetupState({
  awayTeamId,
  homeTeamId,
  rosters
}: {
  awayTeamId: string;
  homeTeamId: string;
  rosters: TeamRoster[];
}): PlaySceneMatchSetupState {
  const teams = rosters.map((roster) => ({
    id: roster.id,
    displayName: roster.displayName
  }));
  const setup = {
    awayTeamId,
    homeTeamId,
    teams
  };

  assertKnownTeam(setup, awayTeamId);
  assertKnownTeam(setup, homeTeamId);

  return setup;
}

function projectSetup(setup: PlaySceneMatchSetupState): PlaySceneSetupProjection {
  return {
    ...setup,
    awayTeamName: teamDisplayName(setup, setup.awayTeamId),
    homeTeamName: teamDisplayName(setup, setup.homeTeamId),
    teams: setup.teams.map((team) => ({ ...team }))
  };
}

function assertKnownTeam(
  setup: PlaySceneMatchSetupState,
  teamId: string
): void {
  if (!setup.teams.some((team) => team.id === teamId)) {
    throw new Error(`Missing play-scene roster: ${teamId}`);
  }
}

function teamDisplayName(
  setup: PlaySceneMatchSetupState,
  teamId: string
): string {
  return setup.teams.find((team) => team.id === teamId)?.displayName ?? teamId;
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

function applySoloPitchAssist(
  adapter: PlaySceneLoopAdapter,
  timeMs: number
): PlaySceneLoopAdapter {
  if (
    !adapter.soloAssist.enabled ||
    adapter.loop.phase.kind !== "ready-for-at-bat" ||
    timeMs < adapter.nextActionAtMs
  ) {
    return adapter;
  }

  return applyPitchControl(adapter, timeMs);
}

function moveAssistedFielderTowardBall(
  adapter: PlaySceneLoopAdapter,
  elapsedMs: number
): PlaySceneLoopAdapter {
  if (
    !adapter.soloAssist.enabled ||
    !adapter.soloAssist.fieldingRecovery ||
    adapter.loop.phase.kind !== "awaiting-recovery" ||
    !adapter.loop.lastPlay ||
    !isIdleFieldingInput(adapter.fieldingInput) ||
    elapsedMs <= 0
  ) {
    return adapter;
  }

  const nearest = findNearestFielder(
    adapter.loop.fielders,
    adapter.loop.ball.position
  );

  if (
    !nearest ||
    nearest.distance <= adapter.loop.settings.recoveryRadius ||
    nearest.fielder.speed <= 0
  ) {
    return adapter;
  }

  const travelMs = Math.min(
    elapsedMs,
    (nearest.distance / nearest.fielder.speed) * 1_000
  );

  if (travelMs <= 0) {
    return adapter;
  }

  return {
    ...adapter,
    loop: advanceLocalMatchLoop(adapter.loop, {
      type: "move-fielder",
      fielderId: nearest.fielder.id,
      input: {
        axisX: (adapter.loop.ball.position.x - nearest.fielder.position.x) /
          nearest.distance,
        axisY: (adapter.loop.ball.position.y - nearest.fielder.position.y) /
          nearest.distance
      },
      elapsedMs: travelMs,
      bounds: adapter.fieldBounds
    })
  };
}

function findNearestFielder(
  fielders: readonly Fielder[],
  position: Vector2
): { distance: number; fielder: Fielder } | null {
  return fielders.reduce<{ distance: number; fielder: Fielder } | null>(
    (nearest, fielder) => {
      const distance = vectorDistance(fielder.position, position);

      if (!nearest || distance < nearest.distance) {
        return {
          distance,
          fielder
        };
      }

      return nearest;
    },
    null
  );
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

function createDefaultFielders(roster: TeamRoster): Fielder[] {
  return getPlayersByBattingOrder(roster).map((player, index) => {
    const slot =
      DEFAULT_FIELDER_SLOTS[index] ??
      DEFAULT_FIELDER_SLOTS[DEFAULT_FIELDER_SLOTS.length - 1];

    return {
      id: player.id,
      position: cloneVector(slot.position),
      speed: slot.speed
    };
  });
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

function normalizeSoloAssist(
  input: PlaySceneSoloAssistInput,
  defaults: GameplayAssistTuning
): PlaySceneSoloAssistSettings {
  if (typeof input === "boolean") {
    return {
      ...defaults,
      enabled: input
    };
  }

  return {
    enabled: input.enabled ?? defaults.enabled,
    fieldingRecovery: input.fieldingRecovery ?? defaults.fieldingRecovery,
    pitchDelayMs: Math.max(0, input.pitchDelayMs ?? defaults.pitchDelayMs)
  };
}

function vectorDistance(left: Vector2, right: Vector2): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

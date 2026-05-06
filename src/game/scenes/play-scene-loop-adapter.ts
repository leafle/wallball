import { loadPredefinedRosters } from "../data/fixtures";
import type { PlayerProfile, TeamRoster } from "../domain/rosters";
import type { HalfInning } from "../domain/rules";
import type {
  BallPhysicsSnapshot,
  Vector2,
  WallTarget
} from "../systems/ball-physics";
import type { BallResultKind } from "../systems/ball-results";
import type { Fielder } from "../systems/fielding";
import {
  advanceLocalMatchLoop,
  createLocalMatchLoopState,
  type LocalMatchLoopState,
  type LocalMatchPhase
} from "../systems/local-match-loop";

export interface PlaySceneLoopAdapter {
  awayRoster: TeamRoster;
  homeRoster: TeamRoster;
  loop: LocalMatchLoopState;
  nextActionAtMs: number;
  nextPitchDelayMs: number;
  pitchDurationMs: number;
  recoveryDelayMs: number;
}

export interface CreatePlaySceneLoopAdapterInput {
  awayTeamId?: string;
  fielders?: readonly Fielder[];
  homeTeamId?: string;
  nextPitchDelayMs?: number;
  pitchDurationMs?: number;
  recoveryDelayMs?: number;
  startedAtMs?: number;
}

export interface PlaySceneLoopProjection {
  ball: BallPhysicsSnapshot;
  fielders: PlaySceneFielderProjection[];
  hud: PlaySceneHudProjection;
  lastResult: BallResultKind | null;
  phase: LocalMatchPhase;
  wallTarget: WallTarget;
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
  fielders = DEFAULT_FIELDERS,
  homeTeamId = DEFAULT_HOME_TEAM_ID,
  nextPitchDelayMs = DEFAULT_NEXT_PITCH_DELAY_MS,
  pitchDurationMs = DEFAULT_PITCH_DURATION_MS,
  recoveryDelayMs = DEFAULT_RECOVERY_DELAY_MS,
  startedAtMs = 0
}: CreatePlaySceneLoopAdapterInput = {}): PlaySceneLoopAdapter {
  const rosters = loadPredefinedRosters();
  const awayRoster = findRoster(rosters, awayTeamId);
  const homeRoster = findRoster(rosters, homeTeamId);

  return {
    awayRoster,
    homeRoster,
    loop: createLocalMatchLoopState({
      awayRoster,
      homeRoster,
      fielders,
      maxRecoverySpeed: 1_000,
      recoveryRadius: 600
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
  let nextAdapter = adapter;
  let actionsApplied = 0;

  while (timeMs >= nextAdapter.nextActionAtMs && actionsApplied < 3) {
    nextAdapter = advanceNextLoopAction(nextAdapter);
    actionsApplied += 1;
  }

  return nextAdapter;
}

export function projectPlaySceneLoopState(
  adapter: PlaySceneLoopAdapter
): PlaySceneLoopProjection {
  const { flow } = adapter.loop;
  const batterId = adapter.loop.phase.batterId;
  const fieldingRoster = getFieldingRoster(adapter);
  const pitcher = getPitcher(fieldingRoster);

  return {
    ball: {
      position: cloneVector(adapter.loop.ball.position),
      velocity: cloneVector(adapter.loop.ball.velocity)
    },
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
      pitcherName: pitcher.displayName
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

function advanceNextLoopAction(
  adapter: PlaySceneLoopAdapter
): PlaySceneLoopAdapter {
  if (adapter.loop.phase.kind === "ready-for-at-bat") {
    return {
      ...adapter,
      loop: advanceLocalMatchLoop(adapter.loop, {
        type: "pitch",
        idealContactMs: adapter.pitchDurationMs,
        pitchStartedAtMs: adapter.nextActionAtMs,
        pitchX: 0,
        targetX: 0
      }),
      nextActionAtMs: adapter.nextActionAtMs + adapter.pitchDurationMs
    };
  }

  if (adapter.loop.phase.kind === "pitch-in-flight") {
    const pitch = adapter.loop.currentPitch;

    if (!pitch) {
      return {
        ...adapter,
        nextActionAtMs: adapter.nextActionAtMs + adapter.recoveryDelayMs
      };
    }

    return {
      ...adapter,
      loop: advanceLocalMatchLoop(adapter.loop, {
        type: "swing",
        swingAtMs: pitch.pitchStartedAtMs + pitch.idealContactMs
      }),
      nextActionAtMs: adapter.nextActionAtMs + adapter.recoveryDelayMs
    };
  }

  return {
    ...adapter,
    loop: advanceLocalMatchLoop(adapter.loop, {
      type: "recover-ball"
    }),
    nextActionAtMs: adapter.nextActionAtMs + adapter.nextPitchDelayMs
  };
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

import { GAME_HEIGHT, GAME_WIDTH } from "../dimensions";
import { loadPredefinedRosters } from "../data/fixtures";
import type { GameplayControlIntent } from "../input/game-controls";
import {
  createPlaySceneAdapterInputFromPreferences,
  type GameplayPreferences
} from "../preferences";
import {
  advancePlaySceneLoopAdapter,
  applyPlaySceneControlIntent,
  configurePlaySceneLoopAdapter,
  createPlaySceneLoopAdapter,
  projectPlaySceneLoopState,
  selectPlaySceneLoopTeam,
  startPlaySceneLoopAdapter,
  type PlaySceneFielderProjection,
  type PlaySceneHudProjection,
  type PlaySceneLoopAdapter,
  type PlaySceneLoopProjection,
  type PlaySceneRunState,
  type PlaySceneSetupProjection,
  type PlaySceneSetupSide
} from "./play-scene-loop-adapter";
import type { LocalMatchLoopState } from "../systems/local-match-loop";

export const WALLBALL_PLAY_SCENE_KEY = "wallball-play";
export const WALLBALL_PLAY_SCENE_PROJECTION_EVENT =
  "wallball:play-scene-projection";

export interface WallballPlaySceneProjectionEventDetail {
  loop: LocalMatchLoopState;
  projection: PlaySceneLoopProjection;
}

interface SceneObject {
  setOrigin?: (x: number, y?: number) => SceneObject;
  setInteractive?: () => SceneObject;
  setPosition?: (x: number, y: number) => SceneObject;
  setRotation?: (radians: number) => SceneObject;
  setStrokeStyle?: (
    lineWidth: number,
    color: number,
    alpha?: number
  ) => SceneObject;
  setText?: (text: string) => SceneObject;
  on?: (event: string, callback: () => void) => SceneObject;
}

interface PlaySceneContext {
  add: {
    circle: (
      x: number,
      y: number,
      radius: number,
      color: number,
      alpha?: number
    ) => SceneObject;
    rectangle: (
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
      alpha?: number
    ) => SceneObject;
    text: (
      x: number,
      y: number,
      text: string,
      style: Record<string, string>
    ) => SceneObject;
  };
  wallballPlay?: PlaySceneRuntime;
  wallballProjectionTarget?: Pick<EventTarget, "dispatchEvent">;
}

interface PlaySceneRuntime {
  adapter: PlaySceneLoopAdapter;
  ball: SceneObject;
  feedback: PlaySceneFeedbackObjects;
  feedbackIntensity: PlaySceneFeedbackIntensity;
  fielders: PlaySceneFielderObjects[];
  hud: PlaySceneHudObjects;
  lastProjectionEventKey: string;
  setup: PlaySceneSetupObjects;
}

interface PlaySceneActors {
  ball: SceneObject;
  fielders: PlaySceneFielderObjects[];
}

interface PlaySceneFielderObjects {
  body: SceneObject;
  head: SceneObject;
}

interface PlaySceneFeedbackObjects {
  primary: SceneObject;
  result: SceneObject;
  secondary: SceneObject;
  wall: SceneObject;
}

interface PlaySceneHudObjects {
  awayScore: SceneObject;
  batter: SceneObject;
  callout: SceneObject;
  homeScore: SceneObject;
  inning: SceneObject;
  matchup: SceneObject;
  outs: SceneObject;
}

interface PlaySceneSetupObjects {
  awayTeam: SceneObject;
  homeTeam: SceneObject;
  pause: SceneObject;
  restart: SceneObject;
  start: SceneObject;
}

export interface WallballPlaySceneOptions {
  preferences?: GameplayPreferences;
}

type PlaySceneFeedbackIntensity = "full" | "reduced";

const COLORS = {
  ball: 0xfffaf0,
  batter: 0xfffaf0,
  field: 0x1f2d28,
  fieldLine: 0xe1d6b8,
  fielder: 0x4cb7a5,
  hud: 0x10100f,
  hudAccent: 0xf5c84b,
  pitcher: 0x4cb7a5,
  sky: 0x101820,
  wall: 0x34382f,
  wallTarget: 0xf5c84b
} as const;

export const WALLBALL_PLAY_SCENE_CONFIG = createWallballPlaySceneConfig();

export function createWallballPlaySceneConfig(
  options: WallballPlaySceneOptions = {}
) {
  return {
    key: WALLBALL_PLAY_SCENE_KEY,
    create(this: PlaySceneContext): void {
      createWallballPlayScene.call(this, options);
    },
    update: updateWallballPlayScene
  };
}

export function createWallballPlayScene(
  this: PlaySceneContext,
  options: WallballPlaySceneOptions = {}
): void {
  const adapter = createPlaySceneLoopAdapter(
    createAdapterInputFromPreferences(options.preferences)
  );
  const projection = projectPlaySceneLoopState(adapter);
  const feedbackIntensity = feedbackIntensityFromPreferences(options.preferences);

  drawBackdrop.call(this);
  drawWallAndTarget.call(this, projection);
  drawCourt.call(this);
  const actors = drawActors.call(this, projection);
  const hud = drawHud.call(this, projection.hud);
  const feedback = drawFeedback.call(
    this,
    projection.feedback,
    feedbackIntensity
  );
  const setup = drawSetupControls.call(this, projection.setup);

  this.wallballPlay = {
    adapter,
    ball: actors.ball,
    feedback,
    feedbackIntensity,
    fielders: actors.fielders,
    hud,
    lastProjectionEventKey: "",
    setup
  };
  emitPlaySceneProjection(this, this.wallballPlay, projection);
}

export function updateWallballPlayScene(
  this: PlaySceneContext,
  timeMs: number,
  _deltaMs?: number
): void {
  const runtime = this.wallballPlay;

  if (!runtime) {
    return;
  }

  runtime.adapter = advancePlaySceneLoopAdapter(runtime.adapter, timeMs);
  renderAndEmitProjection(this, runtime);
}

export function updateWallballPlayScenePreferences(
  this: PlaySceneContext,
  preferences: GameplayPreferences
): void {
  const runtime = this.wallballPlay;

  if (!runtime) {
    return;
  }

  runtime.feedbackIntensity = feedbackIntensityFromPreferences(preferences);
  runtime.adapter = configurePlaySceneLoopAdapter(
    runtime.adapter,
    createPlaySceneAdapterInputFromPreferences(preferences, {
      validTeamIds: runtime.adapter.setup.teams.map((team) => team.id)
    })
  );
  renderAndEmitProjection(this, runtime);
}

export function dispatchWallballPlaySceneControlIntent(
  this: PlaySceneContext,
  intent: GameplayControlIntent,
  timeMs: number
): void {
  const runtime = this.wallballPlay;

  if (!runtime) {
    return;
  }

  runtime.adapter = applyPlaySceneControlIntent(runtime.adapter, intent, timeMs);
  renderAndEmitProjection(this, runtime);
}

function drawBackdrop(this: PlaySceneContext): void {
  this.add.rectangle(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2,
    GAME_WIDTH,
    GAME_HEIGHT,
    COLORS.sky
  );
  this.add.rectangle(640, 418, 1184, 524, COLORS.field, 0.96).setStrokeStyle?.(
    4,
    COLORS.fielder,
    0.62
  );
}

function drawWallAndTarget(
  this: PlaySceneContext,
  projection: PlaySceneLoopProjection
): void {
  this.add.rectangle(640, 146, 910, 180, COLORS.wall).setStrokeStyle?.(
    3,
    COLORS.fieldLine,
    0.42
  );
  this.add
    .rectangle(
      projection.wallTarget.center.x,
      projection.wallTarget.center.y,
      projection.wallTarget.width,
      projection.wallTarget.height,
      COLORS.wallTarget,
      0.12
    )
    .setStrokeStyle?.(5, COLORS.wallTarget, 0.92);
  this.add
    .rectangle(
      projection.wallTarget.center.x,
      projection.wallTarget.center.y,
      projection.wallTarget.width * 0.5,
      projection.wallTarget.height * 0.5,
      COLORS.wallTarget,
      0.08
    )
    .setStrokeStyle?.(2, COLORS.wallTarget, 0.58);
}

function drawCourt(this: PlaySceneContext): void {
  this.add.rectangle(640, 482, 440, 330, 0x2f3b32, 0.64).setStrokeStyle?.(
    3,
    COLORS.fielder,
    0.28
  );
  this.add.rectangle(640, 632, 760, 4, COLORS.fieldLine, 0.38);
  this.add.rectangle(640, 504, 4, 258, COLORS.fieldLine, 0.16);
  this.add.rectangle(710, 464, 118, 90, 0x121512, 0.28).setStrokeStyle?.(
    2,
    COLORS.fieldLine,
    0.28
  );
  this.add.rectangle(640, 598, 132, 38, 0x10100f, 0.34).setStrokeStyle?.(
    2,
    COLORS.fieldLine,
    0.22
  );
}

function drawActors(
  this: PlaySceneContext,
  projection: PlaySceneLoopProjection
): PlaySceneActors {
  drawPlayer.call(this, 640, 590, COLORS.pitcher, true);
  drawPlayer.call(this, 742, 458, COLORS.batter, false);
  this.add.rectangle(684, 438, 96, 12, COLORS.wallTarget).setRotation?.(-0.34);

  const fielders: PlaySceneFielderObjects[] = [];

  for (const fielder of projection.fielders) {
    fielders.push(drawFielder.call(this, fielder.position.x, fielder.position.y));
  }

  const ball = this.add.circle(
    projection.ball.position.x,
    projection.ball.position.y,
    12,
    COLORS.ball
  );
  ball.setStrokeStyle?.(3, 0x10100f, 0.82);

  return {
    ball,
    fielders
  };
}

function drawPlayer(
  this: PlaySceneContext,
  x: number,
  y: number,
  color: number,
  foreground: boolean
): void {
  const scale = foreground ? 1 : 0.78;

  this.add.circle(x, y - 50 * scale, 20 * scale, color);
  this.add.rectangle(x, y, 58 * scale, 82 * scale, color).setStrokeStyle?.(
    2,
    0x10100f,
    0.22
  );
  this.add.rectangle(x - 19 * scale, y + 60 * scale, 16 * scale, 56 * scale, color);
  this.add.rectangle(x + 19 * scale, y + 60 * scale, 16 * scale, 56 * scale, color);
}

function drawFielder(
  this: PlaySceneContext,
  x: number,
  y: number
): PlaySceneFielderObjects {
  const head = this.add.circle(x, y - 14, 14, COLORS.fielder);
  const body = this.add.rectangle(x, y + 18, 36, 48, COLORS.fielder);
  body.setStrokeStyle?.(2, 0x10100f, 0.2);

  return {
    body,
    head
  };
}

function drawHud(
  this: PlaySceneContext,
  state: PlaySceneHudProjection
): PlaySceneHudObjects {
  this.add.rectangle(148, 72, 232, 96, COLORS.hud, 0.78).setStrokeStyle?.(
    2,
    COLORS.hudAccent,
    0.54
  );
  this.add.rectangle(414, 72, 250, 96, COLORS.hud, 0.72).setStrokeStyle?.(
    2,
    COLORS.fielder,
    0.42
  );
  this.add.rectangle(683, 72, 250, 96, COLORS.hud, 0.72).setStrokeStyle?.(
    2,
    COLORS.fielder,
    0.42
  );
  this.add.rectangle(324, 140, 548, 42, COLORS.hud, 0.6).setStrokeStyle?.(
    2,
    COLORS.hudAccent,
    0.28
  );

  return {
    awayScore: addHudText.call(
      this,
      314,
      40,
      `${state.awayTeamName} ${state.awayScore}`
    ),
    batter: addHudText.call(this, 584, 40, `Batter ${state.batterName}`),
    callout: addCalloutText.call(this, 52, 122, state.calloutText ?? ""),
    homeScore: addHudText.call(
      this,
      314,
      76,
      `${state.homeTeamName} ${state.homeScore}`
    ),
    inning: addHudText.call(this, 52, 40, `Inning ${state.inning}`),
    matchup: addHudText.call(
      this,
      584,
      76,
      `${state.pitcherName} vs ${state.batterName}`
    ),
    outs: addHudText.call(this, 52, 76, `Outs ${state.outs}`)
  };
}

function drawFeedback(
  this: PlaySceneContext,
  feedback: PlaySceneLoopProjection["feedback"],
  intensity: PlaySceneFeedbackIntensity
): PlaySceneFeedbackObjects {
  this.add.rectangle(294, 656, 508, 82, COLORS.hud, 0.58).setStrokeStyle?.(
    2,
    COLORS.fielder,
    0.32
  );

  return {
    primary: addFeedbackText.call(this, 52, 622, feedback.primary.text),
    result: addFeedbackText.call(this, 52, 678, feedbackResultText(feedback)),
    secondary: addFeedbackText.call(
      this,
      52,
      650,
      feedbackSecondaryText(feedback, intensity)
    ),
    wall: addFeedbackText.call(this, 584, 202, feedbackWallText(feedback, intensity))
  };
}

function drawSetupControls(
  this: PlaySceneContext,
  setup: PlaySceneSetupProjection
): PlaySceneSetupObjects {
  this.add.rectangle(1_030, 78, 340, 112, COLORS.hud, 0.72).setStrokeStyle?.(
    2,
    COLORS.hudAccent,
    0.46
  );

  const awayTeam = addSetupText.call(
    this,
    884,
    30,
    `Away ${setup.awayTeamName}`
  );
  const homeTeam = addSetupText.call(
    this,
    884,
    64,
    `Home ${setup.homeTeamName}`
  );
  const start = addSetupText.call(this, 1_114, 30, "Start / Restart");
  const pause = addSetupText.call(this, 1_114, 64, "Pause");
  const restart = addSetupText.call(this, 1_114, 98, "Restart");

  bindSetupControl(awayTeam, () => {
    cycleSetupTeam.call(this, "away");
  });
  bindSetupControl(homeTeam, () => {
    cycleSetupTeam.call(this, "home");
  });
  bindSetupControl(start, () => {
    startSetupMatch.call(this);
  });
  bindSetupControl(pause, () => {
    toggleSetupPause.call(this);
  });
  bindSetupControl(restart, () => {
    restartSetupMatch.call(this);
  });

  return {
    awayTeam,
    homeTeam,
    pause,
    restart,
    start
  };
}

function addHudText(
  this: PlaySceneContext,
  x: number,
  y: number,
  text: string
): SceneObject {
  return this.add.text(x, y, text, {
    color: "#fffaf0",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "24px",
    fontStyle: "bold"
  });
}

function addSetupText(
  this: PlaySceneContext,
  x: number,
  y: number,
  text: string
): SceneObject {
  return this.add.text(x, y, text, {
    color: "#fffaf0",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "20px",
    fontStyle: "bold"
  });
}

function addCalloutText(
  this: PlaySceneContext,
  x: number,
  y: number,
  text: string
): SceneObject {
  return this.add.text(x, y, text, {
    color: "#fffaf0",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "18px",
    fontStyle: "bold"
  });
}

function addFeedbackText(
  this: PlaySceneContext,
  x: number,
  y: number,
  text: string
): SceneObject {
  return this.add.text(x, y, text, {
    color: "#fffaf0",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "20px",
    fontStyle: "bold"
  });
}

function bindSetupControl(object: SceneObject, callback: () => void): void {
  object.setInteractive?.();
  object.on?.("pointerdown", callback);
}

function renderProjection(
  runtime: PlaySceneRuntime,
  projection: PlaySceneLoopProjection
): void {
  renderHud(runtime.hud, projection.hud);
  renderFeedback(
    runtime.feedback,
    projection.feedback,
    runtime.feedbackIntensity
  );
  renderSetup(runtime.setup, projection.setup, projection.runState);
  runtime.ball.setPosition?.(
    projection.ball.position.x,
    projection.ball.position.y
  );

  projection.fielders.forEach((fielder, index) => {
    renderFielder(runtime.fielders[index], fielder);
  });
}

function renderAndEmitProjection(
  context: PlaySceneContext,
  runtime: PlaySceneRuntime
): void {
  const projection = projectPlaySceneLoopState(runtime.adapter);

  renderProjection(runtime, projection);
  emitPlaySceneProjection(context, runtime, projection);
}

function cycleSetupTeam(
  this: PlaySceneContext,
  side: PlaySceneSetupSide
): void {
  const runtime = this.wallballPlay;

  if (!runtime) {
    return;
  }

  const setup = projectPlaySceneLoopState(runtime.adapter).setup;
  const currentTeamId = side === "away" ? setup.awayTeamId : setup.homeTeamId;
  const currentIndex = setup.teams.findIndex((team) => team.id === currentTeamId);
  const nextTeam = setup.teams[(currentIndex + 1) % setup.teams.length];

  if (!nextTeam) {
    return;
  }

  runtime.adapter = selectPlaySceneLoopTeam(runtime.adapter, {
    side,
    teamId: nextTeam.id
  });
  renderAndEmitProjection(this, runtime);
}

function startSetupMatch(this: PlaySceneContext): void {
  const runtime = this.wallballPlay;

  if (!runtime) {
    return;
  }

  runtime.adapter = startPlaySceneLoopAdapter(runtime.adapter, currentTimeMs());
  renderAndEmitProjection(this, runtime);
}

function toggleSetupPause(this: PlaySceneContext): void {
  dispatchWallballPlaySceneControlIntent.call(
    this,
    {
      kind: "pause-toggle",
      source: "touch"
    },
    currentTimeMs()
  );
}

function restartSetupMatch(this: PlaySceneContext): void {
  dispatchWallballPlaySceneControlIntent.call(
    this,
    {
      kind: "restart",
      source: "touch"
    },
    currentTimeMs()
  );
}

function emitPlaySceneProjection(
  context: PlaySceneContext,
  runtime: PlaySceneRuntime,
  projection: PlaySceneLoopProjection
): void {
  const eventKey = projectionEventKey(projection);

  if (runtime.lastProjectionEventKey === eventKey) {
    return;
  }

  runtime.lastProjectionEventKey = eventKey;
  const target =
    context.wallballProjectionTarget ??
    (typeof window === "undefined" ? null : window);

  target?.dispatchEvent(
    createProjectionEvent({
      loop: runtime.adapter.loop,
      projection
    })
  );
}

function projectionEventKey(projection: PlaySceneLoopProjection): string {
  return [
    projection.phase.kind,
    projection.runState.kind,
    projection.hud.awayScore,
    projection.hud.homeScore,
    projection.hud.batterName,
    projection.hud.pitcherName,
    projection.setup.awayTeamId,
    projection.setup.homeTeamId,
    projection.feedback.primary.text,
    projection.feedback.secondary?.text ?? "",
    projection.feedback.result?.text ?? "",
    projection.feedback.wall?.text ?? "",
    projection.completion?.finalScore ?? "",
    projection.completion?.winnerTeamId ?? ""
  ].join("|");
}

function createProjectionEvent(
  detail: WallballPlaySceneProjectionEventDetail
): Event {
  if (typeof CustomEvent === "function") {
    return new CustomEvent(WALLBALL_PLAY_SCENE_PROJECTION_EVENT, {
      detail
    });
  }

  const event = new Event(
    WALLBALL_PLAY_SCENE_PROJECTION_EVENT
  ) as CustomEvent<WallballPlaySceneProjectionEventDetail>;
  Object.defineProperty(event, "detail", {
    value: detail
  });

  return event;
}

function renderHud(
  hud: PlaySceneHudObjects,
  state: PlaySceneHudProjection
): void {
  hud.inning.setText?.(`Inning ${state.inning}`);
  hud.outs.setText?.(`Outs ${state.outs}`);
  hud.awayScore.setText?.(`${state.awayTeamName} ${state.awayScore}`);
  hud.homeScore.setText?.(`${state.homeTeamName} ${state.homeScore}`);
  hud.batter.setText?.(`Batter ${state.batterName}`);
  hud.matchup.setText?.(`${state.pitcherName} vs ${state.batterName}`);
  hud.callout.setText?.(state.calloutText ?? "");
}

function renderFeedback(
  feedbackObjects: PlaySceneFeedbackObjects,
  feedback: PlaySceneLoopProjection["feedback"],
  intensity: PlaySceneFeedbackIntensity
): void {
  feedbackObjects.primary.setText?.(feedback.primary.text);
  feedbackObjects.secondary.setText?.(feedbackSecondaryText(feedback, intensity));
  feedbackObjects.result.setText?.(feedbackResultText(feedback));
  feedbackObjects.wall.setText?.(feedbackWallText(feedback, intensity));
}

function feedbackResultText(
  feedback: PlaySceneLoopProjection["feedback"]
): string {
  if (!feedback.result || feedback.result.text === feedback.primary.text) {
    return "";
  }

  return feedback.result.text;
}

function feedbackSecondaryText(
  feedback: PlaySceneLoopProjection["feedback"],
  intensity: PlaySceneFeedbackIntensity
): string {
  return intensity === "reduced" ? "" : feedback.secondary?.text ?? "";
}

function feedbackWallText(
  feedback: PlaySceneLoopProjection["feedback"],
  intensity: PlaySceneFeedbackIntensity
): string {
  return intensity === "reduced" ? "" : feedback.wall?.text ?? "";
}

function feedbackIntensityFromPreferences(
  preferences: GameplayPreferences | undefined
): PlaySceneFeedbackIntensity {
  return preferences?.reducedFeedbackIntensity ? "reduced" : "full";
}

function createAdapterInputFromPreferences(
  preferences: GameplayPreferences | undefined
) {
  if (!preferences) {
    return {};
  }

  return createPlaySceneAdapterInputFromPreferences(preferences, {
    validTeamIds: preferencesValidTeamIds()
  });
}

function preferencesValidTeamIds(): string[] {
  return loadPredefinedRosters().map((team) => team.id);
}

function renderSetup(
  setupObjects: PlaySceneSetupObjects,
  setup: PlaySceneSetupProjection,
  runState: PlaySceneRunState
): void {
  setupObjects.awayTeam.setText?.(`Away ${setup.awayTeamName}`);
  setupObjects.homeTeam.setText?.(`Home ${setup.homeTeamName}`);
  setupObjects.start.setText?.("Start / Restart");
  setupObjects.pause.setText?.(runState.kind === "paused" ? "Resume" : "Pause");
  setupObjects.restart.setText?.("Restart");
}

function renderFielder(
  objects: PlaySceneFielderObjects | undefined,
  fielder: PlaySceneFielderProjection
): void {
  objects?.head.setPosition?.(fielder.position.x, fielder.position.y - 14);
  objects?.body.setPosition?.(fielder.position.x, fielder.position.y + 18);
}

function currentTimeMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

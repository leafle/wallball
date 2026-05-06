import { GAME_HEIGHT, GAME_WIDTH } from "../dimensions";

export const WALLBALL_PLAY_SCENE_KEY = "wallball-play";

interface SceneObject {
  setOrigin?: (x: number, y?: number) => SceneObject;
  setRotation?: (radians: number) => SceneObject;
  setStrokeStyle?: (
    lineWidth: number,
    color: number,
    alpha?: number
  ) => SceneObject;
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
}

interface PlaySceneDemoState {
  awayScore: number;
  awayTeam: string;
  batter: string;
  homeScore: number;
  homeTeam: string;
  inning: number;
  outs: number;
  pitcher: string;
}

const DEMO_STATE: PlaySceneDemoState = {
  awayScore: 0,
  awayTeam: "Champions",
  batter: "Cainer",
  homeScore: 0,
  homeTeam: "Woodland",
  inning: 1,
  outs: 0,
  pitcher: "Danny"
};

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

export const WALLBALL_PLAY_SCENE_CONFIG = {
  key: WALLBALL_PLAY_SCENE_KEY,
  create: createWallballPlayScene
};

export function createWallballPlayScene(this: PlaySceneContext): void {
  drawBackdrop.call(this);
  drawWallAndTarget.call(this);
  drawCourt.call(this);
  drawActors.call(this);
  drawHud.call(this, DEMO_STATE);
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

function drawWallAndTarget(this: PlaySceneContext): void {
  this.add.rectangle(640, 146, 910, 180, COLORS.wall).setStrokeStyle?.(
    3,
    COLORS.fieldLine,
    0.42
  );
  this.add.rectangle(640, 138, 190, 108, COLORS.wallTarget, 0.12).setStrokeStyle?.(
    5,
    COLORS.wallTarget,
    0.92
  );
  this.add.rectangle(640, 138, 96, 54, COLORS.wallTarget, 0.08).setStrokeStyle?.(
    2,
    COLORS.wallTarget,
    0.58
  );
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

function drawActors(this: PlaySceneContext): void {
  drawPlayer.call(this, 640, 590, COLORS.pitcher, true);
  drawPlayer.call(this, 742, 458, COLORS.batter, false);
  this.add.rectangle(684, 438, 96, 12, COLORS.wallTarget).setRotation?.(-0.34);

  for (const fielder of [
    { x: 430, y: 318 },
    { x: 850, y: 316 },
    { x: 554, y: 384 },
    { x: 742, y: 386 }
  ]) {
    drawFielder.call(this, fielder.x, fielder.y);
  }

  this.add.circle(676, 404, 12, COLORS.ball).setStrokeStyle?.(3, 0x10100f, 0.82);
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

function drawFielder(this: PlaySceneContext, x: number, y: number): void {
  this.add.circle(x, y - 14, 14, COLORS.fielder);
  this.add.rectangle(x, y + 18, 36, 48, COLORS.fielder).setStrokeStyle?.(
    2,
    0x10100f,
    0.2
  );
}

function drawHud(
  this: PlaySceneContext,
  state: PlaySceneDemoState
): void {
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

  addHudText.call(this, 52, 40, `Inning ${state.inning}`);
  addHudText.call(this, 52, 76, `Outs ${state.outs}`);
  addHudText.call(this, 314, 40, `${state.awayTeam} ${state.awayScore}`);
  addHudText.call(this, 314, 76, `${state.homeTeam} ${state.homeScore}`);
  addHudText.call(this, 584, 40, `Batter ${state.batter}`);
  addHudText.call(this, 584, 76, `${state.pitcher} vs ${state.batter}`);
}

function addHudText(
  this: PlaySceneContext,
  x: number,
  y: number,
  text: string
): void {
  this.add.text(x, y, text, {
    color: "#fffaf0",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "24px",
    fontStyle: "bold"
  });
}

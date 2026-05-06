export interface FramePoint {
  xPercent: number;
  yPercent: number;
}

export interface FrameBounds {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  rightPercent: number;
  bottomPercent: number;
}

export interface FrameActor {
  center: FramePoint;
  bounds: FrameBounds;
  releasePoint: FramePoint;
}

export type ControlZoneAction = "pitch" | "swing";

export interface ControlZone {
  action: ControlZoneAction;
  bounds: FrameBounds;
}

export interface WallFacingCameraFrame {
  activePlayBounds: FrameBounds;
  batter: FrameActor;
  controlZones: ControlZone[];
  pitchPath: {
    from: FramePoint;
    contact: FramePoint;
    wallTarget: FramePoint;
  };
  pitcher: FrameActor;
  wall: FrameBounds;
  wallTarget: FrameActor;
}

export function createWallFacingCameraFrame(): WallFacingCameraFrame {
  const pitcher = actor(50, 86, 8, 16, { xPercent: 50, yPercent: 78 });
  const batter = actor(59, 64, 6, 16, { xPercent: 56, yPercent: 64 });
  const wallTarget = actor(50, 19, 14, 14, { xPercent: 50, yPercent: 19 });
  const wall = bounds(14, 5, 72, 30);

  return {
    activePlayBounds: bounds(32, 10, 36, 84),
    batter,
    controlZones: [
      {
        action: "pitch",
        bounds: bounds(8, 70, 22, 24)
      },
      {
        action: "swing",
        bounds: bounds(70, 70, 22, 24)
      }
    ],
    pitchPath: {
      from: pitcher.releasePoint,
      contact: batter.center,
      wallTarget: wallTarget.center
    },
    pitcher,
    wall,
    wallTarget
  };
}

export function createWallFacingCameraStyle(
  frame: WallFacingCameraFrame = createWallFacingCameraFrame()
): string {
  const pitchZone = getControlZone(frame, "pitch");
  const swingZone = getControlZone(frame, "swing");
  const vars: Array<[string, number]> = [
    ["--wall-left", frame.wall.leftPercent],
    ["--wall-top", frame.wall.topPercent],
    ["--wall-width", frame.wall.widthPercent],
    ["--wall-height", frame.wall.heightPercent],
    ["--wall-target-x", frame.wallTarget.center.xPercent],
    ["--wall-target-y", frame.wallTarget.center.yPercent],
    ["--wall-target-width", frame.wallTarget.bounds.widthPercent],
    ["--wall-target-height", frame.wallTarget.bounds.heightPercent],
    ["--pitcher-x", frame.pitcher.center.xPercent],
    ["--pitcher-y", frame.pitcher.center.yPercent],
    ["--pitcher-width", frame.pitcher.bounds.widthPercent],
    ["--pitcher-height", frame.pitcher.bounds.heightPercent],
    ["--batter-x", frame.batter.center.xPercent],
    ["--batter-y", frame.batter.center.yPercent],
    ["--batter-width", frame.batter.bounds.widthPercent],
    ["--batter-height", frame.batter.bounds.heightPercent],
    ["--pitch-path-start-x", frame.pitchPath.from.xPercent],
    ["--pitch-path-start-y", frame.pitchPath.from.yPercent],
    ["--pitch-path-contact-x", frame.pitchPath.contact.xPercent],
    ["--pitch-path-contact-y", frame.pitchPath.contact.yPercent],
    ["--pitch-control-left", pitchZone.bounds.leftPercent],
    ["--pitch-control-top", pitchZone.bounds.topPercent],
    ["--pitch-control-width", pitchZone.bounds.widthPercent],
    ["--pitch-control-height", pitchZone.bounds.heightPercent],
    ["--swing-control-left", swingZone.bounds.leftPercent],
    ["--swing-control-top", swingZone.bounds.topPercent],
    ["--swing-control-width", swingZone.bounds.widthPercent],
    ["--swing-control-height", swingZone.bounds.heightPercent]
  ];

  return vars
    .map(([name, value]) => `${name}: ${formatPercent(value)};`)
    .join(" ");
}

export function calculateWallFacingPitchPosition({
  frame,
  laneOffset,
  laneWidthPercent,
  progress
}: {
  frame: WallFacingCameraFrame;
  laneOffset: number;
  laneWidthPercent: number;
  progress: number;
}): FramePoint {
  const clampedProgress = clamp(progress, 0, 1);
  const contactXPercent =
    frame.pitchPath.from.xPercent + laneOffset * laneWidthPercent;

  return {
    xPercent: interpolate(
      frame.pitchPath.from.xPercent,
      contactXPercent,
      clampedProgress
    ),
    yPercent: interpolate(
      frame.pitchPath.from.yPercent,
      frame.pitchPath.contact.yPercent,
      clampedProgress
    )
  };
}

function actor(
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number,
  releasePoint: FramePoint = { xPercent, yPercent }
): FrameActor {
  return {
    center: { xPercent, yPercent },
    bounds: bounds(
      xPercent - widthPercent / 2,
      yPercent - heightPercent / 2,
      widthPercent,
      heightPercent
    ),
    releasePoint
  };
}

function bounds(
  leftPercent: number,
  topPercent: number,
  widthPercent: number,
  heightPercent: number
): FrameBounds {
  return {
    leftPercent,
    topPercent,
    widthPercent,
    heightPercent,
    rightPercent: leftPercent + widthPercent,
    bottomPercent: topPercent + heightPercent
  };
}

function getControlZone(
  frame: WallFacingCameraFrame,
  action: ControlZoneAction
): ControlZone {
  const zone = frame.controlZones.find((candidate) => candidate.action === action);

  if (!zone) {
    throw new Error(`Missing ${action} control zone`);
  }

  return zone;
}

function formatPercent(value: number): string {
  return `${Number(value.toFixed(3))}%`;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

import type { LocalMatchLoopState, LocalMatchPlay } from "./local-match-loop";

export type LocalMatchFeedbackKind =
  | "ready"
  | "pitch"
  | "swing-contact"
  | "swing-miss"
  | "wall-hit"
  | "target-hit"
  | "recovery"
  | "out"
  | "run"
  | "match-complete";

export type LocalMatchFeedbackAnchor =
  | "batter"
  | "field"
  | "results"
  | "wall";

export type LocalMatchFeedbackTone =
  | "complete"
  | "neutral"
  | "positive"
  | "warning";

export interface LocalMatchFeedbackCue {
  anchor: LocalMatchFeedbackAnchor;
  kind: LocalMatchFeedbackKind;
  text: string;
  tone: LocalMatchFeedbackTone;
}

export interface LocalMatchFeedbackProjection {
  primary: LocalMatchFeedbackCue;
  result: LocalMatchFeedbackCue | null;
  secondary: LocalMatchFeedbackCue | null;
  wall: LocalMatchFeedbackCue | null;
}

export function projectLocalMatchFeedback(
  state: LocalMatchLoopState
): LocalMatchFeedbackProjection {
  if (state.phase.kind === "match-completed") {
    return {
      primary: cue("match-complete", "Match complete", "complete", "results"),
      result: state.lastPlay ? resultCue(state.lastPlay) : null,
      secondary: state.lastPlay ? recoveryCue(state.lastPlay, false) : null,
      wall: state.lastPlay ? wallCue(state.lastPlay) : null
    };
  }

  if (state.phase.kind === "pitch-in-flight") {
    return {
      primary: cue("pitch", "Pitch in flight", "neutral", "field"),
      result: null,
      secondary: null,
      wall: null
    };
  }

  if (state.phase.kind === "awaiting-recovery" && state.lastPlay) {
    return {
      primary: contactCue(state.lastPlay),
      result: null,
      secondary: recoveryCue(state.lastPlay, true),
      wall: wallCue(state.lastPlay)
    };
  }

  if (state.lastPlay?.plateAppearance) {
    const result = resultCue(state.lastPlay);

    return {
      primary:
        state.lastPlay.ballResult.kind === "miss"
          ? contactCue(state.lastPlay)
          : result ?? cue("ready", "Ready for pitch", "neutral", "field"),
      result,
      secondary: recoveryCue(state.lastPlay, false),
      wall: wallCue(state.lastPlay)
    };
  }

  return {
    primary: cue("ready", "Ready for pitch", "neutral", "field"),
    result: null,
    secondary: null,
    wall: null
  };
}

function contactCue(play: LocalMatchPlay): LocalMatchFeedbackCue {
  if (play.ballResult.kind === "miss") {
    return cue("swing-miss", "Swing missed", "warning", "batter");
  }

  return cue(
    "swing-contact",
    `Swing: ${play.ballResult.contactQuality} contact`,
    play.ballResult.kind === "out" ? "warning" : "positive",
    "batter"
  );
}

function wallCue(play: LocalMatchPlay): LocalMatchFeedbackCue | null {
  if (play.ballResult.kind === "miss") {
    return null;
  }

  if (play.wallCollision.kind !== "wall-collision") {
    return null;
  }

  if (play.wallCollision.targetHit) {
    return cue("target-hit", "Target hit", "positive", "wall");
  }

  return cue("wall-hit", "Wall hit", "neutral", "wall");
}

function recoveryCue(
  play: LocalMatchPlay,
  awaitingRecovery: boolean
): LocalMatchFeedbackCue | null {
  if (play.ballResult.kind === "miss") {
    return null;
  }

  if (!play.recovery) {
    return awaitingRecovery
      ? cue("recovery", "Recover the ball", "neutral", "field")
      : null;
  }

  if (play.recovery.kind === "loose") {
    return cue("recovery", "Ball loose", "warning", "field");
  }

  return cue("recovery", "Ball recovered", "positive", "field");
}

function resultCue(play: LocalMatchPlay): LocalMatchFeedbackCue | null {
  const plateAppearance = play.plateAppearance;

  if (!plateAppearance) {
    return null;
  }

  if (plateAppearance.runsScored.length > 0) {
    const runsScored = plateAppearance.runsScored.length;

    return cue(
      "run",
      `${runsScored} ${runsScored === 1 ? "run" : "runs"} scored`,
      "positive",
      "field"
    );
  }

  return cue(
    "out",
    plateAppearance.halfInningEnded ? "Side retired" : "Out recorded",
    "warning",
    "field"
  );
}

function cue(
  kind: LocalMatchFeedbackKind,
  text: string,
  tone: LocalMatchFeedbackTone,
  anchor: LocalMatchFeedbackAnchor
): LocalMatchFeedbackCue {
  return {
    anchor,
    kind,
    text,
    tone
  };
}

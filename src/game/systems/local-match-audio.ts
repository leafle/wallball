import type { LocalMatchEvent, LocalMatchEventKind } from "./local-match-loop";

export type LocalMatchAudioCueKind =
  | "pitch"
  | "swing"
  | "contact"
  | "miss"
  | "wall-hit"
  | "recovery"
  | "out"
  | "run"
  | "match-complete";

export interface LocalMatchAudioCue {
  kind: LocalMatchAudioCueKind;
  sequence: number;
}

export interface ProjectLocalMatchAudioCuesInput {
  afterSequence?: number;
  events: readonly LocalMatchEvent[];
  muted?: boolean;
}

export interface LocalMatchAudioCueProjection {
  cues: LocalMatchAudioCue[];
  nextSequence: number;
}

export interface LocalMatchAudioCuePlaybackOptions {
  reducedIntensity: boolean;
}

export interface LocalMatchAudioCueOutput {
  playCue(
    cue: LocalMatchAudioCue,
    options: LocalMatchAudioCuePlaybackOptions
  ): void;
  unlock?: () => void;
}

export interface LocalMatchAudioCueControllerOptions {
  muted?: boolean;
  reducedIntensity?: boolean;
  unlocked?: boolean;
}

export interface LocalMatchAudioPreferences {
  muted: boolean;
  reducedIntensity: boolean;
}

interface CueToneProfile {
  durationMs: number;
  frequencyHz: number;
  gain: number;
  type: OscillatorType;
}

type BrowserAudioContextConstructor = new () => AudioContext;

export function projectLocalMatchAudioCues({
  afterSequence = 0,
  events,
  muted = false
}: ProjectLocalMatchAudioCuesInput): LocalMatchAudioCueProjection {
  const nextSequence = events.reduce(
    (latest, event) => Math.max(latest, event.sequence),
    afterSequence
  );

  if (muted) {
    return {
      cues: [],
      nextSequence
    };
  }

  return {
    cues: events
      .filter((event) => event.sequence > afterSequence)
      .map(audioCueFromEvent)
      .filter((cue): cue is LocalMatchAudioCue => cue !== null),
    nextSequence
  };
}

export class LocalMatchAudioCueController {
  private lastSequence = 0;
  private muted: boolean;
  private reducedIntensity: boolean;
  private unlocked: boolean;

  constructor(
    private readonly output: LocalMatchAudioCueOutput,
    options: LocalMatchAudioCueControllerOptions = {}
  ) {
    this.muted = options.muted ?? false;
    this.reducedIntensity = options.reducedIntensity ?? false;
    this.unlocked = options.unlocked ?? false;
  }

  unlock(): void {
    this.unlocked = true;
    this.output.unlock?.();
  }

  setPreferences(preferences: LocalMatchAudioPreferences): void {
    this.muted = preferences.muted;
    this.reducedIntensity = preferences.reducedIntensity;
  }

  ingest(events: readonly LocalMatchEvent[]): void {
    const projection = projectLocalMatchAudioCues({
      afterSequence: this.lastSequence,
      events,
      muted: this.muted || !this.unlocked
    });

    this.lastSequence = projection.nextSequence;

    for (const cue of projection.cues) {
      this.output.playCue(cue, {
        reducedIntensity: this.reducedIntensity
      });
    }
  }
}

export function createGeneratedToneAudioOutput(): LocalMatchAudioCueOutput {
  let context: AudioContext | null = null;

  return {
    unlock: () => {
      context = ensureAudioContext(context);
      resumeAudioContext(context);
    },
    playCue: (cue, options) => {
      context = ensureAudioContext(context);
      resumeAudioContext(context);

      if (context) {
        playGeneratedCueTone(context, cue, options);
      }
    }
  };
}

function ensureAudioContext(context: AudioContext | null): AudioContext | null {
  if (context) {
    return context;
  }

  const AudioContextConstructor = getBrowserAudioContextConstructor();

  if (!AudioContextConstructor) {
    return null;
  }

  try {
    return new AudioContextConstructor();
  } catch {
    // Audio feedback is optional and should never interrupt gameplay.
    return null;
  }
}

function resumeAudioContext(context: AudioContext | null): void {
  if (context?.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
}

function audioCueFromEvent(event: LocalMatchEvent): LocalMatchAudioCue | null {
  const kind = cueKindFromEvent(event);

  if (!kind) {
    return null;
  }

  return {
    kind,
    sequence: event.sequence
  };
}

function cueKindFromEvent(
  event: LocalMatchEvent
): LocalMatchAudioCueKind | null {
  if (event.kind === "contact") {
    return event.result === "miss" ? "miss" : "contact";
  }

  if (event.kind === "target-hit") {
    return "wall-hit";
  }

  if (event.kind === "match-completed") {
    return "match-complete";
  }

  if (isDirectAudioCueEventKind(event.kind)) {
    return event.kind;
  }

  return null;
}

function isDirectAudioCueEventKind(
  kind: LocalMatchEventKind
): kind is Extract<
  LocalMatchEventKind,
  "out" | "pitch" | "recovery" | "run" | "swing" | "wall-hit"
> {
  return (
    kind === "out" ||
    kind === "pitch" ||
    kind === "recovery" ||
    kind === "run" ||
    kind === "swing" ||
    kind === "wall-hit"
  );
}

function playGeneratedCueTone(
  context: AudioContext,
  cue: LocalMatchAudioCue,
  options: LocalMatchAudioCuePlaybackOptions
): void {
  const profile = toneProfileForCue(cue.kind);
  const now = context.currentTime;
  const durationSeconds = profile.durationMs / 1_000;
  const volumeScale = options.reducedIntensity ? 0.44 : 1;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = profile.type;
  oscillator.frequency.setValueAtTime(profile.frequencyHz, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(
    profile.gain * volumeScale,
    now + 0.012
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSeconds);
}

function toneProfileForCue(kind: LocalMatchAudioCueKind): CueToneProfile {
  switch (kind) {
    case "pitch":
      return tone(330, 85, 0.035, "sine");
    case "swing":
      return tone(190, 70, 0.04, "triangle");
    case "contact":
      return tone(520, 105, 0.045, "triangle");
    case "miss":
      return tone(145, 120, 0.045, "sawtooth");
    case "wall-hit":
      return tone(760, 80, 0.035, "square");
    case "recovery":
      return tone(410, 90, 0.032, "sine");
    case "out":
      return tone(220, 130, 0.038, "triangle");
    case "run":
      return tone(660, 150, 0.044, "sine");
    case "match-complete":
      return tone(880, 190, 0.04, "sine");
  }
}

function tone(
  frequencyHz: number,
  durationMs: number,
  gain: number,
  type: OscillatorType
): CueToneProfile {
  return {
    durationMs,
    frequencyHz,
    gain,
    type
  };
}

function getBrowserAudioContextConstructor(): BrowserAudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & {
    AudioContext?: BrowserAudioContextConstructor;
    webkitAudioContext?: BrowserAudioContextConstructor;
  };

  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null;
}

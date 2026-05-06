import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import {
  calculateBattingLaunch,
  calculateSwingTimingMs,
  type BattingLaunch
} from "../systems/batting";
import type { Vector2 } from "../systems/ball-physics";

type PrototypePhase = "idle" | "pitching" | "launched";

interface PrototypeState {
  frameId: number | null;
  launch: BattingLaunch | null;
  launchPosition: Vector2;
  launchStartedAtMs: number;
  phase: PrototypePhase;
  pitchIndex: number;
  pitchStartedAtMs: number;
  pitchX: number;
}

const IDEAL_CONTACT_MS = 900;
const PITCH_DURATION_MS = 1_200;
const LAUNCH_RESET_MS = 1_700;
const PITCH_LANES = [-0.22, 0.04, 0.18, -0.08] as const;
const PITCHER_POSITION: Vector2 = {
  x: GAME_WIDTH / 2,
  y: 635
};
const CONTACT_Y = 470;
const LANE_WIDTH = 360;

export function mountBattingPrototype(host: HTMLElement): () => void {
  const state: PrototypeState = {
    frameId: null,
    launch: null,
    launchPosition: { ...PITCHER_POSITION },
    launchStartedAtMs: 0,
    phase: "idle",
    pitchIndex: 0,
    pitchStartedAtMs: 0,
    pitchX: PITCH_LANES[0]
  };

  host.innerHTML = `
    <div class="batting-lab" aria-label="Batting timing prototype">
      <div class="prototype-hud" aria-live="polite">
        <span data-role="phase">Ready</span>
        <span data-role="timing">Timing 0 ms</span>
        <span data-role="result">No pitch</span>
      </div>
      <div class="wall-zone">
        <div class="wall-target"></div>
      </div>
      <div class="pitcher-marker"></div>
      <div class="batter-marker"></div>
      <div class="timing-meter" aria-hidden="true">
        <div class="timing-sweet-spot"></div>
        <div class="timing-cursor" data-role="timing-cursor"></div>
      </div>
      <div class="prototype-ball" data-role="ball"></div>
      <div class="prototype-controls">
        <button type="button" data-action="pitch">Pitch</button>
        <button type="button" data-action="swing">Swing</button>
      </div>
    </div>
  `;

  const lab = getElement<HTMLElement>(host, ".batting-lab");
  const ball = getElement<HTMLElement>(host, "[data-role='ball']");
  const cursor = getElement<HTMLElement>(host, "[data-role='timing-cursor']");
  const phaseLabel = getElement<HTMLElement>(host, "[data-role='phase']");
  const timingLabel = getElement<HTMLElement>(host, "[data-role='timing']");
  const resultLabel = getElement<HTMLElement>(host, "[data-role='result']");
  const pitchButton = getElement<HTMLButtonElement>(host, "[data-action='pitch']");
  const swingButton = getElement<HTMLButtonElement>(host, "[data-action='swing']");

  const render = (nowMs: number): void => {
    const pitchPosition = currentPitchPosition(state, nowMs);

    if (state.phase === "pitching") {
      const elapsedMs = nowMs - state.pitchStartedAtMs;
      const timingMs = calculateSwingTimingMs({
        pitchStartedAtMs: state.pitchStartedAtMs,
        swingAtMs: nowMs,
        idealContactMs: IDEAL_CONTACT_MS
      });
      setBallPosition(ball, pitchPosition);
      setTimingCursor(cursor, elapsedMs / PITCH_DURATION_MS);
      timingLabel.textContent = `Timing ${formatTiming(timingMs)}`;

      if (elapsedMs >= PITCH_DURATION_MS) {
        state.phase = "idle";
        phaseLabel.textContent = "Ready";
        resultLabel.textContent = "Miss";
      }
    } else if (state.phase === "launched" && state.launch) {
      const elapsedSeconds = (nowMs - state.launchStartedAtMs) / 1_000;
      setBallPosition(ball, {
        x: state.launchPosition.x + state.launch.velocity.x * elapsedSeconds,
        y:
          state.launchPosition.y +
          state.launch.velocity.y * elapsedSeconds +
          220 * elapsedSeconds * elapsedSeconds
      });

      if (nowMs - state.launchStartedAtMs >= LAUNCH_RESET_MS) {
        state.phase = "idle";
        state.launch = null;
        phaseLabel.textContent = "Ready";
      }
    } else {
      setBallPosition(ball, pitchPosition);
      setTimingCursor(cursor, 0);
    }

    state.frameId = window.requestAnimationFrame(render);
  };

  const startPitch = (): void => {
    state.pitchX = PITCH_LANES[state.pitchIndex % PITCH_LANES.length];
    state.pitchIndex += 1;
    state.pitchStartedAtMs = performance.now();
    state.phase = "pitching";
    state.launch = null;
    phaseLabel.textContent = "Pitching";
    resultLabel.textContent = "Tracking";
    timingLabel.textContent = "Timing 0 ms";
  };

  const swing = (): void => {
    if (state.phase !== "pitching") {
      resultLabel.textContent = "Start a pitch";
      return;
    }

    const swingAtMs = performance.now();
    const swingTimingMs = calculateSwingTimingMs({
      pitchStartedAtMs: state.pitchStartedAtMs,
      swingAtMs,
      idealContactMs: IDEAL_CONTACT_MS
    });
    const launch = calculateBattingLaunch({
      swingTimingMs,
      pitchX: state.pitchX,
      targetX: 0,
      wallTargetHit: Math.abs(state.pitchX) <= 0.12 && Math.abs(swingTimingMs) <= 45
    });

    state.launch = launch;
    state.launchPosition = currentPitchPosition(state, swingAtMs);
    state.launchStartedAtMs = swingAtMs;
    state.phase = "launched";
    phaseLabel.textContent = "Contact";
    timingLabel.textContent = `Timing ${formatTiming(swingTimingMs)}`;
    resultLabel.textContent = `${launch.result.contactQuality} ${launch.result.kind}`;
  };

  pitchButton.addEventListener("pointerdown", startPitch);
  swingButton.addEventListener("pointerdown", swing);
  lab.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof HTMLButtonElement)) {
      swing();
    }
  });
  window.addEventListener("keydown", handleKeyDown);
  state.frameId = window.requestAnimationFrame(render);

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Space") {
      event.preventDefault();
      swing();
    } else if (event.key.toLowerCase() === "p" || event.key === "Enter") {
      startPitch();
    }
  }

  return () => {
    if (state.frameId !== null) {
      window.cancelAnimationFrame(state.frameId);
    }

    window.removeEventListener("keydown", handleKeyDown);
  };
}

function currentPitchPosition(
  state: PrototypeState,
  nowMs: number
): Vector2 {
  const progress =
    state.phase === "pitching"
      ? clamp((nowMs - state.pitchStartedAtMs) / PITCH_DURATION_MS, 0, 1)
      : 0;

  return {
    x: PITCHER_POSITION.x + state.pitchX * LANE_WIDTH,
    y: PITCHER_POSITION.y + (CONTACT_Y - PITCHER_POSITION.y) * progress
  };
}

function setBallPosition(ball: HTMLElement, position: Vector2): void {
  ball.style.left = `${round((position.x / GAME_WIDTH) * 100)}%`;
  ball.style.top = `${round((position.y / GAME_HEIGHT) * 100)}%`;
}

function setTimingCursor(cursor: HTMLElement, progress: number): void {
  cursor.style.transform = `translateX(${round(clamp(progress, 0, 1) * 100)}%)`;
}

function formatTiming(value: number): string {
  if (value > 0) {
    return `+${Math.round(value)} ms`;
  }

  return `${Math.round(value)} ms`;
}

function getElement<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing batting prototype element ${selector}`);
  }

  return element;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

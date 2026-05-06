export type GameplayControlSource = "keyboard" | "touch";

export type GameplayControlIntent =
  | {
      kind: "pitch";
      source: GameplayControlSource;
    }
  | {
      kind: "swing";
      source: GameplayControlSource;
    }
  | {
      axisX: number;
      axisY: number;
      kind: "fielder-move";
      source: GameplayControlSource;
    };

export interface FieldingInput {
  axisX: number;
  axisY: number;
}

export interface GameplayControlHelpItem {
  action: GameplayControlIntent["kind"];
  keyboard: string;
  label: string;
  touch: string;
}

type GameplayAction = "pitch" | "swing";
type GameplayControlDispatch = (intent: GameplayControlIntent) => void;
type KeyboardLikeEvent = Pick<KeyboardEvent, "code" | "key">;

const PITCH_KEY_CODES = ["Enter", "KeyP"] as const;
const SWING_KEY_CODES = ["Space"] as const;
const LEFT_KEY_CODES = ["ArrowLeft", "KeyA"] as const;
const RIGHT_KEY_CODES = ["ArrowRight", "KeyD"] as const;
const UP_KEY_CODES = ["ArrowUp", "KeyW"] as const;
const DOWN_KEY_CODES = ["ArrowDown", "KeyS"] as const;

const PITCH_KEYS: ReadonlySet<string> = new Set(PITCH_KEY_CODES);
const SWING_KEYS: ReadonlySet<string> = new Set(SWING_KEY_CODES);
const LEFT_KEYS: ReadonlySet<string> = new Set(LEFT_KEY_CODES);
const RIGHT_KEYS: ReadonlySet<string> = new Set(RIGHT_KEY_CODES);
const UP_KEYS: ReadonlySet<string> = new Set(UP_KEY_CODES);
const DOWN_KEYS: ReadonlySet<string> = new Set(DOWN_KEY_CODES);

export function keyboardActionForKey(
  event: KeyboardLikeEvent
): GameplayAction | null {
  if (SWING_KEYS.has(event.code) || event.key === " ") {
    return "swing";
  }

  if (PITCH_KEYS.has(event.code) || event.key === "Enter") {
    return "pitch";
  }

  return null;
}

export function isFieldingKey(code: string): boolean {
  return (
    LEFT_KEYS.has(code) ||
    RIGHT_KEYS.has(code) ||
    UP_KEYS.has(code) ||
    DOWN_KEYS.has(code)
  );
}

export function fieldingInputFromKeys(codes: Iterable<string>): FieldingInput {
  let left = 0;
  let right = 0;
  let up = 0;
  let down = 0;

  for (const code of codes) {
    left = Math.max(left, LEFT_KEYS.has(code) ? 1 : 0);
    right = Math.max(right, RIGHT_KEYS.has(code) ? 1 : 0);
    up = Math.max(up, UP_KEYS.has(code) ? 1 : 0);
    down = Math.max(down, DOWN_KEYS.has(code) ? 1 : 0);
  }

  return {
    axisX: right - left,
    axisY: down - up
  };
}

export function combineFieldingInputs(
  inputs: Iterable<FieldingInput>
): FieldingInput {
  let axisX = 0;
  let axisY = 0;

  for (const input of inputs) {
    axisX += input.axisX;
    axisY += input.axisY;
  }

  return {
    axisX: clamp(axisX, -1, 1),
    axisY: clamp(axisY, -1, 1)
  };
}

export function getGameplayControlHelpItems(): GameplayControlHelpItem[] {
  return [
    {
      action: "pitch",
      keyboard: formatKeyList(PITCH_KEY_CODES),
      label: "Pitch",
      touch: "Pitch button"
    },
    {
      action: "swing",
      keyboard: formatKeyList(SWING_KEY_CODES),
      label: "Swing",
      touch: "Swing button"
    },
    {
      action: "fielder-move",
      keyboard: "Arrow keys or WASD",
      label: "Fielding",
      touch: "Fielding pad"
    }
  ];
}

export function mountKeyboardGameplayControls(
  targetWindow: Window,
  dispatch: GameplayControlDispatch
): () => void {
  const pressedFieldingKeys = new Set<string>();
  let lastFieldingInput: FieldingInput = {
    axisX: 0,
    axisY: 0
  };

  const emitFieldingMove = (): void => {
    const nextInput = fieldingInputFromKeys(pressedFieldingKeys);

    if (
      nextInput.axisX !== lastFieldingInput.axisX ||
      nextInput.axisY !== lastFieldingInput.axisY
    ) {
      lastFieldingInput = nextInput;
      dispatch({
        kind: "fielder-move",
        source: "keyboard",
        ...nextInput
      });
    }
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) {
      return;
    }

    const action = keyboardActionForKey(event);

    if (action) {
      event.preventDefault();

      if (!event.repeat) {
        dispatch({
          kind: action,
          source: "keyboard"
        });
      }

      return;
    }

    if (isFieldingKey(event.code)) {
      event.preventDefault();

      if (!pressedFieldingKeys.has(event.code)) {
        pressedFieldingKeys.add(event.code);
        emitFieldingMove();
      }
    }
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target) || !isFieldingKey(event.code)) {
      return;
    }

    event.preventDefault();
    pressedFieldingKeys.delete(event.code);
    emitFieldingMove();
  };

  targetWindow.addEventListener("keydown", handleKeyDown);
  targetWindow.addEventListener("keyup", handleKeyUp);

  return () => {
    targetWindow.removeEventListener("keydown", handleKeyDown);
    targetWindow.removeEventListener("keyup", handleKeyUp);
  };
}

export function mountTouchGameplayControls(
  root: HTMLElement,
  dispatch: GameplayControlDispatch
): () => void {
  const activeFieldingPointers = new Map<number, FieldingInput>();
  let lastFieldingInput: FieldingInput = {
    axisX: 0,
    axisY: 0
  };

  const emitFieldingMove = (): void => {
    const nextInput = combineFieldingInputs(activeFieldingPointers.values());

    if (
      nextInput.axisX !== lastFieldingInput.axisX ||
      nextInput.axisY !== lastFieldingInput.axisY
    ) {
      lastFieldingInput = nextInput;
      dispatch({
        kind: "fielder-move",
        source: "touch",
        ...nextInput
      });
    }
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const actionControl = event.target.closest<HTMLElement>(
      "[data-control-action]"
    );

    if (actionControl && root.contains(actionControl)) {
      const action = parseGameplayAction(actionControl.dataset.controlAction);

      if (action) {
        event.preventDefault();
        dispatch({
          kind: action,
          source: "touch"
        });
      }

      return;
    }

    const fieldingControl = event.target.closest<HTMLElement>(
      "[data-control-field-x], [data-control-field-y]"
    );

    if (fieldingControl && root.contains(fieldingControl)) {
      event.preventDefault();
      fieldingControl.setPointerCapture(event.pointerId);
      activeFieldingPointers.set(
        event.pointerId,
        parseFieldingControlInput(fieldingControl)
      );
      emitFieldingMove();
    }
  };

  const handlePointerEnd = (event: PointerEvent): void => {
    if (activeFieldingPointers.delete(event.pointerId)) {
      emitFieldingMove();
    }
  };

  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("pointerup", handlePointerEnd);
  root.addEventListener("pointercancel", handlePointerEnd);
  root.addEventListener("lostpointercapture", handlePointerEnd);

  return () => {
    root.removeEventListener("pointerdown", handlePointerDown);
    root.removeEventListener("pointerup", handlePointerEnd);
    root.removeEventListener("pointercancel", handlePointerEnd);
    root.removeEventListener("lostpointercapture", handlePointerEnd);
  };
}

function parseGameplayAction(value: string | undefined): GameplayAction | null {
  return value === "pitch" || value === "swing" ? value : null;
}

function parseFieldingControlInput(element: HTMLElement): FieldingInput {
  return {
    axisX: parseAxisValue(element.dataset.controlFieldX),
    axisY: parseAxisValue(element.dataset.controlFieldY)
  };
}

function parseAxisValue(value: string | undefined): number {
  if (value === undefined) {
    return 0;
  }

  return clamp(Number(value) || 0, -1, 1);
}

function formatKeyList(codes: readonly string[]): string {
  return codes.map(formatKeyCode).join(" or ");
}

function formatKeyCode(code: string): string {
  if (code === "Space") {
    return "Space";
  }

  if (code === "Enter") {
    return "Enter";
  }

  if (code.startsWith("Key")) {
    return code.slice(3);
  }

  return code;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

import { GAME_HEIGHT, GAME_WIDTH, createBaseGameConfig } from "./game/config";
import { loadPredefinedRosters } from "./game/data/fixtures";
import {
  mountKeyboardGameplayControls,
  mountTouchGameplayControls,
  type GameplayControlIntent
} from "./game/input/game-controls";
import {
  mountPhaserGameShell,
  type MountedPhaserGameShell
} from "./game/phaser-shell";
import { createRemoteRoomClient } from "./game/remote/room-client";
import { mountBattingPrototype } from "./game/ui/batting-prototype";
import type {
  RemoteAssignment,
  RemoteIntentKind,
  RemoteIntentPayloadValue,
  RemotePlayerSide,
  RemoteRoomSnapshot
} from "./game/remote/room-store";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount element");
}

const config = createBaseGameConfig();
const battingPrototypeParent = "batting-prototype";
const rosters = loadPredefinedRosters();
const remoteClient = createRemoteRoomClient();

interface RemoteUiState {
  assignment: RemoteAssignment | null;
  sequence: number;
  snapshot: RemoteRoomSnapshot | null;
  unsubscribe: (() => void) | null;
}

const remoteState: RemoteUiState = {
  assignment: null,
  sequence: 0,
  snapshot: null,
  unsubscribe: null
};
let phaserShell: MountedPhaserGameShell | null = null;

const rosterOptions = rosters
  .map((team) => `<option value="${team.id}">${team.displayName}</option>`)
  .join("");

app.innerHTML = `
  <main class="app-shell">
    <section class="game-panel" aria-labelledby="wallball-title">
      <div class="title-row">
        <div>
          <p class="eyebrow">Remote match lab</p>
          <h1 id="wallball-title">Wallball</h1>
        </div>
        <span class="resolution-pill">${GAME_WIDTH} x ${GAME_HEIGHT}</span>
      </div>
      <div class="game-stage-grid">
        <div
          id="${config.parent}"
          class="game-host phaser-host"
          data-role="phaser-shell"
          data-width="${String(config.width)}"
          data-height="${String(config.height)}"
        ></div>
        <div
          id="${battingPrototypeParent}"
          class="game-host prototype-host"
          data-width="${String(config.width)}"
          data-height="${String(config.height)}"
        ></div>
      </div>
    </section>
    <section id="remote-console" class="remote-console" aria-label="Remote two-player controls">
      <div class="connection-grid">
        <form id="create-room-form" class="control-group">
          <h2>Create Room</h2>
          <label>
            Name
            <input id="host-name" name="hostName" value="Host" autocomplete="name" />
          </label>
          <label>
            Away
            <select id="away-team" name="awayTeam">${rosterOptions}</select>
          </label>
          <label>
            Home
            <select id="home-team" name="homeTeam">${rosterOptions}</select>
          </label>
          <button type="submit">Create</button>
        </form>
        <form id="join-room-form" class="control-group">
          <h2>Join Room</h2>
          <label>
            Name
            <input id="guest-name" name="guestName" value="Guest" autocomplete="name" />
          </label>
          <label>
            Code
            <input id="join-code" name="joinCode" maxlength="6" autocomplete="off" />
          </label>
          <button type="submit">Join</button>
        </form>
      </div>
      <div id="room-state" class="room-state" aria-live="polite">
        <span>No room connected</span>
      </div>
      <div class="intent-grid" aria-label="Player intents">
        <button id="ready-intent" type="button">Ready</button>
        <button id="pitch-intent" type="button" data-control-action="pitch">Pitch</button>
        <button id="swing-intent" type="button" data-control-action="swing">Swing</button>
        <button id="record-match" type="button">Record</button>
      </div>
      <div class="fielding-pad" aria-label="Fielding controls">
        <button
          class="fielding-control fielding-up"
          type="button"
          aria-label="Move fielder up"
          data-control-field-y="-1"
        >Up</button>
        <button
          class="fielding-control fielding-left"
          type="button"
          aria-label="Move fielder left"
          data-control-field-x="-1"
        >Left</button>
        <button
          class="fielding-control fielding-right"
          type="button"
          aria-label="Move fielder right"
          data-control-field-x="1"
        >Right</button>
        <button
          class="fielding-control fielding-down"
          type="button"
          aria-label="Move fielder down"
          data-control-field-y="1"
        >Down</button>
      </div>
      <div class="activity-grid">
        <section class="activity-panel" aria-labelledby="intent-log-title">
          <h2 id="intent-log-title">Intent Log</h2>
          <ol id="intent-log" class="event-list"></ol>
        </section>
        <section class="activity-panel" aria-labelledby="match-log-title">
          <h2 id="match-log-title">Recorded Matches</h2>
          <ol id="match-log" class="event-list"></ol>
        </section>
      </div>
    </section>
  </main>
`;

const createRoomForm = getElement<HTMLFormElement>("#create-room-form");
const joinRoomForm = getElement<HTMLFormElement>("#join-room-form");
const hostNameInput = getElement<HTMLInputElement>("#host-name");
const guestNameInput = getElement<HTMLInputElement>("#guest-name");
const joinCodeInput = getElement<HTMLInputElement>("#join-code");
const awayTeamSelect = getElement<HTMLSelectElement>("#away-team");
const homeTeamSelect = getElement<HTMLSelectElement>("#home-team");
const remoteConsoleElement = getElement<HTMLElement>("#remote-console");
const roomStateElement = getElement<HTMLDivElement>("#room-state");
const intentLogElement = getElement<HTMLOListElement>("#intent-log");
const matchLogElement = getElement<HTMLOListElement>("#match-log");

void mountPhaserGameShell()
  .then((mounted) => {
    phaserShell = mounted;
  })
  .catch(reportError);
mountBattingPrototype(getElement<HTMLDivElement>(`#${battingPrototypeParent}`));
void mountKeyboardGameplayControls(window, handleGameplayControlIntent);
void mountTouchGameplayControls(remoteConsoleElement, handleGameplayControlIntent);

homeTeamSelect.value = rosters[1]?.id ?? rosters[0]?.id ?? "";
joinCodeInput.value = new URLSearchParams(window.location.search).get("room") ?? "";

createRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void createRoom().catch(reportError);
});

joinRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void joinRoom().catch(reportError);
});

bindIntentButton("#ready-intent", "ready", {});

getElement<HTMLButtonElement>("#record-match").addEventListener("click", () => {
  void recordMatch().catch(reportError);
});

renderRemoteState();

async function createRoom(): Promise<void> {
  const result = await remoteClient.createRoom({
    awayTeamId: awayTeamSelect.value,
    homeTeamId: homeTeamSelect.value,
    hostDisplayName: normalizedName(hostNameInput.value, "Host")
  });

  connectToRoom(result.assignment, result.snapshot);
}

async function joinRoom(): Promise<void> {
  const result = await remoteClient.joinRoom({
    code: joinCodeInput.value,
    guestDisplayName: normalizedName(guestNameInput.value, "Guest")
  });

  connectToRoom(result.assignment, result.snapshot);
}

function connectToRoom(
  assignment: RemoteAssignment,
  snapshot: RemoteRoomSnapshot
): void {
  remoteState.unsubscribe?.();
  remoteState.assignment = assignment;
  remoteState.sequence = 0;
  remoteState.snapshot = snapshot;
  joinCodeInput.value = snapshot.code;
  window.history.replaceState(null, "", snapshot.sharePath);
  remoteState.unsubscribe = remoteClient.subscribe(snapshot.code, (nextSnapshot) => {
    remoteState.snapshot = nextSnapshot;
    renderRemoteState();
  });
  renderRemoteState();
}

function bindIntentButton(
  selector: string,
  kind: RemoteIntentKind,
  payload: Record<string, RemoteIntentPayloadValue>
): void {
  getElement<HTMLButtonElement>(selector).addEventListener("click", () => {
    void sendIntent(kind, payload).catch(reportError);
  });
}

function handleGameplayControlIntent(intent: GameplayControlIntent): void {
  phaserShell?.dispatchControlIntent(intent);

  if (intent.kind === "pitch") {
    void sendIntent("pitch", {
      targetX: GAME_WIDTH / 2,
      speed: 42
    }).catch(reportError);
  } else if (intent.kind === "swing") {
    void sendIntent("swing", {
      timingMs: 0
    }).catch(reportError);
  } else {
    void sendIntent("fielder-move", {
      axisX: intent.axisX,
      axisY: intent.axisY
    }).catch(reportError);
  }
}

async function sendIntent(
  kind: RemoteIntentKind,
  payload: Record<string, RemoteIntentPayloadValue>
): Promise<void> {
  if (!remoteState.snapshot || !remoteState.assignment) {
    renderStatus("Connect to a room first");
    return;
  }

  remoteState.sequence += 1;
  await remoteClient.sendIntent({
    code: remoteState.snapshot.code,
    side: remoteState.assignment.side,
    kind,
    sequence: remoteState.sequence,
    payload
  });
}

async function recordMatch(): Promise<void> {
  const snapshot = remoteState.snapshot;

  if (!snapshot) {
    renderStatus("Connect to a room first");
    return;
  }

  const score = deriveScore(snapshot);

  await remoteClient.recordMatch(snapshot.code, {
    id: `${snapshot.code}-${Date.now()}`,
    playedAt: new Date().toISOString(),
    teams: snapshot.teams,
    score,
    innings: Math.max(1, Math.ceil(snapshot.intents.length / 6)),
    events: snapshot.intents.slice(-8).map((intent, index) => ({
      kind: intent.kind,
      playerId: playerLabel(snapshot, intent.side).toLowerCase(),
      inning: Math.max(1, Math.floor(index / 3) + 1)
    }))
  });
}

function renderRemoteState(): void {
  const snapshot = remoteState.snapshot;
  const assignment = remoteState.assignment;

  if (!snapshot || !assignment) {
    renderStatus("No room connected");
    renderList(intentLogElement, []);
    renderList(matchLogElement, []);
    return;
  }

  roomStateElement.innerHTML = `
    <span class="room-code">${escapeHtml(snapshot.code)}</span>
    <span>${escapeHtml(assignment.role)} - ${escapeHtml(assignment.side)}</span>
    <span>${escapeHtml(teamName(snapshot.teams.away))} at ${escapeHtml(
      teamName(snapshot.teams.home)
    )}</span>
    <span>${snapshot.players.away ? "Away ready" : "Away open"}</span>
    <span>${snapshot.players.home ? "Home ready" : "Home open"}</span>
  `;

  renderList(
    intentLogElement,
    snapshot.intents
      .slice()
      .reverse()
      .map(
        (intent) =>
          `#${intent.version} ${playerLabel(snapshot, intent.side)} ${intent.kind}`
      )
  );
  renderList(
    matchLogElement,
    snapshot.recordedMatches
      .slice()
      .reverse()
      .map((match) => `${match.finalScore} - ${match.innings} inning(s)`)
  );
}

function renderStatus(message: string): void {
  roomStateElement.innerHTML = `<span>${escapeHtml(message)}</span>`;
}

function reportError(error: unknown): void {
  renderStatus(error instanceof Error ? error.message : "Remote request failed");
}

function renderList(listElement: HTMLOListElement, items: string[]): void {
  listElement.innerHTML =
    items.length > 0
      ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : `<li class="empty-row">None yet</li>`;
}

function deriveScore(snapshot: RemoteRoomSnapshot): { away: number; home: number } {
  return snapshot.intents.reduce(
    (score, intent) => ({
      ...score,
      [intent.side]: score[intent.side] + (intent.kind === "ready" ? 0 : 1)
    }),
    {
      away: 0,
      home: 0
    }
  );
}

function teamName(teamId: string): string {
  return rosters.find((team) => team.id === teamId)?.displayName ?? teamId;
}

function playerLabel(
  snapshot: RemoteRoomSnapshot,
  side: RemotePlayerSide
): string {
  return snapshot.players[side]?.displayName ?? side;
}

function normalizedName(value: string, fallback: string): string {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : fallback;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") {
      return "&amp;";
    }

    if (character === "<") {
      return "&lt;";
    }

    if (character === ">") {
      return "&gt;";
    }

    if (character === "\"") {
      return "&quot;";
    }

    return "&#039;";
  });
}

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element ${selector}`);
  }

  return element;
}

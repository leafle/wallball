import { GAME_HEIGHT, GAME_WIDTH, createBaseGameConfig } from "./game/config";
import {
  createFixtureWallballDataClient,
  createResilientWallballDataClient,
  readWallballPersistenceStatus,
  type WallballDataClient,
  type WallballPersistenceStatus
} from "./game/data/game-data-client";
import { loadPredefinedRosters } from "./game/data/fixtures";
import type { InteractionCallout } from "./game/domain/friend-interactions";
import type { HighScore } from "./game/domain/high-scores";
import type { CompletedMatch, MatchSummary } from "./game/domain/match-summary";
import {
  getGameplayControlHelpItems,
  mountKeyboardGameplayControls,
  mountTouchGameplayControls,
  type GameplayControlIntent
} from "./game/input/game-controls";
import {
  mountPhaserGameShell,
  type MountedPhaserGameShell
} from "./game/phaser-shell";
import { createRemoteRoomClient } from "./game/remote/room-client";
import type {
  RemoteAssignment,
  RemoteIntentKind,
  RemoteIntentPayloadValue,
  RemotePlayerSide,
  RemoteRoomSnapshot
} from "./game/remote/room-store";
import {
  WALLBALL_PLAY_SCENE_PROJECTION_EVENT,
  type WallballPlaySceneProjectionEventDetail
} from "./game/scenes/play-scene";
import { recordLocalMatchCompletion } from "./game/systems/match-completion";
import { mountBattingPrototype } from "./game/ui/batting-prototype";
import { projectControlHelpPanel } from "./game/ui/control-help";
import {
  projectPostMatchResultsPanel,
  type PostMatchPlayerLabel,
  type PostMatchRecordState,
  type PostMatchResultsPanelProjection
} from "./game/ui/post-match-results";
import {
  projectMatchHistoryScreen,
  type MatchHistoryPlayerLabel,
  type MatchHistoryScreenProjection,
  type MatchHistoryTeamLabel
} from "./game/ui/match-history-screen";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount element");
}

const config = createBaseGameConfig();
const battingPrototypeParent = "batting-prototype";
const controlHelpParent = "control-help";
const controlHelpStorageKey = "wallball.controlHelp.dismissed";
const postMatchResultsParent = "post-match-results";
const matchHistoryParent = "match-history";
const localRivalryMatchup = {
  batterId: "cainer",
  pitcherId: "al"
} as const;
const localRivalryPlayerIds = ["cainer", "al"] as const;
const localRivalryTeamIds = ["champions", "woodland"] as const;
const rosters = loadPredefinedRosters();
const localDataClient = createResilientWallballDataClient({
  primary: createFixtureWallballDataClient()
});
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

interface LocalResultsUiState {
  activeCompletionKey: string | null;
  errorMessage: string | null;
  highScores: HighScore[];
  persistenceStatus: WallballPersistenceStatus;
  players: PostMatchPlayerLabel[];
  projection: WallballPlaySceneProjectionEventDetail["projection"] | null;
  recordState: PostMatchRecordState;
  recordingCompletionKey: string | null;
  summary: MatchSummary | null;
}

const localResultsState: LocalResultsUiState = {
  activeCompletionKey: null,
  errorMessage: null,
  highScores: [],
  persistenceStatus: {
    pendingWrites: 0,
    state: "synced"
  },
  players: [],
  projection: null,
  recordState: "idle",
  recordingCompletionKey: null,
  summary: null
};

interface LocalHistoryUiState {
  highScores: HighScore[];
  matches: CompletedMatch[];
  players: MatchHistoryPlayerLabel[];
  rivalryCallout: InteractionCallout | null;
  teams: MatchHistoryTeamLabel[];
}

const localHistoryState: LocalHistoryUiState = {
  highScores: [],
  matches: [],
  players: [],
  rivalryCallout: null,
  teams: rosters.map(({ displayName, id }) => ({
    displayName,
    id
  }))
};

let phaserShell: MountedPhaserGameShell | null = null;
let controlHelpDismissed = readControlHelpDismissed();

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
      <aside
        id="${controlHelpParent}"
        class="control-help-panel"
        aria-label="Control help"
      ></aside>
      <div class="game-stage-grid">
        <div class="play-surface-grid">
          <div
            id="${config.parent}"
            class="game-host phaser-host"
            data-role="phaser-shell"
            data-width="${String(config.width)}"
            data-height="${String(config.height)}"
          ></div>
          <div class="local-side-panel">
            <aside
              id="${postMatchResultsParent}"
              class="post-match-panel"
              aria-live="polite"
              aria-label="Local match results and leaderboard"
            ></aside>
            <aside
              id="${matchHistoryParent}"
              class="match-history-panel"
              aria-live="polite"
              aria-label="Match history and rivalry summary"
            ></aside>
          </div>
        </div>
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
const controlHelpElement = getElement<HTMLElement>(`#${controlHelpParent}`);
const postMatchResultsElement = getElement<HTMLElement>(
  `#${postMatchResultsParent}`
);
const matchHistoryElement = getElement<HTMLElement>(`#${matchHistoryParent}`);

window.addEventListener(WALLBALL_PLAY_SCENE_PROJECTION_EVENT, (event) => {
  void handlePlaySceneProjection(
    (event as CustomEvent<WallballPlaySceneProjectionEventDetail>).detail
  ).catch(reportLocalResultsError);
});

void initializeLocalDataPanels(localDataClient).catch(reportLocalResultsError);
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

controlHelpElement.addEventListener("click", (event) => {
  const action =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-control-help-action]")?.dataset
          .controlHelpAction
      : undefined;

  if (action === "dismiss" || action === "show") {
    controlHelpDismissed = action === "dismiss";
    writeControlHelpDismissed(controlHelpDismissed);
    renderControlHelpPanel();
  }
});

renderRemoteState();
renderControlHelpPanel();
renderLocalResultsPanel();
renderMatchHistoryPanel();

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
  } else if (intent.kind === "fielder-move") {
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

async function initializeLocalDataPanels(
  dataClient: WallballDataClient
): Promise<void> {
  const [players, teams] = await Promise.all([
    dataClient.listPlayers(),
    dataClient.listTeams()
  ]);
  const playerLabels = players.map(({ displayName, id }) => ({
    displayName,
    id
  }));

  localResultsState.players = playerLabels;
  localHistoryState.players = playerLabels;
  localHistoryState.teams = teams.map(({ displayName, id }) => ({
    displayName,
    id
  }));
  await refreshLocalHistoryPanel(dataClient);
  renderLocalResultsPanel();
}

async function refreshLocalHistoryPanel(
  dataClient: WallballDataClient
): Promise<void> {
  const [highScores, matches, interactionContext] = await Promise.all([
    dataClient.getHighScores("runs"),
    dataClient.getMatchHistory(),
    dataClient.getInteractionContext(localRivalryMatchup)
  ]);

  localResultsState.highScores = highScores;
  localResultsState.persistenceStatus = readWallballPersistenceStatus(dataClient);
  localHistoryState.highScores = highScores;
  localHistoryState.matches = matches;
  localHistoryState.rivalryCallout = interactionContext.matchHistoryCallout;
  renderMatchHistoryPanel();
}

async function handlePlaySceneProjection(
  detail: WallballPlaySceneProjectionEventDetail
): Promise<void> {
  localResultsState.projection = detail.projection;

  if (detail.projection.phase.kind !== "match-completed") {
    localResultsState.activeCompletionKey = null;
    localResultsState.errorMessage = null;
    localResultsState.recordState = "idle";
    localResultsState.recordingCompletionKey = null;
    localResultsState.persistenceStatus = readWallballPersistenceStatus(localDataClient);
    localResultsState.summary = null;
    renderLocalResultsPanel();
    return;
  }

  const completionKey = localCompletionKey(detail);

  if (
    localResultsState.activeCompletionKey === completionKey ||
    localResultsState.recordingCompletionKey === completionKey
  ) {
    renderLocalResultsPanel();
    return;
  }

  localResultsState.activeCompletionKey = completionKey;
  localResultsState.errorMessage = null;
  localResultsState.recordState = "recording";
  localResultsState.recordingCompletionKey = completionKey;
  localResultsState.summary = null;
  renderLocalResultsPanel();

  try {
    const recorded = await recordLocalMatchCompletion(detail.loop, {
      dataClient: localDataClient,
      id: `local-${Date.now()}`,
      playedAt: new Date().toISOString()
    });

    if (localResultsState.activeCompletionKey !== completionKey) {
      return;
    }

    localResultsState.highScores = recorded.highScores;
    localResultsState.persistenceStatus = recorded.persistenceStatus;
    localResultsState.recordState = "recorded";
    localResultsState.summary = recorded.summary;
    await refreshLocalHistoryPanel(localDataClient);
  } catch (error) {
    if (localResultsState.activeCompletionKey !== completionKey) {
      return;
    }

    localResultsState.errorMessage =
      error instanceof Error ? error.message : "Match result could not be saved.";
    localResultsState.recordState = "failed";
  } finally {
    if (localResultsState.recordingCompletionKey === completionKey) {
      localResultsState.recordingCompletionKey = null;
    }

    renderLocalResultsPanel();
  }
}

function renderMatchHistoryPanel(): void {
  renderMatchHistoryPanelProjection(
    projectMatchHistoryScreen({
      highScores: localHistoryState.highScores,
      matches: localHistoryState.matches,
      players: localHistoryState.players,
      rivalry: {
        callout: localHistoryState.rivalryCallout,
        playerIds: localRivalryPlayerIds,
        teamIds: localRivalryTeamIds
      },
      teams: localHistoryState.teams
    })
  );
}

function renderMatchHistoryPanelProjection(
  panel: MatchHistoryScreenProjection
): void {
  matchHistoryElement.innerHTML = `
    <div class="match-history-header">
      <div>
        <h2>${escapeHtml(panel.title)}</h2>
        <p>${escapeHtml(panel.statusLabel)}</p>
      </div>
    </div>
    <section class="match-history-section">
      <h3>Rivalry</h3>
      <p class="rivalry-title">${escapeHtml(panel.rivalry.title)}</p>
      <dl class="rivalry-lines">
        <div>
          <dt>Head to head</dt>
          <dd>${escapeHtml(panel.rivalry.recordLabel)}</dd>
        </div>
        <div>
          <dt>Latest</dt>
          <dd>${escapeHtml(panel.rivalry.recentResultLabel)}</dd>
        </div>
        <div>
          <dt>Runs</dt>
          <dd>${escapeHtml(panel.rivalry.runLeaderLabel)}</dd>
        </div>
      </dl>
      ${
        panel.rivalry.calloutText
          ? `<p class="rivalry-callout">${escapeHtml(panel.rivalry.calloutText)}</p>`
          : ""
      }
    </section>
    <section class="match-history-section">
      <h3>Recent Matches</h3>
      ${renderRecentMatchRows(panel)}
    </section>
  `;
}

function renderRecentMatchRows(panel: MatchHistoryScreenProjection): string {
  if (panel.emptyHistoryText) {
    return `<p class="empty-row">${escapeHtml(panel.emptyHistoryText)}</p>`;
  }

  return `<ol class="match-history-list">${panel.recentRows
    .map(
      (row) => `
        <li>
          <span>${escapeHtml(row.playedAtLabel)}</span>
          <strong>${escapeHtml(row.scoreLabel)}</strong>
          <em>${escapeHtml(row.resultLabel)}</em>
          <small>${escapeHtml(row.detail)}</small>
        </li>
      `
    )
    .join("")}</ol>`;
}

function renderLocalResultsPanel(): void {
  const projection = localResultsState.projection;

  if (!projection) {
    postMatchResultsElement.innerHTML = `
      <div class="post-match-header">
        <span class="post-match-status">Live</span>
        <h2>Match Results</h2>
      </div>
      <p class="post-match-score">Waiting for first pitch</p>
      <p class="post-match-winner">Local results will appear here.</p>
    `;
    return;
  }

  renderPostMatchPanelProjection(
    projectPostMatchResultsPanel({
      errorMessage: localResultsState.errorMessage,
      highScores: localResultsState.highScores,
      persistenceStatus: localResultsState.persistenceStatus,
      players: localResultsState.players,
      projection,
      recordState: localResultsState.recordState,
      summary: localResultsState.summary
    })
  );
}

function renderPostMatchPanelProjection(
  panel: PostMatchResultsPanelProjection
): void {
  postMatchResultsElement.innerHTML = `
    <div class="post-match-header">
      <span class="post-match-status">${escapeHtml(panel.statusLabel)}</span>
      <h2>${escapeHtml(panel.title)}</h2>
    </div>
    <p class="post-match-score">${escapeHtml(panel.finalScore)}</p>
    <p class="post-match-winner">${escapeHtml(panel.winnerLabel)}</p>
    <dl class="post-match-meta">
      <div>
        <dt>Matchup</dt>
        <dd>${escapeHtml(panel.matchupLabel)}</dd>
      </div>
    </dl>
    <div class="post-match-section">
      <h3>Summary</h3>
      ${renderSummaryRows(panel.summaryRows)}
    </div>
    <div class="post-match-section">
      <h3>Runs Leaderboard</h3>
      ${renderLeaderboardRows(panel)}
    </div>
  `;
}

function renderSummaryRows(rows: string[]): string {
  if (rows.length === 0) {
    return `<p class="empty-row">Finish the match to record a summary.</p>`;
  }

  return `<ul class="post-match-list">${rows
    .map((row) => `<li>${escapeHtml(row)}</li>`)
    .join("")}</ul>`;
}

function renderLeaderboardRows(panel: PostMatchResultsPanelProjection): string {
  if (panel.emptyLeaderboardText) {
    return `<p class="empty-row">${escapeHtml(panel.emptyLeaderboardText)}</p>`;
  }

  return `<ol class="post-match-list leaderboard-list">${panel.leaderboardRows
    .map(
      (row) => `
        <li>
          <span class="leaderboard-rank">#${String(row.rank)}</span>
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}</strong>
        </li>
      `
    )
    .join("")}</ol>`;
}

function renderControlHelpPanel(): void {
  const panel = projectControlHelpPanel({
    controlItems: getGameplayControlHelpItems(),
    dismissed: controlHelpDismissed
  });

  if (panel.dismissed) {
    controlHelpElement.classList.add("is-dismissed");
    controlHelpElement.innerHTML = `
      <div class="control-help-collapsed">
        <span>${escapeHtml(panel.title)} hidden</span>
        <button type="button" data-control-help-action="show">Show</button>
      </div>
    `;
    return;
  }

  controlHelpElement.classList.remove("is-dismissed");
  controlHelpElement.innerHTML = `
    <div class="control-help-header">
      <div>
        <h2>${escapeHtml(panel.title)}</h2>
        <p>${escapeHtml(panel.summary)}</p>
      </div>
      <button type="button" data-control-help-action="dismiss">Hide</button>
    </div>
    <div class="control-help-sections">
      ${panel.sections
        .map(
          (section) => `
            <section class="control-help-section">
              <h3>${escapeHtml(section.title)}</h3>
              <dl>
                ${section.rows
                  .map(
                    (row) => `
                      <div>
                        <dt>${escapeHtml(row.label)}</dt>
                        <dd>${escapeHtml(row.detail)}</dd>
                      </div>
                    `
                  )
                  .join("")}
              </dl>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function readControlHelpDismissed(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }

  try {
    return localStorage.getItem(controlHelpStorageKey) === "true";
  } catch {
    return false;
  }
}

function writeControlHelpDismissed(dismissed: boolean): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(controlHelpStorageKey, String(dismissed));
  } catch {
    // Local storage can be unavailable; the in-memory state still updates.
  }
}

function reportLocalResultsError(error: unknown): void {
  localResultsState.errorMessage =
    error instanceof Error ? error.message : "Local results failed to update.";
  localResultsState.recordState = "failed";
  renderLocalResultsPanel();
}

function localCompletionKey({
  loop
}: WallballPlaySceneProjectionEventDetail): string {
  const { events, match } = loop.flow;

  return [
    match.teams.away,
    match.teams.home,
    match.score.away,
    match.score.home,
    events.length
  ].join(":");
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

import { describe, expect, it } from "vitest";

import { loadPredefinedRosters } from "../data/fixtures";
import { createRemoteRoomStore } from "../remote/room-store";
import { projectRemoteLobbyChecklist } from "./remote-lobby";

const teams = loadPredefinedRosters().map(({ displayName, id }) => ({
  displayName,
  id
}));

describe("remote lobby checklist", () => {
  it("keeps local play available while no remote room is connected", () => {
    expect(
      projectRemoteLobbyChecklist({
        assignment: null,
        snapshot: null,
        teams
      })
    ).toEqual({
      assignmentLabel: "Local controls",
      bridgeLabel: "Remote bridge idle",
      checklistRows: [
        {
          detail: "Create or join when the remote room service is available.",
          label: "Create or join",
          state: "waiting"
        },
        {
          detail: "Choose teams locally or create a remote room.",
          label: "Selected matchup",
          state: "waiting"
        },
        {
          detail: "Waiting for a remote room before checking readiness.",
          label: "Away ready",
          state: "waiting"
        },
        {
          detail: "Waiting for a remote room before checking readiness.",
          label: "Home ready",
          state: "waiting"
        },
        {
          detail: "Waiting for first remote pitch.",
          label: "Pitch intents",
          state: "waiting"
        },
        {
          detail: "Waiting for first remote swing.",
          label: "Swing intents",
          state: "waiting"
        },
        {
          detail: "Waiting for first remote fielding input.",
          label: "Fielding intents",
          state: "waiting"
        }
      ],
      roomCodeLabel: "No room",
      statusLabel: "Local play available",
      title: "Remote Lobby"
    });
  });

  it("projects participant readiness and deterministic intent bridge status from room state", () => {
    const store = createRemoteRoomStore({
      codeFactory: () => "AB12CD",
      now: () => "2026-05-06T20:30:00.000Z"
    });
    const created = store.createRoom({
      awayTeamId: "champions",
      homeTeamId: "woodland",
      hostDisplayName: "Brandon"
    });

    store.joinRoom({
      code: "AB12CD",
      guestDisplayName: "Danny"
    });
    store.appendIntent({
      code: "AB12CD",
      kind: "ready",
      sequence: 1,
      side: "away"
    });
    store.appendIntent({
      code: "AB12CD",
      kind: "ready",
      sequence: 1,
      side: "home"
    });
    store.appendIntent({
      code: "AB12CD",
      kind: "pitch",
      payload: {
        idealContactMs: 180,
        pitchX: 0,
        targetX: 0
      },
      sequence: 2,
      side: "home"
    });
    store.appendIntent({
      code: "AB12CD",
      kind: "swing",
      payload: {
        timingMs: 0
      },
      sequence: 2,
      side: "away"
    });
    store.appendIntent({
      code: "AB12CD",
      kind: "fielder-move",
      payload: {
        axisX: 1,
        axisY: 0
      },
      sequence: 3,
      side: "home"
    });

    expect(
      projectRemoteLobbyChecklist({
        assignment: created.assignment,
        snapshot: store.getSnapshot("AB12CD"),
        teams
      })
    ).toEqual({
      assignmentLabel: "Host - away controls",
      bridgeLabel: "5 remote intents synced through deterministic bridge",
      checklistRows: [
        {
          detail: "Room AB12CD connected",
          label: "Create or join",
          state: "ready"
        },
        {
          detail: "Champions at Woodland",
          label: "Selected matchup",
          state: "ready"
        },
        {
          detail: "Brandon ready",
          label: "Away ready",
          state: "ready"
        },
        {
          detail: "Danny ready",
          label: "Home ready",
          state: "ready"
        },
        {
          detail: "Pitch event #3 synced",
          label: "Pitch intents",
          state: "ready"
        },
        {
          detail: "Swing event #4 synced",
          label: "Swing intents",
          state: "ready"
        },
        {
          detail: "Fielding event #5 synced",
          label: "Fielding intents",
          state: "ready"
        }
      ],
      roomCodeLabel: "AB12CD",
      statusLabel: "Ready to start remote loop",
      title: "Remote Lobby"
    });
  });
});

import { describe, expect, it } from "vitest";

import type { MatchSummary } from "../domain/match-summary";
import type { LocalMatchEvent } from "../systems/local-match-loop";
import { projectLocalMatchEventPanel } from "./local-match-event-panel";

describe("local match event panel projection", () => {
  it("projects compact recent event rows and recorded summary rows", () => {
    expect(
      projectLocalMatchEventPanel({
        events: [
          event(1, "pitch", "cainer"),
          event(2, "swing", "cainer"),
          {
            ...event(3, "contact", "cainer"),
            contactQuality: "perfect",
            result: "home-run"
          },
          {
            ...event(4, "target-hit", "cainer"),
            targetHit: true
          },
          {
            ...event(5, "recovery", "al"),
            fielderId: "al",
            recoveryKind: "recovered"
          },
          {
            ...event(6, "run", "cainer"),
            runsScored: ["cainer"],
            score: {
              away: 1,
              home: 0
            }
          },
          {
            ...event(7, "match-completed", null),
            score: {
              away: 1,
              home: 0
            }
          }
        ],
        players: [
          {
            id: "cainer",
            displayName: "Cainer"
          },
          {
            id: "al",
            displayName: "Al"
          }
        ],
        projection: {
          awayTeamName: "Champions",
          homeTeamName: "Woodland",
          phaseKind: "match-completed"
        },
        summary
      })
    ).toEqual({
      emptyText: null,
      recentRows: [
        {
          id: "7",
          label: "Final: Champions 1, Woodland 0",
          meta: "Top 1 - score 1-0",
          tone: "complete",
          toneLabel: "Final"
        },
        {
          id: "6",
          label: "Cainer scored",
          meta: "Top 1 - score 1-0",
          tone: "positive",
          toneLabel: "Positive"
        },
        {
          id: "5",
          label: "Al recovered the ball",
          meta: "Top 1",
          tone: "positive",
          toneLabel: "Positive"
        },
        {
          id: "4",
          label: "Target hit",
          meta: "Top 1",
          tone: "positive",
          toneLabel: "Positive"
        },
        {
          id: "3",
          label: "Perfect contact: home run",
          meta: "Top 1",
          tone: "positive",
          toneLabel: "Positive"
        },
        {
          id: "2",
          label: "Cainer swung",
          meta: "Top 1",
          tone: "neutral",
          toneLabel: "Live"
        }
      ],
      statusLabel: "7 events",
      summaryRows: ["1: cainer home-run", "1: cainer run"],
      title: "Replay Summary"
    });
  });

  it("keeps an empty live panel unobtrusive before the first pitch", () => {
    expect(
      projectLocalMatchEventPanel({
        events: [],
        players: [],
        projection: {
          awayTeamName: "Champions",
          homeTeamName: "Woodland",
          phaseKind: "ready-for-at-bat"
        },
        summary: null
      })
    ).toMatchObject({
      emptyText: "Events appear after the first pitch.",
      recentRows: [],
      statusLabel: "Live",
      summaryRows: [],
      title: "Event Log"
    });
  });

  it("projects pitch wall-zone and score context from event rows", () => {
    expect(
      projectLocalMatchEventPanel({
        events: [
          {
            ...event(1, "take", "cainer"),
            result: "miss"
          },
          {
            ...event(2, "target-hit", "cainer"),
            result: "miss",
            targetHit: true
          },
          {
            ...event(3, "wall-hit", "cainer"),
            result: "miss",
            targetHit: false
          },
          {
            ...event(4, "run", "cainer"),
            runsScored: ["cainer"],
            score: {
              away: 1,
              home: 0
            }
          }
        ],
        players: [
          {
            id: "cainer",
            displayName: "Cainer"
          }
        ],
        projection: {
          awayTeamName: "Champions",
          homeTeamName: "Woodland",
          phaseKind: "ready-for-at-bat"
        },
        summary: null
      }).recentRows
    ).toEqual([
      {
        id: "4",
        label: "Cainer scored",
        meta: "Top 1 - score 1-0",
        tone: "positive",
        toneLabel: "Positive"
      },
      {
        id: "3",
        label: "Pitch outside zone",
        meta: "Top 1",
        tone: "neutral",
        toneLabel: "Live"
      },
      {
        id: "2",
        label: "Pitch inside zone",
        meta: "Top 1",
        tone: "warning",
        toneLabel: "Warning"
      },
      {
        id: "1",
        label: "Cainer took the pitch",
        meta: "Top 1",
        tone: "neutral",
        toneLabel: "Live"
      }
    ]);
  });
});

const summary: MatchSummary = {
  id: "local-1",
  playedAt: "2026-05-06T20:30:00.000Z",
  finalScore: "champions 1, woodland 0",
  winnerTeamId: "champions",
  loserTeamId: "woodland",
  innings: 1,
  notableEvents: ["1: cainer home-run", "1: cainer run"]
};

function event(
  sequence: number,
  kind: LocalMatchEvent["kind"],
  playerId: string | null
): LocalMatchEvent {
  return {
    half: "top",
    inning: 1,
    kind,
    playerId,
    sequence
  };
}

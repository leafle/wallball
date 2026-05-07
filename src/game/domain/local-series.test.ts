import { describe, expect, it } from "vitest";

import type { CompletedMatch } from "./match-summary";
import {
  clearLocalSeriesState,
  createLocalSeries,
  loadLocalSeriesState,
  projectLocalSeriesPanel,
  saveLocalSeriesState,
  updateLocalSeriesFromCompletedMatch,
  type LocalSeriesStorage
} from "./local-series";

describe("local mini-series", () => {
  it("projects an idle setup and an active best-of-three score", () => {
    expect(
      projectLocalSeriesPanel({
        selectedMatchup: {
          awayTeamId: "champions",
          homeTeamId: "woodland"
        },
        series: null,
        teams
      })
    ).toEqual({
      canReset: false,
      completed: false,
      detailRows: [
        {
          label: "Next match",
          value: "Champions vs Woodland"
        },
        {
          label: "Series format",
          value: "Choose Best of 3 or First to N"
        }
      ],
      modeLabel: "No active series",
      nextMatchLabel: "Next match: Champions vs Woodland",
      scoreLabel: "No active series",
      statusLabel: "Not started",
      title: "Local Series",
      winnerLabel: "Start a local series from the selected matchup."
    });

    const series = updateLocalSeriesFromCompletedMatch(
      createLocalSeries({
        awayTeamId: "champions",
        format: "best-of-three",
        homeTeamId: "woodland",
        id: "series-1",
        startedAt: "2026-05-07T15:00:00.000Z"
      }),
      match({
        id: "match-1",
        score: {
          away: 2,
          home: 1
        }
      })
    );

    expect(
      projectLocalSeriesPanel({
        selectedMatchup: {
          awayTeamId: "team-cainer",
          homeTeamId: "ej"
        },
        series,
        teams
      })
    ).toEqual({
      canReset: true,
      completed: false,
      detailRows: [
        {
          label: "Format",
          value: "Best of 3"
        },
        {
          label: "Recorded",
          value: "1 match"
        },
        {
          label: "Next match",
          value: "Champions vs Woodland"
        }
      ],
      modeLabel: "Best of 3",
      nextMatchLabel: "Next match: Champions vs Woodland",
      scoreLabel: "Champions 1, Woodland 0",
      statusLabel: "In progress",
      title: "Local Series",
      winnerLabel: "Champions need 1 more win."
    });
  });

  it("advances a first-to-N series after completed matches without double-counting", () => {
    const initial = createLocalSeries({
      awayTeamId: "champions",
      format: "first-to",
      homeTeamId: "woodland",
      id: "series-2",
      startedAt: "2026-05-07T15:00:00.000Z",
      targetWins: 3
    });
    const afterAwayWin = updateLocalSeriesFromCompletedMatch(
      initial,
      match({
        id: "match-1",
        score: {
          away: 4,
          home: 2
        }
      })
    );
    const afterDuplicate = updateLocalSeriesFromCompletedMatch(
      afterAwayWin,
      match({
        id: "match-1",
        score: {
          away: 4,
          home: 2
        }
      })
    );
    const afterTie = updateLocalSeriesFromCompletedMatch(
      afterDuplicate,
      match({
        id: "match-2",
        score: {
          away: 3,
          home: 3
        }
      })
    );
    const afterUnrelated = updateLocalSeriesFromCompletedMatch(
      afterTie,
      match({
        id: "match-3",
        score: {
          away: 8,
          home: 0
        },
        teams: {
          away: "team-cainer",
          home: "ej"
        }
      })
    );
    const afterHomeWins = [
      match({
        id: "match-4",
        playedAt: "2026-05-07T16:00:00.000Z",
        score: {
          away: 1,
          home: 2
        }
      }),
      match({
        id: "match-5",
        playedAt: "2026-05-07T17:00:00.000Z",
        score: {
          away: 0,
          home: 2
        }
      }),
      match({
        id: "match-6",
        playedAt: "2026-05-07T18:00:00.000Z",
        score: {
          away: 2,
          home: 5
        }
      })
    ].reduce(updateLocalSeriesFromCompletedMatch, afterUnrelated);

    expect(afterHomeWins).toMatchObject({
      completedAt: "2026-05-07T18:00:00.000Z",
      completedMatchIds: ["match-1", "match-2", "match-4", "match-5", "match-6"],
      wins: {
        away: 1,
        home: 3
      }
    });
    expect(
      projectLocalSeriesPanel({
        selectedMatchup: {
          awayTeamId: "champions",
          homeTeamId: "woodland"
        },
        series: afterHomeWins,
        teams
      })
    ).toMatchObject({
      completed: true,
      modeLabel: "First to 3",
      nextMatchLabel: "Series complete: Woodland won.",
      scoreLabel: "Champions 1, Woodland 3",
      statusLabel: "Complete",
      winnerLabel: "Woodland won the series."
    });
  });

  it("persists only the active local series state needed to resume or reset", () => {
    const storage = createMemoryStorage();
    const series = createLocalSeries({
      awayTeamId: "champions",
      format: "best-of-three",
      homeTeamId: "woodland",
      id: "series-3",
      startedAt: "2026-05-07T15:00:00.000Z"
    });

    saveLocalSeriesState(series, {
      storage,
      validTeamIds: ["champions", "woodland", "team-cainer", "ej"]
    });

    expect(
      loadLocalSeriesState({
        storage,
        validTeamIds: ["champions", "woodland", "team-cainer", "ej"]
      })
    ).toEqual(series);

    clearLocalSeriesState({ storage });

    expect(loadLocalSeriesState({ storage })).toBeNull();
  });
});

const teams = [
  {
    id: "champions",
    displayName: "Champions"
  },
  {
    id: "woodland",
    displayName: "Woodland"
  },
  {
    id: "team-cainer",
    displayName: "Team Cainer"
  },
  {
    id: "ej",
    displayName: "EJ"
  }
];

function match({
  id,
  playedAt = "2026-05-07T15:30:00.000Z",
  score,
  teams: matchTeams = {
    away: "champions",
    home: "woodland"
  }
}: Pick<CompletedMatch, "id" | "score"> &
  Partial<Pick<CompletedMatch, "playedAt" | "teams">>): CompletedMatch {
  return {
    events: [],
    id,
    innings: 1,
    playedAt,
    score,
    teams: matchTeams
  };
}

function createMemoryStorage(
  initial: Record<string, string> = {}
): LocalSeriesStorage {
  const values = new Map(Object.entries(initial));

  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
}

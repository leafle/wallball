import { describe, expect, it } from "vitest";

import {
  createPlaySceneLoopAdapter,
  projectPlaySceneLoopState
} from "./scenes/play-scene-loop-adapter";
import {
  DEFAULT_GAMEPLAY_PREFERENCES,
  GAMEPLAY_PREFERENCES_STORAGE_KEY,
  createPlaySceneAdapterInputFromPreferences,
  loadGameplayPreferences,
  resetGameplayPreferences,
  saveGameplayPreferences,
  updateGameplayPreferences,
  type GameplayPreferences,
  type GameplayPreferenceStorage
} from "./preferences";

describe("gameplay preferences", () => {
  const validTeamIds = ["champions", "woodland", "team-cainer", "ej"];

  it("loads typed local gameplay preferences from storage", () => {
    const stored: GameplayPreferences = {
      audioMuted: true,
      controlHelpVisible: false,
      preferredMatchup: {
        awayTeamId: "ej",
        homeTeamId: "team-cainer"
      },
      reducedFeedbackIntensity: true,
      soloAssistEnabled: false
    };
    const storage = createMemoryStorage({
      [GAMEPLAY_PREFERENCES_STORAGE_KEY]: JSON.stringify(stored)
    });

    expect(
      loadGameplayPreferences({
        storage,
        validTeamIds
      })
    ).toEqual(stored);
  });

  it("falls back safely when stored values are missing, invalid, or unavailable", () => {
    const storage = createMemoryStorage({
      [GAMEPLAY_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        audioMuted: "yes",
        controlHelpVisible: "no",
        preferredMatchup: {
          awayTeamId: "missing-team",
          homeTeamId: 42
        },
        reducedFeedbackIntensity: 1,
        soloAssistEnabled: null
      })
    });

    expect(
      loadGameplayPreferences({
        storage,
        validTeamIds
      })
    ).toEqual(DEFAULT_GAMEPLAY_PREFERENCES);

    expect(
      loadGameplayPreferences({
        storage: createThrowingStorage(),
        validTeamIds
      })
    ).toEqual(DEFAULT_GAMEPLAY_PREFERENCES);
  });

  it("migrates the previous control-help dismissal key when typed preferences are absent", () => {
    const storage = createMemoryStorage({
      "wallball.controlHelp.dismissed": "true"
    });

    expect(
      loadGameplayPreferences({
        storage,
        validTeamIds
      })
    ).toEqual({
      ...DEFAULT_GAMEPLAY_PREFERENCES,
      controlHelpVisible: false
    });
  });

  it("saves updated preferences and resets them back to defaults", () => {
    const storage = createMemoryStorage();
    const updated = updateGameplayPreferences(DEFAULT_GAMEPLAY_PREFERENCES, {
      audioMuted: true,
      preferredMatchup: {
        awayTeamId: "woodland",
        homeTeamId: "ej"
      }
    });

    saveGameplayPreferences(updated, {
      storage,
      validTeamIds
    });

    expect(
      loadGameplayPreferences({
        storage,
        validTeamIds
      })
    ).toEqual(updated);

    expect(resetGameplayPreferences({ storage })).toEqual(
      DEFAULT_GAMEPLAY_PREFERENCES
    );
    expect(
      loadGameplayPreferences({
        storage,
        validTeamIds
      })
    ).toEqual(DEFAULT_GAMEPLAY_PREFERENCES);
  });

  it(
    "feeds matchup and solo assist into playable config safely",
    () => {
      const preferences = updateGameplayPreferences(DEFAULT_GAMEPLAY_PREFERENCES, {
        preferredMatchup: {
          awayTeamId: "ej",
          homeTeamId: "team-cainer"
        },
        soloAssistEnabled: false
      });
      const adapter = createPlaySceneLoopAdapter(
        createPlaySceneAdapterInputFromPreferences(preferences, {
          validTeamIds
        })
      );

      expect(projectPlaySceneLoopState(adapter).setup).toMatchObject({
        awayTeamId: "ej",
        awayTeamName: "EJ",
        homeTeamId: "team-cainer",
        homeTeamName: "Team Cainer"
      });
      expect(adapter.soloAssist.enabled).toBe(false);
      expect(adapter.tuning.assist.enabled).toBe(true);
    }
  );
});

function createMemoryStorage(
  initial: Record<string, string> = {}
): GameplayPreferenceStorage {
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

function createThrowingStorage(): GameplayPreferenceStorage {
  return {
    getItem: () => {
      throw new Error("storage unavailable");
    },
    removeItem: () => {
      throw new Error("storage unavailable");
    },
    setItem: () => {
      throw new Error("storage unavailable");
    }
  };
}

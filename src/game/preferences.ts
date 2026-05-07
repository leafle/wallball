export interface GameplayPreferenceStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface PreferredGameplayMatchup {
  awayTeamId: string;
  homeTeamId: string;
}

export interface GameplayPreferences {
  audioMuted: boolean;
  controlHelpVisible: boolean;
  preferredMatchup: PreferredGameplayMatchup;
  reducedFeedbackIntensity: boolean;
  soloAssistEnabled: boolean;
}

export interface GameplayPreferenceOptions {
  storage?: GameplayPreferenceStorage | null;
  validTeamIds?: readonly string[];
}

export type GameplayPreferencePatch = Partial<
  Omit<GameplayPreferences, "preferredMatchup">
> & {
  preferredMatchup?: Partial<PreferredGameplayMatchup>;
};

export interface PlayScenePreferenceAdapterInput {
  awayTeamId: string;
  homeTeamId: string;
  soloAssist: {
    enabled: boolean;
  };
}

export const GAMEPLAY_PREFERENCES_STORAGE_KEY =
  "wallball.gameplayPreferences.v1";
const LEGACY_CONTROL_HELP_STORAGE_KEY = "wallball.controlHelp.dismissed";

export const DEFAULT_GAMEPLAY_PREFERENCES: GameplayPreferences = {
  audioMuted: false,
  controlHelpVisible: true,
  preferredMatchup: {
    awayTeamId: "champions",
    homeTeamId: "woodland"
  },
  reducedFeedbackIntensity: false,
  soloAssistEnabled: true
};

export function loadGameplayPreferences(
  options: GameplayPreferenceOptions = {}
): GameplayPreferences {
  const storage = options.storage ?? getBrowserLocalStorage();

  if (!storage) {
    return cloneGameplayPreferences(DEFAULT_GAMEPLAY_PREFERENCES);
  }

  try {
    const raw = storage.getItem(GAMEPLAY_PREFERENCES_STORAGE_KEY);

    if (!raw) {
      return loadLegacyGameplayPreferences(storage);
    }

    return normalizeGameplayPreferences(JSON.parse(raw), options);
  } catch {
    return cloneGameplayPreferences(DEFAULT_GAMEPLAY_PREFERENCES);
  }
}

function loadLegacyGameplayPreferences(
  storage: GameplayPreferenceStorage
): GameplayPreferences {
  const preferences = cloneGameplayPreferences(DEFAULT_GAMEPLAY_PREFERENCES);

  try {
    preferences.controlHelpVisible =
      storage.getItem(LEGACY_CONTROL_HELP_STORAGE_KEY) !== "true";
  } catch {
    preferences.controlHelpVisible =
      DEFAULT_GAMEPLAY_PREFERENCES.controlHelpVisible;
  }

  return preferences;
}

export function saveGameplayPreferences(
  preferences: GameplayPreferences,
  options: GameplayPreferenceOptions = {}
): void {
  const storage = options.storage ?? getBrowserLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      GAMEPLAY_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizeGameplayPreferences(preferences, options))
    );
  } catch {
    // Local storage can be unavailable; callers still keep in-memory settings.
  }
}

export function resetGameplayPreferences(
  options: GameplayPreferenceOptions = {}
): GameplayPreferences {
  const storage = options.storage ?? getBrowserLocalStorage();

  if (storage) {
    try {
      storage.removeItem(GAMEPLAY_PREFERENCES_STORAGE_KEY);
    } catch {
      // Missing storage should not prevent resetting the in-memory state.
    }
  }

  return cloneGameplayPreferences(DEFAULT_GAMEPLAY_PREFERENCES);
}

export function updateGameplayPreferences(
  current: GameplayPreferences,
  patch: GameplayPreferencePatch,
  options: Omit<GameplayPreferenceOptions, "storage"> = {}
): GameplayPreferences {
  return normalizeGameplayPreferences(
    {
      ...current,
      ...patch,
      preferredMatchup: {
        ...current.preferredMatchup,
        ...patch.preferredMatchup
      }
    },
    options
  );
}

export function createPlaySceneAdapterInputFromPreferences(
  preferences: GameplayPreferences,
  options: Omit<GameplayPreferenceOptions, "storage"> = {}
): PlayScenePreferenceAdapterInput {
  const normalized = normalizeGameplayPreferences(preferences, options);

  return {
    awayTeamId: normalized.preferredMatchup.awayTeamId,
    homeTeamId: normalized.preferredMatchup.homeTeamId,
    soloAssist: {
      enabled: normalized.soloAssistEnabled
    }
  };
}

export function areGameplayPreferencesEqual(
  left: GameplayPreferences,
  right: GameplayPreferences
): boolean {
  return (
    left.audioMuted === right.audioMuted &&
    left.controlHelpVisible === right.controlHelpVisible &&
    left.reducedFeedbackIntensity === right.reducedFeedbackIntensity &&
    left.soloAssistEnabled === right.soloAssistEnabled &&
    left.preferredMatchup.awayTeamId === right.preferredMatchup.awayTeamId &&
    left.preferredMatchup.homeTeamId === right.preferredMatchup.homeTeamId
  );
}

function normalizeGameplayPreferences(
  input: unknown,
  options: Omit<GameplayPreferenceOptions, "storage"> = {}
): GameplayPreferences {
  const source = isRecord(input) ? input : {};

  return {
    audioMuted: readBoolean(
      source.audioMuted,
      DEFAULT_GAMEPLAY_PREFERENCES.audioMuted
    ),
    controlHelpVisible: readBoolean(
      source.controlHelpVisible,
      DEFAULT_GAMEPLAY_PREFERENCES.controlHelpVisible
    ),
    preferredMatchup: normalizePreferredMatchup(
      source.preferredMatchup,
      options.validTeamIds
    ),
    reducedFeedbackIntensity: readBoolean(
      source.reducedFeedbackIntensity,
      DEFAULT_GAMEPLAY_PREFERENCES.reducedFeedbackIntensity
    ),
    soloAssistEnabled: readBoolean(
      source.soloAssistEnabled,
      DEFAULT_GAMEPLAY_PREFERENCES.soloAssistEnabled
    )
  };
}

function normalizePreferredMatchup(
  input: unknown,
  validTeamIds: readonly string[] | undefined
): PreferredGameplayMatchup {
  const source = isRecord(input) ? input : {};

  return {
    awayTeamId: readTeamId(
      source.awayTeamId,
      DEFAULT_GAMEPLAY_PREFERENCES.preferredMatchup.awayTeamId,
      validTeamIds
    ),
    homeTeamId: readTeamId(
      source.homeTeamId,
      DEFAULT_GAMEPLAY_PREFERENCES.preferredMatchup.homeTeamId,
      validTeamIds
    )
  };
}

function readTeamId(
  value: unknown,
  fallback: string,
  validTeamIds: readonly string[] | undefined
): string {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  if (validTeamIds && !validTeamIds.includes(value)) {
    return fallback;
  }

  return value;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBrowserLocalStorage(): GameplayPreferenceStorage | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  return localStorage;
}

function cloneGameplayPreferences(
  preferences: GameplayPreferences
): GameplayPreferences {
  return {
    ...preferences,
    preferredMatchup: {
      ...preferences.preferredMatchup
    }
  };
}

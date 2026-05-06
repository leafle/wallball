import {
  generateMatchSummary,
  type CompletedMatch
} from "./match-summary";

export type InteractionTrigger = "player-matchup" | "match-history";

export interface PlayerMatchup {
  batterId: string;
  pitcherId: string;
}

export interface InteractionPrompt {
  id: string;
  trigger: InteractionTrigger;
  message: string;
  tags: string[];
  batterId?: string;
  pitcherId?: string;
  playerIds?: string[];
}

export interface InteractionCallout {
  id: string;
  trigger: InteractionTrigger;
  message: string;
  playerIds: string[];
  tags: string[];
  sourceMatchId?: string;
}

export interface InteractionContext {
  matchupCallout: InteractionCallout | null;
  matchHistoryCallout: InteractionCallout | null;
  callouts: InteractionCallout[];
}

export interface InteractionContextOptions {
  matchup: PlayerMatchup;
  prompts: InteractionPrompt[];
  matchHistory?: CompletedMatch[];
}

export function getInteractionContext({
  matchup,
  prompts,
  matchHistory = []
}: InteractionContextOptions): InteractionContext {
  const matchupCallout = selectMatchupCallout(matchup, prompts);
  const matchHistoryCallout = selectMatchHistoryCallout(
    matchup,
    prompts,
    matchHistory
  );
  const callouts = [matchupCallout, matchHistoryCallout].filter(
    isInteractionCallout
  );

  return {
    matchupCallout,
    matchHistoryCallout,
    callouts
  };
}

function selectMatchupCallout(
  matchup: PlayerMatchup,
  prompts: InteractionPrompt[]
): InteractionCallout | null {
  const prompt = prompts.find(
    (candidate) =>
      candidate.trigger === "player-matchup" &&
      candidate.batterId === matchup.batterId &&
      candidate.pitcherId === matchup.pitcherId
  );

  if (!prompt) {
    return null;
  }

  return {
    id: prompt.id,
    trigger: prompt.trigger,
    message: prompt.message,
    playerIds: [matchup.batterId, matchup.pitcherId],
    tags: [...prompt.tags]
  };
}

function selectMatchHistoryCallout(
  matchup: PlayerMatchup,
  prompts: InteractionPrompt[],
  matchHistory: CompletedMatch[]
): InteractionCallout | null {
  const playerIds = [matchup.batterId, matchup.pitcherId];
  const prompt = prompts.find(
    (candidate) =>
      candidate.trigger === "match-history" &&
      haveSamePlayers(candidate.playerIds ?? [], playerIds)
  );

  if (!prompt) {
    return null;
  }

  const sourceMatch = [...matchHistory]
    .filter((match) => matchIncludesPlayers(match, playerIds))
    .sort((left, right) => right.playedAt.localeCompare(left.playedAt))[0];

  if (!sourceMatch) {
    return null;
  }

  const summary = generateMatchSummary(sourceMatch);

  return {
    id: prompt.id,
    trigger: prompt.trigger,
    message: renderTemplate(prompt.message, {
      batterId: matchup.batterId,
      pitcherId: matchup.pitcherId,
      matchId: sourceMatch.id,
      finalScore: summary.finalScore,
      winnerTeamId: summary.winnerTeamId ?? "tie",
      loserTeamId: summary.loserTeamId ?? "tie"
    }),
    playerIds,
    tags: [...prompt.tags],
    sourceMatchId: sourceMatch.id
  };
}

function matchIncludesPlayers(
  match: CompletedMatch,
  playerIds: string[]
): boolean {
  const matchPlayerIds = new Set(
    match.events.map((event) => event.playerId)
  );

  return playerIds.every((playerId) => matchPlayerIds.has(playerId));
}

function haveSamePlayers(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightPlayerIds = new Set(right);
  return left.every((playerId) => rightPlayerIds.has(playerId));
}

function renderTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(
    /\{([a-zA-Z]+)\}/g,
    (placeholder, key: string) => values[key] ?? placeholder
  );
}

function isInteractionCallout(
  callout: InteractionCallout | null
): callout is InteractionCallout {
  return callout !== null;
}

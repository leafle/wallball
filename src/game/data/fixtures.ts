import type { InteractionPrompt } from "../domain/friend-interactions";
import type { PlayerProfile, TeamRoster } from "../domain/rosters";

export type PlayerFixture = PlayerProfile;

export type TeamFixture = TeamRoster;

const predefinedRosters: TeamFixture[] = [
  {
    id: "champions",
    displayName: "Champions",
    players: [
      player("cainer", "Cainer", 1, "champions"),
      player("minkus", "Minkus", 2, "champions"),
      player("brandon", "Brandon", 3, "champions")
    ]
  },
  {
    id: "woodland",
    displayName: "Woodland",
    players: [
      player("al", "Al", 1, "woodland"),
      player("danny", "Danny", 2, "woodland"),
      player("regen", "Regen", 3, "woodland")
    ]
  },
  {
    id: "team-cainer",
    displayName: "Team Cainer",
    players: [
      player("rich", "Rich", 1, "team-cainer"),
      player("jsack", "JSack", 2, "team-cainer"),
      player("jeremy", "Jeremy", 3, "team-cainer")
    ]
  },
  {
    id: "ej",
    displayName: "EJ",
    players: [
      player("bobby", "Bobby", 1, "ej"),
      player("nick", "Nick", 2, "ej"),
      player("andrew", "Andrew", 3, "ej")
    ]
  }
];

const interactionPrompts: InteractionPrompt[] = [
  {
    id: "brandon-vs-danny",
    trigger: "player-matchup",
    batterId: "brandon",
    pitcherId: "danny",
    message: "Brandon digs in while Danny works fast.",
    tags: ["matchup", "pace"]
  },
  {
    id: "cainer-vs-al-history",
    trigger: "match-history",
    playerIds: ["cainer", "al"],
    message: "Cainer and Al have history here: {finalScore} in {matchId}.",
    tags: ["history", "rivalry"]
  }
];

export function loadPredefinedRosters(): TeamFixture[] {
  return predefinedRosters.map((team) => ({
    ...team,
    players: team.players.map((rosterPlayer) => ({ ...rosterPlayer }))
  }));
}

export function loadInteractionPrompts(): InteractionPrompt[] {
  return interactionPrompts.map((prompt) => ({ ...prompt }));
}

function player(
  id: string,
  displayName: string,
  battingOrder: number,
  teamTag: string
): PlayerFixture {
  return {
    id,
    displayName,
    battingOrder,
    tags: [teamTag]
  };
}

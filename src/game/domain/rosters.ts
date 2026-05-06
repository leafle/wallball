export type TeamId = string;
export type PlayerId = string;

export interface PlayerProfile {
  id: PlayerId;
  displayName: string;
  battingOrder: number;
  tags: string[];
}

export interface TeamRoster {
  id: TeamId;
  displayName: string;
  players: PlayerProfile[];
}

export interface BattingOrder {
  away: PlayerId[];
  home: PlayerId[];
}

export interface CreateBattingOrderInput {
  away: TeamRoster;
  home: TeamRoster;
}

export function createBattingOrderFromRosters({
  away,
  home
}: CreateBattingOrderInput): BattingOrder {
  return {
    away: playerIdsByBattingOrder(away),
    home: playerIdsByBattingOrder(home)
  };
}

function playerIdsByBattingOrder(team: TeamRoster): PlayerId[] {
  return [...team.players]
    .sort((left, right) => left.battingOrder - right.battingOrder)
    .map((player) => player.id);
}

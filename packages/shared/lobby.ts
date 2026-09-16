import type { LobbyID } from "./ids";

export type LobbyInfo = {
  id: LobbyID;
  player_count: number;
  max_players: number;
  host: string;
};

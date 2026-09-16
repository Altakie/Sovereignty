import type { LobbyID } from "./ids";

export interface SessionReturn {
  in_game: boolean;
}

export interface InGame extends SessionReturn {
  in_game: true;
  name: string;
  lobby_id: LobbyID;
}

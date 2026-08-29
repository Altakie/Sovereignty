import type { LobbyInfo } from "shared/lobby";
import {
  type ConnectMessage,
  type DisconnectMessage,
  type Message,
  MessageKinds,
  type PlayerNamesMessage,
  type StartMessage,
  serializeMessage,
} from "shared/messages";
import { none, type Option, some } from "shared/option";
import { Game } from "./game";
import { AISocket, type MessageSink } from "./socket";

const MAX_PLAYERS = 6;

const PLAYER_TYPES = Object.freeze({
  AI: "AI",
  HUMAN: "Human",
});
type PlayerType = (typeof PLAYER_TYPES)[keyof typeof PLAYER_TYPES];

export type PlayerLobbyInfo = {
  clientid: string;
  socket: MessageSink;
  name: string;
  player_type: PlayerType;
};

export class Lobby {
  id: string;
  player_lobby_infos: Map<string, PlayerLobbyInfo>;
  host: Option<PlayerLobbyInfo>;
  game?: Game;
  max_players: number;

  constructor(id: string) {
    this.id = id;
    this.player_lobby_infos = new Map();
    this.max_players = MAX_PLAYERS;
    this.host = none();
  }

  get_info(): LobbyInfo {
    return {
      id: this.id,
      player_count: this.player_lobby_infos.size,
      max_players: this.max_players,
      host: this.host.map((host) => host.name).unwrap_or_else(() => "No Host"),
    };
  }

  add_player(
    clientid: string,
    name: string,
    ws: MessageSink,
    player_type?: PlayerType,
  ) {
    const player_lobby_info: PlayerLobbyInfo = {
      name: name,
      clientid: clientid,
      socket: ws,
      player_type: player_type ? player_type : PLAYER_TYPES.HUMAN,
    };

    this.player_lobby_infos.set(clientid, player_lobby_info);
    if (this.player_lobby_infos.size === 1) {
      this.host = some(player_lobby_info);
    }

    // Check if there is a game going on and if the player is in it, send them a game started message
    // TODO: Only send connect message to players in lobby
    if (this.game?.player_infos.some((pi) => pi.clientid === clientid)) {
      this.game.reconnect_player(clientid, ws);
    }

    let players_in_lobby: PlayerLobbyInfo[];
    if (this.game === undefined) {
      players_in_lobby = this.player_lobby_infos.values().toArray();
    } else {
      players_in_lobby = this.player_lobby_infos
        .values()
        .filter(
          (player_lobby_info) =>
            !this.game?.player_infos.some(
              (player_info) =>
                player_info.clientid === player_lobby_info.clientid,
            ),
        )
        .toArray();
    }

    const msg: ConnectMessage = {
      kind: MessageKinds.CONNECT,
      player_name: name,
    };

    const msg_str = serializeMessage(msg);

    for (const player of players_in_lobby) {
      if (player.clientid === clientid) {
        const msg: PlayerNamesMessage = {
          kind: MessageKinds.PLAYER_NAMES,
          player_names: this.get_player_names(),
        };

        player.socket.send(serializeMessage(msg));
        continue;
      }

      player.socket.send(msg_str);
    }
  }

  add_ai_player() {
    if (this.player_lobby_infos.values().some((pli) => pli.name === "Gemini")) {
      return;
    }
    const ai_player = new AISocket((clientid, message) =>
      this.resolve_message(clientid, message),
    );
    this.add_player(ai_player.client_id, "Gemini", ai_player, PLAYER_TYPES.AI);
  }

  resolve_message(clientid: string, message: Message) {
    console.log(`Message received: ${JSON.stringify(message)}`);
    switch (message.kind) {
      case MessageKinds.START: {
        const start_message = message as StartMessage;
        // if (players.size > 1) {
        console.log("Start Message Received");
        if (this.game) {
          break;
        }
        console.log("Starting Game");
        this.game = new Game(
          this.get_player_lobby_infos(),
          this,
          start_message.chosen_cards,
        );

        this.game.start_game();

        console.log(
          `Game Started with players: ${JSON.stringify(this.get_player_names())}`,
        );
        // }
        break;
      }
      case MessageKinds.ADD_AI_PLAYER:
        this.add_ai_player();
        break;
      case MessageKinds.KICK_PLAYER:
        if (!this.host.is_some_and((host) => host.clientid === clientid)) {
          break;
        }
        // TODO: Tell the player they've been kicked
        this.remove_player(clientid);
        break;
      case MessageKinds.PICK_CARDS_RESPONSE:
      case MessageKinds.PICK_SUPPLY_PILE_RESPONSE:
      case MessageKinds.PICK_YES_NO_RESPONSE:
        if (this.game === undefined) {
          console.log("No Game");
          break;
        }
        if (this.game.wait_queue.isEmpty()) {
          console.log("Received player response but game is not waiting");
        }
        console.log("Going to resolve player choice");
        this.game.resolve_player_choice(clientid, message);
        break;
      default:
        console.log(`Message Kind "${message.kind}" not recognized`);
    }
  }

  remove_player(clientid: string) {
    // TODO: Only send disconnect message to players in lobby unless the player who left was in the game
    const name = this.player_lobby_infos.get(clientid)?.name;
    if (name == null) {
      return;
    }

    this.player_lobby_infos.delete(clientid);

    if (this.host.is_some_and((host) => host.clientid === clientid)) {
      let next_player = this.player_lobby_infos.values().next().value;
      while (next_player?.player_type !== "Human") {
        next_player = this.player_lobby_infos.values().next().value;
      }

      if (!next_player) {
        this.host = none();
        return;
      } else {
        this.host = some(next_player);
      }
    }

    const msg: DisconnectMessage = {
      kind: MessageKinds.DISCONNECT,
      player_name: name,
    };

    const msg_str = serializeMessage(msg);
    for (const player of this.player_lobby_infos.values()) {
      player.socket.send(msg_str);
    }

    console.log(`Player ${clientid} left the game`);
  }

  get_player_names(): string[] {
    return this.player_lobby_infos
      .values()
      .map((info) => info.name)
      .toArray();
  }

  get_player_lobby_infos(): PlayerLobbyInfo[] {
    return this.player_lobby_infos.values().toArray();
  }
}

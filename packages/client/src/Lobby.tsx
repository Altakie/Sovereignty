import { useEffect, useState } from "react";
import {
  type AddAIPlayerMessage,
  type ConnectMessage,
  type DisconnectMessage,
  type GameStateUpdateMessage,
  type LogEventMessage,
  type Message,
  MessageKinds,
  type NewLogTurnMessage,
  type PlayerNamesMessage,
  parseMessage,
  type StartedMessage,
  type StartMessage,
  type SyncLogMessage,
  serializeMessage,
} from "shared/messages";
import { RouterStates, useGlobalStore } from "./App";
import { Button } from "./components/ui/button.tsx";
import "./App.css";
import type { GameState, PlayerDisplayInfo, SharablePlayer } from "shared";
import { BaseCards } from "shared/cards/base";
import type { Card, CardInfo, CardName } from "shared/cards.ts";
import type { LogEntry, Turn } from "shared/log.ts";
import { none, type Option, some } from "shared/option.ts";
import type { supplyStack } from "shared/supply.ts";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog.tsx";
import { Separator } from "./components/ui/separator.tsx";
import { CardShape, CardShell, Game, GoldCoin } from "./Game.tsx";
import { GameEnd } from "./GameEnd.tsx";
import { cn } from "./lib/utils.ts";

// export const GameContext = createContext<{
//   gameSocket: RefObject<WebSocket>,
//   gameState: GameState,
//   message?: Message,
//   player: Player
// }>(null)
//

export const LobbyStates = Object.freeze({
  LOBBY: "Lobby",
  GAME_STARTED: "Game Started",
  GAME_END: "Game End",
});

type LobbyStore = {
  lobby_id: string;
  set_lobby_id: (id: string) => void;
  connected: boolean;
  set_connected: (connected: boolean) => void;
  game_socket: WebSocket | null;
  set_game_socket: (game_socket: WebSocket | null) => void;
  name: string;
  set_name: (name: string) => void;
  send_message: (message: Message) => void;
  player_names: string[];
  add_player_name: (name: string) => void;
  remove_player_name: (name: string) => void;
  set_player_names: (names: string[]) => void;
  kingdomCards: Option<CardInfo>[];
  set_kingdom_card: (index: number, card: CardInfo) => void;
  clear_kingdom_card: (index: number) => void;

  player_game_infos: PlayerDisplayInfo[];
  set_player_game_infos: (infos: PlayerDisplayInfo[]) => void;

  lobby_state: (typeof LobbyStates)[keyof typeof LobbyStates];
  set_lobby_state: (
    game_started: (typeof LobbyStates)[keyof typeof LobbyStates],
  ) => void;

  game_state?: GameState;
  set_game_state: (game_state: GameState) => void;
  message?: Message;
  set_message: (message?: Message) => void;
  player?: SharablePlayer;
  set_player: (player?: SharablePlayer) => void;

  log_messages: Turn[];
  add_log_messages: (...messages: LogEntry[]) => void;
  add_turn: (turn: Turn) => void;
  set_log: (log: Turn[]) => void;
  clear_log: () => void;
  ping: HTMLAudioElement;

  selected_stacks: supplyStack[];
  toggle_stack: (stack: supplyStack) => void;
  reset_stacks: () => void;

  selected_cards: Card[];
  toggle_card: (card: Card) => void;
  reset_cards: () => void;
};

export const useLobbyStore = create<LobbyStore>((set, get) => ({
  lobby_id: "",
  set_lobby_id: (id: string) => set(() => ({ lobby_id: id })),
  connected: false,
  set_connected: (connected: boolean) => {
    set({ connected: connected });
  },
  game_socket: null,
  set_game_socket: (game_socket: WebSocket | null) => {
    set({ game_socket: game_socket });
  },
  name: "",
  set_name: (name: string) => {
    set({ name: name });
  },
  send_message: (message: Message) => {
    get().game_socket?.send(serializeMessage(message));
  },
  player_names: [],
  add_player_name: (name) => {
    set((state) => ({ player_names: [...state.player_names, name] }));
  },
  remove_player_name: (name) => {
    set((state) => ({
      player_names: state.player_names.filter((n) => n !== name),
    }));
  },
  set_player_names: (names) => {
    set({ player_names: names });
  },
  player_game_infos: [],
  set_player_game_infos: (infos) => {
    set({ player_game_infos: infos });
  },
  lobby_state: LobbyStates.LOBBY,
  set_lobby_state: (game_started) => {
    set({ lobby_state: game_started });
  },
  // set_choice_list: (choice_list) => {
  //   set(() => ({ choice_list: choice_list }));
  // },
  kingdomCards: Array(10).fill(none()),
  set_kingdom_card: (index, card) => {
    set((state) => ({
      kingdomCards: state.kingdomCards.map((c, i) =>
        i === index ? some(card) : c,
      ),
    }));
  },
  clear_kingdom_card: (index) => {
    set((state) => ({
      kingdomCards: state.kingdomCards.map((c, i) =>
        i === index ? none<CardInfo>() : c,
      ),
    }));
  },

  set_game_state: (game_state) => {
    set(() => ({ game_state: game_state }));
  },
  set_message: (message) => {
    set(() => ({ message: message }));
  },
  set_player: (player) => {
    set(() => ({ player: player }));
  },
  log_messages: [],
  add_log_messages: (...messages: LogEntry[]) => {
    set((state) => ({
      log_messages: state.log_messages.map((turn, i) => {
        if (i !== 0) {
          return turn;
        } else {
          return { ...turn, events: [...turn.events, ...messages] };
        }
      }),
    }));
  },
  add_turn: (turn: Turn) =>
    set((state) => ({ log_messages: [turn, ...state.log_messages] })),
  set_log: (log) => set({ log_messages: log.toReversed() }),
  clear_log: () => {
    set({ log_messages: [] });
  },
  ping: new Audio("sounds/ping.mp3"),

  selected_stacks: [],
  toggle_stack: (stack: supplyStack) => {
    set((state) => ({
      selected_stacks: state.selected_stacks.includes(stack)
        ? state.selected_stacks.filter((s) => s !== stack)
        : [...state.selected_stacks, stack],
    }));
  },
  reset_stacks: () => {
    set({ selected_stacks: [] });
  },

  selected_cards: [],
  toggle_card: (card: Card) => {
    set((state) => ({
      selected_cards: state.selected_cards.includes(card)
        ? state.selected_cards.filter((c) => c !== card)
        : [...state.selected_cards, card],
    }));
  },
  reset_cards: () => {
    set({ selected_cards: [] });
  },
}));

export function Lobby() {
  // const [connected, setConnected] = useState(false)
  // const gameSocket = useGameSocket(setConnected);
  useGameSocket();
  //
  const _set_router_state = useGlobalStore((state) => state.set_router_state);
  //
  // const [player_names, setPlayerNames] = useState<string[]>([])
  // const [gameStarted, setGameStarted] = useState<typeof LobbyState[keyof typeof LobbyState]>(LobbyState.LOBBY)
  // const [choice_list, setChoiceList] = useState<JSX.Element>(null)
  //
  // const [gameState, setGameState] = useState<GameState>(null)
  // const [message, setMessage] = useState<Message>(null);
  // const [player, setPlayer] = useState<Player>(null)
  const [connected, lobby_state] = useLobbyStore(
    useShallow((state) => [state.connected, state.lobby_state]),
  );

  if (!connected) {
    return <Connecting />;
  }

  switch (lobby_state) {
    case LobbyStates.LOBBY:
      return <LobbyView />;
    case LobbyStates.GAME_STARTED:
      return (
        // <GameContext value={gameSocket}>
        /* </GameContext> */
        <Game />
      );
    case LobbyStates.GAME_END:
      return <GameEnd />;
  }
}

export function resolve_message(ev: MessageEvent) {
  console.log(`Message: ${ev.data}`);
  const message = parseMessage(ev.data);
  if (!message) {
    return;
  }

  const {
    lobby_state,
    set_lobby_state,
    add_player_name,
    remove_player_name,
    set_player_names,
    set_player_game_infos,
    set_game_state,
    set_message,
    set_player,
    add_log_messages,
    clear_log,
    add_turn,
    ping,
    set_log,
    player,
  } = useLobbyStore.getState();

  switch (message.kind) {
    case MessageKinds.PLAYER_NAMES: {
      const player_msg = message as PlayerNamesMessage;
      set_player_names(player_msg.player_names);
      console.log(JSON.stringify(player_msg.player_names));
      break;
    }
    case MessageKinds.CONNECT: {
      // TODO: If the player is in game, it should say that a player is disconnected, vs connected, but not remove their name from the list
      if (lobby_state === LobbyStates.GAME_STARTED) {
        break;
      }
      const conn_msg = message as ConnectMessage;
      add_player_name(conn_msg.player_name);
      break;
    }
    case MessageKinds.DISCONNECT: {
      if (lobby_state === LobbyStates.GAME_STARTED) {
        break;
      }
      const disconn_msg = message as DisconnectMessage;
      remove_player_name(disconn_msg.player_name);
      break;
    }
    case MessageKinds.STARTED: {
      const started_msg = message as StartedMessage;
      set_player_game_infos(started_msg.players);
      set_game_state(started_msg.state);
      set_player(started_msg.player);

      set_lobby_state(LobbyStates.GAME_STARTED);
      break;
    }
    case MessageKinds.PICK_CARDS_REQUEST:
      // NOTE: Handled elsewhere
      // lobby_store.set_choice_list(
      //   <ChooseCardsList message={message as PickCardsRequest} />,
      // );
      set_message(message);
      break;
    case MessageKinds.PICK_SUPPLY_PILE_REQUEST:
      // lobby_store.set_choice_list(
      //   <ChooseSupplyPilesList message={message as PickSupplyPileRequest} game_socket={gameSocket.current} lobby_store.set_choice_list={setChoiceList} />
      // )
      set_message(message);
      break;
    case MessageKinds.PICK_YES_NO_REQUEST:
      // lobby_store.set_choice_list(
      //   <ChooseYesNo message={message as PickYesNoRequest} />,
      // );
      set_message(message);
      break;
    case MessageKinds.GAME_STATE_UPDATE: {
      const update_message: GameStateUpdateMessage =
        message as GameStateUpdateMessage;
      set_game_state(update_message.game_state);
      set_player(update_message.player);
      set_player_game_infos(update_message.players);

      break;
    }
    case MessageKinds.GAME_END:
      set_message(message);
      set_lobby_state(LobbyStates.GAME_END);
      clear_log();
      break;
    case MessageKinds.LOG_EVENT: {
      const log_message = message as LogEventMessage;
      add_log_messages(...log_message.log_messages);
      break;
    }
    case MessageKinds.NEW_TURN: {
      const new_turn_msg = message as NewLogTurnMessage;
      add_turn(new_turn_msg.turn);
      if (new_turn_msg.turn.active_player_name === player!.name) ping.play();
      break;
    }
    case MessageKinds.SYNC_LOG: {
      const sync_log_msg = message as SyncLogMessage;
      set_log(sync_log_msg.log);
      break;
    }
    default:
      console.log(`Message kind ${message.kind} not recognized or implemented`);
      break;
  }
}

export function gameSocketUrl(id: string, name?: string): string {
  return name ? `/game/${id}?name=${encodeURIComponent(name)}` : `/game/${id}`;
}

// Close codes the server uses to reject a join (as opposed to a dropped
// connection, which should be retried).
const REJECTED_CLOSE_CODES = new Set([4000, 4001, 4002]);

function useGameSocket() {
  const set_connected = useLobbyStore((state) => state.set_connected);
  const set_router_state = useGlobalStore((state) => state.set_router_state);
  const set_lobby_state = useLobbyStore((state) => state.set_lobby_state);
  const set_game_socket = useLobbyStore((state) => state.set_game_socket);
  useEffect(() => {
    function attach(socket: WebSocket, attempt: number) {
      socket.onopen = () => {
        console.log("Joined Game!");
        set_lobby_state(LobbyStates.LOBBY);
        set_connected(true);
      };
      socket.onmessage = resolve_message;

      socket.onclose = (ev) => {
        set_connected(false);
        console.log(ev.code);
        if (ev.code === 1000 || REJECTED_CLOSE_CODES.has(ev.code)) {
          set_router_state(RouterStates.HOME);
          console.log(`Closed Socket on attempt ${attempt}`);
          return;
        }

        setTimeout(
          () => connect(attempt + 1),
          Math.min(1000 * 2 ** attempt, 30000),
        );
      };
    }

    function connect(attempt: number) {
      const { name, lobby_id } = useLobbyStore.getState();
      const socket = new WebSocket(gameSocketUrl(lobby_id, name));
      attach(socket, attempt);
      set_game_socket(socket);
    }

    // If Home already opened and confirmed a connection, reuse it instead of
    // opening a second one for the same clientid.
    const existing = useLobbyStore.getState().game_socket;
    if (existing && existing.readyState === WebSocket.OPEN) {
      attach(existing, 0);
      set_connected(true);
    } else {
      connect(0);
    }

    return () => {
      console.log("Cleanup");
      useLobbyStore.getState().game_socket?.close(1000);
    };
  }, [set_connected, set_router_state, set_lobby_state, set_game_socket]);
}

function LobbyView() {
  const connected = useLobbyStore((state) => state.connected);
  const player_names = useLobbyStore((state) => state.player_names);
  const kingdomCards = useLobbyStore((state) => state.kingdomCards);
  const set_router_state = useGlobalStore((state) => state.set_router_state);
  return (
    <>
      <div className="inline-flex justify-between p-2">
        <span className="text-black text-lg">
          <b>Welcome to the game</b>
        </span>
        <div>
          <Button
            onClick={() => {
              console.log("Attempting to start game");
              const message: StartMessage = {
                kind: MessageKinds.START,
                chosen_cards: kingdomCards
                  .filter((c) => c.is_some())
                  .map((c) => c.unwrap()),
              };
              useLobbyStore.getState().send_message(message);
            }}
            disabled={!connected}
          >
            Start Game
          </Button>

          <Button
            onClick={() => {
              useLobbyStore.getState().game_socket?.close(1000);
              // WARN: Set in two places, probably fine but check again later
              set_router_state(RouterStates.HOME);
            }}
          >
            Leave Game
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex flex-row h-full">
        <div className="w-3/4 p-2">
          <KingdomCardPicker />
        </div>
        <Separator orientation="vertical" />
        <div className="w-1/4 p-2">
          <PlayerList />
          <Button
            onClick={() => {
              const ai_player_msg: AddAIPlayerMessage = {
                kind: MessageKinds.ADD_AI_PLAYER,
              };
              useLobbyStore.getState().send_message(ai_player_msg);
            }}
            disabled={
              !connected || player_names.some((name) => name === "Gemini")
            }
          >
            Add AI Player
          </Button>
        </div>
      </div>
    </>
  );
}

function Connecting() {
  // const router_state = useRouterStore((state) => state.router_state);

  return (
    <div className="flex flex-col justify-center items-center">
      <p className="text-foreground text-xs">Connecting to Lobby ...</p>
      {/* <Button onClick={() => set_router_state(RouterStates.HOME)}> */}
      {/*   Cancel */}
      {/* </Button> */}
    </div>
  );
}

function PlayerList() {
  const players = useLobbyStore((state) => state.player_names);
  return (
    <div className="flex flex-col flex-nowrap gap-1 text-left">
      <p className="text-md text-black">
        <b>Players</b>
      </p>
      {players.map((name) => (
        <PlayerDisplay key={name} name={name} />
      ))}
    </div>
  );
}

export function PlayerDisplay({
  name,
  under,
  right,
  highlight = "none",
}: {
  name: string;
  under?: string;
  right?: string;
  highlight?: "current" | "attacked" | "none";
}) {
  return (
    <div
      className="border border-foreground text-black text-sm mx-auto rounded-lg text-ellipsis text-nowrap overflow-auto
      p-1 w-[15vw]
      "
    >
      <div className="flex flex-row flex-nowrap justify-start p-px items-center h-full">
        <div
          className={cn(
            "w-1 mr-1 h-6",
            highlight === "current" ? "bg-primary rounded-md" : "",
            highlight === "attacked" ? "bg-red-800 rounded-md" : "",
          )}
        />

        <div className="mr-4 rounded-full bg-gray-400 border-black text-md min-w-8 min-h-8 max-h-8 max-w-8 flex items-center justify-center text-center">
          <b>{name[0]}</b>
        </div>
        <div className="flex flex-col justify-start items-start">
          <div>
            <b>{name}</b>
          </div>
          <div className="text-xs text-gray-600">{under}</div>
        </div>
        <div className="flex-1 text-right flex flex-row justify-end items-center">
          <div className="text-black text-lg">
            <b>{right}</b>
          </div>
          <div className="text-gray-600 text-sm">{right ? "VP" : ""}</div>
        </div>
      </div>
    </div>
  );
}

const CLICKABLE_CARD_CLASS = "cursor-pointer hover:border-primary";

function KingdomCardPicker() {
  const [kingdomCards, set_kingdom_card, clear_kingdom_card] = useLobbyStore(
    useShallow((state) => [
      state.kingdomCards,
      state.set_kingdom_card,
      state.clear_kingdom_card,
    ]),
  );
  const [open_slot, set_open_slot] = useState<number | null>(null);

  const used_elsewhere = new Set<CardName>(
    kingdomCards
      .filter((_, i) => i !== open_slot)
      .map((c) =>
        c.match({
          Some: (c) => c.name,
          None: () => undefined,
        }),
      )
      .filter((name): name is CardName => name !== undefined),
  );

  return (
    <>
      <div className="flex flex-row flex-wrap justify-center gap-2">
        {kingdomCards.map((card, index) => (
          <KingdomCardSlot
            key={card.map((c) => c.name.toString()).unwrap_or(`?${index}`)}
            card={card}
            onOpen={() => set_open_slot(index)}
            onClear={() => clear_kingdom_card(index)}
          />
        ))}
      </div>
      <Dialog
        open={open_slot !== null}
        onOpenChange={(open) => {
          if (!open) {
            set_open_slot(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose a Kingdom Card</DialogTitle>
          </DialogHeader>
          <div className="flex flex-row flex-wrap justify-center gap-2 max-h-[70vh] overflow-y-auto p-2">
            {BaseCards.map((c) => {
              const disabled = used_elsewhere.has(c.name);
              return (
                <CardShell
                  key={c.name}
                  card_info={c}
                  className={
                    disabled
                      ? "opacity-40 pointer-events-none"
                      : CLICKABLE_CARD_CLASS
                  }
                  onClick={() => {
                    if (open_slot === null) {
                      return;
                    }
                    set_kingdom_card(open_slot, c);
                    set_open_slot(null);
                  }}
                >
                  <div className="flex flex-row justify-start">
                    <GoldCoin cost={c.cost} />
                  </div>
                </CardShell>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KingdomCardSlot({
  card,
  onOpen,
  onClear,
}: {
  card: Option<CardInfo>;
  onOpen: () => void;
  onClear: () => void;
}) {
  if (card.is_none()) {
    return (
      <CardShape
        height={20}
        className={cn(
          CLICKABLE_CARD_CLASS,
          "flex flex-row justify-center items-center text-lg",
        )}
        onClick={onOpen}
      >
        <b>?</b>
      </CardShape>
    );
  }

  const info = card.unwrap();
  return (
    <div className="relative group">
      <CardShell
        card_info={info}
        className={CLICKABLE_CARD_CLASS}
        onClick={onOpen}
      >
        <div className="flex flex-row justify-start">
          <GoldCoin cost={info.cost} />
        </div>
      </CardShell>
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          onClear();
        }}
        aria-label={`Clear ${info.name}`}
        className="hidden group-hover:flex absolute -top-1.5 -right-1.5 w-5 h-5 items-center justify-center rounded-full bg-gray-700 text-white text-xs leading-none hover:bg-gray-900 cursor-pointer"
      >
        ×
      </button>
    </div>
  );
}

import type { Player } from "shared";
import type { Card, CardInfo } from "shared/cards";
import { CardTypes } from "shared/cards";
import {
  type Message,
  MessageKinds,
  type PickCardsResponse,
  type PickSupplyPileResponse,
  type PickYesNoResponse,
  parseMessage,
} from "shared/messages";
import { getVictoryCount, type supplyStack } from "shared/supply";
import type { PlayerInfo } from "./game";
import { Game } from "./game";
import { Lobby } from "./lobby";
import type { MessageSink } from "./socket";

export class FakeSink implements MessageSink {
  messages: Message[] = [];

  send(message: string) {
    const result = parseMessage(message);
    if (result.success) {
      this.messages.push(result.data);
    }
  }
}

/** Returns the most recently sent message of a given kind, or undefined if none was sent. */
export function lastMessageOfKind<T extends Message>(
  sink: FakeSink,
  kind: string,
): T | undefined {
  for (let i = sink.messages.length - 1; i >= 0; i--) {
    if (sink.messages[i]!.kind === kind) {
      return sink.messages[i] as T;
    }
  }
  return undefined;
}

export type TestPlayerSetup = {
  name?: string;
  hand?: CardInfo[];
  deck?: CardInfo[];
  discard?: CardInfo[];
};

export type TestGameSetup = {
  players: TestPlayerSetup[];
  /** Overrides the randomly chosen kingdom supply piles with exactly these cards. */
  kingdomCards?: CardInfo[];
  /** Index into `players` (setup order, not internal shuffled order) that should be the active player. Defaults to 0. */
  currentPlayer?: number;
};

export type TestGame = {
  game: Game;
  /** Fake sockets, aligned to `setup.players` order. */
  sinks: FakeSink[];
  /** Client ids, aligned to `setup.players` order. */
  clientids: string[];
};

/**
 * Builds a Game with deterministic hands/decks/discards and (optionally) a fixed
 * kingdom supply, bypassing the random shuffle Game normally deals on construction.
 * Game shuffles player order internally, so lookups must go through clientid, not
 * array index - use `getPlayerInfo`/`getPlayer` rather than `game.player_infos[i]`.
 */
export function createTestGame(setup: TestGameSetup): TestGame {
  const clientids = setup.players.map((_, i) => `test-client-${i}`);
  const sinks = setup.players.map(() => new FakeSink());

  const lobby = new Lobby();
  const game = new Game(
    setup.players.map((p, i) => ({
      clientid: clientids[i]!,
      name: p.name ?? `Player ${i}`,
      socket: sinks[i]!,
    })),
    lobby,
    [],
  );

  if (setup.kingdomCards) {
    const victoryCount = getVictoryCount(setup.players.length);
    game.game_state.supply.stacks = setup.kingdomCards.map((card) => ({
      card,
      count: card.types.includes(CardTypes.VICTORY) ? victoryCount : 10,
    }));
  }

  setup.players.forEach((p, i) => {
    const player = getPlayer(game, clientids[i]!);
    if (p.hand) player.hand = p.hand.map((info) => game.new_card(info));
    if (p.deck) player.deck = p.deck.map((info) => game.new_card(info));
    if (p.discard) {
      player.discard_pile = p.discard.map((info) => game.new_card(info));
    }
  });

  const currentClientId = clientids[setup.currentPlayer ?? 0]!;
  game.game_state.current_player_index = game.player_infos.findIndex(
    (pi) => pi.clientid === currentClientId,
  );

  return { game, sinks, clientids };
}

export function getPlayerInfo(game: Game, clientid: string): PlayerInfo {
  return game.player_infos.find((pi) => pi.clientid === clientid)!;
}

export function getPlayer(game: Game, clientid: string): Player {
  return getPlayerInfo(game, clientid).player;
}

/**
 * The clientid of the player currently blocking the wait queue, if any.
 * Game shuffles player order internally, so which opponent an attack
 * reaches first is non-deterministic - use this instead of assuming a
 * fixed order when resolving prompts across multiple opponents.
 */
export function getPendingClientId(game: Game): string | undefined {
  return game.wait_queue.peek_front_waiting().match({
    Some: (f) => f.player_info.clientid,
    None: () => undefined,
  });
}

export function resolvePrompt(game: Game, clientid: string, choices: Card[]) {
  const response: PickCardsResponse = {
    kind: MessageKinds.PICK_CARDS_RESPONSE,
    choices,
  };
  game.resolve_player_choice(clientid, response);
}

export function resolveGainPrompt(
  game: Game,
  clientid: string,
  choices: supplyStack[],
) {
  const response: PickSupplyPileResponse = {
    kind: MessageKinds.PICK_SUPPLY_PILE_RESPONSE,
    choices,
  };
  game.resolve_player_choice(clientid, response);
}

export function resolveBinaryPrompt(
  game: Game,
  clientid: string,
  choice: boolean,
) {
  const response: PickYesNoResponse = {
    kind: MessageKinds.PICK_YES_NO_RESPONSE,
    choice,
  };
  game.resolve_player_choice(clientid, response);
}

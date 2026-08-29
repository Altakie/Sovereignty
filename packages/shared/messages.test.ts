import { describe, expect, test } from "bun:test";
import { MessageKinds, MessageSchema, parseMessage } from "./messages";

const cardInfo = { name: "Copper", types: ["Treasure"], cost: 0 };
const card = { id: "card-1", info: cardInfo };
const supplyStack = { card: cardInfo, count: 10 };
const supply = { fixed_stacks: [supplyStack], stacks: [supplyStack] };
const sharablePlayer = {
  name: "Alice",
  hand: [card],
  deck_size: 5,
  discard_pile_size: 0,
  victory_points: 3,
};
const playerDisplayInfo = { name: "Alice", total_cards: 10, victory_points: 3 };
const gameState = {
  phase: "Action",
  current_player_index: 0,
  turn_number: 1,
  attack_index: null,
  played_cards: [],
  set_aside_cards: [],
  supply,
  trash_pile: [],
  actions: 1,
  money: 0,
  buys: 1,
};
const logEntry = { player_name: "Alice", kind: "Played", cards: [cardInfo] };
const turn = {
  active_player_name: "Alice",
  turn_number: 1,
  events: [logEntry],
};

type Case = {
  name: string;
  valid: Record<string, unknown>;
  invalidMutations: ((v: Record<string, unknown>) => unknown)[];
};

const cases: Case[] = [
  {
    name: MessageKinds.CONNECT,
    valid: { kind: MessageKinds.CONNECT, player_name: "Alice" },
    invalidMutations: [(v) => ({ ...v, player_name: 123 })],
  },
  {
    name: MessageKinds.KICK_PLAYER,
    valid: { kind: MessageKinds.KICK_PLAYER, player_name: "Alice" },
    invalidMutations: [(v) => ({ ...v, player_name: undefined })],
  },
  {
    name: MessageKinds.ADD_AI_PLAYER,
    valid: { kind: MessageKinds.ADD_AI_PLAYER },
    invalidMutations: [() => ({ kind: MessageKinds.KICK_PLAYER })],
  },
  {
    name: MessageKinds.DISCONNECT,
    valid: { kind: MessageKinds.DISCONNECT, player_name: "Alice" },
    invalidMutations: [(v) => ({ ...v, player_name: null })],
  },
  {
    name: MessageKinds.PLAYER_NAMES,
    valid: { kind: MessageKinds.PLAYER_NAMES, player_names: ["Alice", "Bob"] },
    invalidMutations: [(v) => ({ ...v, player_names: "Alice" })],
  },
  {
    name: MessageKinds.START,
    valid: { kind: MessageKinds.START, chosen_cards: [cardInfo] },
    invalidMutations: [(v) => ({ ...v, chosen_cards: [{ name: "Copper" }] })],
  },
  {
    name: MessageKinds.STARTED,
    valid: {
      kind: MessageKinds.STARTED,
      players: [playerDisplayInfo],
      state: gameState,
      player: sharablePlayer,
    },
    invalidMutations: [
      (v) => ({ ...v, state: { ...gameState, supply: undefined } }),
    ],
  },
  {
    name: MessageKinds.PICK_CARDS_REQUEST,
    valid: {
      kind: MessageKinds.PICK_CARDS_REQUEST,
      description: "Choose card(s) to discard",
      choices: [card],
      min: 0,
      max: 1,
    },
    invalidMutations: [
      (v) => ({ ...v, description: "Not a real description" }),
    ],
  },
  {
    name: MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    valid: {
      kind: MessageKinds.PICK_SUPPLY_PILE_REQUEST,
      description: "Choose a card to gain from the supply",
      choices: [supplyStack],
      min: 0,
      max: 1,
    },
    invalidMutations: [(v) => ({ ...v, choices: [{ card: cardInfo }] })],
  },
  {
    name: MessageKinds.PICK_YES_NO_REQUEST,
    valid: {
      kind: MessageKinds.PICK_YES_NO_REQUEST,
      description: "Play this card?",
      card,
    },
    invalidMutations: [
      (v) => ({ ...v, description: "Not a real description" }),
    ],
  },
  {
    name: MessageKinds.PICK_CARDS_RESPONSE,
    valid: { kind: MessageKinds.PICK_CARDS_RESPONSE, choices: [card] },
    invalidMutations: [(v) => ({ ...v, choices: [{ id: "card-1" }] })],
  },
  {
    name: MessageKinds.PICK_SUPPLY_PILE_RESPONSE,
    valid: {
      kind: MessageKinds.PICK_SUPPLY_PILE_RESPONSE,
      choices: [supplyStack],
    },
    invalidMutations: [(v) => ({ ...v, choices: [{ count: "ten" }] })],
  },
  {
    name: MessageKinds.PICK_YES_NO_RESPONSE,
    valid: { kind: MessageKinds.PICK_YES_NO_RESPONSE, choice: true },
    invalidMutations: [(v) => ({ ...v, choice: "yes" })],
  },
  {
    name: MessageKinds.GAME_STATE_UPDATE,
    valid: {
      kind: MessageKinds.GAME_STATE_UPDATE,
      game_state: gameState,
      player: sharablePlayer,
      players: [playerDisplayInfo],
    },
    invalidMutations: [
      (v) => ({ ...v, game_state: { ...gameState, phase: "Cleanup" } }),
    ],
  },
  {
    name: MessageKinds.GAME_END,
    valid: {
      kind: MessageKinds.GAME_END,
      winner_indices: [0],
      players_end_infos_in_victory_order: [
        { name: "Alice", victory_points: 5, final_deck: [card] },
      ],
    },
    invalidMutations: [(v) => ({ ...v, winner_indices: ["0"] })],
  },
  {
    name: MessageKinds.LOG_EVENT,
    valid: { kind: MessageKinds.LOG_EVENT, log_messages: [logEntry] },
    invalidMutations: [
      (v) => ({
        ...v,
        log_messages: [{ player_name: "Alice", kind: "NotARealKind" }],
      }),
    ],
  },
  {
    name: MessageKinds.NEW_TURN,
    valid: { kind: MessageKinds.NEW_TURN, turn },
    invalidMutations: [(v) => ({ ...v, turn: { ...turn, events: "none" } })],
  },
  {
    name: MessageKinds.SYNC_LOG,
    valid: { kind: MessageKinds.SYNC_LOG, log: [turn] },
    invalidMutations: [(v) => ({ ...v, log: turn })],
  },
];

describe("MessageSchema", () => {
  for (const { name, valid, invalidMutations } of cases) {
    test(`accepts a valid "${name}" message`, () => {
      const result = MessageSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    invalidMutations.forEach((mutate, i) => {
      test(`rejects an invalid "${name}" message (case ${i})`, () => {
        const result = MessageSchema.safeParse(mutate(valid));
        expect(result.success).toBe(false);
      });
    });
  }

  test("rejects a message with an unrecognized kind", () => {
    const result = MessageSchema.safeParse({ kind: "Not A Real Kind" });
    expect(result.success).toBe(false);
  });

  test("rejects a non-object payload", () => {
    const result = MessageSchema.safeParse("just a string");
    expect(result.success).toBe(false);
  });
});

describe("parseMessage", () => {
  test("parses valid JSON into a valid message", () => {
    const result = parseMessage(
      JSON.stringify({ kind: MessageKinds.ADD_AI_PLAYER }),
    );
    expect(result.success).toBe(true);
  });

  test("rejects malformed JSON", () => {
    const result = parseMessage("{not valid json");
    expect(result.success).toBe(false);
  });

  test("rejects well-formed JSON that doesn't match any message schema", () => {
    const result = parseMessage(JSON.stringify({ not_a: "message" }));
    expect(result.success).toBe(false);
  });
});

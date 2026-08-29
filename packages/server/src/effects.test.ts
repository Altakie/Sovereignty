import { describe, expect, test } from "bun:test";
import { BaseKingdomCards } from "shared/cards/base";
import { Curse } from "shared/cards/curses";
import { Copper, Gold, Silver } from "shared/cards/treasures";
import { Duchy, Estate, Province } from "shared/cards/victories";
import {
  MessageKinds,
  type PickCardsRequest,
  type PickSupplyPileRequest,
  type PickYesNoRequest,
} from "shared/messages";
import { effect_table } from "./effects";
import {
  createTestGame,
  getPendingClientId,
  getPlayer,
  lastMessageOfKind,
  resolveBinaryPrompt,
  resolveGainPrompt,
  resolvePrompt,
} from "./test-utils";

describe("Village", () => {
  test("draws 1 card and grants +2 actions", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;

    effect_table.Village(game);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);
    expect(player.deck.length).toBe(0);
    expect(game.game_state.actions).toBe(starting_actions + 2);
  });

  test("still grants +2 actions when the deck and discard pile are both empty", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [], discard: [] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;

    expect(() => effect_table.Village(game)).not.toThrow();

    expect(player.hand).toEqual([]);
    expect(game.game_state.actions).toBe(starting_actions + 2);
  });
});

describe("Chapel", () => {
  test("prompts to trash up to 4 cards and trashes the chosen ones", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper, Copper, Copper, Estate] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const hand = [...player.hand];

    effect_table.Chapel(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toMatchObject({
      min: 0,
      max: 4,
      choices: hand,
    });

    const [copper1, copper2] = hand;
    resolvePrompt(game, clientids[0]!, [copper1!, copper2!]);

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Estate",
    ]);
    expect(game.game_state.trash_pile.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Copper",
    ]);
  });

  test("caps the trashable max at hand size when the hand has fewer than 4 cards", () => {
    const { game, sinks } = createTestGame({
      players: [{ hand: [Copper, Copper] }],
    });

    effect_table.Chapel(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.max).toBe(2);
  });

  test("trashing nothing leaves the hand and trash pile unchanged", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper, Estate] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Chapel(game);
    resolvePrompt(game, clientids[0]!, []);

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Estate",
    ]);
    expect(game.game_state.trash_pile).toEqual([]);
  });
});

describe("Witch", () => {
  test("draws 2 cards for the active player", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [Copper, Copper] },
        { hand: [], deck: [] },
      ],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Witch(game);

    expect(player.hand.length).toBe(2);
  });

  test("curses the opponent when they have no reaction", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Witch(game);

    expect(opponent.discard_pile.map((c) => c.info.name)).toEqual(["Curse"]);
    expect(game.game_state.attack_index).toBeNull();
  });

  test("Moat blocks the curse when revealed", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [BaseKingdomCards.Moat], deck: [] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);
    const moat_card = opponent.hand[0]!;

    effect_table.Witch(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toMatchObject({
      min: 0,
      max: 1,
      choices: [moat_card],
    });

    resolvePrompt(game, clientids[1]!, [moat_card]);

    expect(opponent.discard_pile).toEqual([]);
  });

  test("holding Moat but not revealing it still gets cursed", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [BaseKingdomCards.Moat], deck: [] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Witch(game);
    resolvePrompt(game, clientids[1]!, []);

    expect(opponent.discard_pile.map((c) => c.info.name)).toEqual(["Curse"]);
  });

  test("curses every opponent in turn order with 3 players", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [] },
        { hand: [], deck: [] },
      ],
    });

    effect_table.Witch(game);

    expect(
      getPlayer(game, clientids[1]!).discard_pile.map((c) => c.info.name),
    ).toEqual(["Curse"]);
    expect(
      getPlayer(game, clientids[2]!).discard_pile.map((c) => c.info.name),
    ).toEqual(["Curse"]);
    expect(game.game_state.attack_index).toBeNull();
  });

  test("grants no curse and does not throw when the Curse pile is empty", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [] },
      ],
    });
    const curse_stack = game.game_state.supply.fixed_stacks.find(
      (s) => s.card.name === "Curse",
    )!;
    curse_stack.count = 0;
    const opponent = getPlayer(game, clientids[1]!);

    expect(() => effect_table.Witch(game)).not.toThrow();

    expect(opponent.discard_pile).toEqual([]);
  });
});

describe("Copper", () => {
  test("gives +1 money", () => {
    const { game } = createTestGame({ players: [{}] });

    effect_table.Copper(game);

    expect(game.game_state.money).toBe(1);
  });
});

describe("Silver", () => {
  test("gives +2 money when it is the only card played this turn", () => {
    const { game } = createTestGame({ players: [{}] });
    const silver = game.new_card(Silver);
    game.game_state.played_cards = [silver];

    effect_table.Silver(game);

    expect(game.game_state.money).toBe(2);
  });

  test("gives +1 additional money per Merchant already in play", () => {
    const { game } = createTestGame({ players: [{}] });
    const merchant1 = game.new_card(BaseKingdomCards.Merchant);
    const merchant2 = game.new_card(BaseKingdomCards.Merchant);
    const silver = game.new_card(Silver);
    game.game_state.played_cards = [merchant1, merchant2, silver];

    effect_table.Silver(game);

    expect(game.game_state.money).toBe(4);
  });

  test("skips the Merchant bonus when a Silver was already played earlier this turn", () => {
    const { game } = createTestGame({ players: [{}] });
    const earlier_silver = game.new_card(Silver);
    const merchant = game.new_card(BaseKingdomCards.Merchant);
    const this_silver = game.new_card(Silver);
    game.game_state.played_cards = [earlier_silver, merchant, this_silver];

    effect_table.Silver(game);

    expect(game.game_state.money).toBe(2);
  });
});

describe("Gold", () => {
  test("gives +3 money", () => {
    const { game } = createTestGame({ players: [{}] });

    effect_table.Gold(game);

    expect(game.game_state.money).toBe(3);
  });
});

describe("Victory and Curse cards", () => {
  test("Estate, Duchy, Province, Gardens, and Curse have no play effect", () => {
    const { game } = createTestGame({ players: [{}] });
    const starting_actions = game.game_state.actions;
    const starting_money = game.game_state.money;
    const starting_buys = game.game_state.buys;

    for (const card of [
      Estate,
      Duchy,
      Province,
      BaseKingdomCards.Gardens,
      Curse,
    ]) {
      expect(() => effect_table[card.name](game)).not.toThrow();
    }

    expect(game.game_state.actions).toBe(starting_actions);
    expect(game.game_state.money).toBe(starting_money);
    expect(game.game_state.buys).toBe(starting_buys);
  });
});

describe("Moat", () => {
  test("draws 2 cards", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [Copper, Copper, Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Moat(game);

    expect(player.hand.length).toBe(2);
  });

  test("draws only what is available when the deck and discard together have fewer than 2 cards", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [Copper], discard: [] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Moat(game);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);
  });
});

describe("Merchant", () => {
  test("draws 1 card and grants +1 action", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;

    effect_table.Merchant(game);

    expect(player.hand.length).toBe(1);
    expect(game.game_state.actions).toBe(starting_actions + 1);
  });

  test("still grants +1 action when there is nothing left to draw", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [], discard: [] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;

    effect_table.Merchant(game);

    expect(player.hand).toEqual([]);
    expect(game.game_state.actions).toBe(starting_actions + 1);
  });
});

describe("Smithy", () => {
  test("draws 3 cards", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [Copper, Copper, Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Smithy(game);

    expect(player.hand.length).toBe(3);
  });

  test("draws fewer than 3 when the deck and discard together run out mid-draw", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [Copper], discard: [Estate] }],
    });
    const player = getPlayer(game, clientids[0]!);

    expect(() => effect_table.Smithy(game)).not.toThrow();

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Estate",
    ]);
    expect(player.deck).toEqual([]);
    expect(player.discard_pile).toEqual([]);
  });
});

describe("Council Room", () => {
  test("draws 4 for the active player, +1 buy, and 1 card for every other player", () => {
    const { game, clientids } = createTestGame({
      players: [
        { deck: [Copper, Copper, Copper, Copper] },
        { deck: [Copper] },
        { deck: [Copper] },
      ],
    });
    const starting_buys = game.game_state.buys;

    effect_table["Council Room"](game);

    expect(getPlayer(game, clientids[0]!).hand.length).toBe(4);
    expect(getPlayer(game, clientids[1]!).hand.length).toBe(1);
    expect(getPlayer(game, clientids[2]!).hand.length).toBe(1);
    expect(game.game_state.buys).toBe(starting_buys + 1);
  });

  test("draws as much as is available when a player's deck and discard run out", () => {
    const { game, clientids } = createTestGame({
      players: [
        { deck: [Copper, Copper], discard: [] },
        { deck: [], discard: [] },
      ],
    });

    expect(() => effect_table["Council Room"](game)).not.toThrow();

    expect(getPlayer(game, clientids[0]!).hand.length).toBe(2);
    expect(getPlayer(game, clientids[1]!).hand.length).toBe(0);
  });
});

describe("Festival", () => {
  test("grants +2 actions, +1 buy, +2 money", () => {
    const { game } = createTestGame({ players: [{}] });
    const starting_actions = game.game_state.actions;
    const starting_buys = game.game_state.buys;

    effect_table.Festival(game);

    expect(game.game_state.actions).toBe(starting_actions + 2);
    expect(game.game_state.buys).toBe(starting_buys + 1);
    expect(game.game_state.money).toBe(2);
  });
});

describe("Laboratory", () => {
  test("draws 2 cards and grants +1 action", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [Copper, Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;

    effect_table.Laboratory(game);

    expect(player.hand.length).toBe(2);
    expect(game.game_state.actions).toBe(starting_actions + 1);
  });

  test("draws only what is available when the deck and discard together have fewer than 2 cards", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [Copper], discard: [] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;

    effect_table.Laboratory(game);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);
    expect(game.game_state.actions).toBe(starting_actions + 1);
  });
});

describe("Market", () => {
  test("draws 1 card, +1 action, +1 buy, +1 money", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;
    const starting_buys = game.game_state.buys;

    effect_table.Market(game);

    expect(player.hand.length).toBe(1);
    expect(game.game_state.actions).toBe(starting_actions + 1);
    expect(game.game_state.buys).toBe(starting_buys + 1);
    expect(game.game_state.money).toBe(1);
  });

  test("still grants +1 action, +1 buy, +1 money when there is nothing left to draw", () => {
    const { game, clientids } = createTestGame({
      players: [{ deck: [], discard: [] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;
    const starting_buys = game.game_state.buys;

    effect_table.Market(game);

    expect(player.hand).toEqual([]);
    expect(game.game_state.actions).toBe(starting_actions + 1);
    expect(game.game_state.buys).toBe(starting_buys + 1);
    expect(game.game_state.money).toBe(1);
  });
});

describe("Cellar", () => {
  test("grants +1 action, discards chosen cards, and draws that many replacements", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper, Copper, Estate], deck: [Silver, Gold] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;
    const hand = [...player.hand];

    effect_table.Cellar(game);

    expect(game.game_state.actions).toBe(starting_actions + 1);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toMatchObject({ min: 0, max: 3, choices: hand });

    const [copper1, copper2] = hand;
    resolvePrompt(game, clientids[0]!, [copper1!, copper2!]);

    expect(player.discard_pile.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Copper",
    ]);
    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Estate",
      "Gold",
      "Silver",
    ]);
  });

  test("reshuffles the pile it just discarded into when the deck is empty", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper, Copper, Estate], deck: [], discard: [] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Cellar(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    const coppers = request!.choices.filter((c) => c.info.name === "Copper");
    resolvePrompt(game, clientids[0]!, coppers);

    // The 2 discarded Coppers are the only cards available to reshuffle
    // into the deck, so drawing 2 replacements draws those same cards back.
    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Copper",
      "Estate",
    ]);
    expect(player.discard_pile).toEqual([]);
    expect(player.deck).toEqual([]);
  });
});

describe("Harbinger", () => {
  test("draws 1, grants +1 action, and can put a discarded card back on the deck", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [], deck: [Copper], discard: [Silver] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;
    const discard_snapshot = [...player.discard_pile];

    effect_table.Harbinger(game);

    expect(game.game_state.actions).toBe(starting_actions + 1);
    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toMatchObject({
      min: 0,
      max: 1,
      choices: discard_snapshot,
    });

    resolvePrompt(game, clientids[0]!, [discard_snapshot[0]!]);

    expect(player.discard_pile).toEqual([]);
    expect(player.deck.map((c) => c.info.name)).toEqual(["Silver"]);
  });

  test("does not prompt when the discard pile is empty", () => {
    const { game, sinks } = createTestGame({
      players: [{ hand: [], deck: [Copper], discard: [] }],
    });

    effect_table.Harbinger(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
  });

  test("leaves the discard pile untouched when the player declines to top-deck anything", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [Copper], discard: [Silver] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Harbinger(game);
    resolvePrompt(game, clientids[0]!, []);

    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Silver"]);
    expect(player.deck).toEqual([]);
  });
});

describe("Vassal", () => {
  test("gives +2 money and discards the top card of the deck", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Vassal(game);

    expect(game.game_state.money).toBe(2);
    expect(player.deck.length).toBe(0);
    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Copper"]);
  });

  test("does not prompt when the discarded card is not an Action", () => {
    const { game, sinks } = createTestGame({
      players: [{ hand: [], deck: [Copper] }],
    });

    effect_table.Vassal(game);

    const request = lastMessageOfKind(
      sinks[0]!,
      MessageKinds.PICK_YES_NO_REQUEST,
    );
    expect(request).toBeUndefined();
  });

  test("plays the discarded Action card when the player accepts", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [Copper, Copper, Copper, BaseKingdomCards.Smithy] },
      ],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Vassal(game);

    const request = lastMessageOfKind<PickYesNoRequest>(
      sinks[0]!,
      MessageKinds.PICK_YES_NO_REQUEST,
    );
    expect(request?.card.info.name).toBe("Smithy");

    resolveBinaryPrompt(game, clientids[0]!, true);

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Copper",
      "Copper",
    ]);
    expect(player.discard_pile).toEqual([]);
    expect(game.game_state.played_cards.map((c) => c.info.name)).toEqual([
      "Smithy",
    ]);
  });

  test("leaves the discarded Action card in the discard pile when the player declines", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [BaseKingdomCards.Smithy] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Vassal(game);
    resolveBinaryPrompt(game, clientids[0]!, false);

    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Smithy"]);
    expect(game.game_state.played_cards).toEqual([]);
  });

  test("reshuffles the discard pile into the deck before discarding when the deck is empty", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [], discard: [Silver] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Vassal(game);

    expect(game.game_state.money).toBe(2);
    expect(player.deck).toEqual([]);
    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Silver"]);
  });

  test("does nothing beyond +2 money when the deck and discard pile are both empty", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [], deck: [], discard: [] }],
    });
    const player = getPlayer(game, clientids[0]!);

    expect(() => effect_table.Vassal(game)).not.toThrow();

    expect(game.game_state.money).toBe(2);
    expect(player.discard_pile).toEqual([]);
    const request = lastMessageOfKind(
      sinks[0]!,
      MessageKinds.PICK_YES_NO_REQUEST,
    );
    expect(request).toBeUndefined();
  });
});

describe("Workshop", () => {
  test("gains a card costing up to 4 to the discard pile", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Workshop(game);

    const request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    expect(request?.min).toBe(1);
    expect(request?.max).toBe(1);
    expect(request?.choices.every((s) => s.card.cost <= 4)).toBe(true);

    const silver_stack = request!.choices.find(
      (s) => s.card.name === "Silver",
    )!;
    resolveGainPrompt(game, clientids[0]!, [silver_stack]);

    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Silver"]);
  });

  test("does nothing when no supply pile costs 4 or less", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [] }],
      kingdomCards: [BaseKingdomCards["Council Room"]],
    });
    for (const name of ["Copper", "Silver", "Estate", "Curse"]) {
      game.game_state.supply.fixed_stacks.find(
        (s) => s.card.name === name,
      )!.count = 0;
    }
    const player = getPlayer(game, clientids[0]!);

    expect(() => effect_table.Workshop(game)).not.toThrow();

    const request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    expect(request).toBeUndefined();
    expect(player.discard_pile).toEqual([]);
    expect(game.wait_queue.isEmpty()).toBe(true);
  });
});

describe("Moneylender", () => {
  test("trashes a Copper from hand for +3 money when accepted", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper, Estate] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const copper = player.hand.find((c) => c.info.name === "Copper")!;

    effect_table.Moneylender(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toMatchObject({ min: 0, max: 1, choices: [copper] });

    resolvePrompt(game, clientids[0]!, [copper]);

    expect(game.game_state.money).toBe(3);
    expect(player.hand.map((c) => c.info.name)).toEqual(["Estate"]);
    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Copper",
    ]);
  });

  test("does nothing when declined", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Moneylender(game);
    resolvePrompt(game, clientids[0]!, []);

    expect(game.game_state.money).toBe(0);
    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);
  });

  test("does not prompt when the hand has no Copper", () => {
    const { game, sinks } = createTestGame({
      players: [{ hand: [Estate] }],
    });

    effect_table.Moneylender(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
    expect(game.game_state.money).toBe(0);
  });
});

describe("Poacher", () => {
  test("draws 1, +1 money, +1 action, and does not prompt when no piles are empty", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [], deck: [Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;

    effect_table.Poacher(game);

    expect(player.hand.length).toBe(1);
    expect(game.game_state.money).toBe(1);
    expect(game.game_state.actions).toBe(starting_actions + 1);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
  });

  test("forces a discard for each empty supply pile", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Estate], deck: [Copper] }],
    });
    game.game_state.supply.fixed_stacks.find(
      (s) => s.card.name === "Duchy",
    )!.count = 0;
    const player = getPlayer(game, clientids[0]!);

    effect_table.Poacher(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.min).toBe(1);
    expect(request?.max).toBe(1);

    const to_discard = player.hand.find((c) => c.info.name === "Estate")!;
    resolvePrompt(game, clientids[0]!, [to_discard]);

    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Estate"]);
    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);
  });

  test("forces a discard for each of multiple empty supply piles", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Estate, Estate], deck: [Copper] }],
    });
    game.game_state.supply.fixed_stacks.find(
      (s) => s.card.name === "Duchy",
    )!.count = 0;
    game.game_state.supply.fixed_stacks.find(
      (s) => s.card.name === "Province",
    )!.count = 0;
    const player = getPlayer(game, clientids[0]!);

    effect_table.Poacher(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.min).toBe(2);
    expect(request?.max).toBe(2);

    const to_discard = player.hand.filter((c) => c.info.name === "Estate");
    resolvePrompt(game, clientids[0]!, to_discard);

    expect(player.discard_pile.map((c) => c.info.name)).toEqual([
      "Estate",
      "Estate",
    ]);
    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);
  });

  test("caps the forced discard at hand size when empty piles outnumber the hand", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Estate], deck: [Copper] }],
    });
    for (const name of ["Duchy", "Province", "Curse"]) {
      game.game_state.supply.fixed_stacks.find(
        (s) => s.card.name === name,
      )!.count = 0;
    }
    const player = getPlayer(game, clientids[0]!);

    effect_table.Poacher(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    // 3 empty piles, but only 2 cards in hand - forced discard is capped at hand size.
    expect(request?.min).toBe(2);
    expect(request?.max).toBe(2);

    resolvePrompt(game, clientids[0]!, [...player.hand]);

    expect(player.hand).toEqual([]);
    expect(player.discard_pile.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Estate",
    ]);
  });
});

describe("Remodel", () => {
  test("trashes a card and gains a replacement costing up to its cost + 2", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const copper = player.hand[0]!;

    effect_table.Remodel(game);

    const trash_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(trash_request).toMatchObject({ min: 1, max: 1, choices: [copper] });

    resolvePrompt(game, clientids[0]!, [copper]);

    const gain_request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    expect(gain_request?.choices.every((s) => s.card.cost <= 2)).toBe(true);

    const estate_stack = gain_request!.choices.find(
      (s) => s.card.name === "Estate",
    )!;
    resolveGainPrompt(game, clientids[0]!, [estate_stack]);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Copper",
    ]);
    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Estate"]);
  });

  test("does not prompt with an empty hand", () => {
    const { game, sinks } = createTestGame({ players: [{ hand: [] }] });

    effect_table.Remodel(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
  });

  test("gains nothing when nothing in the supply costs within budget after trashing", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper] }],
      kingdomCards: [BaseKingdomCards["Council Room"]],
    });
    for (const name of ["Copper", "Estate", "Curse"]) {
      game.game_state.supply.fixed_stacks.find(
        (s) => s.card.name === name,
      )!.count = 0;
    }
    const player = getPlayer(game, clientids[0]!);

    effect_table.Remodel(game);
    expect(() =>
      resolvePrompt(game, clientids[0]!, [player.hand[0]!]),
    ).not.toThrow();

    const gain_request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    expect(gain_request).toBeUndefined();
    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Copper",
    ]);
    expect(player.discard_pile).toEqual([]);
    expect(game.wait_queue.isEmpty()).toBe(true);
  });
});

describe("Mine", () => {
  test("trashes a Treasure from hand and gains a costlier one directly into hand", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const copper = player.hand[0]!;

    effect_table.Mine(game);

    const trash_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(trash_request).toMatchObject({ min: 0, max: 1, choices: [copper] });

    resolvePrompt(game, clientids[0]!, [copper]);

    const gain_request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    expect(
      gain_request?.choices.every(
        (s) => s.card.types.includes("Treasure") && s.card.cost <= 3,
      ),
    ).toBe(true);

    const silver_stack = gain_request!.choices.find(
      (s) => s.card.name === "Silver",
    )!;
    resolveGainPrompt(game, clientids[0]!, [silver_stack]);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Copper",
    ]);
    expect(player.hand.map((c) => c.info.name)).toEqual(["Silver"]);
    expect(player.discard_pile).toEqual([]);
  });

  test("does not prompt when the hand has no Treasure", () => {
    const { game, sinks } = createTestGame({ players: [{ hand: [Estate] }] });

    effect_table.Mine(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
  });

  test("declining to trash leaves the hand and trash pile untouched even though a Treasure was available", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [Copper, Estate] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Mine(game);
    resolvePrompt(game, clientids[0]!, []);

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Estate",
    ]);
    expect(game.game_state.trash_pile).toEqual([]);
  });

  test("gains nothing when no Treasure pile is left within budget after trashing", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Copper] }],
    });
    for (const name of ["Copper", "Silver"]) {
      game.game_state.supply.fixed_stacks.find(
        (s) => s.card.name === name,
      )!.count = 0;
    }
    const player = getPlayer(game, clientids[0]!);

    effect_table.Mine(game);
    expect(() =>
      resolvePrompt(game, clientids[0]!, [player.hand[0]!]),
    ).not.toThrow();

    const gain_request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    expect(gain_request).toBeUndefined();
    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Copper",
    ]);
    expect(player.hand).toEqual([]);
    expect(game.wait_queue.isEmpty()).toBe(true);
  });
});

describe("Artisan", () => {
  test("gains a card costing up to 5 into hand, then puts a hand card on top of the deck", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [], deck: [] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Artisan(game);

    const gain_request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    expect(gain_request?.choices.every((s) => s.card.cost <= 5)).toBe(true);

    const silver_stack = gain_request!.choices.find(
      (s) => s.card.name === "Silver",
    )!;
    resolveGainPrompt(game, clientids[0]!, [silver_stack]);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Silver"]);

    const put_back_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(put_back_request).toMatchObject({
      min: 1,
      max: 1,
      choices: [...player.hand],
    });

    resolvePrompt(game, clientids[0]!, [player.hand[0]!]);

    expect(player.hand).toEqual([]);
    expect(player.deck.map((c) => c.info.name)).toEqual(["Silver"]);
  });

  test("can put a pre-existing hand card back instead of the one just gained", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Estate], deck: [] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const estate = player.hand[0]!;

    effect_table.Artisan(game);

    const gain_request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    const silver_stack = gain_request!.choices.find(
      (s) => s.card.name === "Silver",
    )!;
    resolveGainPrompt(game, clientids[0]!, [silver_stack]);

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Estate",
      "Silver",
    ]);

    const put_back_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(put_back_request?.choices.map((c) => c.info.name).sort()).toEqual([
      "Estate",
      "Silver",
    ]);

    resolvePrompt(game, clientids[0]!, [estate]);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Silver"]);
    expect(player.deck.map((c) => c.info.name)).toEqual(["Estate"]);
  });

  test("gains nothing but still requires putting a card from hand onto the deck when no supply pile costs 5 or less", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [Estate], deck: [] }],
      kingdomCards: [BaseKingdomCards.Artisan],
    });
    for (const name of ["Copper", "Silver", "Estate", "Curse", "Duchy"]) {
      game.game_state.supply.fixed_stacks.find(
        (s) => s.card.name === name,
      )!.count = 0;
    }
    const player = getPlayer(game, clientids[0]!);

    expect(() => effect_table.Artisan(game)).not.toThrow();

    const gain_request = lastMessageOfKind<PickSupplyPileRequest>(
      sinks[0]!,
      MessageKinds.PICK_SUPPLY_PILE_REQUEST,
    );
    expect(gain_request).toBeUndefined();

    const put_back_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(put_back_request?.choices.map((c) => c.info.name)).toEqual([
      "Estate",
    ]);

    resolvePrompt(game, clientids[0]!, put_back_request!.choices);

    expect(player.hand).toEqual([]);
    expect(player.deck.map((c) => c.info.name)).toEqual(["Estate"]);
    expect(game.wait_queue.isEmpty()).toBe(true);
  });
});

describe("Bureaucrat", () => {
  test("gains a Silver onto the top of the active player's deck", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [Copper] },
        { hand: [], deck: [] },
      ],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Bureaucrat(game);

    expect(player.deck.map((c) => c.info.name)).toEqual(["Copper", "Silver"]);
  });

  test("forces an opponent holding a Victory card to top-deck it", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [Estate, Copper], deck: [] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);
    const estate = opponent.hand.find((c) => c.info.name === "Estate")!;

    effect_table.Bureaucrat(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toMatchObject({ min: 1, max: 1, choices: [estate] });

    resolvePrompt(game, clientids[1]!, [estate]);

    expect(opponent.hand.map((c) => c.info.name)).toEqual(["Copper"]);
    expect(opponent.deck.map((c) => c.info.name)).toEqual(["Estate"]);
  });

  test("does not prompt an opponent with no Victory card in hand", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [Copper], deck: [] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Bureaucrat(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
    expect(opponent.hand.map((c) => c.info.name)).toEqual(["Copper"]);
  });

  test("Moat blocks the forced top-deck", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [Estate, BaseKingdomCards.Moat], deck: [] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);
    const moat = opponent.hand.find((c) => c.info.name === "Moat")!;

    effect_table.Bureaucrat(game);

    const react_request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(react_request?.choices).toEqual([moat]);

    resolvePrompt(game, clientids[1]!, [moat]);

    expect(opponent.hand.map((c) => c.info.name).sort()).toEqual([
      "Estate",
      "Moat",
    ]);
    expect(opponent.deck).toEqual([]);
  });

  test("lets the opponent choose which Victory card to top-deck when they hold two", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [Estate, Duchy, Copper], deck: [] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Bureaucrat(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.min).toBe(1);
    expect(request?.max).toBe(1);
    expect(request?.choices.map((c) => c.info.name).sort()).toEqual([
      "Duchy",
      "Estate",
    ]);

    const duchy = request!.choices.find((c) => c.info.name === "Duchy")!;
    resolvePrompt(game, clientids[1]!, [duchy]);

    expect(opponent.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Estate",
    ]);
    expect(opponent.deck.map((c) => c.info.name)).toEqual(["Duchy"]);
  });

  test("does not gain a Silver when the Silver pile is empty", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [] },
      ],
    });
    game.game_state.supply.fixed_stacks.find(
      (s) => s.card.name === "Silver",
    )!.count = 0;
    const player = getPlayer(game, clientids[0]!);

    expect(() => effect_table.Bureaucrat(game)).not.toThrow();

    expect(player.deck).toEqual([]);
  });

  test("attacks every opponent in turn order with 3 players", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [Estate], deck: [] },
        { hand: [Estate], deck: [] },
      ],
    });

    effect_table.Bureaucrat(game);
    // Game shuffles player order internally, so which opponent is attacked
    // first is non-deterministic - resolve whichever is actually pending.
    for (let i = 0; i < 2; i++) {
      const pending_clientid = getPendingClientId(game)!;
      resolvePrompt(game, pending_clientid, [
        getPlayer(game, pending_clientid).hand[0]!,
      ]);
    }

    expect(getPlayer(game, clientids[1]!).deck.map((c) => c.info.name)).toEqual(
      ["Estate"],
    );
    expect(getPlayer(game, clientids[2]!).deck.map((c) => c.info.name)).toEqual(
      ["Estate"],
    );
    expect(game.game_state.attack_index).toBeNull();
  });
});

describe("Militia", () => {
  test("gives +2 money", () => {
    const { game } = createTestGame({
      players: [{ hand: [] }, { hand: [] }],
    });

    effect_table.Militia(game);

    expect(game.game_state.money).toBe(2);
  });

  test("forces an opponent with more than 3 cards to discard down to 3", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [] },
        { hand: [Copper, Copper, Copper, Estate, Estate] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Militia(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.min).toBe(2);
    expect(request?.max).toBe(2);

    const to_discard = opponent.hand.filter((c) => c.info.name === "Estate");
    resolvePrompt(game, clientids[1]!, to_discard);

    expect(opponent.hand.length).toBe(3);
    expect(opponent.discard_pile.map((c) => c.info.name).sort()).toEqual([
      "Estate",
      "Estate",
    ]);
  });

  test("does not prompt an opponent with 3 or fewer cards", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [] }, { hand: [Copper, Copper, Copper] }],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Militia(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
    expect(opponent.hand.length).toBe(3);
  });

  test("Moat blocks the forced discard", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [] },
        { hand: [Copper, Copper, Copper, Copper, BaseKingdomCards.Moat] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);
    const moat = opponent.hand.find((c) => c.info.name === "Moat")!;

    effect_table.Militia(game);
    resolvePrompt(game, clientids[1]!, [moat]);

    expect(opponent.hand.length).toBe(5);
    expect(opponent.discard_pile).toEqual([]);
  });

  test("attacks every opponent independently in turn order with 3 players", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [] },
        { hand: [Copper, Copper, Copper, Copper, Estate] },
        { hand: [Copper, Copper, Copper, Copper, Estate] },
      ],
    });

    effect_table.Militia(game);
    // Game shuffles player order internally, so which opponent is attacked
    // first is non-deterministic - resolve whichever is actually pending.
    for (let i = 0; i < 2; i++) {
      const pending_clientid = getPendingClientId(game)!;
      const pending_hand = getPlayer(game, pending_clientid).hand;
      resolvePrompt(game, pending_clientid, [
        pending_hand.find((c) => c.info.name === "Estate")!,
        pending_hand.find((c) => c.info.name === "Copper")!,
      ]);
    }

    expect(getPlayer(game, clientids[1]!).hand.length).toBe(3);
    expect(getPlayer(game, clientids[2]!).hand.length).toBe(3);
    expect(game.game_state.attack_index).toBeNull();
  });
});

describe("Sentry", () => {
  // deck (bottom -> top): Estate, Silver, Gold. Gold is drawn by the
  // "+1 Card" step; Silver and Estate are the two revealed cards, in that
  // order (Silver revealed first since it's now on top).
  function setupSentry() {
    return createTestGame({
      players: [{ hand: [], deck: [Estate, Silver, Gold] }],
    });
  }

  test("draws 1, grants +1 action, and reveals the top 2 cards for a trash prompt", () => {
    const { game, sinks, clientids } = setupSentry();
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;

    effect_table.Sentry(game);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Gold"]);
    expect(game.game_state.actions).toBe(starting_actions + 1);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.min).toBe(0);
    expect(request?.max).toBe(2);
    expect(request?.choices.map((c) => c.info.name)).toEqual([
      "Silver",
      "Estate",
    ]);
  });

  test("trashing both revealed cards ends resolution with nothing put back", () => {
    const { game, sinks, clientids } = setupSentry();
    const player = getPlayer(game, clientids[0]!);

    effect_table.Sentry(game);
    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    resolvePrompt(game, clientids[0]!, request!.choices);

    expect(game.game_state.trash_pile.map((c) => c.info.name).sort()).toEqual([
      "Estate",
      "Silver",
    ]);
    expect(player.deck).toEqual([]);
    expect(lastMessageOfKind(sinks[0]!, MessageKinds.PICK_CARDS_REQUEST)).toBe(
      request,
    );
  });

  test("trashing one and discarding the other leaves nothing to put back", () => {
    const { game, sinks, clientids } = setupSentry();
    const player = getPlayer(game, clientids[0]!);

    effect_table.Sentry(game);
    const trash_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    const silver = trash_request!.choices.find(
      (c) => c.info.name === "Silver",
    )!;
    resolvePrompt(game, clientids[0]!, [silver]);

    const discard_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(discard_request?.choices.map((c) => c.info.name)).toEqual([
      "Estate",
    ]);
    resolvePrompt(game, clientids[0]!, discard_request!.choices);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Silver",
    ]);
    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Estate"]);
    expect(player.deck).toEqual([]);
  });

  test("trashing one and keeping the other puts the kept card back automatically", () => {
    const { game, sinks, clientids } = setupSentry();
    const player = getPlayer(game, clientids[0]!);

    effect_table.Sentry(game);
    const trash_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    const silver = trash_request!.choices.find(
      (c) => c.info.name === "Silver",
    )!;
    resolvePrompt(game, clientids[0]!, [silver]);
    resolvePrompt(game, clientids[0]!, []);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Silver",
    ]);
    expect(player.discard_pile).toEqual([]);
    expect(player.deck.map((c) => c.info.name)).toEqual(["Estate"]);
  });

  test("keeping both cards prompts for reorder, and the chosen card ends up on top", () => {
    const { game, sinks, clientids } = setupSentry();
    const player = getPlayer(game, clientids[0]!);

    effect_table.Sentry(game);
    resolvePrompt(game, clientids[0]!, []);
    const discard_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    resolvePrompt(game, clientids[0]!, []);

    const put_back_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(put_back_request?.min).toBe(1);
    expect(put_back_request?.max).toBe(1);
    expect(put_back_request?.choices.map((c) => c.info.name).sort()).toEqual([
      "Estate",
      "Silver",
    ]);
    expect(put_back_request).not.toBe(discard_request);

    const silver = put_back_request!.choices.find(
      (c) => c.info.name === "Silver",
    )!;
    resolvePrompt(game, clientids[0]!, [silver]);

    expect(player.deck.map((c) => c.info.name)).toEqual(["Estate", "Silver"]);
  });

  test("choosing the other card in the reorder prompt puts it on top instead", () => {
    const { game, sinks, clientids } = setupSentry();
    const player = getPlayer(game, clientids[0]!);

    effect_table.Sentry(game);
    resolvePrompt(game, clientids[0]!, []);
    resolvePrompt(game, clientids[0]!, []);

    const put_back_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    const estate = put_back_request!.choices.find(
      (c) => c.info.name === "Estate",
    )!;
    resolvePrompt(game, clientids[0]!, [estate]);

    expect(player.deck.map((c) => c.info.name)).toEqual(["Silver", "Estate"]);
  });

  test("reveals only 1 card when fewer than 2 remain in the deck", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [], deck: [Estate, Gold] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Sentry(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.choices.map((c) => c.info.name)).toEqual(["Estate"]);

    resolvePrompt(game, clientids[0]!, []);
    resolvePrompt(game, clientids[0]!, []);

    expect(player.deck.map((c) => c.info.name)).toEqual(["Estate"]);
    expect(
      lastMessageOfKind(sinks[0]!, MessageKinds.PICK_SUPPLY_PILE_REQUEST),
    ).toBeUndefined();
  });

  test("reshuffles the discard pile into the deck mid-reveal when the deck runs out", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [], deck: [Gold], discard: [Copper, Silver] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Sentry(game);

    expect(player.discard_pile).toEqual([]);
    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.choices.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Silver",
    ]);
  });

  test("does not prompt when the deck and discard pile are both empty", () => {
    const { game, sinks } = createTestGame({
      players: [{ hand: [], deck: [], discard: [] }],
    });
    const starting_actions = game.game_state.actions;

    expect(() => effect_table.Sentry(game)).not.toThrow();

    expect(game.game_state.actions).toBe(starting_actions + 1);
    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
  });
});

describe("Bandit", () => {
  test("gains a Gold to the active player's discard pile", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [] },
      ],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Bandit(game);

    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Gold"]);
  });

  test("does not gain a Gold when the Gold pile is empty", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [] },
      ],
    });
    game.game_state.supply.fixed_stacks.find(
      (s) => s.card.name === "Gold",
    )!.count = 0;
    const player = getPlayer(game, clientids[0]!);

    expect(() => effect_table.Bandit(game)).not.toThrow();

    expect(player.discard_pile).toEqual([]);
  });

  test("forces a trash of the sole trashable revealed treasure and discards the rest", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [Estate, Silver] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Bandit(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.min).toBe(1);
    expect(request?.max).toBe(1);
    expect(request?.choices.map((c) => c.info.name)).toEqual(["Silver"]);

    resolvePrompt(game, clientids[1]!, request!.choices);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Silver",
    ]);
    expect(opponent.discard_pile.map((c) => c.info.name)).toEqual(["Estate"]);
    expect(opponent.deck).toEqual([]);
  });

  test("lets the opponent choose which trashable treasure to trash when two are revealed", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [Silver, Gold] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Bandit(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.choices.map((c) => c.info.name).sort()).toEqual([
      "Gold",
      "Silver",
    ]);

    const gold = request!.choices.find((c) => c.info.name === "Gold")!;
    resolvePrompt(game, clientids[1]!, [gold]);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Gold",
    ]);
    expect(opponent.discard_pile.map((c) => c.info.name)).toEqual(["Silver"]);
  });

  test("discards both revealed cards without prompting when neither is a trashable treasure", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [Estate, Copper] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Bandit(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request).toBeUndefined();
    expect(opponent.discard_pile.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Estate",
    ]);
    expect(game.game_state.trash_pile).toEqual([]);
  });

  test("forces the trash when only one card is revealed because the deck is nearly empty", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [Silver] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Bandit(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.choices.map((c) => c.info.name)).toEqual(["Silver"]);

    resolvePrompt(game, clientids[1]!, request!.choices);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Silver",
    ]);
    expect(opponent.discard_pile).toEqual([]);
  });

  test("reshuffles the discard pile into the deck mid-reveal when the deck runs out", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [], discard: [Copper, Silver] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    effect_table.Bandit(game);

    const request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(request?.choices.map((c) => c.info.name)).toEqual(["Silver"]);
    expect(opponent.discard_pile).toEqual([]);

    resolvePrompt(game, clientids[1]!, request!.choices);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Silver",
    ]);
    expect(opponent.discard_pile.map((c) => c.info.name)).toEqual(["Copper"]);
  });

  test("does not throw when the opponent has no cards left to reveal", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [], deck: [], discard: [] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);

    expect(() => effect_table.Bandit(game)).not.toThrow();

    expect(opponent.discard_pile).toEqual([]);
    expect(game.game_state.trash_pile).toEqual([]);
  });

  test("Moat blocks the attack entirely", () => {
    const { game, clientids } = createTestGame({
      players: [
        { hand: [], deck: [] },
        { hand: [BaseKingdomCards.Moat], deck: [Silver, Gold] },
      ],
    });
    const opponent = getPlayer(game, clientids[1]!);
    const moat = opponent.hand[0]!;

    effect_table.Bandit(game);
    resolvePrompt(game, clientids[1]!, [moat]);

    expect(opponent.deck.map((c) => c.info.name).sort()).toEqual([
      "Gold",
      "Silver",
    ]);
    expect(opponent.discard_pile).toEqual([]);
    expect(game.game_state.trash_pile).toEqual([]);
  });
});

describe("Throne Room", () => {
  test("does nothing when no action card is chosen", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [BaseKingdomCards.Village, Copper], deck: [] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table["Throne Room"](game);
    resolvePrompt(game, clientids[0]!, []);

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Village",
    ]);
    expect(game.game_state.played_cards).toEqual([]);
  });

  test("plays a no-prompt action card twice", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [BaseKingdomCards.Village], deck: [Copper, Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;
    const village = player.hand[0]!;

    effect_table["Throne Room"](game);
    resolvePrompt(game, clientids[0]!, [village]);

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Copper",
    ]);
    expect(game.game_state.actions).toBe(starting_actions + 4);
    expect(game.game_state.played_cards.map((c) => c.info.name)).toEqual([
      "Village",
    ]);
  });

  test("re-prompts for a choice-driven action card on both plays", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [BaseKingdomCards.Chapel, Copper, Copper, Copper, Copper], deck: [] },
      ],
    });
    const player = getPlayer(game, clientids[0]!);
    const chapel = player.hand.find((c) => c.info.name === "Chapel")!;

    effect_table["Throne Room"](game);
    resolvePrompt(game, clientids[0]!, [chapel]);

    const first_trash_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(first_trash_request?.choices.length).toBe(4);
    const first_copper = first_trash_request!.choices[0]!;
    resolvePrompt(game, clientids[0]!, [first_copper]);

    const second_trash_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(second_trash_request).not.toBe(first_trash_request);
    expect(second_trash_request?.choices.length).toBe(3);
    const second_copper = second_trash_request!.choices[0]!;
    resolvePrompt(game, clientids[0]!, [second_copper]);

    expect(game.game_state.trash_pile.map((c) => c.info.name)).toEqual([
      "Copper",
      "Copper",
    ]);
    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper", "Copper"]);
    expect(game.game_state.played_cards.map((c) => c.info.name)).toEqual([
      "Chapel",
    ]);
  });

  test("replays an Attack card, letting Moat block each attack instance independently", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        { hand: [BaseKingdomCards.Militia], deck: [] },
        {
          hand: [
            BaseKingdomCards.Moat,
            Copper,
            Copper,
            Copper,
            Copper,
          ],
          deck: [],
        },
      ],
    });
    const player = getPlayer(game, clientids[0]!);
    const opponent = getPlayer(game, clientids[1]!);
    const militia = player.hand[0]!;
    const moat = opponent.hand.find((c) => c.info.name === "Moat")!;

    effect_table["Throne Room"](game);
    resolvePrompt(game, clientids[0]!, [militia]);

    const first_react_request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(first_react_request?.choices).toEqual([moat]);
    resolvePrompt(game, clientids[1]!, [moat]);

    const second_react_request = lastMessageOfKind<PickCardsRequest>(
      sinks[1]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(second_react_request).not.toBe(first_react_request);
    expect(second_react_request?.choices).toEqual([moat]);
    resolvePrompt(game, clientids[1]!, [moat]);

    // +2 money per Militia play, both attacks fully blocked by Moat.
    expect(game.game_state.money).toBe(4);
    expect(opponent.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Copper",
      "Copper",
      "Copper",
      "Moat",
    ]);
    expect(opponent.discard_pile).toEqual([]);
    expect(game.game_state.attack_index).toBeNull();
  });

  test("replays a card with a full multi-prompt chain (Sentry) correctly on both plays", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        {
          hand: [BaseKingdomCards.Sentry],
          deck: [Duchy, Copper, Gold, Estate, Silver, Province],
        },
      ],
    });
    const player = getPlayer(game, clientids[0]!);
    const starting_actions = game.game_state.actions;
    const sentry = player.hand[0]!;

    effect_table["Throne Room"](game);
    resolvePrompt(game, clientids[0]!, [sentry]);

    // First play: reveals Silver + Estate, declines to trash, declines to
    // discard, then reorders them so Silver stays on top of the deck.
    const first_trash_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(first_trash_request?.choices.map((c) => c.info.name).sort()).toEqual(
      ["Estate", "Silver"],
    );
    resolvePrompt(game, clientids[0]!, []);

    const first_discard_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(first_discard_request).not.toBe(first_trash_request);
    resolvePrompt(game, clientids[0]!, []);

    const put_back_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(put_back_request).not.toBe(first_discard_request);
    const silver = put_back_request!.choices.find(
      (c) => c.info.name === "Silver",
    )!;
    resolvePrompt(game, clientids[0]!, [silver]);

    // Second play begins automatically: reveals Estate + Gold and trashes both.
    const second_trash_request = lastMessageOfKind<PickCardsRequest>(
      sinks[0]!,
      MessageKinds.PICK_CARDS_REQUEST,
    );
    expect(second_trash_request).not.toBe(put_back_request);
    expect(
      second_trash_request?.choices.map((c) => c.info.name).sort(),
    ).toEqual(["Estate", "Gold"]);
    resolvePrompt(game, clientids[0]!, second_trash_request!.choices);

    expect(game.game_state.actions).toBe(starting_actions + 2);
    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Province",
      "Silver",
    ]);
    expect(game.game_state.trash_pile.map((c) => c.info.name).sort()).toEqual([
      "Estate",
      "Gold",
    ]);
    expect(player.deck.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Duchy",
    ]);
    expect(player.discard_pile).toEqual([]);
    expect(game.game_state.played_cards.map((c) => c.info.name)).toEqual([
      "Sentry",
    ]);
  });
});

describe("Library", () => {
  test("draws non-Action cards synchronously up to a 7-card hand", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [
        {
          hand: [],
          deck: [
            Copper,
            Copper,
            Copper,
            Copper,
            Copper,
            Copper,
            Copper,
            Copper,
          ],
        },
      ],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Library(game);

    expect(player.hand.length).toBe(7);
    expect(player.deck.length).toBe(1);
    expect(
      lastMessageOfKind(sinks[0]!, MessageKinds.PICK_YES_NO_REQUEST),
    ).toBeUndefined();
  });

  test("stops early when the deck and discard pile run out before reaching 7", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [Copper, Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Library(game);

    expect(player.hand.length).toBe(2);
    expect(player.deck).toEqual([]);
  });

  test("caps the hand at 7 even when the deck has more cards to give", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [Copper, Copper, Copper, Copper, Copper], deck: [] }],
    });
    const player = getPlayer(game, clientids[0]!);
    player.deck = [Estate, Estate, Estate, Estate].map((info) =>
      game.new_card(info),
    );

    effect_table.Library(game);

    expect(player.hand.length).toBe(7);
    expect(player.deck.length).toBe(2);
  });

  test("sets aside a skipped Action card and discards it once resolution ends", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [], deck: [Copper, BaseKingdomCards.Smithy] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Library(game);

    const request = lastMessageOfKind<PickYesNoRequest>(
      sinks[0]!,
      MessageKinds.PICK_YES_NO_REQUEST,
    );
    expect(request?.card.info.name).toBe("Smithy");

    resolveBinaryPrompt(game, clientids[0]!, false);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);
    expect(player.discard_pile.map((c) => c.info.name)).toEqual(["Smithy"]);
    expect(game.game_state.set_aside_cards).toEqual([]);
  });

  test("keeps an accepted Action card in hand instead of setting it aside", () => {
    const { game, sinks, clientids } = createTestGame({
      players: [{ hand: [], deck: [Copper, BaseKingdomCards.Smithy] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Library(game);

    const request = lastMessageOfKind<PickYesNoRequest>(
      sinks[0]!,
      MessageKinds.PICK_YES_NO_REQUEST,
    );
    expect(request?.card.info.name).toBe("Smithy");

    resolveBinaryPrompt(game, clientids[0]!, true);

    expect(player.hand.map((c) => c.info.name).sort()).toEqual([
      "Copper",
      "Smithy",
    ]);
    expect(player.discard_pile).toEqual([]);
  });

  test("reshuffles the discard pile into the deck when the deck starts empty", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [], discard: [Copper, Copper] }],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Library(game);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper", "Copper"]);
    expect(player.deck).toEqual([]);
    expect(player.discard_pile).toEqual([]);
  });

  test("does nothing when the deck and discard pile are both empty", () => {
    const { game, clientids } = createTestGame({
      players: [{ hand: [], deck: [], discard: [] }],
    });
    const player = getPlayer(game, clientids[0]!);

    expect(() => effect_table.Library(game)).not.toThrow();

    expect(player.hand).toEqual([]);
  });

  test("accumulates multiple consecutively skipped Action cards and discards them all at the end", () => {
    // deck (bottom -> top): Copper, Smithy, Village. Village and Smithy are
    // drawn (and skipped) first, then Copper is drawn last.
    const { game, sinks, clientids } = createTestGame({
      players: [
        {
          hand: [],
          deck: [Copper, BaseKingdomCards.Smithy, BaseKingdomCards.Village],
        },
      ],
    });
    const player = getPlayer(game, clientids[0]!);

    effect_table.Library(game);
    const first_request = lastMessageOfKind<PickYesNoRequest>(
      sinks[0]!,
      MessageKinds.PICK_YES_NO_REQUEST,
    );
    expect(first_request?.card.info.name).toBe("Village");
    resolveBinaryPrompt(game, clientids[0]!, false);

    const second_request = lastMessageOfKind<PickYesNoRequest>(
      sinks[0]!,
      MessageKinds.PICK_YES_NO_REQUEST,
    );
    expect(second_request).not.toBe(first_request);
    expect(second_request?.card.info.name).toBe("Smithy");
    resolveBinaryPrompt(game, clientids[0]!, false);

    expect(player.hand.map((c) => c.info.name)).toEqual(["Copper"]);
    expect(player.discard_pile.map((c) => c.info.name).sort()).toEqual([
      "Smithy",
      "Village",
    ]);
    expect(game.game_state.set_aside_cards).toEqual([]);
  });
});

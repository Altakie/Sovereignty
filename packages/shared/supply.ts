import { type Card, type CardInfo, CardTypes } from "./cards";
import { BaseKingdomCards } from "./cards/base";
import { Curse } from "./cards/curses";
import { Copper, Gold, Silver } from "./cards/treasures";
import { Duchy, Estate, Province } from "./cards/victories";
import { shuffle } from "./shuffle";

export type supplyStack = {
  card: CardInfo;
  count: number;
};

export function same_stack(a: supplyStack, b: supplyStack): boolean {
  return a.card.name === b.card.name && a.count === b.count;
}

export function getVictoryCount(playerCount: number): number {
  return playerCount <= 2 ? 8 : 12;
}

export function getProvinceCount(playerCount: number): number {
  if (playerCount <= 4) return getVictoryCount(playerCount);
  if (playerCount === 5) return 15;
  return 18;
}

export class Supply {
  fixed_stacks: supplyStack[];
  stacks: supplyStack[];

  constructor(playerCount: number, chosen_cards: CardInfo[]) {
    const victoryCount: number = getVictoryCount(playerCount);
    this.fixed_stacks = [
      { card: Copper, count: 60 - 7 * playerCount },
      { card: Silver, count: 40 },
      { card: Gold, count: 30 },
      { card: Estate, count: victoryCount },
      { card: Duchy, count: victoryCount },
      { card: Province, count: getProvinceCount(playerCount) },
      { card: Curse, count: Math.max(10 * playerCount - 10, 10) },
    ];

    this.stacks = [];

    const kingdomCards = chosen_cards;

    const allCards: CardInfo[] = shuffle(Object.values(BaseKingdomCards));

    let i = 0;
    while (kingdomCards.length < 10) {
      const cardInfo = allCards[i]!;
      if (!kingdomCards.some((card) => card.name === cardInfo.name)) {
        kingdomCards.push(cardInfo);
      }
      i++;
    }

    kingdomCards.sort((a: CardInfo, b: CardInfo) => {
      if (a.cost === b.cost) {
        return a.name.localeCompare(b.name);
      }
      return a.cost - b.cost;
    });

    for (const card of kingdomCards) {
      if (card.types.includes(CardTypes.VICTORY)) {
        this.stacks.push({ card: card, count: victoryCount });
      } else {
        this.stacks.push({ card: card, count: 10 });
      }
    }
  }

  getStacks(): supplyStack[] {
    return this.fixed_stacks.concat(this.stacks);
  }

  gainCard(cardName: string): Card | null {
    const stack = this.getStacks().find((s) => s.card.name === cardName);
    if (stack && stack.count > 0) {
      stack.count--;
      return { id: `${cardName}-${Date.now()}`, info: stack.card };
    }
    return null;
  }

  toggleDebugMode() {
    this.stacks = [
      { card: BaseKingdomCards.Chapel, count: 1 },
      { card: BaseKingdomCards.Moat, count: 1 },
      { card: BaseKingdomCards.Merchant, count: 1 },
      { card: BaseKingdomCards.Witch, count: 10 },
      { card: BaseKingdomCards.Bandit, count: 10 },
      { card: BaseKingdomCards.Bureaucrat, count: 10 },
      { card: BaseKingdomCards.Militia, count: 10 },
    ];
  }
}

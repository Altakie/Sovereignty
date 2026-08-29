import { type CardInfo, CardTypes } from "../cards";

export type BaseKingdomCardName =
  | "Cellar"
  | "Chapel"
  | "Moat"
  | "Harbinger"
  | "Merchant"
  | "Vassal"
  | "Village"
  | "Workshop"
  | "Bureaucrat"
  | "Gardens"
  | "Militia"
  | "Moneylender"
  | "Poacher"
  | "Remodel"
  | "Smithy"
  | "Throne Room"
  | "Bandit"
  | "Council Room"
  | "Festival"
  | "Laboratory"
  | "Library"
  | "Market"
  | "Mine"
  | "Sentry"
  | "Witch"
  | "Artisan";

export const BaseKingdomCards: Record<BaseKingdomCardName, CardInfo> = {
  Cellar: {
    name: "Cellar",
    types: [CardTypes.ACTION],
    cost: 2,
  },
  Chapel: {
    name: "Chapel",
    types: [CardTypes.ACTION],
    cost: 2,
  },
  Moat: {
    name: "Moat",
    types: [CardTypes.ACTION, CardTypes.REACTION],
    cost: 2,
  },
  Harbinger: {
    name: "Harbinger",
    types: [CardTypes.ACTION],
    cost: 3,
  },
  Merchant: {
    name: "Merchant",
    types: [CardTypes.ACTION],
    cost: 3,
  },
  Vassal: {
    name: "Vassal",
    types: [CardTypes.ACTION],
    cost: 3,
  },
  Village: {
    name: "Village",
    types: [CardTypes.ACTION],
    cost: 3,
  },
  Workshop: {
    name: "Workshop",
    types: [CardTypes.ACTION],
    cost: 3,
  },
  Bureaucrat: {
    name: "Bureaucrat",
    types: [CardTypes.ACTION, CardTypes.ATTACK],
    cost: 4,
  },
  Gardens: {
    name: "Gardens",
    types: [CardTypes.VICTORY],
    cost: 4,
  },
  Militia: {
    name: "Militia",
    types: [CardTypes.ACTION, CardTypes.ATTACK],
    cost: 4,
  },
  Moneylender: {
    name: "Moneylender",
    types: [CardTypes.ACTION],
    cost: 4,
  },
  Poacher: {
    name: "Poacher",
    types: [CardTypes.ACTION],
    cost: 4,
  },
  Remodel: {
    name: "Remodel",
    types: [CardTypes.ACTION],
    cost: 4,
  },
  Smithy: {
    name: "Smithy",
    types: [CardTypes.ACTION],
    cost: 4,
  },
  "Throne Room": {
    name: "Throne Room",
    types: [CardTypes.ACTION],
    cost: 4,
  },
  Bandit: {
    name: "Bandit",
    types: [CardTypes.ACTION, CardTypes.ATTACK],
    cost: 5,
  },
  "Council Room": {
    name: "Council Room",
    types: [CardTypes.ACTION],
    cost: 5,
  },
  Festival: {
    name: "Festival",
    types: [CardTypes.ACTION],
    cost: 5,
  },
  Laboratory: {
    name: "Laboratory",
    types: [CardTypes.ACTION],
    cost: 5,
  },
  Library: {
    name: "Library",
    types: [CardTypes.ACTION],
    cost: 5,
  },
  Market: {
    name: "Market",
    types: [CardTypes.ACTION],
    cost: 5,
  },
  Mine: {
    name: "Mine",
    types: [CardTypes.ACTION],
    cost: 5,
  },
  Sentry: {
    name: "Sentry",
    types: [CardTypes.ACTION],
    cost: 5,
  },
  Witch: {
    name: "Witch",
    types: [CardTypes.ACTION, CardTypes.ATTACK],
    cost: 5,
  },
  Artisan: {
    name: "Artisan",
    types: [CardTypes.ACTION],
    cost: 6,
  },
};

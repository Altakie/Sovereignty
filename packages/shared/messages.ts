import { z } from "zod";
import {
  GamePhases,
  type PlayerDisplayInfo,
  type PlayerEndInfo,
  type SharablePlayer,
} from ".";
import { type Card, type CardInfo, type CardName, CardTypes } from "./cards";
import {
  BinaryDescriptions,
  GainDescriptions,
  PickCardsDescriptions,
} from "./effect_descriptions";
import { type LogEntry, LogEventKinds, type Turn } from "./log";
import type { supplyStack } from "./supply";

export const MessageKinds = Object.freeze({
  // Lobby Messages
  CONNECT: "Connect",
  DISCONNECT: "Disconnect",
  PLAYER_NAMES: "Player Names",
  START: "Start",
  STARTED: "Started",
  KICK_PLAYER: "Kick Player",
  ADD_AI_PLAYER: "Add AI Player",

  // Game Messages
  GAME_STATE_UPDATE: "Game State Update",

  PICK_CARDS_REQUEST: "Pick Cards Request",
  PICK_SUPPLY_PILE_REQUEST: "Pick Supply Pile Request",
  PICK_YES_NO_REQUEST: "Pick Yes No Request",

  PICK_CARDS_RESPONSE: "Pick Cards Response",
  PICK_SUPPLY_PILE_RESPONSE: "Pick Supply Pile Response",
  PICK_YES_NO_RESPONSE: "Pick Yes No Response",

  GAME_END: "Game has been terminated",

  LOG_EVENT: "Log Event",
  NEW_TURN: "New Log Turn",
  SYNC_LOG: "Sync Log",
});

type MessageKind = (typeof MessageKinds)[keyof typeof MessageKinds];

const CardInfoSchema: z.ZodType<CardInfo> = z.object({
  name: z.string() as unknown as z.ZodType<CardName>,
  types: z.array(z.enum(CardTypes)),
  cost: z.number(),
});

const CardSchema: z.ZodType<Card> = z.object({
  id: z.string(),
  info: CardInfoSchema,
});

const SupplyStackSchema: z.ZodType<supplyStack> = z.object({
  card: CardInfoSchema,
  count: z.number(),
});

const SupplySchema = z.object({
  fixed_stacks: z.array(SupplyStackSchema),
  stacks: z.array(SupplyStackSchema),
});

const BaseLogEntrySchema = z.object({
  player_name: z.string(),
});

const LogEntrySchema: z.ZodType<LogEntry> = z.discriminatedUnion("kind", [
  BaseLogEntrySchema.extend({
    kind: z.enum([
      LogEventKinds.PLAYED,
      LogEventKinds.DISCARDED,
      LogEventKinds.GAINED,
      LogEventKinds.TRASHED,
    ]),
    cards: z.array(CardInfoSchema),
  }),
  BaseLogEntrySchema.extend({
    kind: z.literal(LogEventKinds.DREW),
    count: z.number(),
  }),
  BaseLogEntrySchema.extend({
    kind: z.literal(LogEventKinds.NO_CARDS_TO_DISCARD),
  }),
  BaseLogEntrySchema.extend({
    kind: z.literal(LogEventKinds.REVEALED_REACTION),
    card: CardInfoSchema,
  }),
]);

const TurnSchema: z.ZodType<Turn> = z.object({
  active_player_name: z.string(),
  turn_number: z.number(),
  events: z.array(LogEntrySchema),
});

const SharablePlayerSchema: z.ZodType<SharablePlayer> = z.object({
  name: z.string(),
  hand: z.array(CardSchema),
  deck_size: z.number(),
  top_of_discard_pile: CardSchema.optional(),
  discard_pile_size: z.number(),
  victory_points: z.number(),
});

const PlayerDisplayInfoSchema: z.ZodType<PlayerDisplayInfo> = z.object({
  name: z.string(),
  total_cards: z.number(),
  victory_points: z.number(),
});

const PlayerEndInfoSchema: z.ZodType<PlayerEndInfo> = z.object({
  name: z.string(),
  victory_points: z.number(),
  final_deck: z.array(CardSchema),
});

const GameStateSchema = z.object({
  phase: z.enum(GamePhases),
  current_player_index: z.number(),
  turn_number: z.number(),

  attack_index: z.number().nullable(),

  played_cards: z.array(CardSchema),
  set_aside_cards: z.array(CardSchema),

  supply: SupplySchema,
  trash_pile: z.array(CardSchema),

  actions: z.number(),
  money: z.number(),
  buys: z.number(),
});

const BaseMessageSchema = z.object({});

const ConnectMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.CONNECT),
  player_name: z.string(),
});

const KickPlayerMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.KICK_PLAYER),
  player_name: z.string(),
});

const AddAIPlayerMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.ADD_AI_PLAYER),
});

const DisconnectMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.DISCONNECT),
  player_name: z.string(),
});

const PlayerNamesMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.PLAYER_NAMES),
  player_names: z.array(z.string()),
});

const StartMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.START),
  chosen_cards: z.array(CardInfoSchema),
});

const StartedMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.STARTED),
  players: z.array(PlayerDisplayInfoSchema),
  state: GameStateSchema,
  player: SharablePlayerSchema,
});

export const request_message_kinds = new Set<MessageKind>();
request_message_kinds.add(MessageKinds.PICK_CARDS_REQUEST);
request_message_kinds.add(MessageKinds.PICK_SUPPLY_PILE_REQUEST);
request_message_kinds.add(MessageKinds.PICK_YES_NO_REQUEST);

const PickCardsRequestSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.PICK_CARDS_REQUEST),
  description: z.enum(PickCardsDescriptions),
  choices: z.array(CardSchema),
  min: z.number(),
  max: z.number(),
});

const PickSupplyPileRequestSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.PICK_SUPPLY_PILE_REQUEST),
  description: z.enum(GainDescriptions),
  choices: z.array(SupplyStackSchema),
  min: z.number(),
  max: z.number(),
});

const PickYesNoRequestSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.PICK_YES_NO_REQUEST),
  description: z.enum(BinaryDescriptions),
  card: CardSchema,
});

const PickCardsResponseSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.PICK_CARDS_RESPONSE),
  choices: z.array(CardSchema),
});

const PickSupplyPileResponseSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.PICK_SUPPLY_PILE_RESPONSE),
  choices: z.array(SupplyStackSchema),
});

const PickYesNoResponseSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.PICK_YES_NO_RESPONSE),
  choice: z.boolean(),
});

const GameStateUpdateMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.GAME_STATE_UPDATE),
  game_state: GameStateSchema,
  player: SharablePlayerSchema,
  players: z.array(PlayerDisplayInfoSchema),
});

const GameEndMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.GAME_END),
  winner_indices: z.array(z.number()),
  players_end_infos_in_victory_order: z.array(PlayerEndInfoSchema),
});

const LogEventMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.LOG_EVENT),
  log_messages: z.array(LogEntrySchema),
});

const NewLogTurnMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.NEW_TURN),
  turn: TurnSchema,
});

const SyncLogMessageSchema = BaseMessageSchema.extend({
  kind: z.literal(MessageKinds.SYNC_LOG),
  log: z.array(TurnSchema),
});

export const MessageSchema = z.discriminatedUnion("kind", [
  ConnectMessageSchema,
  KickPlayerMessageSchema,
  AddAIPlayerMessageSchema,
  DisconnectMessageSchema,
  PlayerNamesMessageSchema,
  StartMessageSchema,
  StartedMessageSchema,
  PickCardsRequestSchema,
  PickSupplyPileRequestSchema,
  PickYesNoRequestSchema,
  PickCardsResponseSchema,
  PickSupplyPileResponseSchema,
  PickYesNoResponseSchema,
  GameStateUpdateMessageSchema,
  GameEndMessageSchema,
  LogEventMessageSchema,
  NewLogTurnMessageSchema,
  SyncLogMessageSchema,
]);

export type Message = z.infer<typeof MessageSchema>;

export type ConnectMessage = z.infer<typeof ConnectMessageSchema>;
export type KickPlayerMessage = z.infer<typeof KickPlayerMessageSchema>;
export type AddAIPlayerMessage = z.infer<typeof AddAIPlayerMessageSchema>;
export type DisconnectMessage = z.infer<typeof DisconnectMessageSchema>;
export type PlayerNamesMessage = z.infer<typeof PlayerNamesMessageSchema>;
export type StartMessage = z.infer<typeof StartMessageSchema>;
export type StartedMessage = z.infer<typeof StartedMessageSchema>;
export type PickCardsRequest = z.infer<typeof PickCardsRequestSchema>;
export type PickSupplyPileRequest = z.infer<typeof PickSupplyPileRequestSchema>;
export type PickYesNoRequest = z.infer<typeof PickYesNoRequestSchema>;
export type PickCardsResponse = z.infer<typeof PickCardsResponseSchema>;
export type PickSupplyPileResponse = z.infer<
  typeof PickSupplyPileResponseSchema
>;
export type PickYesNoResponse = z.infer<typeof PickYesNoResponseSchema>;
export type GameStateUpdateMessage = z.infer<
  typeof GameStateUpdateMessageSchema
>;
export type GameEndMessage = z.infer<typeof GameEndMessageSchema>;
export type LogEventMessage = z.infer<typeof LogEventMessageSchema>;
export type NewLogTurnMessage = z.infer<typeof NewLogTurnMessageSchema>;
export type SyncLogMessage = z.infer<typeof SyncLogMessageSchema>;

export type RequestMessage =
  | PickCardsRequest
  | PickSupplyPileRequest
  | PickYesNoRequest;

export function serializeMessage(msg: Message): string {
  return JSON.stringify(msg);
}

export type ParseMessageResult =
  | { success: true; data: Message }
  | { success: false; error: z.ZodError };

export function parseMessage(msg: string): ParseMessageResult {
  let json: unknown;
  try {
    json = JSON.parse(msg);
  } catch (e) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "custom",
          message: e instanceof Error ? e.message : "Invalid JSON",
          path: [],
          input: msg,
        },
      ]),
    };
  }

  return MessageSchema.safeParse(json);
}

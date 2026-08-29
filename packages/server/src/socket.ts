import { GoogleGenAI } from "@google/genai";
import { randomUUIDv7, sleep } from "bun";
import type { GameState, SharablePlayer } from "shared";
import {
  type GameStateUpdateMessage,
  type Message,
  MessageKinds,
  MessageSchema,
  type PickCardsRequest,
  type PickCardsResponse,
  type PickSupplyPileRequest,
  type PickSupplyPileResponse,
  type PickYesNoResponse,
  parseMessage,
  type StartedMessage,
} from "shared/messages";

function random_sample<T>(items: T[], count: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count);
}

function random_subset<T>(items: T[], min: number, max: number): T[] {
  const upper = Math.min(max, items.length);
  const lower = Math.min(min, upper);
  const count = lower + Math.floor(Math.random() * (upper - lower + 1));
  return random_sample(items, count);
}

export interface MessageSink {
  send: (message: string) => void;
}

const system_instruction =
  "You are a player in a virtual version of the board game dominion." +
  "You will be prompted to make choices based on a game state and your player information." +
  "If you are given a choice between yes and no, return a boolean with true meaning yes and false meaning no." +
  "If you are prompted to pick from a list of cards or a list of supply piles, return the indicies of the choices you want to pick in a list." +
  "When given a list of choices, you should always pick at least the minimum number of choices designated in the message," +
  " and at most the maximum, or your choice will be rejected." +
  "When given a list of choices, if the minimum number of choices is 0, you can return an empty list to skip that choice." +
  "Doing this in the action phase will skip your remaining actions and proceed you to the money phase, and doing this in the buy phase will end your turn." +
  "You will not be prompted to play cards in the money phase, the game engine will automatically play all your treasures." +
  "Certain cards may ask you to make follow up decisions when played, for which you will be reprompted." +
  "You may only pick each choice once." +
  "You should also attach your reason for making a decision to the response, but be succinct when describing your reasoning.";

const MAX_REQUESTS = 2;
export class AISocket implements MessageSink {
  client_id: string;
  on_response: (clientid: string, message: Message) => void;
  game_state?: GameState;
  player?: SharablePlayer;
  ai: GoogleGenAI;
  previous_interaction_id?: string;

  constructor(on_response: (clientid: string, message: Message) => void) {
    this.client_id = randomUUIDv7();
    this.on_response = on_response;
    this.ai = new GoogleGenAI({});
  }

  send(msg: string) {
    const result = parseMessage(msg);
    if (!result.success) {
      console.warn(`AISocket rejected message: ${result.error.message}`);
      return;
    }
    const message = result.data;
    switch (message.kind) {
      case MessageKinds.STARTED: {
        const started_message = message as StartedMessage;
        this.game_state = started_message.state as GameState;
        this.player = started_message.player;
        return;
      }
      case MessageKinds.GAME_STATE_UPDATE: {
        const update_msg = message as GameStateUpdateMessage;
        this.game_state = update_msg.game_state as GameState;
        this.player = update_msg.player;
        return;
      }
      case MessageKinds.PICK_CARDS_REQUEST:
      case MessageKinds.PICK_SUPPLY_PILE_REQUEST:
      case MessageKinds.PICK_YES_NO_REQUEST:
        break;
      case MessageKinds.GAME_END:
        // Restart the convo
        this.previous_interaction_id = undefined;
        return;
      default:
        return;
    }
    this.handle_request(message, msg);
  }

  async handle_request(message: Message, message_string: string) {
    // TODO: If out of tokens just pick a random choice lol

    let response_format: {};

    if (message.kind === MessageKinds.PICK_YES_NO_REQUEST) {
      response_format = {
        type: "object",
        properties: {
          choice: {
            type: "boolean",
          },
          reasoning: {
            type: "string",
          },
        },
        propertyOrdering: ["choice", "reasoning"],
        required: ["choice", "reasoning"],
      };
    } else {
      response_format = {
        type: "object",
        properties: {
          choice_indicies: {
            type: "array",
            items: {
              type: "number",
            },
          },
          reasoning: {
            type: "string",
          },
        },
        propertyOrdering: ["choice_indicies", "reasoning"],
        required: ["choice_indicies", "reasoning"],
      };
    }

    // TODO:
    // Build interactions object based on request type
    // If its a boolean request, then we ask for a boolean response with some reasoning
    // If its a different kind of request, we ask it to pick a choice
    // let interaction: Awaited<ReturnType<typeof this.ai.interactions.create>>;
    let interaction: any;

    let req_number = 0;

    while (req_number < MAX_REQUESTS) {
      req_number += 1;
      try {
        interaction = await this.ai.interactions.create({
          model: "gemini-3.1-flash-lite",
          input: message_string,
          system_instruction: system_instruction,
          previous_interaction_id: this.previous_interaction_id,
          response_format: response_format,
        });

        if (interaction.status === "completed") {
          break;
        }
      } catch (e) {
        console.log(e);
        // Sleep until the next min
        const next_min = new Date();
        next_min.setMinutes(next_min.getMinutes() + 1);
        next_min.setSeconds(1);
        next_min.setMilliseconds(0);
        await sleep(next_min);
      }
    }

    if (req_number > MAX_REQUESTS) {
      console.log(JSON.stringify(interaction));
      this.on_response(this.client_id, this.pick_random_choice(message)!);
      return;
    }

    console.log(
      `AI Response (${interaction.usage?.total_tokens} tokens used): ${interaction.output_text}`,
    );

    this.previous_interaction_id = interaction.id;

    try {
      const res = JSON.parse(interaction.output_text!);

      let response: Message | undefined;
      switch (message.kind) {
        case MessageKinds.PICK_YES_NO_REQUEST: {
          response = {
            kind: MessageKinds.PICK_YES_NO_RESPONSE,
            choice: res.choice,
          };
          break;
        }
        case MessageKinds.PICK_SUPPLY_PILE_REQUEST: {
          const pick_supply_req = message as PickSupplyPileRequest;
          const choices = res.choice_indicies.map(
            (choice_index: number) =>
              pick_supply_req.choices[
                choice_index % pick_supply_req.choices.length
              ]!,
          );
          response = {
            kind: MessageKinds.PICK_SUPPLY_PILE_RESPONSE,
            choices: choices,
          };
          break;
        }
        case MessageKinds.PICK_CARDS_REQUEST: {
          const pick_cards_req = message as PickCardsRequest;

          const choices = res.choice_indicies.map(
            (choice_index: number) =>
              pick_cards_req.choices[
                choice_index % pick_cards_req.choices.length
              ]!,
          );

          response = {
            kind: MessageKinds.PICK_CARDS_RESPONSE,
            choices: choices,
          };
          break;
        }
      }

      const validated = response && MessageSchema.safeParse(response);
      if (validated?.success) {
        this.on_response(this.client_id, validated.data);
      } else {
        if (validated) {
          console.warn(
            `AI produced an invalid ${message.kind} response, falling back to a random choice: ${validated.error.message}`,
          );
        }
        this.on_response(this.client_id, this.pick_random_choice(message)!);
      }
    } catch {
      this.on_response(this.client_id, this.pick_random_choice(message)!);
      return;
    }
  }

  pick_random_choice(message: Message): Message | undefined {
    switch (message.kind) {
      case MessageKinds.PICK_CARDS_REQUEST: {
        const req = message as PickCardsRequest;
        const res: PickCardsResponse = {
          kind: MessageKinds.PICK_CARDS_RESPONSE,
          choices: random_subset(req.choices, req.min, req.max),
        };

        return res;
      }
      case MessageKinds.PICK_SUPPLY_PILE_REQUEST: {
        const req = message as PickSupplyPileRequest;
        const res: PickSupplyPileResponse = {
          kind: MessageKinds.PICK_SUPPLY_PILE_RESPONSE,
          choices: random_subset(req.choices, req.min, req.max),
        };

        return res;
      }
      case MessageKinds.PICK_YES_NO_REQUEST: {
        const res: PickYesNoResponse = {
          kind: MessageKinds.PICK_YES_NO_RESPONSE,
          choice: Math.random() < 0.5,
        };
        return res;
      }
    }

    return undefined;
  }
}

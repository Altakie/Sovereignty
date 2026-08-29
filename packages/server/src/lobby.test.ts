import { describe, expect, test } from "bun:test";
import { MessageKinds, parseMessage, serializeMessage } from "shared/messages";
import { Lobby } from "./lobby";

function receive(lobby: Lobby, clientid: string, raw: string) {
  const result = parseMessage(raw);
  if (!result.success) {
    return { accepted: false as const, error: result.error };
  }
  lobby.resolve_message(clientid, result.data);
  return { accepted: true as const };
}

describe("message validation at the lobby boundary", () => {
  test("a well-formed message is forwarded to the lobby", () => {
    const lobby = new Lobby("test-lobby");
    lobby.add_player("client-1", "Alice", { send: () => {} });

    const outcome = receive(
      lobby,
      "client-1",
      serializeMessage({ kind: MessageKinds.ADD_AI_PLAYER }),
    );

    expect(outcome.accepted).toBe(true);
    expect(
      lobby.player_lobby_infos.values().some((p) => p.name === "Gemini"),
    ).toBe(true);
  });

  test("malformed JSON is rejected and never reaches the lobby", () => {
    const lobby = new Lobby("test-lobby");
    lobby.add_player("client-1", "Alice", { send: () => {} });

    const outcome = receive(lobby, "client-1", "{not valid json");

    expect(outcome.accepted).toBe(false);
    expect(
      lobby.player_lobby_infos.values().some((p) => p.name === "Gemini"),
    ).toBe(false);
  });

  test("a structurally invalid message is rejected and never reaches the lobby", () => {
    const lobby = new Lobby("test-lobby");
    lobby.add_player("client-1", "Alice", { send: () => {} });

    const outcome = receive(
      lobby,
      "client-1",
      JSON.stringify({ kind: MessageKinds.KICK_PLAYER, player_name: 123 }),
    );

    expect(outcome.accepted).toBe(false);
    expect(
      lobby.player_lobby_infos.values().some((p) => p.name === "Alice"),
    ).toBe(true);
  });

  test("an unrecognized message kind is rejected", () => {
    const lobby = new Lobby("test-lobby");
    lobby.add_player("client-1", "Alice", { send: () => {} });

    const outcome = receive(
      lobby,
      "client-1",
      JSON.stringify({ kind: "Not A Real Kind" }),
    );

    expect(outcome.accepted).toBe(false);
  });
});

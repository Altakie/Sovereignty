import { randomUUIDv7 } from "bun";
import { config } from "dotenv";
import { type Context, Hono } from "hono";
import { serveStatic, upgradeWebSocket, websocket } from "hono/bun";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import type { ClientID, LobbyID } from "shared/ids";
import { parseMessage } from "shared/messages";
import { Option } from "shared/option";
import type { InGame, SessionReturn } from "shared/session";
import { Lobby } from "./lobby";

config();
const app = new Hono();

app.use(cors());
// NOTE: Only use when testing with separate client
// app.use(cors({
//   origin: "*"
// }))

function getClientId(c: Context): ClientID | undefined {
  return getCookie(c, "clientid");
}

const lobbies: Map<LobbyID, Lobby> = new Map();

const HOST_GC_GRACE_PERIOD_MS = 30_000;

app.get("/lobbies", (c) => {
  return c.json({
    lobbies: lobbies
      .values()
      .map((lobby) => lobby.get_info())
      .toArray(),
  });
});

app.post("/newlobby", (c) => {
  const name = c.req.query("name");
  if (!name || name === "") {
    return c.json({ error: "Name is required" }, 400);
  }

  let new_lobby_id: LobbyID = randomUUIDv7();
  while (lobbies.get(new_lobby_id)) {
    new_lobby_id = randomUUIDv7();
  }

  lobbies.set(
    new_lobby_id,
    new Lobby(
      new_lobby_id,
      register_players_in_game,
      deregister_players_in_game,
    ),
  );

  return c.json({
    lobby_id: new_lobby_id,
  });
});

// Need to fix reconnect handling
// Ideally query an endpoint that tells us if the clientid is present in a game and get back the lobbyid or nothing
// When a game is started, it needs to register playerids to some kind of map
// Players then should only be allowed in one game at a time
// When a game ends, remove all corresponding entries from the map
// Or just go through all clientids in that game and delete the keys

const in_game: Map<ClientID, LobbyID> = new Map();

function register_players_in_game(clientids: ClientID[], lobby_id: LobbyID) {
  for (const clientid of clientids) {
    in_game.set(clientid, lobby_id);
  }
}

function deregister_players_in_game(clientids: ClientID[]) {
  for (const clientid of clientids) {
    in_game.delete(clientid);
  }
}

app.get("/session", (c) => {
  const clientid = new Option(getClientId(c));
  const lobby_id = clientid.map((c) => in_game.get(c));
  const player_info = lobby_id
    .map((lobby_id) => lobbies.get(lobby_id))
    .map((lobby) =>
      lobby?.game?.player_infos.find((pi) =>
        clientid.map((ci) => ci === pi.clientid),
      ),
    );

  return player_info.match({
    Some(player_info) {
      return c.json<InGame>({
        in_game: true,
        name: player_info.player.name,
        lobby_id: lobby_id.unwrap(),
      });
    },
    None() {
      return c.json<SessionReturn>({ in_game: false });
    },
  });
});

app.use(
  "/game/:id",
  upgradeWebSocket((c) => {
    const id: LobbyID | undefined = c.req.param("id");
    const lobby = lobbies.get(id ? id : "");
    if (lobby === undefined) {
      return {
        onOpen: (ev, ws) => {
          ws.close(1000, "Lobby does not exist");
          return;
        },
      };
    }

    return {
      onOpen: async (_ev, ws) => {
        const clientid = getClientId(c);
        // Reject improper connections
        if (!clientid) {
          ws.close(4000, "Improper clientid");
          return;
        }

        const active_player_info = lobby.game?.player_infos.find(
          (pi) => pi.clientid === clientid,
        );
        if (active_player_info) {
          lobby.add_player(clientid, active_player_info.player.name, ws);
          console.log(`Player ${clientid} reconnected to the game`);
          return;
        }

        const name = c.req.query("name");
        if (!name) {
          ws.close(4000, "No name provided");
          return;
        }

        if (
          lobby.player_lobby_infos.values().some((pli) => pli.name === name)
        ) {
          ws.close(4001, "Name is already taken");
          return;
        }

        if (lobby.player_lobby_infos.size >= lobby.max_players) {
          ws.close(4002, "Lobby is full");
          return;
        }

        lobby.add_player(clientid, name, ws);

        console.log(`Player ${clientid} joined the game`);
        console.log(`Players: ${JSON.stringify(lobby.get_player_names())}`);
      },
      onMessage: (ev, _ws) => {
        const clientid = getClientId(c);
        if (!clientid) {
          return;
        }
        const result = parseMessage(ev.data.toString());
        if (!result.success) {
          console.warn(
            `Rejected message from ${clientid}: ${result.error.message}`,
          );
          return;
        }

        // NOTE: This is where player responses are resolved, other messages are resolved below
        lobby.resolve_message(clientid, result.data);
      },
      onClose: async () => {
        const clientid = getClientId(c);
        if (!clientid) {
          return;
        }

        lobby.remove_player(clientid);

        if (lobby.host.is_none()) {
          setTimeout(() => {
            if (lobby.host.is_none()) {
              deregister_players_in_game(lobby.get_player_client_ids());
              lobbies.delete(lobby.id);
            }
          }, HOST_GC_GRACE_PERIOD_MS);
        }
      },
    };
  }),
);

app.use("/*", (c, next) => {
  const existing = getClientId(c);
  if (!existing) {
    setCookie(c, "clientid", randomUUIDv7(), {
      httpOnly: true,
    });
  }

  return next();
});

app.use("/*", serveStatic({ root: "../client/dist" }));

export default {
  hostname: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
  websocket,
};

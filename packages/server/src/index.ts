import { randomUUIDv7 } from "bun";
import { config } from "dotenv";
import { type Context, Hono } from "hono";
import { serveStatic, upgradeWebSocket, websocket } from "hono/bun";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { parseMessage } from "shared/messages";
import { Lobby } from "./lobby";

config();
const app = new Hono();

app.use(cors());
// NOTE: Only use when testing with separate client
// app.use(cors({
//   origin: "*"
// }))

function getClientId(c: Context): string | undefined {
  return getCookie(c, "clientid");
}

const lobbies: Map<string, Lobby> = new Map();
lobbies.set("default", new Lobby("default"));
lobbies.set("cool", new Lobby("cool"));

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

  let new_lobby_id = randomUUIDv7();
  while (lobbies.get(new_lobby_id)) {
    new_lobby_id = randomUUIDv7();
  }

  lobbies.set(new_lobby_id, new Lobby(new_lobby_id));

  return c.json({
    lobby_id: new_lobby_id,
  });
});

// app.get("/session", (c) => {
//   const clientid = getCookie(c, "clientid");
//   const player_info = clientid
//     ? lobby.game?.player_infos.find((pi) => pi.clientid === clientid)
//     : undefined;
//
//   if (!player_info) {
//     return c.json({ in_game: false });
//   }
//
//   return c.json({ in_game: true, name: player_info.player.name });
// });

app.use(
  "/game/:id",
  upgradeWebSocket((c) => {
    const id = c.req.param("id");
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
        const message = parseMessage(ev.data.toString());
        if (!message) {
          console.log("Message rejected");
          return;
        }

        // NOTE: This is where player responses are resolved, other messages are resolved below
        lobby.resolve_message(clientid, message);
      },
      onClose: async () => {
        const clientid = getClientId(c);
        if (!clientid) {
          return;
        }

        lobby.remove_player(clientid);
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

// app.get('/', (context) => {
//   return context.text("Hi!")
// })

export default {
  hostname: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
  websocket,
};

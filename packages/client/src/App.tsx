import { useEffect, useState } from "react";
import "./App.css";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import type { LobbyInfo } from "shared/lobby";
import { MessageKinds, parseMessage } from "shared/messages";
import { none, type Option, some } from "shared/option.ts";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert.tsx";
import { Button } from "./components/ui/button.tsx";
import {
  gameSocketUrl,
  Lobby,
  resolve_message,
  useLobbyStore,
} from "./Lobby.tsx";

// import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

type Milliseconds = number;
const REFETCH_LOBBIES_INTERVAL: Milliseconds = 5000;

export const RouterStates = Object.freeze({
  HOME: "Home",
  LOBBY: "Lobby",
});

type RouterState = (typeof RouterStates)[keyof typeof RouterStates];

type AppError = {
  title: string;
  message: string;
};

type GlobalStore = {
  router_state: RouterState;
  set_router_state: (state: RouterState) => void;

  error: Option<AppError>;
  set_error: (err: Option<AppError>) => void;
  name: string;
  set_name: (name: string) => void;
};

export const useGlobalStore = create<GlobalStore>((set) => ({
  router_state: RouterStates.HOME,
  set_router_state(state) {
    set(() => ({ router_state: state }));
  },

  error: none(),
  set_error(err) {
    set(() => ({ error: err }));
  },

  name: "",
  set_name(name) {
    set(() => ({ name: name }));
  },
}));

function App() {
  const state = useGlobalStore((state) => state.router_state);

  return <div className="h-screen overflow-auto">{stateTable[state]}</div>;
}

const stateTable: Record<RouterState, React.ReactNode> = {
  Home: <Home />,
  Lobby: <Lobby />,
};

function Home() {
  const [reconnect_name, setReconnectName] = useState<string | undefined>(
    undefined,
  );

  const [set_router_state, name, set_name, error, set_error] = useGlobalStore(
    useShallow((state) => [
      state.set_router_state,
      state.name,
      state.set_name,
      state.error,
      state.set_error,
    ]),
  );

  useEffect(() => {
    fetch("/session")
      .then((res) => res.json())
      .then((session: { in_game: boolean; name?: string }) => {
        if (session.in_game) {
          setReconnectName(session.name);
        }
      })
      .catch((e) => console.log(e));
  }, []);

  const { mutate, isPending } = useMutation({
    mutationKey: ["create lobby"],
    mutationFn: async () => {
      const res = await fetch(`/newlobby?name=${encodeURIComponent(name)}`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error);
      }
      return body;
    },
  });

  return (
    <div className="flex flex-col justify-center items-center h-full w-full gap-2">
      {reconnect_name && (
        <p>
          You have a game in progress as {reconnect_name}.
          <Button onClick={() => set_router_state(RouterStates.LOBBY)}>
            Reconnect
          </Button>
        </p>
      )}
      <Card className="border">
        <CardContent className="w-[30vw] text-left">
          <p>Your Name:</p>
          <input
            className="border rounded-md text-black w-full text-base bg-white p-1"
            value={name}
            onChange={(e) => set_name(e.target.value)}
          ></input>
        </CardContent>
      </Card>
      <Button
        onClick={() => {
          set_error(none());
          mutate(undefined, {
            onSuccess(data) {
              const lobby_id = data.lobby_id;
              useLobbyStore.getState().set_lobby_id(lobby_id);
              connect_to_lobby(lobby_id, name, () => {});
            },
            onError(error) {
              set_error(
                some({
                  title: "Failed to create lobby",
                  message: error.message,
                }),
              );
            },
          });
        }}
      >
        Create Lobby
      </Button>

      <LobbyFinder />

      {error.match({
        Some: (error) => (
          <Alert
            variant="destructive"
            className="fixed top-2 left-2 w-fit animate-slide-in-right bg-red-50"
          >
            <AlertCircleIcon />
            <AlertTitle>{error.title}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ),
        None: () => <></>,
      })}
    </div>
  );
}

function LobbyFinder() {
  const { isLoading, error, data } = useQuery({
    queryKey: ["Lobbies"],
    queryFn: async () => {
      return await fetch("/lobbies").then((res) => res.json());
    },
    refetchInterval: REFETCH_LOBBIES_INTERVAL,
  });

  if (error) {
    return <div>Error fetching lobbies</div>;
  }

  if (isLoading) {
    return <div>Loading lobbies</div>;
  }

  const lobbies: LobbyInfo[] = data!.lobbies;

  return (
    <div>
      {lobbies.map((lobby) => (
        <Card key={lobby.id}>
          <CardHeader>
            <b>{lobby.id}</b>
          </CardHeader>
          <CardContent>
            {lobby.player_count} / {lobby.max_players} Players
            <div>
              <LobbyConnectButton id={lobby.id} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LobbyConnectButton({ id }: { id: string }) {
  const { name, set_error, set_router_state } = useGlobalStore(
    useShallow((state) => ({
      name: state.name,
      set_error: state.set_error,
      set_router_state: state.set_router_state,
    })),
  );
  const [loading, set_loading] = useState(false);
  return (
    <Button
      onClick={() => {
        set_loading(true);
        set_error(none());

        connect_to_lobby(id, name, set_loading);
      }}
    >
      {loading ? "Joining..." : "Join Game"}
    </Button>
  );
}

function connect_to_lobby(
  id: string,
  name: string,
  set_loading: (loading: boolean) => void,
) {
  useLobbyStore.getState().set_lobby_id(id);
  const { set_router_state, set_error } = useGlobalStore.getState();
  const socket = new WebSocket(
    gameSocketUrl(useLobbyStore.getState().lobby_id, name),
  );
  socket.onmessage = (ev) => {
    const message = parseMessage(ev.data);
    if (message?.kind !== MessageKinds.PLAYER_NAMES) {
      return;
    }
    resolve_message(ev);
    useLobbyStore.getState().set_name(name);
    useLobbyStore.getState().set_game_socket(socket);
    set_loading(false);
    set_router_state(RouterStates.LOBBY);
  };
  socket.onclose = (ev) => {
    set_loading(false);
    if (ev.code === 1000) {
      return;
    }
    set_error(
      some({
        title: "Failed to connect to lobby",
        message: ev.reason || "Failed to connect to lobby",
      }),
    );
  };
}

export default App;

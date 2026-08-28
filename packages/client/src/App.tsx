import { useEffect, useState } from "react";
import "./App.css";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import type { LobbyInfo } from "shared/lobby";
import { MessageKinds, parseMessage } from "shared/messages";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert.tsx";
import { Button } from "./components/ui/button.tsx";
import {
  gameSocketUrl,
  Lobby,
  resolve_message,
  useLobbyStore,
} from "./Lobby.tsx";

// import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// let ws: WebSocket = null;
type Milliseconds = number;
const REFETCH_LOBBIES_INTERVAL: Milliseconds = 5000;

export const RouterStates = Object.freeze({
  HOME: "Home",
  LOBBY: "Lobby",
});

type RouterState = (typeof RouterStates)[keyof typeof RouterStates];

type GlobalStore = {
  router_state: RouterState;
  set_router_state: (state: RouterState) => void;

  error: string;
  set_error: (err: string) => void;
  name: string;
  set_name: (name: string) => void;
};

export const useGlobalStore = create<GlobalStore>((set) => ({
  router_state: RouterStates.HOME,
  set_router_state(state) {
    set(() => ({ router_state: state }));
  },

  error: "",
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

  const { set_router_state, name, set_name, error } = useGlobalStore(
    useShallow((state) => ({
      set_router_state: state.set_router_state,
      name: state.name,
      set_name: state.set_name,
      error: state.error,
    })),
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

  // TODO: Actually create this endpoint on the server side
  const { mutate, isPending } = useMutation({
    mutationKey: ["create lobby"],
    mutationFn: async () => {
      return await fetch("/newgame", {
        method: "POST",
      }).then((req) => req.json());
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
      <Button onClick={() => mutate()}>Create Lobby</Button>

      <LobbyFinder />

      {error && (
        <Alert
          variant="destructive"
          className="fixed top-2 left-2 w-fit animate-slide-in-right bg-red-50"
        >
          <AlertCircleIcon />
          <AlertTitle>Failed to connect to lobby</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
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
        <div key={lobby.id}>
          {lobby.id} : {lobby.player_count}
          <div>
            <LobbyConnectButton id={lobby.id} />
          </div>
        </div>
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
  const [loading, setLoading] = useState(false);
  return (
    <Button
      onClick={() => {
        setLoading(true);
        set_error("");

        useLobbyStore.getState().set_lobby_id(id);
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
          setLoading(false);
          set_router_state(RouterStates.LOBBY);
        };
        socket.onclose = (ev) => {
          setLoading(false);
          if (ev.code === 1000) {
            return;
          }
          set_error(ev.reason || "Failed to connect to lobby");
        };
      }}
    >
      {loading ? "Joining..." : "Join Game"}
    </Button>
  );
}

export default App;

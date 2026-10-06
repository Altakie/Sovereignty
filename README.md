# Sovereignty: self-hostable, real-time multiplayer Dominion with LLM opponents

![Screenshot of Game In Progress](./media/game_screen.png)

A self-hosted multiplayer game engine for the popular deck building game Dominion.
Heavily inspired by [Dominion-Online](https://dominion.games/),
which is a great option for those who do not want to self host.
Allows you to play Dominion with a group of friends remotely through a self-hosted server.
Please consider buying a hard copy of Dominion and any expansions you may like if you enjoy the game
and want to support its creators.

Currently supports up to 6 player games and multiple lobbies.

## Features

- Online multiplayer using WebSockets
- Multiple Lobbies with automatic host reassignment and auto cleanup
- AI/LLM players
- Ability to reconnect to in progress games

## Currently Supported Expansions

- [Base Set(Second Edition Cards Only)](<https://dominioncg.fandom.com/wiki/Dominion_(Base_Set)>)

## Setup and Installation

1. Clone this repository

```bash
git clone https://github.com/Altakie/Sovereignty.git
```

1. Install dependencies. We recommend using [Bun](https://bun.com/) as the package manager.

```bash
bun install
```

## Instructions for Self Hosting

To run:

```bash
bun run serve
```

This should start the server at [localhost:3000](http://localhost:3000), which will make it accessible on your local network
if you are running it on your own machine.

To expose the server outside your local network, or if you are hosting the server outside your local network, either [tunnel](https://www.cloudflare.com/learning/network-layer/what-is-tunneling/) localhost:3000 on the host machine, set up [port forwarding](https://en.wikipedia.org/wiki/Port_forwarding) rules, set-up a [Virtual Private Network](https://en.wikipedia.org/wiki/Virtual_private_network), or use any other method you see fit.

## Setting up the AI Player

Sovereignty supports playing against LLMs. However, this will require additional setup. Currently only Gemini models are supported.

- To add support for an AI-Player either create a .env file in the following way under in [packages/server](/packages/server), or set the environment variable manually before launching the server. Otherwise the AI-Player will not work.

```env
GEMINI_API_KEY="<your Gemini API key>"
```

## TODOs and Known Bugs

[Todos.md](./Todos.md)

<!-- This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime. -->

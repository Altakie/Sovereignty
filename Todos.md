# TODOS

## Major Features

- Maybe a reorder decision type?
- Better trash pile
- Card reveal mechanic
- Lobby's with ids
  - Can share lobby code with other players to allow joining
  - Password locked lobbies
  - Combine lobby stores and router stores
  - Make game_socket be created when the connect button is clicked
  - Lobby browser
  - Lobbies have ids
    - Connect to /game/:id
      - Connection can be rejected
    - Should work same as before if we store the lobby id/ connect to the lobby with the proper id
    - Lobbies and games share the same socket
    - Do our lobbies live on separate threads?
    - Create lobby button
      - Change lobbies to be initialed with a host
        - Delete the lobby if there is no host
- Actually allow player to make decisions during money phase

## Minor Features

- Server should sign client ids in case someone tries to modify them client side
  - If the client id is not server signed, reassign the client's clientid to a server assigned clientid
- Color code end screen
  - Display vp sources separately
- Indicate empty supply piles
  - Gray them out or put an x over them
  - Just do a check on whether the count is 0 and replace the supply pile visual when it is 0
- Trash pile dialog pop-up button?
  - Maybe show top of trash pile
- Card Art
- AI Player
  - Lobby hosts, only the lobby host should be able to start the game, add AI players, etc..
  - This is to avoid race conditions
  - Lets make the first player who joined lobby host
  - Support for kicking players from the lobby
  - Support for multiple AI players
    - Make them get created with some sort of random name

## Bugs

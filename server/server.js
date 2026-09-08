import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = 3001;

const rooms = new Map();

const COLORS = [
  "red",
  "blue",
  "green",
  "yellow"
];

const DRAW_AMOUNT = {
  draw2: 2,
  wild4: 10,
  wild6: 6,
  wild10: 4
};

// --------------------
// Shuffle
// --------------------

function shuffle(array) {
  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [newArray[i], newArray[j]] = [
      newArray[j],
      newArray[i]
    ];
  }

  return newArray;
}

// --------------------
// Create Deck
// --------------------

function createDeck() {
  const deck = [];

  for (const color of COLORS) {
    // 0
    deck.push({
      type: "number",
      value: 0,
      color
    });

    // 1 - 9
    for (let number = 1; number <= 9; number++) {
      deck.push({
        type: "number",
        value: number,
        color
      });

      deck.push({
        type: "number",
        value: number,
        color
      });
    }

    // Skip
    deck.push({
      type: "skip",
      value: "⊘",
      color
    });

    // Reverse
    deck.push({
      type: "reverse",
      value: "🔄",
      color
    });

    // +2
    deck.push({
      type: "draw2",
      value: "+2",
      color
    });

    // 7
    deck.push({
      type: "seven",
      value: "7",
      color
    });

    // Discard All
    deck.push({
      type: "discardAll",
      value: "🗑️",
      color
    });
  }

  // Normal Wild
  for (let i = 0; i < 4; i++) {
    deck.push({
      type: "wild",
      value: "WILD",
      color: null
    });
  }

  // +4 -> actually draws 10
  for (let i = 0; i < 4; i++) {
    deck.push({
      type: "wild4",
      value: "+4",
      color: null
    });
  }

  // +6 -> actually draws 6
  for (let i = 0; i < 2; i++) {
    deck.push({
      type: "wild6",
      value: "+6",
      color: null
    });
  }

  // +10 -> actually draws 4
  for (let i = 0; i < 2; i++) {
    deck.push({
      type: "wild10",
      value: "+10",
      color: null
    });
  }

  // Wild Color Draw
  for (let i = 0; i < 2; i++) {
    deck.push({
      type: "wildColorDraw",
      value: "🎯",
      color: null
    });
  }

  return shuffle(deck);
}

// --------------------
// Room
// --------------------

function createRoom(
  roomId,
  socketId,
  playerName
) {
  return {
    roomId,

    hostId: socketId,

    players: [
      {
        id: socketId,
        name: playerName,
        hand: []
      }
    ],

    deck: [],

    discardPile: [],

    currentPlayer: 0,

    direction: 1,

    currentColor: null,

    pendingDraw: 0,

    status: "waiting",

    sevenMode: false,

    colorDrawMode: false,

    winner: null
  };
}

// --------------------
// Get Room
// --------------------

function getRoom(socket) {
  return rooms.get(
    socket.data.roomId
  );
}

// --------------------
// Top Card
// --------------------

function getTopCard(room) {
  if (
    room.discardPile.length === 0
  ) {
    return null;
  }

  return room.discardPile[
    room.discardPile.length - 1
  ];
}

// --------------------
// Refill Deck
// --------------------

function refillDeck(room) {
  if (room.deck.length > 0) {
    return;
  }

  if (room.discardPile.length <= 1) {
    return;
  }

  const topCard =
    room.discardPile.pop();

  room.deck = shuffle(
    room.discardPile
  );

  room.discardPile = [topCard];
}

// --------------------
// Draw Cards
// --------------------

function drawCards(
  room,
  player,
  amount
) {
  const drawn = [];

  for (let i = 0; i < amount; i++) {
    refillDeck(room);

    if (room.deck.length === 0) {
      break;
    }

    const card = room.deck.pop();

    player.hand.push(card);

    drawn.push(card);
  }

  return drawn;
}

// --------------------
// Next Player
// --------------------

function getNextIndex(
  room,
  steps = 1
) {
  let index = room.currentPlayer;

  for (let i = 0; i < steps; i++) {
    index =
      (index +
        room.direction +
        room.players.length) %
      room.players.length;
  }

  return index;
}

function nextPlayer(
  room,
  steps = 1
) {
  if (room.players.length === 0) {
    return;
  }

  room.currentPlayer =
    getNextIndex(room, steps);
}

// --------------------
// Wild
// --------------------

function isWild(card) {
  return (
    card.type === "wild" ||
    card.type === "wild4" ||
    card.type === "wild6" ||
    card.type === "wild10" ||
    card.type === "wildColorDraw"
  );
}

// --------------------
// Draw Card
// --------------------

function isDrawCard(card) {
  return (
    card.type === "draw2" ||
    card.type === "wild4" ||
    card.type === "wild6" ||
    card.type === "wild10"
  );
}

// --------------------
// Can Play
// --------------------

function canPlay(
  card,
  room
) {
  if (room.colorDrawMode) {
    return false;
  }

  const topCard =
    getTopCard(room);

  if (!topCard) {
    return true;
  }

  // Wild cards
  if (isWild(card)) {
    return true;
  }

  // Same color
  if (
    room.currentColor &&
    card.color === room.currentColor
  ) {
    return true;
  }

  // Same action
  if (
    card.type === topCard.type &&
    card.type !== "number"
  ) {
    return true;
  }

  // Same number
  if (
    card.type === "number" &&
    topCard.type === "number" &&
    card.value === topCard.value
  ) {
    return true;
  }

  return false;
}

// --------------------
// Winner
// --------------------

function checkWinner(room) {
  const winner = room.players.find(
    (player) => player.hand.length === 0
  );

  if (!winner) {
    return false;
  }

  room.winner = {
    id: winner.id,
    name: winner.name
  };

  room.status = "finished";
  room.sevenMode = false;
  room.colorDrawMode = false;
  room.pendingDraw = 0;

  io.to(room.roomId).emit(
    "message",
    {
      text: `🏆 ${winner.name} won the game!`
    }
  );

  return true;
}

// --------------------
// Elimination
// --------------------

function checkElimination(room) {
  for (
    let i = room.players.length - 1;
    i >= 0;
    i--
  ) {
    if (
      room.players[i].hand.length >= 30
    ) {
      const eliminated =
        room.players[i];

      room.players.splice(i, 1);

      io.to(room.roomId).emit(
        "message",
        {
          text: `${eliminated.name} was eliminated!`
        }
      );

      if (
        room.players.length <= 1
      ) {
        room.status = "finished";
        return;
      }

      if (
        i < room.currentPlayer
      ) {
        room.currentPlayer--;
      }

      if (
        room.currentPlayer >=
        room.players.length
      ) {
        room.currentPlayer = 0;
      }
    }
  }
}

// --------------------
// Send Room
// --------------------

function sendRoom(room) {
  const roomData = {
    roomId: room.roomId,

    hostId: room.hostId,

    players: room.players.map(
      (player) => ({
        id: player.id,
        name: player.name,
        cards: player.hand.length
      })
    ),

    currentPlayer:
      room.players[
        room.currentPlayer
      ]?.id || null,

    currentColor:
      room.currentColor,

    pendingDraw:
      room.pendingDraw,

    status:
      room.status,

    topCard:
      getTopCard(room),

    winner: room.winner
  };

  // Public room information
  io.to(room.roomId).emit(
    "room:update",
    roomData
  );

  // Private hand
  for (const player of room.players) {
    io.to(player.id).emit(
      "hand:update",
      {
        roomId: room.roomId,
        hand: player.hand
      }
    );
  }
}

// --------------------
// Start Game
// --------------------

function startGame(room) {
  if (room.players.length < 2) {
    return;
  }

  room.deck = createDeck();

  room.discardPile = [];

  room.currentPlayer = 0;

  room.direction = 1;

  room.currentColor = null;

  room.pendingDraw = 0;

  room.status = "playing";

  room.sevenMode = false;

  room.colorDrawMode = false;

  room.winner = null;

  // 7 cards each
  for (const player of room.players) {
    player.hand = [];

    for (let i = 0; i < 7; i++) {
      player.hand.push(
        room.deck.pop()
      );
    }
  }

  // First card should be normal
  let firstIndex = -1;

  for (
    let i = room.deck.length - 1;
    i >= 0;
    i--
  ) {
    const card = room.deck[i];

    if (
      !isWild(card) &&
      !isDrawCard(card) &&
      card.type !== "skip" &&
      card.type !== "reverse"
    ) {
      firstIndex = i;
      break;
    }
  }

  if (firstIndex === -1) {
    firstIndex =
      room.deck.length - 1;
  }

  const firstCard =
    room.deck.splice(
      firstIndex,
      1
    )[0];

  room.discardPile.push(
    firstCard
  );

  room.currentColor =
    firstCard.color;

  sendRoom(room);
}

// --------------------
// Connection
// --------------------

io.on(
  "connection",
  (socket) => {
    console.log(
      "Connected:",
      socket.id
    );

    // --------------------
    // Create Room
    // --------------------

    socket.on(
      "room:create",
      ({
        roomId,
        playerName
      }) => {
        roomId = String(
          roomId
        )
          .trim()
          .toUpperCase();

        playerName = String(
          playerName
        ).trim();

        if (
          !roomId ||
          !playerName
        ) {
          socket.emit(
            "error:message",
            "Name aur Room ID enter karo."
          );

          return;
        }

        if (rooms.has(roomId)) {
          socket.emit(
            "error:message",
            "Room already exists."
          );

          return;
        }

        const room =
          createRoom(
            roomId,
            socket.id,
            playerName
          );

        rooms.set(
          roomId,
          room
        );

        socket.join(roomId);

        socket.data.roomId =
          roomId;

        sendRoom(room);
      }
    );

    // --------------------
    // Join Room
    // --------------------

    socket.on(
      "room:join",
      ({
        roomId,
        playerName
      }) => {
        roomId = String(
          roomId
        )
          .trim()
          .toUpperCase();

        playerName = String(
          playerName
        ).trim();

        const room =
          rooms.get(roomId);

        if (!room) {
          socket.emit(
            "error:message",
            "Room not found."
          );

          return;
        }

        if (
          room.players.length >= 3
        ) {
          socket.emit(
            "error:message",
            "Room is full."
          );

          return;
        }

        if (
          room.status !==
          "waiting"
        ) {
          socket.emit(
            "error:message",
            "Game already started."
          );

          return;
        }

        room.players.push({
          id: socket.id,
          name: playerName,
          hand: []
        });

        socket.join(roomId);

        socket.data.roomId =
          roomId;

        sendRoom(room);
      }
    );

    // --------------------
    // Start Game
    // --------------------

    socket.on(
      "game:start",
      () => {
        const room =
          getRoom(socket);

        if (!room) return;

        if (
          socket.id !==
          room.hostId
        ) {
          socket.emit(
            "error:message",
            "Only host can start."
          );

          return;
        }

        if (
          room.players.length < 2
        ) {
          socket.emit(
            "error:message",
            "At least 2 players are required."
          );

          return;
        }

        startGame(room);
      }
    );

    // --------------------
    // Play Card
    // --------------------

    socket.on(
      "card:play",
      ({
        cardIndex,
        chosenColor
      }) => {
        const room =
          getRoom(socket);

        if (!room) return;

        if (
          room.status !==
          "playing"
        ) {
          return;
        }

        const player =
          room.players[
            room.currentPlayer
          ];

        if (
          !player ||
          player.id !==
            socket.id
        ) {
          return;
        }

        const card =
          player.hand[
            cardIndex
          ];

        if (!card) return;

        if (
          !canPlay(
            card,
            room
          )
        ) {
          socket.emit(
            "error:message",
            "You cannot play this card."
          );

          return;
        }

        // Wild cards need color
        if (
          card.type ===
            "wild" ||
          card.type ===
            "wild4" ||
          card.type ===
            "wild6" ||
          card.type ===
            "wild10"
        ) {
          if (
            !COLORS.includes(
              chosenColor
            )
          ) {
            socket.emit(
              "color:choose",
              {
                cardIndex
              }
            );

            return;
          }
        }

        player.hand.splice(
          cardIndex,
          1
        );

        // ----------------
        // Normal Wild
        // ----------------

        if (
          card.type ===
          "wild"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            chosenColor;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          nextPlayer(room);
        }

        // ----------------
        // +4
        // Actual draw 10
        // ----------------

        else if (
          card.type ===
          "wild4"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            chosenColor;

          room.pendingDraw +=
            DRAW_AMOUNT.wild4;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          nextPlayer(room);
        }

        // ----------------
        // +6
        // Actual draw 6
        // ----------------

        else if (
          card.type ===
          "wild6"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            chosenColor;

          room.pendingDraw +=
            DRAW_AMOUNT.wild6;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          nextPlayer(room);
        }

        // ----------------
        // +10
        // Actual draw 4
        // ----------------

        else if (
          card.type ===
          "wild10"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            chosenColor;

          room.pendingDraw +=
            DRAW_AMOUNT.wild10;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          nextPlayer(room);
        }

        // ----------------
        // +2
        // ----------------

        else if (
          card.type ===
          "draw2"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            card.color;

          room.pendingDraw +=
            DRAW_AMOUNT.draw2;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          nextPlayer(room);
        }

        // ----------------
        // Skip
        // ----------------

        else if (
          card.type ===
          "skip"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            card.color;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          nextPlayer(
            room,
            2
          );
        }

        // ----------------
        // Reverse
        // ----------------

        else if (
          card.type ===
          "reverse"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            card.color;

          room.direction *= -1;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          if (
            room.players.length ===
            2
          ) {
            nextPlayer(
              room,
              2
            );
          } else {
            nextPlayer(room);
          }
        }

        // ----------------
        // 7
        // ----------------

        else if (
          card.type ===
          "seven"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            card.color;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          room.sevenMode =
            true;

          socket.emit(
            "seven:choose"
          );

          sendRoom(room);

          return;
        }

        // ----------------
        // Discard All
        // ----------------

        else if (
          card.type ===
          "discardAll"
        ) {
          const sameColorCards =
            player.hand.filter(
              (item) =>
                item.color ===
                card.color
            );

          player.hand =
            player.hand.filter(
              (item) =>
                item.color !==
                card.color
            );

          room.discardPile.push(
            ...sameColorCards
          );

          room.discardPile.push(
            card
          );

          room.currentColor =
            card.color;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          nextPlayer(room);
        }

        // ----------------
        // Wild Color Draw
        // ----------------

        else if (
          card.type ===
          "wildColorDraw"
        ) {
          room.discardPile.push(
            card
          );

          room.currentColor =
            null;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          room.colorDrawMode =
            true;

          nextPlayer(room);

          const next =
            room.players[
              room.currentPlayer
            ];

          if (next) {
            io.to(next.id).emit(
              "colorDraw:choose"
            );
          }

          sendRoom(room);

          return;
        }

        // ----------------
        // Normal Number
        // ----------------

        else {
          room.discardPile.push(
            card
          );

          room.currentColor =
            card.color;

          if (checkWinner(room)) {
            sendRoom(room);
            return;
          }

          nextPlayer(room);
        }

        checkElimination(room);

        if (
          room.players.length ===
          1
        ) {
          room.status =
            "finished";
        }

        sendRoom(room);
      }
    );

    // --------------------
    // Wild Color Draw
    // --------------------

    socket.on(
      "colorDraw:select",
      ({ color }) => {
        const room =
          getRoom(socket);

        if (!room) return;

        if (
          !room.colorDrawMode
        ) {
          return;
        }

        if (
          !COLORS.includes(color)
        ) {
          return;
        }

        const player =
          room.players[
            room.currentPlayer
          ];

        if (
          !player ||
          player.id !==
            socket.id
        ) {
          return;
        }

        room.currentColor =
          color;

        // Draw one by one
        // until selected color appears
        while (true) {
          refillDeck(room);

          if (
            room.deck.length ===
            0
          ) {
            break;
          }

          const card =
            room.deck.pop();

          player.hand.push(card);

          if (
            card.color === color
          ) {
            break;
          }
        }

        room.colorDrawMode =
          false;

        checkElimination(room);

        if (room.status === "finished") {
          sendRoom(room);
          return;
        }

        if (
          room.players.length > 1
        ) {
          nextPlayer(room);
        }

        sendRoom(room);
      }
    );

    // --------------------
    // 7 Exchange
    // --------------------

    socket.on(
      "seven:exchange",
      ({ targetId }) => {
        const room =
          getRoom(socket);

        if (!room) return;

        if (
          !room.sevenMode
        ) {
          return;
        }

        const player =
          room.players[
            room.currentPlayer
          ];

        if (
          !player ||
          player.id !==
            socket.id
        ) {
          return;
        }

        const target =
          room.players.find(
            (item) =>
              item.id ===
              targetId
          );

        if (
          !target ||
          target.id ===
            player.id
        ) {
          socket.emit(
            "error:message",
            "Invalid player."
          );

          return;
        }

        [
          player.hand,
          target.hand
        ] = [
          target.hand,
          player.hand
        ];

        room.sevenMode =
          false;

        if (checkWinner(room)) {
          sendRoom(room);
          return;
        }

        nextPlayer(room);

        checkElimination(room);

        sendRoom(room);
      }
    );

    // --------------------
    // Draw
    // --------------------

    socket.on(
      "card:draw",
      () => {
        const room =
          getRoom(socket);

        if (!room) return;

        if (
          room.status !==
          "playing"
        ) {
          return;
        }

        const player =
          room.players[
            room.currentPlayer
          ];

        if (
          !player ||
          player.id !==
            socket.id
        ) {
          return;
        }

        let amount = 1;

        if (
          room.pendingDraw > 0
        ) {
          amount =
            room.pendingDraw;

          room.pendingDraw = 0;
        }

        drawCards(
          room,
          player,
          amount
        );

        checkElimination(room);

        if (
          room.players.length <= 1
        ) {
          room.status =
            "finished";

          sendRoom(room);
          return;
        }

        nextPlayer(room);

        sendRoom(room);
      }
    );

    // --------------------
    // Leave Room
    // --------------------

    socket.on(
      "room:leave",
      () => {
        leaveRoom(socket);
      }
    );

    // --------------------
    // Disconnect
    // --------------------

    socket.on(
      "disconnect",
      () => {
        leaveRoom(socket);

        console.log(
          "Disconnected:",
          socket.id
        );
      }
    );
  }
);

// --------------------
// Leave Room Function
// --------------------

function leaveRoom(socket) {
  const roomId =
    socket.data.roomId;

  if (!roomId) {
    return;
  }

  const room =
    rooms.get(roomId);

  if (!room) {
    return;
  }

  const index =
    room.players.findIndex(
      (player) =>
        player.id ===
        socket.id
    );

  if (index === -1) {
    return;
  }

  const leavingPlayer =
    room.players[index];

  const wasCurrent =
    room.currentPlayer ===
    index;

  const wasHost =
    room.hostId ===
    socket.id;

  room.players.splice(
    index,
    1
  );

  socket.leave(roomId);

  socket.data.roomId = null;

  // No players
  if (
    room.players.length ===
    0
  ) {
    rooms.delete(roomId);
    return;
  }

  // New host
  if (wasHost) {
    room.hostId =
      room.players[0].id;
  }

  // Fix current player index
  if (
    index <
    room.currentPlayer
  ) {
    room.currentPlayer--;
  }

  if (
    room.currentPlayer >=
    room.players.length
  ) {
    room.currentPlayer = 0;
  }

  // If current player left
  if (wasCurrent) {
    if (
      room.currentPlayer >=
      room.players.length
    ) {
      room.currentPlayer = 0;
    }
  }

  // Reset special modes
  room.sevenMode = false;
  room.colorDrawMode = false;
  room.pendingDraw = 0;
  room.winner = null;

  // Less than 2 players
  if (
    room.players.length < 2
  ) {
    room.status = "waiting";

    room.deck = [];

    room.discardPile = [];

    room.currentColor = null;

    room.pendingDraw = 0;

    for (const player of room.players) {
      player.hand = [];
    }
  }

  io.to(roomId).emit(
    "message",
    {
      text: `${leavingPlayer.name} left the room.`
    }
  );

  sendRoom(room);
}

// --------------------
// Server
// --------------------

app.get(
  "/",
  (req, res) => {
    res.send(
      "UNO Mercy Server Running"
    );
  }
);

server.listen(
  PORT,
  () => {
    console.log(
      `UNO Mercy server running on port ${PORT}`
    );
  }
);
import React, {
  useEffect,
  useState
} from "react";

import { io } from "socket.io-client";

const socket = io(
  "http://localhost:3001"
);

const COLORS = [
  "red",
  "blue",
  "green",
  "yellow"
];

// --------------------
// Card Component
// --------------------

function CardView({
  card,
  small = false
}) {
  if (!card) {
    return null;
  }

  let displayValue =
    card.value;

  if (
    card.type === "skip"
  ) {
    displayValue = "⊘";
  }

  if (
    card.type === "reverse"
  ) {
    displayValue = "🔄";
  }

  if (
    card.type ===
    "discardAll"
  ) {
    displayValue = "🗑️";
  }

  if (
    card.type ===
    "wildColorDraw"
  ) {
    displayValue = "🎯";
  }

  const classes = [
    "card",

    card.color ||
      "wild",

    card.type ===
    "discardAll"
      ? "discardAll"
      : "",

    card.type ===
    "wildColorDraw"
      ? "wildColorDraw"
      : "",

    card.type ===
    "wild4"
      ? "wild4"
      : "",

    card.type ===
    "wild6"
      ? "wild6"
      : "",

    card.type ===
    "wild10"
      ? "wild10"
      : "",

    small
      ? "smallCard"
      : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className="card-corner">
        {displayValue}
      </div>

      <div className="card-center">
        {displayValue}
      </div>

      <div className="card-corner bottom">
        {displayValue}
      </div>
    </div>
  );
}

// --------------------
// App
// --------------------

function App() {
  const [screen, setScreen] =
    useState("home");

  const [name, setName] =
    useState("");

  const [roomId, setRoomId] =
    useState("");

  const [room, setRoom] =
    useState(null);

  const [hand, setHand] =
    useState([]);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [colorModal, setColorModal] =
    useState(null);

  const [
    sevenModal,
    setSevenModal
  ] = useState(false);

  const [
    colorDrawModal,
    setColorDrawModal
  ] = useState(false);

  // --------------------
  // Socket Events
  // --------------------

  useEffect(() => {
    function roomUpdate(data) {
      setRoom(data);

      if (
        data.status ===
        "waiting"
      ) {
        setScreen("room");
      } else {
        setScreen("game");
      }
    }

    function handUpdate(data) {
      if (
        data.roomId ===
        roomId.toUpperCase()
      ) {
        setHand(data.hand || []);
      }
    }

    function errorMessage(text) {
      setError(text);

      setTimeout(() => {
        setError("");
      }, 2500);
    }

    function showMessage(data) {
      setMessage(data.text);

      setTimeout(() => {
        setMessage("");
      }, 2500);
    }

    function chooseSeven() {
      setSevenModal(true);
    }

    function chooseColorDraw() {
      setColorDrawModal(
        true
      );
    }

    function chooseColorFromServer(
      data
    ) {
      setColorModal({
        cardIndex:
          data.cardIndex
      });
    }

    socket.on(
      "room:update",
      roomUpdate
    );

    socket.on(
      "hand:update",
      handUpdate
    );

    socket.on(
      "error:message",
      errorMessage
    );

    socket.on(
      "message",
      showMessage
    );

    socket.on(
      "seven:choose",
      chooseSeven
    );

    socket.on(
      "colorDraw:choose",
      chooseColorDraw
    );

    socket.on(
      "color:choose",
      chooseColorFromServer
    );

    return () => {
      socket.off(
        "room:update",
        roomUpdate
      );

      socket.off(
        "hand:update",
        handUpdate
      );

      socket.off(
        "error:message",
        errorMessage
      );

      socket.off(
        "message",
        showMessage
      );

      socket.off(
        "seven:choose",
        chooseSeven
      );

      socket.off(
        "colorDraw:choose",
        chooseColorDraw
      );

      socket.off(
        "color:choose",
        chooseColorFromServer
      );
    };
  }, [roomId]);

  // --------------------
  // Create
  // --------------------

  function createRoom() {
    if (
      !name.trim() ||
      !roomId.trim()
    ) {
      setError(
        "Name aur Room ID enter karo."
      );

      return;
    }

    socket.emit(
      "room:create",
      {
        roomId,
        playerName: name
      }
    );
  }

  // --------------------
  // Join
  // --------------------

  function joinRoom() {
    if (
      !name.trim() ||
      !roomId.trim()
    ) {
      setError(
        "Name aur Room ID enter karo."
      );

      return;
    }

    socket.emit(
      "room:join",
      {
        roomId,
        playerName: name
      }
    );
  }

  // --------------------
  // Start
  // --------------------

  function startGame() {
    socket.emit(
      "game:start"
    );
  }

  // --------------------
  // Leave
  // --------------------

  function leaveRoom() {
    socket.emit(
      "room:leave"
    );

    setRoom(null);
    setHand([]);

    setScreen("home");

    setColorModal(null);

    setSevenModal(false);

    setColorDrawModal(false);
  }

  // --------------------
  // Play
  // --------------------

  function playCard(
    index,
    card
  ) {
    if (!room) {
      return;
    }

    if (
      room.currentPlayer !==
      socket.id
    ) {
      return;
    }

    // Wild cards
    if (
      card.type === "wild" ||
      card.type ===
        "wild4" ||
      card.type ===
        "wild6" ||
      card.type ===
        "wild10"
    ) {
      setColorModal({
        cardIndex: index
      });

      return;
    }

    socket.emit(
      "card:play",
      {
        cardIndex: index
      }
    );
  }

  // --------------------
  // Choose Color
  // --------------------

  function chooseColor(
    color
  ) {
    if (!colorModal) {
      return;
    }

    socket.emit(
      "card:play",
      {
        cardIndex:
          colorModal.cardIndex,

        chosenColor: color
      }
    );

    setColorModal(null);
  }

  // --------------------
  // Color Draw
  // --------------------

  function chooseDrawColor(
    color
  ) {
    socket.emit(
      "colorDraw:select",
      {
        color
      }
    );

    setColorDrawModal(
      false
    );
  }

  // --------------------
  // 7 Exchange
  // --------------------

  function exchangeHand(
    targetId
  ) {
    socket.emit(
      "seven:exchange",
      {
        targetId
      }
    );

    setSevenModal(false);
  }

  // --------------------
  // Draw
  // --------------------

  function drawCard() {
    if (!room) {
      return;
    }

    if (
      room.currentPlayer !==
      socket.id
    ) {
      return;
    }

    socket.emit(
      "card:draw"
    );
  }

  // --------------------
  // HOME
  // --------------------

  if (
    screen === "home"
  ) {
    return (
      <div className="app">
        <div className="home-card">

          <div className="logo">
            UNO
          </div>

          <h1>
            UNO MERCY
          </h1>

          <p className="subtitle">
            2–3 Player Online Game
          </p>

          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) =>
              setName(
                e.target.value
              )
            }
          />

          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) =>
              setRoomId(
                e.target.value.toUpperCase()
              )
            }
          />

          <div className="home-buttons">

            <button
              onClick={
                createRoom
              }
            >
              Create Room
            </button>

            <button
              className="secondary"
              onClick={
                joinRoom
              }
            >
              Join Room
            </button>

          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

        </div>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  const me =
    room.players.find(
      (player) =>
        player.id ===
        socket.id
    );

  const isMyTurn =
    room.currentPlayer ===
    socket.id;

  const isHost =
    room.hostId ===
    socket.id;

  const currentPlayer =
    room.players.find(
      (player) =>
        player.id ===
        room.currentPlayer
    );

  // --------------------
  // ROOM
  // --------------------

  if (
    screen === "room"
  ) {
    return (
      <div className="app">

        <div className="game-container">

          <header className="top-bar">

            <div>
              <h1>
                UNO MERCY
              </h1>

              <span>
                Room:{" "}
                <b>
                  {room.roomId}
                </b>
              </span>
            </div>

            <button
              className="leave-button"
              onClick={
                leaveRoom
              }
            >
              Leave Room
            </button>

          </header>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <div className="waiting-screen">

            <div className="waiting-icon">
              🎮
            </div>

            <h2>
              Waiting for Players
            </h2>

            <p>
              Players:{" "}
              {room.players.length}
              /3
            </p>

            <div className="players-list">

              {room.players.map(
                (player) => (
                  <div
                    className="player-item"
                    key={
                      player.id
                    }
                  >

                    <span>
                      👤{" "}
                      {player.name}

                      {player.id ===
                        socket.id &&
                        " (You)"}
                    </span>

                    {player.id ===
                      room.hostId && (
                      <span className="host">
                        HOST
                      </span>
                    )}

                  </div>
                )
              )}

            </div>

            {isHost &&
              room.players.length >=
                2 && (
                <button
                  onClick={
                    startGame
                  }
                >
                  Start Game
                </button>
              )}

            {room.players.length <
              2 && (
              <p className="hint">
                Minimum 2 players
                required.
              </p>
            )}

          </div>

        </div>

      </div>
    );
  }

  // --------------------
  // GAME
  // --------------------

  return (
    <div className="app">

      <div className="game-container">

        <header className="top-bar">

          <div>
            <h1>
              UNO MERCY
            </h1>

            <span>
              Room:{" "}
              <b>
                {room.roomId}
              </b>
            </span>
          </div>

          <button
            className="leave-button"
            onClick={
              leaveRoom
            }
          >
            Leave Room
          </button>

        </header>

        {message && (
          <div className="message">
            {message}
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {/* Players */}

        <div className="players-area">

          {room.players.map(
            (player) => (
              <div
                key={player.id}
                className={`player-box ${
                  player.id ===
                  room.currentPlayer
                    ? "active-player"
                    : ""
                }`}
              >

                <strong>
                  {player.name}
                </strong>

                {player.id ===
                  socket.id && (
                  <small>
                    You
                  </small>
                )}

                {player.id ===
                  room.hostId && (
                  <small>
                    👑 Host
                  </small>
                )}

                <span>
                  🃏{" "}
                  {player.cards}
                </span>

              </div>
            )
          )}

        </div>

        {/* Table */}

        <div className="table">

          <div className="turn-info">

            {isMyTurn ? (
              <strong>
                YOUR TURN
              </strong>
            ) : (
              <>
                {currentPlayer?.name}
                's turn
              </>
            )}

          </div>

          <div className="current-card-area">

            <span className="current-label">
              CURRENT CARD
            </span>

            <div className="current-card">
              <CardView
                card={
                  room.topCard
                }
              />
            </div>

            {room.currentColor && (
              <div className="current-color">

                Color:

                <b
                  className={
                    room.currentColor
                  }
                >
                  {" "}
                  {room.currentColor.toUpperCase()}
                </b>

              </div>
            )}

          </div>

          {/* Draw Pile */}

          <div className="draw-area">

            <div
              className={`draw-pile ${
                isMyTurn
                  ? "can-draw"
                  : ""
              }`}
              onClick={
                isMyTurn
                  ? drawCard
                  : undefined
              }
            >

              <span>
                UNO
              </span>

            </div>

            <small>
              Draw
            </small>

            {room.pendingDraw >
              0 && (
              <div className="pending">
                +{room.pendingDraw}
              </div>
            )}

          </div>

        </div>

        {/* Hand */}

        <div className="my-hand-area">

          <h2>
            {me?.name}'s Hand
          </h2>

          <div className="hand">

            {hand.map(
              (card, index) => (
                <div
                  key={`${index}-${card.type}-${card.value}`}
                  className="hand-card-wrapper"
                  onClick={() =>
                    playCard(
                      index,
                      card
                    )
                  }
                >
                  <CardView
                    card={card}
                  />
                </div>
              )
            )}

          </div>

          <p className="card-limit">
            Maximum 30 cards —
            30 cards = Elimination
          </p>

        </div>

        {/* Finished */}

        {room.status ===
          "finished" && (
          <div className="modal-overlay">

            <div className="modal">

              <div className="winner-icon">
                🏆
              </div>

              <h2>
                Game Over
              </h2>

              <p>
                Winner:
              </p>

              <strong>
                {room.winner?.name}
              </strong>

              <button
                onClick={
                  leaveRoom
                }
              >
                Leave Room
              </button>

            </div>

          </div>
        )}

        {/* Wild Color */}

        {colorModal && (
          <div className="modal-overlay">

            <div className="modal">

              <h2>
                Choose Color
              </h2>

              <div className="color-buttons">

                {COLORS.map(
                  (color) => (
                    <button
                      key={
                        color
                      }
                      className={`color-button ${color}`}
                      onClick={() =>
                        chooseColor(
                          color
                        )
                      }
                    >
                      {color.toUpperCase()}
                    </button>
                  )
                )}

              </div>

              <button
                className="cancel"
                onClick={() =>
                  setColorModal(
                    null
                  )
                }
              >
                Cancel
              </button>

            </div>

          </div>
        )}

        {/* Wild Color Draw */}

        {colorDrawModal && (
          <div className="modal-overlay">

            <div className="modal">

              <div className="special-icon">
                🎯
              </div>

              <h2>
                Choose a Color
              </h2>

              <p>
                Cards will be drawn
                until the selected
                color appears.
              </p>

              <div className="color-buttons">

                {COLORS.map(
                  (color) => (
                    <button
                      key={
                        color
                      }
                      className={`color-button ${color}`}
                      onClick={() =>
                        chooseDrawColor(
                          color
                        )
                      }
                    >
                      {color.toUpperCase()}
                    </button>
                  )
                )}

              </div>

            </div>

          </div>
        )}

        {/* Seven */}

        {sevenModal && (
          <div className="modal-overlay">

            <div className="modal">

              <div className="special-icon">
                7️⃣
              </div>

              <h2>
                Exchange Hand
              </h2>

              <p>
                Choose a player
                to exchange your
                complete hand with.
              </p>

              <div className="exchange-list">

                {room.players
                  .filter(
                    (player) =>
                      player.id !==
                      socket.id
                  )
                  .map(
                    (player) => (
                      <button
                        key={
                          player.id
                        }
                        onClick={() =>
                          exchangeHand(
                            player.id
                          )
                        }
                      >
                        👤{" "}
                        {player.name}
                      </button>
                    )
                  )}

              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}

export default App;
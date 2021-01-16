const { uniqueRandomNumbers } = require("./handlers/TicketHandlers");
require("dotenv").config();
// const jwt = require("jwt-then");
const jwt = require("jsonwebtoken");

let intervalId;
const MONGODB_URI =
  "mongodb+srv://gayatri123:gayatri123@hclustor.ootb3.mongodb.net/housie?retryWrites=true&w=majority" ||
  process.env.DATABASE;
const PORT = process.env.PORT || 8000;

const mongoose = require("mongoose");
mongoose.connect(MONGODB_URI, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

mongoose.connection.on("error", (err) => {
  console.log(`Mongoose Connection ERROR: ${err.message}`);
});

mongoose.connection.once("open", () => {
  console.log("MongoDB Connected!!");
});

//Models
require("./models/User");
require("./models/gameRoom");

const app = require("./app");
const gameRoom = require("./models/gameRoom");

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const io = require("socket.io")(server);
const User = mongoose.model("User");

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.query.token;
    const payload = await jwt.verify(token, process.env.SECRET);

    socket.userId = payload.id;
    next();
  } catch (e) {}
});

io.on("connection", (socket) => {
  console.log(`Connected ${socket.userId}`);

  socket.on("disconnect", () => {
    console.log(`Disonnected ${socket.userId}`);
  });

  socket.on("joinroom", async ({ gameroomid }) => {
    socket.join(gameroomid);
    const user = await User.findOne({ _id: socket.userId });

    const gameroom = await gameRoom.findOne({ _id: gameroomid });

    if (gameroom.username === user.name) {
      socket.emit("admin", {
        isadmin: true,
      });
    } else {
      socket.emit("admin", {
        isadmin: false,
      });
    }

    if (!gameroom.players.includes(user.name)) {
      gameroom.players.push(user.name);
      await gameroom.save();
    }

    io.to(gameroomid).emit("players", {
      players: gameroom.players,
    });
    console.log(`A user joined gameroom ${gameroomid}`);
  });

  socket.on("leaveroom", async ({ gameroomid }) => {
    if (intervalId) {
      clearInterval(intervalId);
    }

    socket.leave(gameroomid);
    console.log(`A user left gameroom ${gameroomid}`);
  });

  socket.on("GameroomMessage", async ({ gameroomid, message }) => {
    if (message.trim().length > 0) {
      const user = await User.findOne({ _id: socket.userId });
      io.to(gameroomid).emit("newMessage", {
        message,
        name: user.name,
        userId: socket.userId,
      });
    }
  });

  socket.on("startTimer", async ({ gameroomid }) => {
    await gameRoom.deleteOne({ _id: gameroomid });

    const emitData = () => {
      io.to(gameroomid).emit("timerStarted", {
        time: uniqueRandomNumbers(),
      });
    };
    emitData();
    intervalId = setInterval(emitData, 2000);
  });
});

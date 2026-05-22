const { Server } = require("socket.io");

let io;

const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "https://actecrm.com"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("register", ({ userId, platform }) => {
      if (userId) {
        socket.userId = userId;
        socket.platform = platform;

        socket.join(`user_${userId}`);

        console.log(
          `User ${userId} registered on ${platform} with socket ${socket.id}`,
        );
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
};

const emitNotification = (userId, data) => {
  if (io) {
    if (userId) {
      io.to(`user_${userId}`).emit("notification", data);
    } else {
      io.emit("notification", data);
    }
  }
};

const emitLeadUpdate = (data) => {
  if (io) {
    io.emit("lead_update", data); // Data includes lead_count
  }
};

const emitForceLogout = (userId, platform) => {
  if (!io || !userId) return;

  const sockets = io.sockets.sockets;

  sockets.forEach((socket) => {
    if (socket.userId == userId && socket.platform === platform) {
      socket.emit("force_logout", {
        message:
          "You have been logged out because of a new login on another system.",
      });
    }
  });
};

module.exports = { init, emitNotification, emitLeadUpdate, emitForceLogout };

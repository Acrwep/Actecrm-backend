const express = require("express");
const Route = require("./routes/Route");
const cors = require("cors");
require("./models/SchedulerModel");
const path = require("path");

const http = require("http");
const socketService = require("./services/SocketService");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
socketService.init(server);

// Middleware (MUST come first)
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", Route);

// Catch all undefined routes
app.use((req, res) => {
  res.status(404).send({
    message: "404 Not Found",
  });
});

const port = process.env.PORT || 3000;
// server.listen(port, () => {
//   console.log(`Server is running on ${port}`);
// });
function startServer(p) {
  server
    .listen(p, () => {
      console.log(`Server is running on ${p}`);
    })
    .on("error", (err) => {
      if (err.code === "EADDRINUSE" && p === 3000) {
        console.log(`Port 3000 is busy, trying port 3001...`);
        startServer(3001);
      } else if (err.code === "EADDRINUSE") {
        console.error(`Port ${p} is also busy. Please free up a port.`);
        process.exit(1);
      } else {
        console.error("Server error:", err);
      }
    });
}

startServer(port);

const express = require("express");
const Route = require("./routes/Route");
const cors = require("cors");

const app = express();

// Middleware (MUST come first)
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use("/api", Route);

// Catch all undefined routes
app.use((req, res) => {
  res.status(404).send({
    message: "404 Not Found",
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});

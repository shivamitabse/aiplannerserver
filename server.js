require("dotenv").config();
const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/api");
const { getDbConnection } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin:
    process.env.FRONTEND_URL ||
    "http://localhost:5173" ||
    "https://www.testmysite.in",
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// Initialize Database on startup
getDbConnection()
  .then(() => {
    console.log("Database connected and initialized.");
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
  });

app.use("/api", apiRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

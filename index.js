// index.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import setupOnlineUsersWS from "./ws/onlineUsers.js";

// Rutas
import emailRoutes from "./routes/emails.js";
import photoRoutes from "./routes/photosRoutes.js";
import factRoutes from "./routes/factRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import adminRoutes from "./routes/admins.js";
import mosaicRoutes from "./routes/mosaicRoutes.js";
import { startMosaicScheduler } from "./utils/mosaicScheduler.js";
// (Puedes agregar más rutas aquí: factsRoutes, uploadRoutes, etc.)

dotenv.config();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

const server = http.createServer(app);

// Inicializar WebSocket de usuarios online
setupOnlineUsersWS(server);

// Middlewares
app.use(
  cors({
    origin: [
      process.env.FRONTEND,
      "http://localhost:5173"
    ],
    credentials: true,
  })
);

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Conectado a MongoDB");
    startMosaicScheduler();
  })
  .catch((err) => console.error("❌ Error de conexión:", err));

// Rutas
app.use("/emails", emailRoutes);
app.use("/photos", photoRoutes);
app.use("/facts", factRoutes);
app.use("/admins", adminRoutes);
app.use("/stats", statsRoutes);
app.use("/mosaic", mosaicRoutes);

// Ejemplo: POST /emails/send, GET /emails/get, etc.

app.get("/ping", (req, res) => {
  res.send("Servidor activo 🚀");
});

// Servidor HTTP (preparado para websockets u otros servicios en el mismo puerto)
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});



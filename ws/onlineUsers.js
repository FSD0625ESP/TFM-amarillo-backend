// ws/onlineUsers.js
import { Server } from "socket.io";
import EmailEntry from "../models/EmailEntry.js";

export default function setupOnlineUsersWS(server) {
  const DEFAULT_ORIGINS = ["https://d2w2jevfn752dh.cloudfront.net", "https://d2w2jevfn752dh.cloudfront.net"];
  const normalizeOrigin = (origin) => origin.replace(/\/+$/, "");
  const parseOrigins = (value) =>
    value
      ? value
          .split(",")
          .map((origin) => normalizeOrigin(origin.trim()))
          .filter(Boolean)
      : [];
  const unique = (origins) => [...new Set(origins)];
  const allowedOrigins = (() => {
    const envOrigins = parseOrigins(process.env.FRONTEND_ORIGINS);
    if (envOrigins.length) return unique(envOrigins);
    const singleOrigin = parseOrigins(process.env.FRONTEND);
    if (singleOrigin.length) return unique(singleOrigin);
    return DEFAULT_ORIGINS;
  })();

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  // Clave (email o fallback) -> { email, id, sockets: Set<socketId> }
  const onlineUsers = new Map();
  // socketId -> key
  const socketToKey = new Map();

  // Búsqueda case-insensitive por email
  const existsEmail = async (email) => {
    if (!email) return false;
    return EmailEntry.exists({
      email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    });
  };

  const broadcast = () => {
    let anonymousCount = 0;
    const registeredUsers = [];

    Array.from(onlineUsers.values()).forEach(({ email, id, isAnonymous }) => {
      if (email || id) {
        registeredUsers.push({ email, id });
      } else if (isAnonymous) {
        anonymousCount += 1;
      }
    });

    io.emit("online-users", {
      count: registeredUsers.length, // compat con admin actual
      users: registeredUsers,
      anonymousCount,
      total: registeredUsers.length + anonymousCount,
    });
  };

  io.on("connection", async (socket) => {
    const email = socket.handshake.auth?.email || socket.handshake.query?.email;
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
    const anonId = socket.handshake.auth?.anonId || socket.handshake.query?.anonId;

    const normalizedEmail = typeof email === "string" ? email.toLowerCase() : null;
    const normalizedId = userId ? String(userId) : null;
    const normalizedAnonId = anonId ? String(anonId) : null;

    if (normalizedEmail) {
      const exists = await existsEmail(normalizedEmail);
      if (!exists) {
        console.warn("⚠️ WS presencia ignorada: email no registrado", normalizedEmail);
        return;
      }
    }

    const key =
      normalizedEmail ||
      (normalizedId ? `id:${normalizedId}` : `anon:${normalizedAnonId || socket.id}`);
    const entry = onlineUsers.get(key) || {
      email: normalizedEmail,
      id: normalizedId,
      isAnonymous: !normalizedEmail && !normalizedId,
      sockets: new Set(),
    };

    if (!entry.isAnonymous && !normalizedEmail && !normalizedId) {
      entry.isAnonymous = true;
    }

    entry.sockets.add(socket.id);
    onlineUsers.set(key, entry);
    socketToKey.set(socket.id, key);

    console.log("🔵 Usuario conectado:", socket.id, normalizedEmail || normalizedId || key);
    broadcast();

    socket.on("disconnect", () => {
      console.log("🔴 Usuario desconectado:", socket.id);
      const keyForSocket = socketToKey.get(socket.id);
      socketToKey.delete(socket.id);

      if (keyForSocket && onlineUsers.has(keyForSocket)) {
        const entry = onlineUsers.get(keyForSocket);
        entry.sockets.delete(socket.id);

        if (entry.sockets.size === 0) {
          onlineUsers.delete(keyForSocket);
        } else {
          onlineUsers.set(keyForSocket, entry);
        }
      }

      broadcast();
    });
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

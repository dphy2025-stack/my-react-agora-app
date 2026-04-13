const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const app = express();
app.use(express.json());
app.disable("x-powered-by");

const APP_ID = (process.env.APP_ID || "").trim();
const APP_CERTIFICATE = (process.env.APP_CERTIFICATE || "").trim();
const PORT = Number(process.env.PORT || 5000);
const ROOM_TTL_SECONDS = Number(process.env.ROOM_TTL_SECONDS || 10800);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const rooms = new Map();

const corsOptions = {
  origin(origin, callback) {
    if (ALLOWED_ORIGINS.includes("*")) {
      callback(null, true);
      return;
    }

    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

const nowInSeconds = () => Math.floor(Date.now() / 1000);

const normalizeRoomName = (value) => value.trim();

const isRoomExpired = (room) => room.expiresAt <= nowInSeconds();

const cleanupRoomIfExpired = (roomName) => {
  const existing = rooms.get(roomName);
  if (existing && isRoomExpired(existing)) {
    rooms.delete(roomName);
  }
};

const buildToken = (roomName, uid) => {
  const expiresAt = nowInSeconds() + ROOM_TTL_SECONDS;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    roomName,
    uid,
    RtcRole.PUBLISHER,
    expiresAt
  );

  return { token, expiresAt };
};

const validateConfig = () => {
  if (!APP_ID || !APP_CERTIFICATE) {
    throw new Error(
      "APP_ID and APP_CERTIFICATE must be set in backend/.env (or process env)"
    );
  }
};

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    envLoadedFrom: fs.existsSync(envPath) ? envPath : "process.env",
    hasAgoraConfig: Boolean(APP_ID && APP_CERTIFICATE),
  });
});

app.post("/api/rooms/token", (req, res) => {
  try {
    validateConfig();

    const mode = req.body?.mode === "join" ? "join" : "create";
    const roomName = normalizeRoomName(req.body?.roomName || "");
    const roomPassword = String(req.body?.roomPassword || "").trim();

    if (!roomName) {
      return res.status(400).json({ error: "roomName is required" });
    }

    if (!roomPassword) {
      return res.status(400).json({ error: "roomPassword is required" });
    }

    cleanupRoomIfExpired(roomName);

    const existingRoom = rooms.get(roomName);

    if (mode === "create") {
      if (existingRoom && existingRoom.password !== roomPassword) {
        return res
          .status(409)
          .json({ error: "Room already exists with a different password" });
      }

      rooms.set(roomName, {
        password: roomPassword,
        createdAt: nowInSeconds(),
        expiresAt: nowInSeconds() + ROOM_TTL_SECONDS,
      });
    }

    if (mode === "join") {
      if (!existingRoom) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (existingRoom.password !== roomPassword) {
        return res.status(401).json({ error: "Invalid room password" });
      }

      rooms.set(roomName, {
        ...existingRoom,
        expiresAt: nowInSeconds() + ROOM_TTL_SECONDS,
      });
    }

    const uid = Math.floor(Math.random() * 900000) + 100000;
    const { token, expiresAt } = buildToken(roomName, uid);

    return res.json({
      token,
      uid,
      roomName,
      expiresInSeconds: Math.max(0, expiresAt - nowInSeconds()),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Env source: ${fs.existsSync(envPath) ? envPath : "process.env"}`);
  console.log(`Agora config loaded: ${Boolean(APP_ID && APP_CERTIFICATE)}`);
});

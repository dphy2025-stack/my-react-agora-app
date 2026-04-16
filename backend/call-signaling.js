const { Server } = require("socket.io");
const { randomUUID } = require("crypto");

function createCallSignaling(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const online = new Map();
  const calls = new Map();

  const emitToUser = (userId, event, payload) => {
    const sid = online.get(userId);
    if (!sid) return;
    io.to(sid).emit(event, payload);
  };

  const buildRoom = () => ({
    roomId: `room_${Math.random().toString(36).slice(2, 10)}`,
    roomPassword: `pw_${Math.random().toString(36).slice(2, 10)}`,
  });

  const scheduleRoomResend = (callId) => {
    let tries = 0;
    const max = 8;
    const timer = setInterval(() => {
      const c = calls.get(callId);
      if (!c) {
        clearInterval(timer);
        return;
      }

      const bothDelivered = c.roomDelivered[c.from] && c.roomDelivered[c.to];
      const bothJoined = c.joined[c.from] && c.joined[c.to];
      if (bothDelivered || bothJoined) {
        clearInterval(timer);
        return;
      }

      const payload = {
        callId: c.callId,
        roomId: c.roomId,
        roomPassword: c.roomPassword,
        from: c.from,
        to: c.to,
        ts: Date.now(),
      };

      if (!c.roomDelivered[c.from]) emitToUser(c.from, "call:room", payload);
      if (!c.roomDelivered[c.to]) emitToUser(c.to, "call:room", payload);

      tries += 1;
      if (tries >= max) {
        clearInterval(timer);
      }
    }, 1500);
  };

  io.on("connection", (socket) => {
    socket.on("auth:bind", ({ userId }) => {
      if (!userId) return;
      online.set(userId, socket.id);
      socket.data.userId = userId;
      socket.join(`user:${userId}`);
    });

    socket.on("call:invite", ({ to }, ack) => {
      const from = socket.data.userId;
      if (!from || !to) {
        ack?.({ ok: false, error: "bad_request" });
        return;
      }
      const callId = randomUUID();
      calls.set(callId, {
        callId,
        from,
        to,
        status: "invited",
        roomId: "",
        roomPassword: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        roomDelivered: {},
        joined: {},
      });
      emitToUser(to, "call:incoming", { callId, from, createdAt: Date.now() });
      ack?.({ ok: true, callId });
    });

    socket.on("call:accept", ({ callId }, ack) => {
      const by = socket.data.userId;
      const c = calls.get(callId);
      if (!c || by !== c.to) {
        ack?.({ ok: false, error: "invalid_call" });
        return;
      }
      if (!c.roomId) {
        const room = buildRoom();
        c.roomId = room.roomId;
        c.roomPassword = room.roomPassword;
      }
      c.status = "room_ready";
      c.updatedAt = Date.now();
      const payload = {
        callId: c.callId,
        roomId: c.roomId,
        roomPassword: c.roomPassword,
        from: c.from,
        to: c.to,
        ts: Date.now(),
      };
      emitToUser(c.from, "call:room", payload);
      emitToUser(c.to, "call:room", payload);
      scheduleRoomResend(callId);
      ack?.({ ok: true, ...payload });
    });

    socket.on("call:room:ack", ({ callId }, ack) => {
      const userId = socket.data.userId;
      const c = calls.get(callId);
      if (!c || !userId) {
        ack?.({ ok: false });
        return;
      }
      c.roomDelivered[userId] = true;
      c.updatedAt = Date.now();
      ack?.({ ok: true });
    });

    socket.on("call:joined", ({ callId }, ack) => {
      const userId = socket.data.userId;
      const c = calls.get(callId);
      if (!c || !userId) {
        ack?.({ ok: false });
        return;
      }
      c.joined[userId] = true;
      c.updatedAt = Date.now();
      if (c.joined[c.from] && c.joined[c.to]) {
        c.status = "active";
      }
      ack?.({ ok: true });
    });

    socket.on("call:sync", (_payload, ack) => {
      const userId = socket.data.userId;
      if (!userId) {
        ack?.({ ok: false, calls: [] });
        return;
      }
      const active = [];
      for (const c of calls.values()) {
        if ((c.from === userId || c.to === userId) && ["invited", "room_ready", "active"].includes(c.status)) {
          active.push({
            callId: c.callId,
            from: c.from,
            to: c.to,
            status: c.status,
            roomId: c.roomId,
            roomPassword: c.roomPassword,
            updatedAt: c.updatedAt,
          });
        }
      }
      ack?.({ ok: true, calls: active });
    });

    socket.on("disconnect", () => {
      const uid = socket.data.userId;
      if (uid && online.get(uid) === socket.id) {
        online.delete(uid);
      }
    });
  });

  return io;
}

module.exports = { createCallSignaling };


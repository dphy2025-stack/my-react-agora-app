const { Server } = require("socket.io");
const { randomUUID } = require("crypto");

function createCallSignaling(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const userSockets = new Map();
  const calls = new Map();

  const emitToUser = (userId, event, payload) => {
    if (!userId) return;
    io.to(`user:${userId}`).emit(event, payload);
  };

  const removeSocketFromUser = (userId, socketId) => {
    if (!userId || !socketId) return;
    const sockets = userSockets.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userId);
    }
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

      const bothJoined = c.joined[c.from] && c.joined[c.to];
      if (bothJoined || c.status === "ended" || c.status === "cancelled") {
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
      const prevUserId = socket.data.userId;
      if (prevUserId && prevUserId !== userId) {
        removeSocketFromUser(prevUserId, socket.id);
        socket.leave(`user:${prevUserId}`);
      }
      const sockets = userSockets.get(userId) || new Set();
      sockets.add(socket.id);
      userSockets.set(userId, sockets);
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
        roomDeliveredBySocket: {},
        joined: {},
        joinedBySocket: {},
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
      if (userId !== c.from && userId !== c.to) {
        ack?.({ ok: false });
        return;
      }
      c.roomDeliveredBySocket[socket.id] = Date.now();
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
      if (userId !== c.from && userId !== c.to) {
        ack?.({ ok: false });
        return;
      }
      if (!["room_ready", "active"].includes(c.status)) {
        ack?.({ ok: false });
        return;
      }
      c.joinedBySocket[socket.id] = Date.now();
      c.joined[userId] = true;
      c.updatedAt = Date.now();
      if (c.joined[c.from] && c.joined[c.to]) {
        c.status = "active";
      }
      ack?.({ ok: true });
    });

    socket.on("call:leave", ({ callId }, ack) => {
      const userId = socket.data.userId;
      const c = calls.get(callId);
      if (!c || !userId) {
        ack?.({ ok: false });
        return;
      }
      if (userId !== c.from && userId !== c.to) {
        ack?.({ ok: false });
        return;
      }
      c.status = "ended";
      c.updatedAt = Date.now();
      const peer = c.from === userId ? c.to : c.from;
      emitToUser(peer, "call:ended", {
        callId: c.callId,
        by: userId,
        reason: "left",
        ts: Date.now(),
      });
      calls.delete(callId);
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
      if (!uid) return;
      removeSocketFromUser(uid, socket.id);
      if (userSockets.has(uid)) return;

      for (const [callId, c] of calls.entries()) {
        if (!["invited", "room_ready", "active"].includes(c.status)) continue;
        if (c.from !== uid && c.to !== uid) continue;
        c.status = "ended";
        c.updatedAt = Date.now();
        const peer = c.from === uid ? c.to : c.from;
        emitToUser(peer, "call:ended", {
          callId: c.callId,
          by: uid,
          reason: "disconnect",
          ts: Date.now(),
        });
        calls.delete(callId);
      }
    });
  });

  return io;
}

module.exports = { createCallSignaling };

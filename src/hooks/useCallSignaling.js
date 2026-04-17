import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export function useCallSignaling({ userId, onIncoming, joinAgoraRoom }) {
  const socketRef = useRef(null);
  const joiningRef = useRef(false);
  const joinedCallRef = useRef(null);

  const safeJoin = async (payload) => {
    if (!payload?.callId || !payload?.roomId || !payload?.roomPassword) return;
    if (joiningRef.current) return;
    if (joinedCallRef.current === payload.callId) return;
    joiningRef.current = true;
    try {
      await joinAgoraRoom(payload);
      joinedCallRef.current = payload.callId;
      socketRef.current?.emit("call:joined", { callId: payload.callId }, () => {});
      socketRef.current?.emit("call:room:ack", { callId: payload.callId }, () => {});
    } finally {
      joiningRef.current = false;
    }
  };

  useEffect(() => {
    if (!userId) return undefined;
    const url = process.env.REACT_APP_SIGNALING_URL;
    if (!url) return undefined;

    const socket = io(url, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
    });
    socketRef.current = socket;

    const handleConnect = () => {
      socket.emit("auth:bind", { userId });
      socket.emit("call:sync", {}, (res) => {
        if (!res?.ok || !Array.isArray(res.calls)) return;
        const roomReady = res.calls.find((c) => c.status === "room_ready" && c.roomId && c.roomPassword);
        if (roomReady) {
          safeJoin({
            callId: roomReady.callId,
            roomId: roomReady.roomId,
            roomPassword: roomReady.roomPassword,
          });
        }
      });
    };
    socket.on("connect", handleConnect);

    if (typeof onIncoming === "function") {
      socket.on("call:incoming", onIncoming);
    }

    const handleRoom = async (payload) => {
      await safeJoin(payload);
    };
    socket.on("call:room", handleRoom);

    const handleEnded = (payload) => {
      if (payload?.callId && joinedCallRef.current === payload.callId) {
        joinedCallRef.current = null;
      }
      joiningRef.current = false;
    };
    socket.on("call:ended", handleEnded);

    return () => {
      socket.off("connect", handleConnect);
      if (typeof onIncoming === "function") {
        socket.off("call:incoming", onIncoming);
      }
      socket.off("call:room", handleRoom);
      socket.off("call:ended", handleEnded);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, onIncoming, joinAgoraRoom]);

  return {
    invite: (to) =>
      new Promise((resolve) => {
        socketRef.current?.emit("call:invite", { to }, resolve);
      }),
    accept: (callId) =>
      new Promise((resolve) => {
        socketRef.current?.emit("call:accept", { callId }, resolve);
      }),
    sync: () =>
      new Promise((resolve) => {
        socketRef.current?.emit("call:sync", {}, resolve);
      }),
    leave: (callId) =>
      new Promise((resolve) => {
        if (callId && joinedCallRef.current === callId) {
          joinedCallRef.current = null;
        }
        joiningRef.current = false;
        socketRef.current?.emit("call:leave", { callId }, resolve);
      }),
  };
}

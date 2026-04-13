import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { initializeApp } from "firebase/app";
import { getDatabase, onValue, ref, remove, set } from "firebase/database";
import {
  CallEnd,
  Circle,
  ContentCopy,
  FiberManualRecord,
  GraphicEq,
  Hearing,
  Mic,
  MicOff,
  Settings,
  Stop,
  Translate,
  VolumeDown,
  VolumeUp,
} from "@mui/icons-material";
import PersonIcon from "@mui/icons-material/Person";
import notificationSound from "./assets/welcomeNotif.mp3";
import recordingSound from "./assets/Recording.mp3";
import "./App.css";

const firebaseConfig = {
  apiKey: "AIzaSyAfZxkA95CrbDyxr6MBUUa7Q4p2AVSm0Ro",
  authDomain: "react-agora-app.firebaseapp.com",
  projectId: "react-agora-app",
  storageBucket: "react-agora-app.firebasestorage.app",
  messagingSenderId: "49930046765",
  appId: "1:49930046765:web:07cc02c5fd0774b51917a4",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const APP_ID = process.env.REACT_APP_AGORA_APP_ID || "717d9262657d4caab56f3d8a9a7b2089";
const ADMIN_BACKEND_STORAGE_KEY = "voice_call_admin_backend_url";
const ENV_BACKEND_URL = process.env.REACT_APP_TOKEN_SERVER_URL || "";
const LOCAL_BACKEND_URL = "https://surviving-phoenix-suspend.ngrok-free.dev";

const toRoomKey = (value) =>
  value
    .trim()
    .split("")
    .map((char) => (".#$[]/".includes(char) ? "_" : char))
    .join("")
    .toLowerCase();

const withTimeout = async (url, options = {}, timeoutMs = 4000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const qualityLabel = (quality, t) => {
  if (quality <= 1) return t.perfect;
  if (quality <= 3) return t.good;
  if (quality <= 5) return t.medium;
  return t.weak;
};

const qualityColor = (qualityText, t) => {
  if (qualityText === t.perfect) return "#22c55e";
  if (qualityText === t.good) return "#84cc16";
  if (qualityText === t.medium) return "#f59e0b";
  if (qualityText === t.weak) return "#ef4444";
  return "#94a3b8";
};

const isHttpUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^https?:\/\/.+/i.test(trimmed);
};

const App = () => {
  const [language, setLanguage] = useState("fa");
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [roomMode, setRoomMode] = useState("create");

  const [adminBackendUrl, setAdminBackendUrl] = useState(() => {
    return localStorage.getItem(ADMIN_BACKEND_STORAGE_KEY) || ENV_BACKEND_URL;
  });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeBackendUrl, setActiveBackendUrl] = useState("");

  const [inCall, setInCall] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micLowered, setMicLowered] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState("-");
  const [usersInCall, setUsersInCall] = useState({});
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [userUID, setUserUID] = useState(null);
  const [activeRoomName, setActiveRoomName] = useState("");
  const [activeRoomKey, setActiveRoomKey] = useState("");

  const [client] = useState(() => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }));

  const localTrackRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const titleTapRef = useRef({ count: 0, lastAt: 0 });
  const previousUserIdsRef = useRef([]);
  const joinSoundRef = useRef(new Audio(notificationSound));
  const recordingSoundRef = useRef(new Audio(recordingSound));

  const translations = {
    fa: {
      title: "تماس صوتی خصوصی",
      subtitle: "اتصال امن روم خصوصی برای تماس سریع",
      enterName: "نام کاربر",
      enterRoomName: "اسم روم",
      enterRoomPassword: "گذرواژه روم",
      createRoom: "ساخت روم",
      joinRoom: "ورود به روم",
      startCall: "شروع تماس",
      joining: "در حال اتصال...",
      users: "کاربران حاضر",
      mute: "قطع صدا",
      unmute: "وصل صدا",
      lowerMic: "کاهش میکروفون",
      normalMic: "حالت عادی میکروفون",
      record: "شروع ضبط",
      stopRecord: "توقف ضبط",
      leaveCall: "خروج از تماس",
      roomInfo: "کد دعوت روم",
      copyInvite: "کپی کد",
      copied: "کپی شد",
      connectionQuality: "کیفیت اتصال",
      perfect: "عالی",
      good: "خوب",
      medium: "متوسط",
      weak: "ضعیف",
      nameRequired: "نام کاربر را وارد کنید",
      roomNameRequired: "اسم روم را وارد کنید",
      roomPasswordRequired: "گذرواژه روم را وارد کنید",
      backendNotReachable:
        "بک‌اند در دسترس نیست. اول Node backend را اجرا کن و بعد ngrok را وصل کن.",
      backendTokenError: "دریافت توکن از بک‌اند انجام نشد.",
      appIdError: "APP_ID برای Agora تنظیم نشده است.",
      adminAccessHint: "برای پنل مخفی ngrok، روی عنوان 5 بار سریع بزن.",
      adminPanelTitle: "تنظیم مخفی بک‌اند",
      adminBackendLabel: "آدرس بک‌اند (ngrok یا localhost)",
      adminSave: "ذخیره",
      adminClose: "بستن",
      adminGuide:
        "راهنما: اگر بک‌اند را دستی اجرا می‌کنی همین localhost:5000 کافی است. برای دسترسی بیرونی، ngrok http 5000 بزن و لینک https را ذخیره کن.",
      backendConnected: "بک‌اند فعال",
      backendInvalidUrl: "آدرس بک‌اند معتبر نیست. باید با http:// یا https:// شروع شود.",
      recordingStarted: "ضبط تماس شروع شد",
      recordingStopped: "ضبط تماس متوقف شد",
      waitingBackend: "انتظار برای پاسخ بک‌اند...",
    },
    en: {
      title: "Private Voice Call",
      subtitle: "Fast private-room voice call",
      enterName: "Username",
      enterRoomName: "Room name",
      enterRoomPassword: "Room password",
      createRoom: "Create room",
      joinRoom: "Join room",
      startCall: "Start call",
      joining: "Connecting...",
      users: "Users in call",
      mute: "Mute",
      unmute: "Unmute",
      lowerMic: "Lower mic",
      normalMic: "Normal mic",
      record: "Start recording",
      stopRecord: "Stop recording",
      leaveCall: "Leave call",
      roomInfo: "Room invite code",
      copyInvite: "Copy code",
      copied: "Copied",
      connectionQuality: "Connection quality",
      perfect: "Perfect",
      good: "Good",
      medium: "Medium",
      weak: "Weak",
      nameRequired: "Please enter your name",
      roomNameRequired: "Please enter room name",
      roomPasswordRequired: "Please enter room password",
      backendNotReachable:
        "Backend is not reachable. Start Node backend and then connect ngrok.",
      backendTokenError: "Failed to get token from backend.",
      appIdError: "Agora APP_ID is not configured.",
      adminAccessHint: "Tap the title 5 times to open hidden ngrok panel.",
      adminPanelTitle: "Hidden Backend Settings",
      adminBackendLabel: "Backend URL (ngrok or localhost)",
      adminSave: "Save",
      adminClose: "Close",
      adminGuide:
        "Guide: for manual local backend, localhost:5000 is enough. For external access, run ngrok http 5000 and save the HTTPS URL here.",
      backendConnected: "Connected backend",
      backendInvalidUrl: "Backend URL is invalid. It must start with http:// or https://",
      recordingStarted: "Recording started",
      recordingStopped: "Recording stopped",
      waitingBackend: "Waiting for backend...",
    },
  };

  const t = translations[language];

  useEffect(() => {
    localStorage.setItem(ADMIN_BACKEND_STORAGE_KEY, adminBackendUrl.trim());
  }, [adminBackendUrl]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "u") {
        setShowAdminPanel((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!activeRoomKey) return undefined;

    const usersRef = ref(db, `callUsers/${activeRoomKey}`);
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const newIds = Object.keys(data);
      const previousIds = previousUserIdsRef.current;
      const addedIds = newIds.filter((id) => !previousIds.includes(id));

      if (inCall && addedIds.some((id) => Number(id) !== Number(userUID))) {
        joinSoundRef.current.currentTime = 0;
        joinSoundRef.current.volume = 0.35;
        joinSoundRef.current.play().catch(() => {});
      }

      previousUserIdsRef.current = newIds;
      setUsersInCall(data);
    });

    return () => unsubscribe();
  }, [activeRoomKey, inCall, userUID]);

  useEffect(() => {
    if (!activeRoomKey) return undefined;

    const recordingRef = ref(db, `recordingStatus/${activeRoomKey}`);
    const unsubscribe = onValue(recordingRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.isRecording) {
        recordingSoundRef.current.currentTime = 0;
        recordingSoundRef.current.volume = 0.8;
        recordingSoundRef.current.play().catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [activeRoomKey]);

  useEffect(() => {
    if (!inCall) {
      setTimer(0);
      return undefined;
    }

    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [inCall]);

  useEffect(() => {
    if (!inCall) return undefined;

    const handleQuality = (stats) => {
      const worst = Math.max(stats.uplinkNetworkQuality || 0, stats.downlinkNetworkQuality || 0);
      setConnectionQuality(qualityLabel(worst, t));
    };

    client.on("network-quality", handleQuality);
    return () => client.off("network-quality", handleQuality);
  }, [client, inCall, t]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (userUID && activeRoomKey) {
        remove(ref(db, `callUsers/${activeRoomKey}/${userUID}`)).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeRoomKey, userUID]);

  const backendCandidates = useMemo(() => {
    return [adminBackendUrl, ENV_BACKEND_URL, LOCAL_BACKEND_URL]
      .map((item) => item.trim())
      .filter(Boolean);
  }, [adminBackendUrl]);

  const resolveBackendBaseUrl = useCallback(async () => {
    for (const baseUrl of backendCandidates) {
      if (!isHttpUrl(baseUrl)) continue;

      try {
        const cleanUrl = baseUrl.replace(/\/+$/, "");
        const healthRes = await withTimeout(`${cleanUrl}/health`, { method: "GET" }, 3500);
        if (healthRes.ok) {
          return cleanUrl;
        }
      } catch (_error) {
        // try next
      }
    }

    throw new Error(t.backendNotReachable);
  }, [backendCandidates, t.backendNotReachable]);

  const requestToken = useCallback(async () => {
    const baseUrl = await resolveBackendBaseUrl();

    const response = await withTimeout(
      `${baseUrl}/api/rooms/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: roomMode,
          roomName: roomName.trim(),
          roomPassword: roomPassword.trim(),
        }),
      },
      9000
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || t.backendTokenError);
    }

    setActiveBackendUrl(baseUrl);
    return data;
  }, [resolveBackendBaseUrl, roomMode, roomName, roomPassword, t.backendTokenError]);

  const joinCall = useCallback(async () => {
    if (!APP_ID) {
      alert(t.appIdError);
      return;
    }

    if (!username.trim()) {
      alert(t.nameRequired);
      return;
    }

    if (!roomName.trim()) {
      alert(t.roomNameRequired);
      return;
    }

    if (!roomPassword.trim()) {
      alert(t.roomPasswordRequired);
      return;
    }

    if (!backendCandidates.length) {
      alert(t.backendNotReachable);
      return;
    }

    if (adminBackendUrl && !isHttpUrl(adminBackendUrl)) {
      alert(t.backendInvalidUrl);
      return;
    }

    setJoining(true);

    try {
      const tokenPayload = await requestToken();
      const { token, uid, roomName: finalRoomName } = tokenPayload;
      const finalName = finalRoomName || roomName.trim();
      const finalRoomKey = toRoomKey(finalName);

      const joinedUid = await client.join(APP_ID, finalName, token, uid);
      setUserUID(joinedUid);

      const localTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
      localTrackRef.current = localTrack;
      await client.publish([localTrack]);
      client.enableAudioVolumeIndicator();

      await set(ref(db, `callUsers/${finalRoomKey}/${joinedUid}`), username.trim());

      client.on("volume-indicator", (levels) => {
        const next = {};
        levels.forEach((item) => {
          next[item.uid] = (item.level || 0) > 3;
        });
        setSpeakingUsers((prev) => ({ ...prev, ...next }));
      });

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio") {
          user.audioTrack.play();
        }
      });

      client.on("user-left", async (user) => {
        await remove(ref(db, `callUsers/${finalRoomKey}/${user.uid}`)).catch(() => {});
      });

      setActiveRoomName(finalName);
      setActiveRoomKey(finalRoomKey);
      previousUserIdsRef.current = [String(joinedUid)];
      setInCall(true);
      setConnectionQuality("-");
    } catch (error) {
      alert(error.message || t.backendTokenError);
    } finally {
      setJoining(false);
    }
  }, [
    adminBackendUrl,
    backendCandidates.length,
    client,
    requestToken,
    roomName,
    roomPassword,
    t.appIdError,
    t.backendInvalidUrl,
    t.backendNotReachable,
    t.backendTokenError,
    t.nameRequired,
    t.roomNameRequired,
    t.roomPasswordRequired,
    username,
  ]);

  const toggleMute = useCallback(async () => {
    const track = localTrackRef.current;
    if (!track) return;
    await track.setEnabled(isMuted);
    setIsMuted((prev) => !prev);
  }, [isMuted]);

  const toggleMicVolume = useCallback(() => {
    const track = localTrackRef.current;
    if (!track) return;

    if (micLowered) {
      track.setVolume(100);
      setMicLowered(false);
    } else {
      track.setVolume(20);
      setMicLowered(true);
    }
  }, [micLowered]);

  const toggleRecording = useCallback(async () => {
    const track = localTrackRef.current;
    if (!track || !activeRoomKey) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      await set(ref(db, `recordingStatus/${activeRoomKey}`), {
        isRecording: false,
        by: userUID || null,
        at: Date.now(),
      });
      alert(t.recordingStopped);
      return;
    }

    const recorder = new MediaRecorder(new MediaStream([track.getMediaStreamTrack()]), {
      mimeType: "audio/webm",
    });
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `record_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    await set(ref(db, `recordingStatus/${activeRoomKey}`), {
      isRecording: true,
      by: userUID || null,
      at: Date.now(),
    });

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    alert(t.recordingStarted);
  }, [activeRoomKey, isRecording, t.recordingStarted, t.recordingStopped, userUID]);

  const leaveCall = useCallback(async () => {
    try {
      mediaRecorderRef.current?.stop();
      localTrackRef.current?.stop();
      localTrackRef.current?.close();
      await client.leave();
    } finally {
      if (activeRoomKey) {
        await set(ref(db, `recordingStatus/${activeRoomKey}`), {
          isRecording: false,
          by: userUID || null,
          at: Date.now(),
        }).catch(() => {});
      }

      if (userUID && activeRoomKey) {
        await remove(ref(db, `callUsers/${activeRoomKey}/${userUID}`)).catch(() => {});
      }

      setInCall(false);
      setIsMuted(false);
      setMicLowered(false);
      setIsRecording(false);
      setUsersInCall({});
      setSpeakingUsers({});
      setConnectionQuality("-");
      setActiveRoomName("");
      setActiveRoomKey("");
      setUserUID(null);
    }
  }, [activeRoomKey, client, userUID]);

  const inviteCode = useMemo(() => {
    if (!activeRoomName || !roomPassword.trim()) return "-";
    return `${activeRoomName} | ${roomPassword.trim()}`;
  }, [activeRoomName, roomPassword]);

  const copyInviteCode = useCallback(async () => {
    if (!activeRoomName || !roomPassword.trim()) return;
    await navigator.clipboard.writeText(inviteCode);
    alert(t.copied);
  }, [activeRoomName, inviteCode, roomPassword, t.copied]);

  const onTitleSecretTap = useCallback(() => {
    const now = Date.now();
    const prev = titleTapRef.current;
    const withinWindow = now - prev.lastAt < 1800;
    const nextCount = withinWindow ? prev.count + 1 : 1;

    titleTapRef.current = { count: nextCount, lastAt: now };

    if (nextCount >= 5) {
      setShowAdminPanel((state) => !state);
      titleTapRef.current = { count: 0, lastAt: 0 };
    }
  }, []);

  const saveAdminBackend = useCallback(() => {
    const value = adminBackendUrl.trim();
    if (!value) {
      setAdminBackendUrl("");
      alert(t.copied);
      return;
    }
    if (!isHttpUrl(value)) {
      alert(t.backendInvalidUrl);
      return;
    }
    setAdminBackendUrl(value);
    alert(t.copied);
  }, [adminBackendUrl, t.backendInvalidUrl, t.copied]);

  if (!inCall) {
    return (
      <div className="entry-screen">
        <button className="lang-toggle" onClick={() => setLanguage(language === "fa" ? "en" : "fa")}>
          <Translate fontSize="small" />
          {language === "fa" ? "English" : "فارسی"}
        </button>

        <div className="entry-card">
          <h1 className="entry-title" onClick={onTitleSecretTap}>
            {t.title}
          </h1>
          <p className="entry-subtitle">{t.subtitle}</p>

          <input
            dir={language === "fa" ? "rtl" : "ltr"}
            className="nameInput"
            placeholder={t.enterName}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <input
            dir={language === "fa" ? "rtl" : "ltr"}
            className="nameInput"
            placeholder={t.enterRoomName}
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
          />

          <input
            dir={language === "fa" ? "rtl" : "ltr"}
            className="nameInput"
            type="password"
            placeholder={t.enterRoomPassword}
            value={roomPassword}
            onChange={(event) => setRoomPassword(event.target.value)}
          />

          <div className="mode-grid">
            <button
              className={`btn-gradient ${roomMode === "create" ? "mode-active" : ""}`}
              onClick={() => setRoomMode("create")}
            >
              {t.createRoom}
            </button>
            <button
              className={`btn-gradient ${roomMode === "join" ? "mode-active" : ""}`}
              onClick={() => setRoomMode("join")}
            >
              {t.joinRoom}
            </button>
          </div>

          <button className="start-btn" onClick={joinCall} disabled={joining}>
            {joining ? t.waitingBackend : t.startCall}
          </button>

          <p className="hint-text">{t.adminAccessHint}</p>
          {activeBackendUrl ? <p className="backend-badge">{t.backendConnected}: {activeBackendUrl}</p> : null}

          {showAdminPanel ? (
            <div className="admin-panel">
              <div className="admin-title">
                <Settings fontSize="small" />
                {t.adminPanelTitle}
              </div>

              <input
                dir="ltr"
                className="nameInput"
                placeholder={t.adminBackendLabel}
                value={adminBackendUrl}
                onChange={(event) => setAdminBackendUrl(event.target.value)}
              />

              <p className="admin-guide">{t.adminGuide}</p>

              <div className="admin-grid">
                <button className="btn-gradient" onClick={saveAdminBackend}>
                  {t.adminSave}
                </button>
                <button className="btn-gradient" onClick={() => setShowAdminPanel(false)}>
                  {t.adminClose}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="call-screen">
      <div className="call-card">
        <div className="call-header">
          <h3>{activeRoomName}</h3>
          <div className="quality-pill" style={{ color: qualityColor(connectionQuality, t) }}>
            <Circle sx={{ fontSize: 11 }} />
            {t.connectionQuality}: {connectionQuality}
          </div>
        </div>

        <div className="timer-row">
          <GraphicEq sx={{ color: "#8ec5ff" }} />
          <span>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</span>
        </div>

        <div className="invite-box">
          <p>{t.roomInfo}</p>
          <strong>{inviteCode}</strong>
          <button className="copy-btn" onClick={copyInviteCode}>
            <ContentCopy fontSize="small" />
            {t.copyInvite}
          </button>
        </div>

        <div className="users-box">
          <h4>
            <PersonIcon fontSize="small" /> {t.users} ({Object.keys(usersInCall).length})
          </h4>
          <div className="users-list">
            {Object.keys(usersInCall).map((uid) => (
              <div
                key={uid}
                className="user-chip"
                style={{
                  background: speakingUsers[uid] ? "linear-gradient(135deg, #0f3f2f 0%, #0a2d22 100%)" : "rgba(255,255,255,0.08)",
                  border: speakingUsers[uid] ? "1px solid rgba(74, 222, 128, 0.5)" : "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <span>{usersInCall[uid]}</span>
                {speakingUsers[uid] ? <Hearing fontSize="small" sx={{ color: "#4ade80" }} /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="control-grid">
          <button className="control-btn" onClick={toggleMute}>
            {isMuted ? <MicOff /> : <Mic />} {isMuted ? t.unmute : t.mute}
          </button>

          <button className="control-btn" onClick={toggleMicVolume}>
            {micLowered ? <VolumeUp /> : <VolumeDown />} {micLowered ? t.normalMic : t.lowerMic}
          </button>

          <button className="control-btn" onClick={toggleRecording}>
            {isRecording ? <Stop /> : <FiberManualRecord />} {isRecording ? t.stopRecord : t.record}
          </button>

          <button className="control-btn leave" onClick={leaveCall}>
            <CallEnd /> {t.leaveCall}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import swal from "sweetalert";
import { initializeApp } from "firebase/app";
import { get, getDatabase, onDisconnect, onValue, ref, remove, set, update } from "firebase/database";
import {
  AccountCircle,
  CallEnd,
  Circle,
  CloudOff,
  CloudQueue,
  CloudDone,
  ContentCopy,
  FiberManualRecord,
  GraphicEq,
  Mic,
  MicOff,
  PhotoCamera,
  Settings,
  Stop,
  Tune,
  VolumeDown,
  VolumeUp,
  PersonRemove,
  Block,
  Check,
  PhoneInTalk,
  Badge,
  Cake,
  Close,
  History,
  NotificationsOff,
  Person,
  Info,
  Visibility,
  VisibilityOff,
  Group,
  PersonOff,
  DeleteForever,
} from "@mui/icons-material";
import PersonIcon from "@mui/icons-material/Person";
import notificationSound from "./assets/welcomeNotif.mp3";
import recordingSound from "./assets/Recording.mp3";
import ringtone1 from "./assets/Ringtones/ringtone_1.mp3";
import ringtone2 from "./assets/Ringtones/ringtone_2.mp3";
import ringtone3 from "./assets/Ringtones/ringtone_3.mp3";
import ringtone4 from "./assets/Ringtones/ringtone_4.mp3";
import ringtone5 from "./assets/Ringtones/ringtone_5.mp3";
import ringtone6 from "./assets/Ringtones/ringtone_6.mp3";
import appLogo from "./assets/logo image/ChatGPT Image Apr 15, 2026, 02_26_15 PM.png";
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
const APP_DISPLAY_NAME = "Happy Talk";
const ADMIN_BACKEND_STORAGE_KEY = "voice_call_admin_backend_url";
const PROFILE_STORAGE_KEY = "voice_call_profile_id";
const BUTTON_HOVER_COLOR_STORAGE_KEY = "happy_talk_button_hover_color";
const BACKEND_ONBOARDING_KEY = "happy_talk_backend_onboarding_done";
const LOCAL_BACKEND_URL = "http://localhost:5000";
const TOKEN_ENDPOINT_PATHS = ["/api/rooms/token", "/rooms/token", "/api/token"];
const PROFILE_LOADING_MIN_MS = 3000;
const ACTIVE_SESSION_TTL_MS = 20 * 1000;
const ROOM_LIFETIME_MS = 3 * 60 * 60 * 1000;
const ROOM_EMPTY_CLEANUP_DELAY_MS = 5 * 1000;
const DEFAULT_PROFILE_COLOR = "#10b981";
const PROFILE_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#22c55e",
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#e11d48",
];
const PROFILE_EMOJIS = [
  "🙂", "😊", "🤝", "💙", "💕", "🎧", "✨", "🦊", "🐼", "🐯", "🌸", "🚀", "🎤", "🎵", "🧠", "🍀",
  "🦁", "🐨", "🐶", "🐱", "🫶", "💫", "⚡", "🎯", "🏰", "🏡", "💎", "🖊️", "🌈", "🌙", "☀️", "🧩",
  "🥷", "👑", "🦄", "🐙", "🐬", "🧸", "🎮", "📚", "✈️", "🏔️", "🌊", "🍁", "🍉", "🥑", "☕", "🍪",
];

const STABILITY_MODES = {
  balanced: "balanced",
  higher: "higher",
  high: "high",
  ultra: "ultra",
};
const CONTACT_REQUEST_STATUS = {
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
};
const NETWORK_STATUS = {
  good: "good",
  weak: "weak",
  offline: "offline",
};
const INVITE_TTL_MS = 2 * 60 * 1000;
const SPEAKING_LEVEL_THRESHOLD = 17;
const CALL_USER_STALE_MS = 90 * 1000;
const AGORA_JOIN_TIMEOUT_MS = 25 * 1000;
const AGORA_PUBLISH_TIMEOUT_MS = 15 * 1000;
const CALL_PROGRESS_TIMEOUT_MS = 30 * 1000;
const RINGTONES = {
  ringtone_1: ringtone1,
  ringtone_2: ringtone2,
  ringtone_3: ringtone3,
  ringtone_4: ringtone4,
  ringtone_5: ringtone5,
  ringtone_6: ringtone6,
};

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

const withPromiseTimeout = (promise, timeoutMs, timeoutMessage = "Operation timed out") => {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

const applyTrackMutedState = async (track, muted) => {
  if (!track) return false;
  if (typeof track.setMuted === "function") {
    try {
      await track.setMuted(Boolean(muted));
      return true;
    } catch (_error) {
      // fallback below
    }
  }
  if (typeof track.setEnabled === "function") {
    try {
      await track.setEnabled(!Boolean(muted));
      return true;
    } catch (_error) {
      return false;
    }
  }
  return false;
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

const generateProfileId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

const generatePublicUid = () => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const tail = Date.now().toString(36).slice(-4).toUpperCase();
  return `VC-${random}${tail}`;
};

const randomRoomValue = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) {
    return { r: 16, g: 185, b: 129 };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
};

const shadeColor = (hex, amount) => {
  const { r, g, b } = hexToRgb(hex);
  const nextR = clamp(Math.round(r + (255 - r) * amount), 0, 255);
  const nextG = clamp(Math.round(g + (255 - g) * amount), 0, 255);
  const nextB = clamp(Math.round(b + (255 - b) * amount), 0, 255);
  return `rgb(${nextR}, ${nextG}, ${nextB})`;
};

const hexToRgba = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const buildSoftCardStyle = (baseColor, startAlpha = 0.24, endAlpha = 0.14, borderLight = 0.2) => ({
  background: `linear-gradient(130deg, ${hexToRgba(baseColor, startAlpha)} 0%, ${hexToRgba(baseColor, endAlpha)} 100%)`,
  borderColor: shadeColor(baseColor, borderLight),
});

const calcAge = (birthDate) => {
  if (!birthDate) return "-";
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? age : "-";
};

const normalizeCallUser = (rawValue) => {
  if (!rawValue) {
    return {
      name: "User",
      color: DEFAULT_PROFILE_COLOR,
      avatar: "",
      stabilityMode: STABILITY_MODES.balanced,
      networkStatus: NETWORK_STATUS.good,
      lastSeen: 0,
      uid: "",
      profileId: "",
      gender: "not_set",
      birthDate: "",
      emoji: "",
      adminMuted: false,
      socketId: "",
      agoraUid: "",
    };
  }

  if (typeof rawValue === "string") {
    return {
      name: rawValue,
      color: DEFAULT_PROFILE_COLOR,
      avatar: "",
      stabilityMode: STABILITY_MODES.balanced,
      networkStatus: NETWORK_STATUS.good,
      lastSeen: 0,
      uid: "",
      profileId: "",
      gender: "not_set",
      birthDate: "",
      emoji: "",
      adminMuted: false,
      socketId: "",
      agoraUid: "",
    };
  }

  return {
    name: rawValue.name || "User",
    color: rawValue.color || DEFAULT_PROFILE_COLOR,
    avatar: rawValue.avatar || "",
    stabilityMode: rawValue.stabilityMode || STABILITY_MODES.balanced,
    networkStatus: rawValue.networkStatus || NETWORK_STATUS.good,
    lastSeen: rawValue.lastSeen || 0,
    uid: rawValue.uid || "",
    profileId: rawValue.profileId || "",
    gender: rawValue.gender || "not_set",
    birthDate: rawValue.birthDate || "",
    emoji: rawValue.emoji || "",
    adminMuted: Boolean(rawValue.adminMuted),
    socketId: rawValue.socketId || "",
    agoraUid: rawValue.agoraUid ?? "",
  };
};

const inviteEventTs = (item) =>
  Number(item?.roomCreatedAt || item?.respondedAt || item?.createdAt || 0);

const App = () => {
  const androidVersion = useMemo(() => {
    if (typeof navigator === "undefined") return 0;
    const ua = navigator.userAgent || "";
    const match = ua.match(/Android\s+(\d+)/i);
    return match ? Number(match[1] || 0) : 0;
  }, []);
  const isLegacyAndroid = androidVersion > 0 && androidVersion <= 8;

  const [language, setLanguage] = useState("en");
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [showRoomPassword, setShowRoomPassword] = useState(false);
  const [roomMode, setRoomMode] = useState("create");
  const [screen, setScreen] = useState("entry");
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settingsTab, setSettingsTab] = useState("backend");
  const [theme, setTheme] = useState("dark");
  const [fontChoice, setFontChoice] = useState("vazirmatn");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileId, setProfileId] = useState(() => localStorage.getItem(PROFILE_STORAGE_KEY) || "");
  const [profileUid, setProfileUid] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileEmoji, setProfileEmoji] = useState("");
  const [selectedRingtone, setSelectedRingtone] = useState("ringtone_1");
  const [showRingtoneModal, setShowRingtoneModal] = useState(false);
  const [profileColor, setProfileColor] = useState(DEFAULT_PROFILE_COLOR);
  const [buttonHoverColor, setButtonHoverColor] = useState(
    () => localStorage.getItem(BUTTON_HOVER_COLOR_STORAGE_KEY) || "#13b57f"
  );
  const [stabilityMode, setStabilityMode] = useState(STABILITY_MODES.balanced);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [profileGender, setProfileGender] = useState("not_set");
  const [profileBirthDate, setProfileBirthDate] = useState("");
  const [profileCallSeconds, setProfileCallSeconds] = useState(0);
  const [profileSpeakingSeconds, setProfileSpeakingSeconds] = useState(0);
  const [profileHistory, setProfileHistory] = useState([]);
  const [contacts, setContacts] = useState({});
  const [contactsPresence, setContactsPresence] = useState({});
  const [blockedContacts, setBlockedContacts] = useState({});
  const [contactRequests, setContactRequests] = useState([]);
  const [searchUid, setSearchUid] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showMissedPanel, setShowMissedPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [missedCalls, setMissedCalls] = useState([]);
  const [pendingNotifications, setPendingNotifications] = useState(0);
  const [showGroupLobby, setShowGroupLobby] = useState(false);
  const [groupLobbyId, setGroupLobbyId] = useState("");
  const [groupLobbyMembers, setGroupLobbyMembers] = useState({});
  const [groupInviteBusy, setGroupInviteBusy] = useState(false);
  const [incomingGroupInvites, setIncomingGroupInvites] = useState([]);
  const [isRoomAdmin, setIsRoomAdmin] = useState(false);
  const [adminMuteLocked, setAdminMuteLocked] = useState(false);
  const [groupLobbyMeta, setGroupLobbyMeta] = useState(null);
  const [groupSearchUid, setGroupSearchUid] = useState("");
  const [groupSearchResult, setGroupSearchResult] = useState(null);
  const [pendingGroupJoin, setPendingGroupJoin] = useState(null);
  const [outgoingCallRequest, setOutgoingCallRequest] = useState(null);
  const [isGroupCallSession, setIsGroupCallSession] = useState(false);
  const [isInviteRequestRoomSession, setIsInviteRequestRoomSession] = useState(false);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStabilityPicker, setShowStabilityPicker] = useState(false);
  const [shouldAutoOpenBackendAfterProfileSave, setShouldAutoOpenBackendAfterProfileSave] = useState(false);

  const [adminBackendUrl, setAdminBackendUrl] = useState(() => {
    return localStorage.getItem(ADMIN_BACKEND_STORAGE_KEY) || LOCAL_BACKEND_URL;
  });
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
  const [localNetworkStatus, setLocalNetworkStatus] = useState(NETWORK_STATUS.good);
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [selectedCallUser, setSelectedCallUser] = useState(null);

  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: isLegacyAndroid ? "h264" : "vp8" })
  );

  const localTrackRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const previousUserIdsRef = useRef([]);
  const joinSoundRef = useRef(new Audio(notificationSound));
  const recordingSoundRef = useRef(new Audio(recordingSound));
  const avatarInputRef = useRef(null);
  const ringtonePreviewRef = useRef(null);
  const incomingRingtoneRef = useRef(null);
  const outgoingRequestDialogOpenRef = useRef(false);
  const incomingJoinDialogOpenRef = useRef(false);
  const handledRoomReadyInviteRef = useRef({});
  const handledIncomingInviteRef = useRef({});
  const groupCreatingDialogOpenRef = useRef(false);
  const activeSessionIdRef = useRef("");
  const speakingSecondsRef = useRef(0);
  const callParticipantsRef = useRef({});
  const callUserDisconnectRef = useRef(null);
  const sessionInstanceRef = useRef(`sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const lobbyStatusRef = useRef("");
  const joinInFlightRef = useRef(false);
  const joinInFlightStartedAtRef = useRef(0);
  const callProgressDialogOpenRef = useRef(false);
  const callProgressTimerRef = useRef(null);
  const groupCreatingTimerRef = useRef(null);
  const callProgressContentRef = useRef("");
  const receiverJoinFlowRef = useRef({ callId: "", joining: false });
  const tokenEndpointCacheRef = useRef({});
  const inCallHardRef = useRef(false);
  const outgoingInviteProcessRef = useRef({});
  const autoJoinCooldownUntilRef = useRef(0);
  const callActionCooldownUntilRef = useRef(0);
  const incomingInviteSnoozeUntilRef = useRef({});
  const ignoreRoomReadyBeforeRef = useRef(0);
  const autoRoomPermissionRef = useRef({ until: 0, reason: "" });
  const isLeavingCallRef = useRef(false);
  const blockedInviteRoomKeysRef = useRef({});
  const localCallEntryKeyRef = useRef("");

  const translations = {
    fa: {
      title: "ØªÙ…Ø§Ø³ ØµÙˆØªÛŒ Ø®ØµÙˆØµÛŒ",
      subtitle: "Ø§ØªØµØ§Ù„ Ø§Ù…Ù† Ø±ÙˆÙ… Ø®ØµÙˆØµÛŒ Ø¨Ø±Ø§ÛŒ ØªÙ…Ø§Ø³ Ø³Ø±ÛŒØ¹",
      enterName: "Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø±",
      enterRoomName: "Ø§Ø³Ù… Ø±ÙˆÙ…",
      enterRoomPassword: "Ú¯Ø°Ø±ÙˆØ§Ú˜Ù‡ Ø±ÙˆÙ…",
      createRoom: "Ø³Ø§Ø®Øª Ø±ÙˆÙ…",
      joinRoom: "ÙˆØ±ÙˆØ¯ Ø¨Ù‡ Ø±ÙˆÙ…",
      startCall: "Ø´Ø±ÙˆØ¹ ØªÙ…Ø§Ø³",
      joining: "Ø¯Ø± Ø­Ø§Ù„ Ø§ØªØµØ§Ù„...",
      users: "Ú©Ø§Ø±Ø¨Ø±Ø§Ù† Ø­Ø§Ø¶Ø±",
      mute: "Ù‚Ø·Ø¹ ØµØ¯Ø§",
      unmute: "ÙˆØµÙ„ ØµØ¯Ø§",
      lowerMic: "Ú©Ø§Ù‡Ø´ Ù…ÛŒÚ©Ø±ÙˆÙÙˆÙ†",
      normalMic: "Ø­Ø§Ù„Øª Ø¹Ø§Ø¯ÛŒ Ù…ÛŒÚ©Ø±ÙˆÙÙˆÙ†",
      record: "Ø´Ø±ÙˆØ¹ Ø¶Ø¨Ø·",
      stopRecord: "ØªÙˆÙ‚Ù Ø¶Ø¨Ø·",
      leaveCall: "Ø®Ø±ÙˆØ¬ Ø§Ø² ØªÙ…Ø§Ø³",
      roomInfo: "Ú©Ø¯ Ø¯Ø¹ÙˆØª Ø±ÙˆÙ…",
      copyInvite: "Ú©Ù¾ÛŒ Ú©Ø¯",
      copied: "Ú©Ù¾ÛŒ Ø´Ø¯",
      connectionQuality: "Ú©ÛŒÙÛŒØª Ø§ØªØµØ§Ù„",
      perfect: "Ø¹Ø§Ù„ÛŒ",
      good: "Ø®ÙˆØ¨",
      medium: "Ù…ØªÙˆØ³Ø·",
      weak: "Ø¶Ø¹ÛŒÙ",
      nameRequired: "Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø± Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯",
      roomNameRequired: "Ø§Ø³Ù… Ø±ÙˆÙ… Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯",
      roomPasswordRequired: "Ú¯Ø°Ø±ÙˆØ§Ú˜Ù‡ Ø±ÙˆÙ… Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯",
      backendNotReachable:
        "Ø¨Ú©â€ŒØ§Ù†Ø¯ Ø¯Ø± Ø¯Ø³ØªØ±Ø³ Ù†ÛŒØ³Øª. Ø§ÙˆÙ„ Node backend Ø±Ø§ Ø§Ø¬Ø±Ø§ Ú©Ù† Ùˆ Ø¨Ø¹Ø¯ ngrok Ø±Ø§ ÙˆØµÙ„ Ú©Ù†.",
      backendTokenError: "Ø¯Ø±ÛŒØ§ÙØª ØªÙˆÚ©Ù† Ø§Ø² Ø¨Ú©â€ŒØ§Ù†Ø¯ Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯.",
      appIdError: "APP_ID Ø¨Ø±Ø§ÛŒ Agora ØªÙ†Ø¸ÛŒÙ… Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.",
      adminAccessHint: "Ø¨Ø±Ø§ÛŒ Ù¾Ù†Ù„ Ù…Ø®ÙÛŒ ngrokØŒ Ø±ÙˆÛŒ Ø¹Ù†ÙˆØ§Ù† 5 Ø¨Ø§Ø± Ø³Ø±ÛŒØ¹ Ø¨Ø²Ù†.",
      adminPanelTitle: "ØªÙ†Ø¸ÛŒÙ… Ù…Ø®ÙÛŒ Ø¨Ú©â€ŒØ§Ù†Ø¯",
      adminBackendLabel: "Ø¢Ø¯Ø±Ø³ Ø¨Ú©â€ŒØ§Ù†Ø¯ (ngrok ÛŒØ§ localhost)",
      adminSave: "Ø°Ø®ÛŒØ±Ù‡",
      adminClose: "Ø¨Ø³ØªÙ†",
      adminGuide:
        "Ø±Ø§Ù‡Ù†Ù…Ø§: Ø§Ú¯Ø± Ø¨Ú©â€ŒØ§Ù†Ø¯ Ø±Ø§ Ø¯Ø³ØªÛŒ Ø§Ø¬Ø±Ø§ Ù…ÛŒâ€ŒÚ©Ù†ÛŒ Ù‡Ù…ÛŒÙ† localhost:5000 Ú©Ø§ÙÛŒ Ø§Ø³Øª. Ø¨Ø±Ø§ÛŒ Ø¯Ø³ØªØ±Ø³ÛŒ Ø¨ÛŒØ±ÙˆÙ†ÛŒØŒ ngrok http 5000 Ø¨Ø²Ù† Ùˆ Ù„ÛŒÙ†Ú© https Ø±Ø§ Ø°Ø®ÛŒØ±Ù‡ Ú©Ù†.",
      backendConnected: "Ø¨Ú©â€ŒØ§Ù†Ø¯ ÙØ¹Ø§Ù„",
      backendInvalidUrl: "Ø¢Ø¯Ø±Ø³ Ø¨Ú©â€ŒØ§Ù†Ø¯ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª. Ø¨Ø§ÛŒØ¯ Ø¨Ø§ http:// ÛŒØ§ https:// Ø´Ø±ÙˆØ¹ Ø´ÙˆØ¯.",
      recordingStarted: "Ø¶Ø¨Ø· ØªÙ…Ø§Ø³ Ø´Ø±ÙˆØ¹ Ø´Ø¯",
      recordingStopped: "Ø¶Ø¨Ø· ØªÙ…Ø§Ø³ Ù…ØªÙˆÙ‚Ù Ø´Ø¯",
      waitingBackend: "Ø§Ù†ØªØ¸Ø§Ø± Ø¨Ø±Ø§ÛŒ Ù¾Ø§Ø³Ø® Ø¨Ú©â€ŒØ§Ù†Ø¯...",
    },
    en: {
      title: "Happy Talk",
      subtitle: "Next-generation web voice calling platform",
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
      openProfile: "Profile",
      profileTitle: "User Profile",
      profileSubtitle: "Configure once and join calls faster.",
      profileNameLabel: "Display name",
      profileSave: "Save profile",
      profileSaved: "Profile saved",
      profileRequired: "Please complete your profile first.",
      chooseAvatar: "Choose photo",
      removeAvatar: "Remove photo",
      profileColorLabel: "Name background color",
      stabilityLabel: "Call stability mode",
      stabilityBalanced: "Balanced",
      stabilityHigher: "Higher Stable",
      stabilityUltra: "Ultra Stable",
      stabilityHigh: "High Quality",
      stabilityHelp:
        "Ultra Stable sends lower quality audio for stronger reliability and much lower data usage.",
      myProfile: "My profile",
      settings: "Settings",
      settingsBackend: "Backend",
      settingsProfile: "Profile",
      settingsAppearance: "Appearance",
      settingsAbout: "About",
      themeLabel: "Theme",
      themeDark: "Dark",
      themeLight: "Light",
      fontLabel: "Font",
      buttonHoverColorLabel: "Button hover color",
      buttonHoverColorReset: "Reset hover color",
      fontVazir: "Vazirmatn",
      fontSystem: "System UI",
      fontSerif: "Serif",
      languageLabel: "Language",
      anonymousMode: "Join as anonymous profile",
      profileDelete: "Delete profile completely",
      profileDeleteConfirm: "Delete profile and all its history?",
      profileDeleted: "Profile deleted",
      totalCallTime: "Total call time",
      callHistory: "Call history",
      room: "Room",
      participants: "Participants",
      noHistory: "No call history yet",
      netWeak: "Weak network",
      netOffline: "Disconnected",
      netGood: "Online",
      profileUpdatedOnlyInSettings: "Name is linked to profile and can be changed only in settings.",
      aboutTitle: "About This App",
      aboutLine1: "This app is the result of months of focused development and testing.",
      aboutLine2: "It was designed to provide reliable private voice calls, even on weak networks.",
      creator: "Creator: Wahidullah Khajeh Seddiqi (Mr.Happy)",
      contact: "Telegram: t.me/JustBeHappy3",
      settingsContacts: "Contacts",
      contactsTitle: "Contacts",
      contactsSearchUid: "Search by UID",
      sendRequest: "Send Request",
      requestSent: "Contact request sent",
      addContact: "Add Contact",
      noContacts: "No contacts yet",
      incomingRequests: "Incoming Requests",
      noRequests: "No requests",
      accept: "Accept",
      decline: "Decline",
      contactUid: "UID",
      inviteToCall: "Invite To Call",
      incomingCall: "Incoming Call",
      incomingCallBody: "Do you want to join the call?",
      inviteSent: "Invitation sent",
      missedCall: "Missed Call",
      missedCallBody: "You have a missed call",
      contactsOnline: "Online",
      contactsOffline: "Offline",
      historyAdvanced: "Advanced Call History",
      historyOutgoing: "Outgoing",
      historyIncoming: "Incoming",
      historyMissed: "Missed",
      requestedYou: "sent you a contact request",
      requestAccepted: "Contact request accepted",
      requestDeclined: "Contact request declined",
      userNotFound: "User with this UID not found",
      cannotAddSelf: "You cannot add your own UID",
      profileUidLabel: "Your permanent UID",
      blockContact: "Block",
      unblockContact: "Unblock",
      removeContact: "Remove",
      blockedContact: "User has been blocked",
      unblockedContact: "User has been unblocked",
      contactRemoved: "Contact removed",
      callNow: "Call Now",
      callUnavailableBusy: "User is in another room. Missed call was recorded.",
      callUnavailableOffline: "User is offline. Missed call was recorded.",
      requestExpired: "Request expired",
      requestNoAcceptExpired: "User did not accept the call request. The request expired after 2 minutes.",
      expiresIn: "Expires in 2 minutes",
      blockedYou: "You cannot reach this user right now.",
      missedCallsTitle: "Missed Calls",
      missedBy: "By",
      speakingTotal: "Total speaking time",
      genderLabel: "Gender",
      birthDateLabel: "Birth date",
      genderNotSet: "Prefer not to say",
      genderMale: "Male",
      genderFemale: "Female",
      speakingMinutes: "Speaking minutes",
      alreadyBlocked: "This user is blocked",
      callSent: "Call request sent",
      incomingInviteDeclinedExpired: "Invitation expired",
      blockedUserCannotCall: "This user is blocked",
      copiedUid: "UID copied",
      userInfo: "User Info",
      age: "Age",
      clearCallHistory: "Clear call history",
      clearMissedCalls: "Clear missed calls",
      historyCleared: "Call history cleared",
      missedCleared: "Missed calls cleared",
      setEmojiAvatar: "Choose emoji avatar",
      noImageAvatar: "No image",
      sessionWith: "Session with",
      settingsHeader: "Control Center",
      groupCall: "Group Call",
      groupLobbyTitle: "Call Lounge",
      inviteOnlineContacts: "Invite online contacts",
      lobbyMembers: "Lobby members",
      startGroupCall: "Start Group Call",
      groupInviteSent: "Group invite sent",
      groupInviteOnlyOnline: "Only online contacts can be invited",
      noOnlineContacts: "No online contacts",
      groupMemberRemoved: "Member removed from lobby",
      muteMember: "Mute user",
      removeFromLobby: "Remove from lobby",
      showPassword: "Show password",
      hidePassword: "Hide password",
      waitingMembers: "Waiting for members...",
      inLobby: "In lobby",
      groupInvite: "Group lobby invite",
      groupInviteBody: "Do you want to join this group lobby?",
      onlyAdminCanUnmute: "Only admin can unmute you.",
      adminMutedNotice: "You were muted by admin.",
      adminUnmutedNotice: "Admin unmuted you.",
      groupClosedByAdmin: "Group lobby was closed by admin.",
      cancelGroupLobby: "Cancel Lobby",
      searchUserToInvite: "Search UID to invite",
      inviteToLobby: "Invite To Lobby",
      onlineNow: "Online now",
      lastSeen: "Last seen",
      roomCreating: "Room is creating...",
      cannotCallNow: "Call is not possible because the target user is in another call or group lobby.",
      busyInLobby: "You are currently in a group lobby. Leave lobby first.",
      leaveLobbyConfirm: "Do you want to leave the lobby?",
      roomCreateFailed: "Room creation failed. Please try again.",
      sessionInUse: "This account is active in another browser/tab/device. Close that session first.",
      searchByNameOrUid: "Search by name or UID",
      leaveCallConfirm: "Do you want to leave the call?",
      leaveCallConfirmTitle: "Leave Call",
      leavePageWarning: "Are you sure you want to leave and exit the call?",
      actionConfirm: "Confirmation",
      confirmBlock: "Do you want to block this contact?",
      confirmRemove: "Do you want to remove this contact?",
      callRingtone: "Call Ringtone",
      ringtoneSaved: "Ringtone selected",
      preview: "Preview",
      useThis: "Use",
      requestingCall: "Requesting call...",
      contactsModal: "Contacts List",
      requestsModal: "Requests List",
      missedModal: "Missed Calls",
    },
  };

  const t = { ...translations.en, ...(translations[language] || {}) };
  const myProfileButtonStyle = useMemo(
    () => ({
      "--profile-pill-bg": hexToRgba(profileColor || DEFAULT_PROFILE_COLOR, 0.2),
      "--profile-pill-border": hexToRgba(profileColor || DEFAULT_PROFILE_COLOR, 0.5),
      "--profile-pill-text": shadeColor(profileColor || DEFAULT_PROFILE_COLOR, 0.88),
      "--profile-pill-hover-fill": hexToRgba(profileColor || DEFAULT_PROFILE_COLOR, 0.36),
      "--profile-pill-hover-glow": hexToRgba(profileColor || DEFAULT_PROFILE_COLOR, 0.24),
    }),
    [profileColor]
  );

  const closeSwalSafely = useCallback(() => {
    try {
      swal.close();
    } catch (_error) {
      // ignore sweetalert close errors in production race conditions
    }
  }, []);

  const openSwalSafely = useCallback((config) => {
    try {
      return swal(config);
    } catch (_error) {
      return Promise.resolve(false);
    }
  }, []);

  const notify = useCallback((text, icon = "info", title = "", options = {}) => {
    return openSwalSafely({
      title: title || undefined,
      text,
      icon,
      button: options.autoCloseMs ? false : "OK",
      timer: options.autoCloseMs || undefined,
      closeOnClickOutside: !options.persistent,
      closeOnEsc: !options.persistent,
    });
  }, [openSwalSafely]);

  const confirmDialog = useCallback((text, title = "Confirm") => {
    return openSwalSafely({
      title,
      text,
      icon: "warning",
      dangerMode: true,
      buttons: ["Cancel", "Yes"],
    });
  }, [openSwalSafely]);

  const pushBrowserNotification = useCallback((title, body = "") => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, { body, silent: false });
    } catch (_error) {
      // ignore notification errors
    }
  }, []);

  const showGroupCreatingDialog = useCallback(() => {
    if (groupCreatingDialogOpenRef.current) return;
    if (groupCreatingTimerRef.current) {
      clearTimeout(groupCreatingTimerRef.current);
      groupCreatingTimerRef.current = null;
    }
    groupCreatingDialogOpenRef.current = true;
    openSwalSafely({
      title: t.roomCreating,
      text: t.waitingBackend,
      icon: "info",
      buttons: false,
      closeOnClickOutside: false,
      closeOnEsc: false,
    });
    groupCreatingTimerRef.current = setTimeout(() => {
      if (groupCreatingDialogOpenRef.current) {
        groupCreatingDialogOpenRef.current = false;
        closeSwalSafely();
      }
      notify(t.roomCreateFailed, "error", "", { autoCloseMs: 2000 });
    }, CALL_PROGRESS_TIMEOUT_MS);
  }, [closeSwalSafely, notify, openSwalSafely, t.roomCreateFailed, t.roomCreating, t.waitingBackend]);

  const hideGroupCreatingDialog = useCallback(() => {
    if (groupCreatingTimerRef.current) {
      clearTimeout(groupCreatingTimerRef.current);
      groupCreatingTimerRef.current = null;
    }
    if (!groupCreatingDialogOpenRef.current) return;
    groupCreatingDialogOpenRef.current = false;
    closeSwalSafely();
  }, [closeSwalSafely]);

  const hideCallProgressDialog = useCallback(() => {
    if (callProgressTimerRef.current) {
      clearTimeout(callProgressTimerRef.current);
      callProgressTimerRef.current = null;
    }
    callProgressContentRef.current = "";
    if (callProgressDialogOpenRef.current) {
      closeSwalSafely();
      callProgressDialogOpenRef.current = false;
    }
  }, [closeSwalSafely]);

  const showCallProgressDialog = useCallback(
    (title, text) => {
      const nextContentKey = `${title || ""}__${text || ""}`;
      if (callProgressDialogOpenRef.current && callProgressContentRef.current === nextContentKey) {
        return;
      }
      if (callProgressTimerRef.current) {
        clearTimeout(callProgressTimerRef.current);
      }
      if (callProgressDialogOpenRef.current) {
        closeSwalSafely();
      }
      callProgressDialogOpenRef.current = true;
      callProgressContentRef.current = nextContentKey;
      openSwalSafely({
        title,
        text,
        icon: "info",
        buttons: false,
        closeOnClickOutside: false,
        closeOnEsc: false,
      });
      callProgressTimerRef.current = setTimeout(() => {
        if (inCall) return;
        if (callProgressDialogOpenRef.current) {
          closeSwalSafely();
          callProgressDialogOpenRef.current = false;
        }
        callProgressContentRef.current = "";
        notify(t.roomCreateFailed, "error", "", { autoCloseMs: 2000 });
      }, CALL_PROGRESS_TIMEOUT_MS);
    },
    [closeSwalSafely, inCall, notify, openSwalSafely, t.roomCreateFailed]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ADMIN_BACKEND_STORAGE_KEY, adminBackendUrl.trim());
  }, [adminBackendUrl]);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(BUTTON_HOVER_COLOR_STORAGE_KEY, buttonHoverColor);
    document.documentElement.style.setProperty("--btn-hover-color", buttonHoverColor);
    document.documentElement.style.setProperty("--btn-hover-color-soft", hexToRgba(buttonHoverColor, 0.28));
    document.documentElement.style.setProperty("--btn-hover-color-strong", hexToRgba(buttonHoverColor, 0.38));
    document.documentElement.style.setProperty("--btn-hover-glow", hexToRgba(buttonHoverColor, 0.14));
  }, [buttonHoverColor]);

  useEffect(() => {
    document.title = APP_DISPLAY_NAME;
    let iconLink = document.querySelector("link[rel='icon']");
    if (!iconLink) {
      iconLink = document.createElement("link");
      iconLink.setAttribute("rel", "icon");
      document.head.appendChild(iconLink);
    }
    iconLink.setAttribute("href", appLogo);
  }, []);

  useEffect(() => {
    try {
      AgoraRTC.disableLogUpload?.();
      AgoraRTC.setLogLevel?.(2);
    } catch (_error) {
      // ignore sdk logging setup errors
    }
  }, []);

  useEffect(() => {
    return () => {
      if (callProgressTimerRef.current) {
        clearTimeout(callProgressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const missedPending = missedCalls.filter((item) => !item.handled).length;
    setPendingNotifications(contactRequests.length + incomingInvites.length + incomingGroupInvites.length + missedPending);
  }, [contactRequests.length, incomingInvites.length, incomingGroupInvites.length, missedCalls]);

  useEffect(() => {
    const fontMap = {
      vazirmatn: '"vazirmatn", "Segoe UI", Tahoma, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
      system: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Tahoma, "vazirmatn", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
      serif: '"vazirmatn", "Noto Naskh Arabic", "Times New Roman", Georgia, serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
    };
    document.body.style.fontFamily = fontMap[fontChoice] || fontMap.vazirmatn;
  }, [fontChoice]);

  useEffect(() => {
    if (profileId) return;
    const nextId = generateProfileId();
    setProfileId(nextId);
    localStorage.setItem(PROFILE_STORAGE_KEY, nextId);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;

    let alive = true;
    let loadingTimer;
    const loadingStartedAt = Date.now();
    const loadProfile = async () => {
      try {
        const snapshot = await get(ref(db, `profiles/${profileId}`));
        const data = snapshot.val();

        if (!alive) return;

        if (data) {
          const existingUid = data.uid || generatePublicUid();
          const loadedName = String(data.name || "").trim();
          const loadedAnonymous = Boolean(data.isAnonymous);
          const onboardingDone = localStorage.getItem(BACKEND_ONBOARDING_KEY) === "1";
          setProfileUid(existingUid);
          setProfileName(loadedName);
          setUsername(loadedName);
          setProfileAvatar(data.avatar || "");
          setProfileEmoji(data.emoji || "");
          setSelectedRingtone(data.ringtoneId || "ringtone_1");
          setProfileColor(data.color || DEFAULT_PROFILE_COLOR);
          const loadedMode = data.stabilityMode || STABILITY_MODES.balanced;
          setStabilityMode(loadedMode === "ultra" ? STABILITY_MODES.higher : loadedMode);
          setIsAnonymous(loadedAnonymous);
          setProfileGender(data.gender || "not_set");
          setProfileBirthDate(data.birthDate || "");
          setProfileCallSeconds(Number(data.totalCallSeconds || 0));
          setProfileSpeakingSeconds(Number(data.totalSpeakingSeconds || 0));
          const historyRows = data.history ? Object.entries(data.history).map(([id, item]) => ({ id, ...item })) : [];
          historyRows.sort((a, b) => Number(b.startedAt || 0) - Number(a.startedAt || 0));
          setProfileHistory(historyRows);
          if (!data.uid) {
            await update(ref(db, `profiles/${profileId}`), { uid: existingUid });
          }
          const hasValidProfileGate = Boolean(loadedAnonymous || loadedName);
          setShouldAutoOpenBackendAfterProfileSave(!hasValidProfileGate && !onboardingDone);
          setScreen(hasValidProfileGate ? "entry" : "profile");
        } else {
          setProfileUid(generatePublicUid());
          const onboardingDone = localStorage.getItem(BACKEND_ONBOARDING_KEY) === "1";
          setShouldAutoOpenBackendAfterProfileSave(!onboardingDone);
          setScreen("profile");
        }
      } catch (_error) {
        if (alive) {
          setScreen("profile");
        }
      } finally {
        if (alive) {
          const elapsed = Date.now() - loadingStartedAt;
          const remaining = Math.max(0, PROFILE_LOADING_MIN_MS - elapsed);
          loadingTimer = setTimeout(() => {
            if (alive) setProfileLoaded(true);
          }, remaining);
        }
      }
    };

    loadProfile();

    return () => {
      alive = false;
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [profileId]);

  useEffect(() => {
    const cleanupExpiredRooms = async () => {
      try {
        const snapshot = await get(ref(db, "roomMeta"));
        const data = snapshot.val() || {};
        const now = Date.now();
        const tasks = [];
        const roomUserSnapshots = await Promise.all(
          Object.keys(data).map(async (roomKey) => {
            const usersSnap = await get(ref(db, `callUsers/${roomKey}`)).catch(() => null);
            return [roomKey, usersSnap?.val?.() || {}];
          })
        );
        const roomUserMap = Object.fromEntries(roomUserSnapshots);

        Object.entries(data).forEach(([roomKey, meta]) => {
          const expiresAt = Number(meta?.expiresAt || 0);
          if (expiresAt > 0 && expiresAt <= now) {
            tasks.push(remove(ref(db, `roomMeta/${roomKey}`)));
            tasks.push(remove(ref(db, `callUsers/${roomKey}`)));
            tasks.push(remove(ref(db, `recordingStatus/${roomKey}`)));
            tasks.push(remove(ref(db, `muteCommands/${roomKey}`)));
            return;
          }

          const usersObj = roomUserMap[roomKey] || {};
          const usersCount = Object.keys(usersObj).length;
          if (usersCount === 0) {
            const emptySince = Number(meta?.emptySince || 0);
            if (!emptySince) {
              tasks.push(update(ref(db, `roomMeta/${roomKey}`), { emptySince: now }));
            } else if (now - emptySince >= ROOM_EMPTY_CLEANUP_DELAY_MS) {
              tasks.push(remove(ref(db, `roomMeta/${roomKey}`)));
              tasks.push(remove(ref(db, `callUsers/${roomKey}`)));
              tasks.push(remove(ref(db, `recordingStatus/${roomKey}`)));
              tasks.push(remove(ref(db, `muteCommands/${roomKey}`)));
            }
          } else if (meta?.emptySince) {
            tasks.push(update(ref(db, `roomMeta/${roomKey}`), { emptySince: null }));
          }
        });
        const lobbySnapshot = await get(ref(db, "groupLobbies"));
        const lobbies = lobbySnapshot.val() || {};
        Object.entries(lobbies).forEach(([lobbyId, lobby]) => {
          const expiresAt = Number(lobby?.expiresAt || 0);
          if (expiresAt > 0 && expiresAt <= now) {
            tasks.push(remove(ref(db, `groupLobbies/${lobbyId}`)));
          }
        });
        if (tasks.length) {
          await Promise.allSettled(tasks);
        }
      } catch (_error) {
        // ignore cleanup errors
      }
    };

    cleanupExpiredRooms();
    const interval = setInterval(cleanupExpiredRooms, 5 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!profileLoaded || !profileId || !profileUid) return undefined;

    const presenceRef = ref(db, `uidDirectory/${profileUid}`);
    const payload = {
      profileId,
      uid: profileUid,
      name: profileName || `Guest-${profileUid.slice(-6)}`,
      avatar: profileAvatar || "",
      emoji: profileEmoji || "",
      ringtoneId: selectedRingtone || "ringtone_1",
      color: profileColor || DEFAULT_PROFILE_COLOR,
      gender: profileGender || "not_set",
      birthDate: profileBirthDate || "",
      isOnline: true,
      inCallRoomKey: inCall ? activeRoomKey || "busy" : "",
      inGroupLobbyId: groupLobbyId || "",
      lastSeen: Date.now(),
    };
    set(presenceRef, payload).catch(() => {});
    const interval = setInterval(() => {
      update(presenceRef, {
        isOnline: true,
        lastSeen: Date.now(),
        name: profileName || `Guest-${profileUid.slice(-6)}`,
        avatar: profileAvatar || "",
        emoji: profileEmoji || "",
        color: profileColor || DEFAULT_PROFILE_COLOR,
        gender: profileGender || "not_set",
        birthDate: profileBirthDate || "",
        inCallRoomKey: inCall ? activeRoomKey || "busy" : "",
        inGroupLobbyId: groupLobbyId || "",
      }).catch(() => {});
    }, 15000);

    const disconnectHandler = onDisconnect(presenceRef);
    disconnectHandler.update({ isOnline: false, lastSeen: Date.now() }).catch(() => {});

    return () => {
      clearInterval(interval);
      update(presenceRef, { isOnline: false, lastSeen: Date.now() }).catch(() => {});
    };
  }, [
    profileLoaded,
    profileId,
    profileUid,
    profileName,
    profileAvatar,
    profileEmoji,
    selectedRingtone,
    profileColor,
    profileGender,
    profileBirthDate,
    inCall,
    activeRoomKey,
    groupLobbyId,
  ]);

  useEffect(() => {
    if (!profileLoaded || !profileId) return undefined;
    const sessionRef = ref(db, `activeSessions/${profileId}`);
    const sessionId = sessionInstanceRef.current;
    let active = true;

    const syncSession = async () => {
      const snapshot = await get(sessionRef).catch(() => null);
      const now = Date.now();
      const existing = snapshot?.val?.();
      if (
        existing &&
        existing.sessionId &&
        existing.sessionId !== sessionId &&
        now - Number(existing.lastSeen || 0) < ACTIVE_SESSION_TTL_MS
      ) {
        if (active) setSessionBlocked(true);
        return;
      }
      await set(sessionRef, {
        sessionId,
        lastSeen: now,
        profileId,
        profileUid: profileUid || "",
      }).catch(() => {});
      if (active) setSessionBlocked(false);
    };

    syncSession();
    const interval = setInterval(syncSession, 8000);
    const dc = onDisconnect(sessionRef);
    dc.remove().catch(() => {});
    return () => {
      active = false;
      clearInterval(interval);
      get(sessionRef)
        .then((snap) => {
          const data = snap.val();
          if (data?.sessionId === sessionId) {
            return remove(sessionRef);
          }
          return null;
        })
        .catch(() => {});
    };
  }, [profileLoaded, profileId, profileUid]);

  useEffect(() => {
    return () => {
      if (ringtonePreviewRef.current) {
        ringtonePreviewRef.current.pause();
        ringtonePreviewRef.current.currentTime = 0;
      }
      if (incomingRingtoneRef.current) {
        incomingRingtoneRef.current.pause();
        incomingRingtoneRef.current.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    if (!profileLoaded || !profileId) return undefined;
    const contactsRef = ref(db, `contacts/${profileId}`);
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      setContacts(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [profileLoaded, profileId]);

  useEffect(() => {
    if (!profileLoaded || !profileId) return undefined;
    const blockedRef = ref(db, `blockedContacts/${profileId}`);
    const unsubscribe = onValue(blockedRef, (snapshot) => {
      setBlockedContacts(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [profileLoaded, profileId]);

  useEffect(() => {
    const contactList = Object.entries(contacts || {}).map(([key, value]) => ({
      ...(value || {}),
      uid: value?.uid || key,
    }));
    if (!contactList.length) {
      setContactsPresence({});
      return undefined;
    }

    let alive = true;
    const syncPresence = async () => {
      const entries = await Promise.all(
        contactList.map(async (contact) => {
          if (!contact?.uid) return null;
          const snapshot = await get(ref(db, `uidDirectory/${contact.uid}`)).catch(() => null);
          const data = snapshot?.val?.() || {};
          return [contact.uid, data];
        })
      );
      if (!alive) return;
      const map = {};
      entries.forEach((entry) => {
        if (!entry) return;
        map[entry[0]] = entry[1];
      });
      setContactsPresence(map);
    };

    syncPresence();
    const interval = setInterval(syncPresence, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [contacts]);

  useEffect(() => {
    if (!profileLoaded || !profileUid) return undefined;
    const reqRef = ref(db, `contactRequests/${profileUid}`);
    const unsubscribe = onValue(reqRef, (snapshot) => {
      const now = Date.now();
      const rawRows = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }));
      rawRows.forEach((item) => {
        if (
          item.status === CONTACT_REQUEST_STATUS.pending &&
          now - Number(item.createdAt || 0) > INVITE_TTL_MS
        ) {
          update(ref(db, `contactRequests/${profileUid}/${item.id}`), {
            status: "expired",
            respondedAt: now,
          }).catch(() => {});
        }
      });
      const rows = rawRows
        .filter((item) => {
          if (groupLobbyId || inCall) return false;
          if (item.status !== CONTACT_REQUEST_STATUS.pending) return false;
          if (blockedContacts[item.fromUid]) return false;
          return now - Number(item.createdAt || 0) <= INVITE_TTL_MS;
        })
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setContactRequests(rows);
    });
    return () => unsubscribe();
  }, [profileLoaded, profileUid, blockedContacts, groupLobbyId, inCall]);

  useEffect(() => {
    if (!profileLoaded || !profileUid) return undefined;
    const inviteRef = ref(db, `invites/${profileUid}`);
    const unsubscribe = onValue(inviteRef, (snapshot) => {
      const now = Date.now();
      const rawRows = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }));
      rawRows.forEach((item) => {
        if (
          item.status === CONTACT_REQUEST_STATUS.pending &&
          now - Number(item.createdAt || 0) > INVITE_TTL_MS
        ) {
          update(ref(db, `invites/${profileUid}/${item.id}`), {
            status: "expired",
            respondedAt: now,
          }).catch(() => {});
        }
      });
      const rows = rawRows
        .filter((item) => {
          if (groupLobbyId || inCall) return false;
          if (item.status !== CONTACT_REQUEST_STATUS.pending) return false;
          if (blockedContacts[item.fromUid]) return false;
          return now - Number(item.createdAt || 0) <= INVITE_TTL_MS;
        })
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setIncomingInvites(rows);
    });
    return () => unsubscribe();
  }, [profileLoaded, profileUid, blockedContacts, groupLobbyId, inCall]);

  useEffect(() => {
    if (!profileLoaded || !profileUid) return undefined;
    const groupInviteRef = ref(db, `groupLobbyInvites/${profileUid}`);
    const unsubscribe = onValue(groupInviteRef, (snapshot) => {
      if (groupLobbyId || inCall) {
        setIncomingGroupInvites([]);
        return;
      }
      const now = Date.now();
      const rows = Object.entries(snapshot.val() || {})
        .map(([id, value]) => ({ id, ...value }))
        .filter((item) => item.status === CONTACT_REQUEST_STATUS.pending && now - Number(item.createdAt || 0) <= INVITE_TTL_MS)
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setIncomingGroupInvites(rows);
    });
    return () => unsubscribe();
  }, [profileLoaded, profileUid, groupLobbyId, inCall]);

  useEffect(() => {
    if (!incomingGroupInvites.length || !profileUid) return;
    const invite = incomingGroupInvites[0];
    if (!invite?.id || !invite?.lobbyId) return;
    pushBrowserNotification(t.groupInvite, invite.adminName || invite.adminUid || "");

    const ask = async () => {
      const ok = await confirmDialog(`${invite.adminName || invite.adminUid}\n${t.groupInviteBody}`, t.groupInvite);
      const inviteRef = ref(db, `groupLobbyInvites/${profileUid}/${invite.id}`);
      if (!ok) {
        await update(inviteRef, {
          status: CONTACT_REQUEST_STATUS.declined,
          respondedAt: Date.now(),
        }).catch(() => {});
        return;
      }

      await Promise.allSettled([
        update(inviteRef, {
          status: CONTACT_REQUEST_STATUS.accepted,
          respondedAt: Date.now(),
        }),
        set(ref(db, `groupLobbies/${invite.lobbyId}/members/${profileUid}`), {
          uid: profileUid,
          profileId: profileId || "",
          name: profileName || username || profileUid,
          avatar: profileAvatar || "",
          emoji: profileEmoji || "",
          status: "ready",
          joinedAt: Date.now(),
        }),
      ]);
      setGroupLobbyId(invite.lobbyId);
      setShowGroupLobby(true);
      await notify(t.inLobby, "success");
    };

    ask();
  }, [
    confirmDialog,
    incomingGroupInvites,
    notify,
    profileAvatar,
    profileEmoji,
    profileId,
    profileName,
    profileUid,
    pushBrowserNotification,
    t.groupInvite,
    t.groupInviteBody,
    t.inLobby,
    username,
  ]);

  useEffect(() => {
    if (!groupLobbyId) return undefined;
    const membersRef = ref(db, `groupLobbies/${groupLobbyId}/members`);
    const unsubscribe = onValue(membersRef, (snapshot) => {
      setGroupLobbyMembers(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [groupLobbyId]);

  useEffect(() => {
    if (!groupLobbyId) return undefined;
    const lobbyRef = ref(db, `groupLobbies/${groupLobbyId}`);
    const unsubscribe = onValue(lobbyRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setGroupLobbyMeta(null);
        setShowGroupLobby(false);
        return;
      }
      setGroupLobbyMeta(data);
      if (data.status !== lobbyStatusRef.current) {
        lobbyStatusRef.current = data.status;
        if (data.status === "creating") {
          showGroupCreatingDialog();
        }
      }
      if (data.status === "cancelled") {
        hideGroupCreatingDialog();
        notify(t.groupClosedByAdmin, "info");
        setShowGroupLobby(false);
        setGroupLobbyId("");
        lobbyStatusRef.current = "";
      }
      if (data.status === "started" && data.roomName && data.roomPassword && !inCall) {
        hideGroupCreatingDialog();
        setShowGroupLobby(false);
        setRoomMode("join");
        setRoomName(data.roomName);
        setRoomPassword(data.roomPassword);
        setPendingGroupJoin({
          mode: "join",
          roomName: data.roomName,
          roomPassword: data.roomPassword,
          allowFromLobbyStart: true,
          isGroupCall: true,
        });
      }
    });
    return () => unsubscribe();
  }, [groupLobbyId, hideGroupCreatingDialog, inCall, notify, showGroupCreatingDialog, t.groupClosedByAdmin]);

  useEffect(() => {
    if (!profileLoaded || !profileUid) return undefined;
    const missedRef = ref(db, `missedCalls/${profileUid}`);
    const unsubscribe = onValue(missedRef, async (snapshot) => {
      const data = snapshot.val() || {};
      const historyRows = Object.entries(data)
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
      setMissedCalls(historyRows);
      const entries = Object.entries(data)
        .filter(([, item]) => !item?.handled)
        .sort((a, b) => Number((b[1] || {}).at || 0) - Number((a[1] || {}).at || 0));

      if (entries.length) {
        const [id, item] = entries[0];
        const when = new Date(item.at || Date.now()).toLocaleString();
        await notify(`${t.missedCallBody}: ${item.fromName || item.fromUid}\n${when}`, "info", t.missedCall);
        await update(ref(db, `missedCalls/${profileUid}/${id}`), { handled: true }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [notify, profileLoaded, profileUid, t.missedCall, t.missedCallBody]);

  const profilePayload = useMemo(
    () => ({
      profileId,
      uid: profileUid,
      name: profileName.trim() || username.trim(),
      avatar: profileAvatar || "",
      emoji: profileEmoji || "",
      ringtoneId: selectedRingtone || "ringtone_1",
      color: profileColor || DEFAULT_PROFILE_COLOR,
      stabilityMode,
      isAnonymous,
      gender: profileGender,
      birthDate: profileBirthDate,
      updatedAt: Date.now(),
    }),
    [
      isAnonymous,
      profileEmoji,
      selectedRingtone,
      profileAvatar,
      profileBirthDate,
      profileColor,
      profileGender,
      profileId,
      profileName,
      profileUid,
      stabilityMode,
      username,
    ]
  );

  const compressImage = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxSize = 220;
          const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to process image"));
            return;
          }
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        image.onerror = () => reject(new Error("Invalid image file"));
        image.src = String(reader.result || "");
      };
      reader.onerror = () => reject(new Error("Image read failed"));
      reader.readAsDataURL(file);
    });
  }, []);

  const onAvatarFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file);
        setProfileAvatar(dataUrl);
      } catch (_error) {
        await notify("Image upload failed", "error");
      } finally {
        event.target.value = "";
      }
    },
    [compressImage, notify]
  );

  const saveProfile = useCallback(async () => {
    const trimmedName = profileName.trim();
    const immutableUid = profileUid || generatePublicUid();
    const effectiveName = isAnonymous ? `Guest-${immutableUid.slice(-6)}` : trimmedName;
    if (!effectiveName) {
      await notify(t.nameRequired, "warning");
      return;
    }
    if (!profileId) {
      await notify("Profile ID is not ready yet", "warning");
      return;
    }

    setProfileSaving(true);
    try {
      await update(ref(db, `profiles/${profileId}`), {
        ...profilePayload,
        uid: immutableUid,
        name: effectiveName,
        totalCallSeconds: profileCallSeconds || 0,
        totalSpeakingSeconds: profileSpeakingSeconds || 0,
      });
      await update(ref(db, `uidDirectory/${immutableUid}`), {
        name: effectiveName,
        avatar: profileAvatar || "",
        emoji: profileEmoji || "",
        color: profileColor || DEFAULT_PROFILE_COLOR,
        gender: profileGender || "not_set",
        birthDate: profileBirthDate || "",
        lastSeen: Date.now(),
      }).catch(() => {});
      await Promise.allSettled(
        Object.values(contacts || {}).map((contact) => {
          if (!contact?.profileId || !immutableUid) return Promise.resolve();
          return update(ref(db, `contacts/${contact.profileId}/${immutableUid}`), {
            name: effectiveName,
            avatar: profileAvatar || "",
            emoji: profileEmoji || "",
            color: profileColor || DEFAULT_PROFILE_COLOR,
            lastSeen: Date.now(),
          });
        })
      );
      setProfileUid(immutableUid);
      setProfileName(effectiveName);
      setUsername(effectiveName);
      setScreen("entry");
      if (shouldAutoOpenBackendAfterProfileSave) {
        setShowSettingsPanel(true);
        setSettingsTab("backend");
        setShouldAutoOpenBackendAfterProfileSave(false);
        localStorage.setItem(BACKEND_ONBOARDING_KEY, "1");
      }
      await notify(t.profileSaved, "success", "", { autoCloseMs: 2000 });
    } catch (_error) {
      await notify(t.backendTokenError, "error");
    } finally {
      setProfileSaving(false);
    }
  }, [
    isAnonymous,
    profileCallSeconds,
    profileSpeakingSeconds,
    contacts,
    profileId,
    profileName,
    profileAvatar,
    profileEmoji,
    profileColor,
    profileGender,
    profileBirthDate,
    profilePayload,
    profileUid,
    notify,
    shouldAutoOpenBackendAfterProfileSave,
    t.backendTokenError,
    t.nameRequired,
    t.profileSaved,
  ]);

  useEffect(() => {
    if (!activeRoomKey) return undefined;

    const usersRef = ref(db, `callUsers/${activeRoomKey}`);
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const filtered = {};
      Object.entries(data).forEach(([id, item]) => {
        const normalized = normalizeCallUser(item);
        const isValid = Boolean(normalized.name && normalized.name !== "User");
        if (!isValid) return;
        filtered[id] = {
          ...item,
          socketId: normalized.socketId || id,
          agoraUid: normalized.agoraUid ?? "",
        };
        callParticipantsRef.current[normalized.uid || normalized.socketId || id] =
          normalized.name || normalized.uid || String(id);
      });
      const newIds = Object.keys(filtered);
      const previousIds = previousUserIdsRef.current;
      const addedIds = newIds.filter((id) => !previousIds.includes(id));
      const hasAddedRemote = addedIds.some((id) => {
        const normalized = normalizeCallUser(filtered[id]);
        const remoteAgoraUid = normalized.agoraUid;
        return String(remoteAgoraUid) !== String(userUID);
      });

      if (inCall && !isLeavingCallRef.current && hasAddedRemote) {
        joinSoundRef.current.currentTime = 0;
        joinSoundRef.current.volume = 0.35;
        joinSoundRef.current.play().catch(() => {});
      }

      previousUserIdsRef.current = newIds;
      setUsersInCall(filtered);
    });

    return () => unsubscribe();
  }, [activeRoomKey, inCall, userUID]);

  useEffect(() => {
    if (!inCall || !activeRoomKey) return undefined;
    const roomMetaRef = ref(db, `roomMeta/${activeRoomKey}`);
    const unsubscribe = onValue(roomMetaRef, (snapshot) => {
      const data = snapshot.val() || {};
      const isGroup = Boolean(data.isGroupCall);
      setIsGroupCallSession(isGroup);
      setIsInviteRequestRoomSession(Boolean(data.isInviteRequestRoom));
      setIsRoomAdmin(Boolean(isGroup && data.createdByUid && data.createdByUid === profileUid));
    });
    return () => unsubscribe();
  }, [activeRoomKey, inCall, profileUid]);

  useEffect(() => {
    if (!inCall || !isGroupCallSession || !activeRoomKey || !profileUid || userUID === null) return undefined;
    if (!localCallEntryKeyRef.current) return undefined;
    const muteRef = ref(db, `muteCommands/${activeRoomKey}/${profileUid}`);
    const unsubscribe = onValue(muteRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data || data.status !== "pending") return;
      const action = data.action || "mute";
      if (localTrackRef.current) {
        if (action === "mute") {
          await applyTrackMutedState(localTrackRef.current, true);
          setIsMuted(true);
          setAdminMuteLocked(true);
          await update(ref(db, `callUsers/${activeRoomKey}/${localCallEntryKeyRef.current}`), { adminMuted: true }).catch(() => {});
        } else if (action === "unmute") {
          await applyTrackMutedState(localTrackRef.current, false);
          setIsMuted(false);
          setAdminMuteLocked(false);
          await update(ref(db, `callUsers/${activeRoomKey}/${localCallEntryKeyRef.current}`), { adminMuted: false }).catch(() => {});
        }
      }
      await update(muteRef, {
        status: "done",
        handledAt: Date.now(),
      }).catch(() => {});
      notify(action === "mute" ? t.adminMutedNotice : t.adminUnmutedNotice, "info");
    });
    return () => unsubscribe();
  }, [activeRoomKey, inCall, isGroupCallSession, notify, profileUid, t.adminMutedNotice, t.adminUnmutedNotice, userUID]);

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
    if (Object.keys(usersInCall || {}).length <= 1) {
      return undefined;
    }

    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [inCall, usersInCall]);

  useEffect(() => {
    if (!inCall) return undefined;

    const labelSet = {
      perfect: t.perfect,
      good: t.good,
      medium: t.medium,
      weak: t.weak,
    };
    const handleQuality = (stats) => {
      const worst = Math.max(stats.uplinkNetworkQuality || 0, stats.downlinkNetworkQuality || 0);
      setConnectionQuality(qualityLabel(worst, labelSet));
      if (worst >= 6) {
        setLocalNetworkStatus(NETWORK_STATUS.offline);
      } else if (worst >= 4) {
        setLocalNetworkStatus(NETWORK_STATUS.weak);
      } else {
        setLocalNetworkStatus(NETWORK_STATUS.good);
      }
    };

    client.on("network-quality", handleQuality);
    return () => client.off("network-quality", handleQuality);
  }, [client, inCall, t.good, t.medium, t.perfect, t.weak]);

  useEffect(() => {
    if (!inCall) return undefined;
    let cancelled = false;
    const resubscribeRemoteAudio = async () => {
      if (cancelled || !inCall) return;
      const remotes = client.remoteUsers || [];
      await Promise.allSettled(
        remotes
          .filter((remote) => remote && (remote.hasAudio || remote.audioTrack))
          .map(async (remote) => {
            try {
              await client.subscribe(remote, "audio");
              if (remote.audioTrack) {
                if (stabilityMode === STABILITY_MODES.higher) {
                  remote.audioTrack.setVolume?.(30);
                } else if (stabilityMode === STABILITY_MODES.ultra) {
                  remote.audioTrack.setVolume?.(22);
                } else if (stabilityMode === STABILITY_MODES.high) {
                  remote.audioTrack.setVolume?.(100);
                }
                remote.audioTrack.play();
              }
            } catch (_error) {
              // keep polling; next cycle can recover
            }
          })
      );
    };
    const interval = setInterval(resubscribeRemoteAudio, 6500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client, inCall, stabilityMode]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (inCall) {
        event.preventDefault();
        event.returnValue = t.leavePageWarning;
      }
      if (activeRoomKey && localCallEntryKeyRef.current) {
        remove(ref(db, `callUsers/${activeRoomKey}/${localCallEntryKeyRef.current}`)).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeRoomKey, inCall, t.leavePageWarning, userUID]);

  useEffect(() => {
    if (!inCall || !activeRoomKey || userUID === null) return undefined;
    if (isLeavingCallRef.current) return undefined;
    if (!localCallEntryKeyRef.current) return undefined;

    const updatePresence = () => {
      if (isLeavingCallRef.current) return;
      update(ref(db, `callUsers/${activeRoomKey}/${localCallEntryKeyRef.current}`), {
        lastSeen: Date.now(),
        networkStatus: localNetworkStatus,
        name: profileName || username || profileUid || "User",
        avatar: profileAvatar || "",
        emoji: profileEmoji || "",
        color: profileColor || DEFAULT_PROFILE_COLOR,
      }).catch(() => {});
    };

    updatePresence();
    const interval = setInterval(updatePresence, 2500);

    return () => clearInterval(interval);
  }, [activeRoomKey, inCall, localNetworkStatus, userUID, profileName, username, profileUid, profileAvatar, profileEmoji, profileColor]);

  const backendCandidates = useMemo(() => {
    const list = [
      activeBackendUrl?.trim(),
      adminBackendUrl?.trim(),
      LOCAL_BACKEND_URL,
    ]
      .filter(Boolean)
      .map((url) => String(url).replace(/\/+$/, ""))
      .filter((url, index, array) => array.indexOf(url) === index);
    return list.length ? list : [LOCAL_BACKEND_URL];
  }, [activeBackendUrl, adminBackendUrl]);

  const getBackendHeaders = useCallback((baseUrl, includeJson = false) => {
    const headers = {};
    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }
    if (baseUrl.includes("ngrok")) {
      headers["ngrok-skip-browser-warning"] = "true";
    }
    return headers;
  }, []);

  const requestToken = useCallback(async (tokenMode, tokenRoomName, tokenRoomPassword) => {
    const validCandidates = backendCandidates
      .map((url) => url.trim().replace(/\/+$/, ""))
      .filter((url) => isHttpUrl(url));

    if (!validCandidates.length) {
      throw new Error(t.backendNotReachable);
    }

    let lastError = null;
    for (const baseUrl of validCandidates) {
      const cachedPath = tokenEndpointCacheRef.current[baseUrl];
      const endpointPaths = [cachedPath, ...TOKEN_ENDPOINT_PATHS].filter(
        (path, index, list) => Boolean(path) && list.indexOf(path) === index
      );
      let sawOnlyEndpoint404 = true;

      for (const endpointPath of endpointPaths) {
        const endpoint = `${baseUrl}${endpointPath}`;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const response = await withTimeout(
              endpoint,
              {
                method: "POST",
                headers: getBackendHeaders(baseUrl, true),
                body: JSON.stringify({
                  mode: tokenMode,
                  roomName: tokenRoomName,
                  roomPassword: tokenRoomPassword,
                }),
              },
              isLegacyAndroid ? 18000 : 12000
            );

            const rawBody = await response.text().catch(() => "");
            const data = (() => {
              if (!rawBody) return {};
              try {
                return JSON.parse(rawBody);
              } catch (_error) {
                return {};
              }
            })();

            if (!response.ok) {
              const errorMessage = data.error || t.backendTokenError;
              const maybeTransientEndpointError =
                response.status === 404 || response.status === 405 || response.status === 501;

              if (!maybeTransientEndpointError) {
                sawOnlyEndpoint404 = false;
              }

              if (maybeTransientEndpointError && attempt < 3) {
                await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
                continue;
              }

              if (response.status >= 500 || response.status === 502 || response.status === 504) {
                lastError = new Error(`${errorMessage} (status ${response.status} @ ${endpoint})`);
                sawOnlyEndpoint404 = false;
                if (attempt < 3) {
                  await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
                  continue;
                }
                break;
              }

              lastError = new Error(`${errorMessage} (status ${response.status} @ ${endpoint})`);
              break;
            }

            tokenEndpointCacheRef.current[baseUrl] = endpointPath;
            setActiveBackendUrl(baseUrl);
            return data;
          } catch (error) {
            lastError = error;
            sawOnlyEndpoint404 = false;
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
              continue;
            }
          }
        }
      }

      if (sawOnlyEndpoint404) {
        lastError = new Error(
          `Backend endpoint is invalid (404/405/501) at ${baseUrl}. Set Settings > Backend to your Node/ngrok backend URL, not the frontend URL.`
        );
      }
    }

    throw new Error(lastError?.message || t.backendNotReachable);
  }, [backendCandidates, getBackendHeaders, isLegacyAndroid, t.backendNotReachable, t.backendTokenError]);

  const ensureExclusiveSession = useCallback(async () => {
    if (!profileId) return true;
    const sessionRef = ref(db, `activeSessions/${profileId}`);
    const snapshot = await get(sessionRef).catch(() => null);
    const existing = snapshot?.val?.();
    const now = Date.now();
    if (
      existing &&
      existing.sessionId &&
      existing.sessionId !== sessionInstanceRef.current &&
      now - Number(existing.lastSeen || 0) < ACTIVE_SESSION_TTL_MS
    ) {
      setSessionBlocked(true);
      await notify(t.sessionInUse, "warning");
      return false;
    }
    await set(sessionRef, {
      sessionId: sessionInstanceRef.current,
      lastSeen: now,
      profileId,
      profileUid: profileUid || "",
    }).catch(() => {});
    setSessionBlocked(false);
    return true;
  }, [notify, profileId, profileUid, t.sessionInUse]);

  const buildMicEncoderConfig = useCallback(() => {
    if (isLegacyAndroid) {
      return {
        sampleRate: 16000,
        stereo: false,
        bitrate: 18,
      };
    }
    if (stabilityMode === STABILITY_MODES.higher) {
      return {
        sampleRate: 16000,
        stereo: false,
        bitrate: 18,
      };
    }
    if (stabilityMode === STABILITY_MODES.ultra) {
      return {
        sampleRate: 8000,
        stereo: false,
        bitrate: 12,
      };
    }
    if (stabilityMode === STABILITY_MODES.high) {
      return {
        sampleRate: 48000,
        stereo: true,
        bitrate: 128,
      };
    }
    return "speech_standard";
  }, [isLegacyAndroid, stabilityMode]);

  const joinCallInternal = useCallback(async (options = {}) => {
    const suppressErrorNotify = Boolean(options?.suppressErrorNotify);
    if (!profileLoaded) return false;
    const now = Date.now();
    const joinLockAge = now - Number(joinInFlightStartedAtRef.current || 0);
    const staleJoinLockMs = isLegacyAndroid ? 180000 : 120000;
    if (
      joinInFlightRef.current &&
      (!joinInFlightStartedAtRef.current || joinLockAge > staleJoinLockMs) &&
      !inCall &&
      !inCallHardRef.current
    ) {
      joinInFlightRef.current = false;
      joinInFlightStartedAtRef.current = 0;
      setJoining(false);
    }
    if (!inCall && !joinInFlightRef.current && joining) {
      setJoining(false);
    }
    if (!inCall && !joinInFlightRef.current && inCallHardRef.current) {
      inCallHardRef.current = false;
    }
    if (joinInFlightRef.current) return false;
    if (isLeavingCallRef.current) return false;
    if (inCall || inCallHardRef.current) return false;
    if (client.connectionState && client.connectionState !== "DISCONNECTED") {
      await client.leave().catch(() => {});
      client.removeAllListeners();
    }
    if (groupLobbyId && !options?.allowFromLobbyStart) {
      await notify(t.busyInLobby, "warning");
      return false;
    }
    const canUseSession = await ensureExclusiveSession();
    if (!canUseSession) {
      return false;
    }

    if (!APP_ID) {
      await notify(t.appIdError, "error");
      return false;
    }

    const displayName = isAnonymous
      ? `Guest-${String(profileId || "").slice(0, 6)}`
      : (profileName || username).trim();

    if (!displayName) {
      await notify(t.profileRequired, "warning");
      setScreen("profile");
      return false;
    }

    const requestedRoomName = String(options.roomName ?? roomName).trim();
    const requestedRoomPassword = String(options.roomPassword ?? roomPassword).trim();
    const requestedMode = options.mode || roomMode;
    const requestedRoomKey = requestedRoomName ? toRoomKey(requestedRoomName) : "";
    const isInviteJoinAttempt = Boolean(options?.isInviteRequestRoom);

    if (requestedMode === "join" && requestedRoomKey) {
      if (blockedInviteRoomKeysRef.current[requestedRoomKey]) {
        return false;
      }
      const roomMetaSnap = await get(ref(db, `roomMeta/${requestedRoomKey}`)).catch(() => null);
      const roomMeta = roomMetaSnap?.val?.() || {};
      const blockedByMeta = Boolean(profileUid && roomMeta?.blockedRejoinByUid?.[profileUid]);
      if (blockedByMeta) {
        blockedInviteRoomKeysRef.current[requestedRoomKey] = Date.now();
        return false;
      }
      if (roomMeta?.isInviteRequestRoom && !isInviteJoinAttempt && !options?.allowFromLobbyStart) {
        return false;
      }
    }

    if (!requestedRoomName) {
      await notify(t.roomNameRequired, "warning");
      return false;
    }

    if (!requestedRoomPassword) {
      await notify(t.roomPasswordRequired, "warning");
      return false;
    }

    if (!backendCandidates.length) {
      await notify(t.backendNotReachable, "error");
      return false;
    }

    if (adminBackendUrl && !isHttpUrl(adminBackendUrl)) {
      await notify(t.backendInvalidUrl, "warning");
      return false;
    }

    joinInFlightRef.current = true;
    joinInFlightStartedAtRef.current = Date.now();
    setJoining(true);

    try {
      const safeRoomName = requestedRoomName;
      const safeRoomPassword = requestedRoomPassword;
      const encoderConfig = buildMicEncoderConfig();

      const localTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig });
      let tokenPayload = null;
      const tokenAttempts = isLegacyAndroid ? 5 : 4;
      for (let attempt = 1; attempt <= tokenAttempts; attempt += 1) {
        try {
          tokenPayload = await requestToken(requestedMode, safeRoomName, safeRoomPassword);
          if (tokenPayload?.token) break;
        } catch (_error) {
          if (attempt < tokenAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
          }
        }
      }
      if (!tokenPayload?.token) {
        localTrack.stop?.();
        localTrack.close?.();
        throw new Error(t.backendTokenError);
      }

      const { token, uid, roomName: finalRoomName } = tokenPayload;
      const finalName = finalRoomName || safeRoomName;
      const finalRoomKey = toRoomKey(finalName);
      if (activeRoomKey && localCallEntryKeyRef.current) {
        await remove(ref(db, `callUsers/${activeRoomKey}/${localCallEntryKeyRef.current}`)).catch(() => {});
      }
      const existingRoomUsersSnap = await get(ref(db, `callUsers/${finalRoomKey}`)).catch(() => null);
      const existingRoomUsers = existingRoomUsersSnap?.val?.() || {};
      const stalePresenceTasks = Object.entries(existingRoomUsers)
        .filter(([entryKey, value]) => {
          const normalized = normalizeCallUser(value);
          const sameEntryKey = Boolean(localCallEntryKeyRef.current && entryKey === localCallEntryKeyRef.current);
          const sameUid = Boolean(profileUid && normalized.uid === profileUid);
          const sameProfileId = Boolean(profileId && normalized.profileId === profileId);
          return sameEntryKey || sameUid || sameProfileId;
        })
        .map(([entryKey]) => remove(ref(db, `callUsers/${finalRoomKey}/${entryKey}`)).catch(() => {}));
      if (stalePresenceTasks.length) {
        await Promise.allSettled(stalePresenceTasks);
      }

      let joinedUid;
      try {
        joinedUid = await withPromiseTimeout(
          client.join(APP_ID, finalName, token, uid),
          AGORA_JOIN_TIMEOUT_MS,
          "Agora join timeout"
        );
      } catch (joinError) {
        const text = String(joinError?.message || joinError || "");
        if (/INVALID_OPERATION/i.test(text)) {
          await client.leave().catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 220));
          joinedUid = await withPromiseTimeout(
            client.join(APP_ID, finalName, token, uid),
            AGORA_JOIN_TIMEOUT_MS,
            "Agora join timeout"
          );
        } else {
          throw joinError;
        }
      }
      setUserUID(joinedUid);
      setCallStartedAt(Date.now());
      activeSessionIdRef.current = `${Date.now()}_${uid}`;

      localTrackRef.current = localTrack;
      localTrack.setVolume?.(micLowered ? 20 : 100);
      await applyTrackMutedState(localTrack, false);
      let published = false;
      const publishAttempts = isLegacyAndroid ? 4 : 3;
      for (let attempt = 1; attempt <= publishAttempts; attempt += 1) {
        try {
          await withPromiseTimeout(
            client.publish([localTrack]),
            AGORA_PUBLISH_TIMEOUT_MS,
            "Agora publish timeout"
          );
          published = true;
          break;
        } catch (_error) {
          if (attempt < publishAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          }
        }
      }
      if (!published) {
        throw new Error(t.backendTokenError);
      }
      setIsMuted(false);
      setMicLowered(false);
      client.enableAudioVolumeIndicator();
      client.removeAllListeners();

      const callEntryKey = `${sessionInstanceRef.current}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localCallEntryKeyRef.current = callEntryKey;
      const callUserRef = ref(db, `callUsers/${finalRoomKey}/${callEntryKey}`);
      await set(callUserRef, {
        socketId: callEntryKey,
        agoraUid: joinedUid,
        uid: profileUid || "",
        profileId: profileId || "",
        name: displayName,
        avatar: profileAvatar || "",
        emoji: profileEmoji || "",
        color: profileColor || DEFAULT_PROFILE_COLOR,
        gender: profileGender || "not_set",
        birthDate: profileBirthDate || "",
        stabilityMode,
        adminMuted: false,
        networkStatus: NETWORK_STATUS.good,
        lastSeen: Date.now(),
      });
      callParticipantsRef.current = {
        [profileUid || callEntryKey || String(joinedUid)]: displayName,
      };
      callUserDisconnectRef.current = onDisconnect(callUserRef);
      callUserDisconnectRef.current.remove().catch(() => {});
      const roomMetaRef = ref(db, `roomMeta/${finalRoomKey}`);
      const existingMetaSnapshot = await get(roomMetaRef).catch(() => null);
      const existingMeta = existingMetaSnapshot?.val?.() || {};
      await update(roomMetaRef, {
        roomName: finalName,
        createdAt: existingMeta.createdAt || Date.now(),
        createdByUid: existingMeta.createdByUid || (requestedMode === "create" ? profileUid : ""),
        isGroupCall: Boolean(existingMeta.isGroupCall || options?.isGroupCall),
        isInviteRequestRoom: Boolean(existingMeta.isInviteRequestRoom || options?.isInviteRequestRoom),
        expiresAt: Date.now() + ROOM_LIFETIME_MS,
      });

      client.on("volume-indicator", (levels) => {
        if (!Array.isArray(levels)) return;
        const next = {};
        let localSpeakingNow = false;
        levels.forEach((item) => {
          next[item.uid] = (item.level || 0) >= SPEAKING_LEVEL_THRESHOLD;
          if (item.uid === joinedUid || item.uid === 0) {
            localSpeakingNow = (item.level || 0) >= SPEAKING_LEVEL_THRESHOLD;
          }
        });
        setSpeakingUsers((prev) => ({ ...prev, ...next }));
        setLocalSpeaking(localSpeakingNow);
        if (localSpeakingNow) {
          speakingSecondsRef.current += 2;
        }
      });

      const subscribeAndPlay = async (remoteUser, mediaType = "audio") => {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === "audio" && remoteUser.audioTrack) {
          if (stabilityMode === STABILITY_MODES.higher) {
            remoteUser.audioTrack.setVolume?.(30);
          } else if (stabilityMode === STABILITY_MODES.ultra) {
            remoteUser.audioTrack.setVolume?.(22);
          } else if (stabilityMode === STABILITY_MODES.high) {
            remoteUser.audioTrack.setVolume?.(100);
          }
          remoteUser.audioTrack.play();
        }
      };

      const subscribeAndPlayWithRetry = async (remoteUser, mediaType = "audio") => {
        const maxAttempts = isLegacyAndroid ? 5 : 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            await subscribeAndPlay(remoteUser, mediaType);
            return true;
          } catch (_error) {
            if (attempt < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 220 * attempt));
            }
          }
        }
        return false;
      };

      client.on("user-published", async (user, mediaType) => {
        await subscribeAndPlayWithRetry(user, mediaType);
      });

      client.on("user-joined", async (user) => {
        if (user.hasAudio) {
          await subscribeAndPlayWithRetry(user, "audio");
        }
      });

      client.on("user-left", async (user) => {
        const usersSnap = await get(ref(db, `callUsers/${finalRoomKey}`)).catch(() => null);
        const usersMap = usersSnap?.val?.() || {};
        const removeTasks = Object.entries(usersMap)
          .filter(([, value]) => String(normalizeCallUser(value).agoraUid) === String(user.uid))
          .map(([entryKey]) => remove(ref(db, `callUsers/${finalRoomKey}/${entryKey}`)).catch(() => {}));
        if (removeTasks.length) {
          await Promise.allSettled(removeTasks);
        }
      });

      await Promise.allSettled(
        (client.remoteUsers || [])
          .filter((remote) => remote.uid !== joinedUid && (remote.hasAudio || remote.audioTrack))
          .map((remote) => subscribeAndPlayWithRetry(remote, "audio"))
      );

      const renewToken = async () => {
        try {
          const renewed = await requestToken("join", finalName, safeRoomPassword);
          if (renewed?.token) {
            await client.renewToken(renewed.token);
          }
        } catch (_error) {
          // best effort
        }
      };

      client.on("token-privilege-will-expire", renewToken);
      client.on("token-privilege-did-expire", renewToken);
      client.on("connection-state-change", (currentState, _prevState, reason) => {
        if (currentState === "RECONNECTING") {
          setConnectionQuality(t.medium);
          setLocalNetworkStatus(NETWORK_STATUS.weak);
        }
        if (currentState === "DISCONNECTED" && reason !== "LEAVE") {
          setConnectionQuality(t.weak);
          setLocalNetworkStatus(NETWORK_STATUS.offline);
        }
        if (currentState === "CONNECTED") {
          setLocalNetworkStatus(NETWORK_STATUS.good);
        }
      });

      setActiveRoomName(finalName);
      setActiveRoomKey(finalRoomKey);
      setRoomName(finalName);
      setRoomPassword(safeRoomPassword);
      setRoomMode(requestedMode);
      previousUserIdsRef.current = [String(callEntryKey)];
      setGroupLobbyId("");
      setGroupLobbyMeta(null);
      setGroupLobbyMembers({});
      setShowGroupLobby(false);
      inCallHardRef.current = true;
      isLeavingCallRef.current = false;
      setInCall(true);
      setIsGroupCallSession(Boolean(existingMeta.isGroupCall || options?.isGroupCall));
      setIsInviteRequestRoomSession(Boolean(existingMeta.isInviteRequestRoom || options?.isInviteRequestRoom));
      setAdminMuteLocked(false);
      setConnectionQuality("-");
      return true;
    } catch (error) {
      inCallHardRef.current = false;
      localTrackRef.current?.stop?.();
      localTrackRef.current?.close?.();
      localTrackRef.current = null;
      await client.leave().catch(() => {});
      client.removeAllListeners();
      localCallEntryKeyRef.current = "";
      const msg = String(error?.message || t.backendTokenError);
      if (/token cancel|agora token cancel|agorartc.*leave/i.test(msg)) {
        return false;
      }
      const smartMessage =
        /failed to fetch|bad gateway|502|504/i.test(msg)
          ? `${t.backendNotReachable}\n\nTip: Make sure backend is running on port 5000 and ngrok tunnel is active.`
          : msg;
      if (suppressErrorNotify) {
        return false;
      }
      await notify(smartMessage, "error");
      return false;
    } finally {
      setJoining(false);
      joinInFlightRef.current = false;
      joinInFlightStartedAtRef.current = 0;
    }
  }, [
    adminBackendUrl,
    activeRoomKey,
    backendCandidates.length,
    client,
    requestToken,
    roomMode,
    roomName,
    roomPassword,
    profileBirthDate,
    profileEmoji,
    profileGender,
    t.appIdError,
    t.backendInvalidUrl,
    t.backendNotReachable,
    t.backendTokenError,
    t.profileRequired,
    t.medium,
    t.roomNameRequired,
    t.roomPasswordRequired,
    t.weak,
    profileAvatar,
    profileColor,
    profileLoaded,
    profileName,
    profileId,
    profileUid,
    stabilityMode,
    isLegacyAndroid,
    micLowered,
    joining,
    inCall,
    groupLobbyId,
    isAnonymous,
    buildMicEncoderConfig,
    ensureExclusiveSession,
      notify,
      t.busyInLobby,
      username,
  ]);

  const joinCall = useCallback(async () => {
    autoRoomPermissionRef.current = {
      until: Date.now() + 3 * 60 * 1000,
      reason: "manual_start",
    };
    await joinCallInternal();
  }, [joinCallInternal]);

  useEffect(() => {
    if (!pendingGroupJoin || inCall || joining) return;
    joinCallInternal(pendingGroupJoin);
    setPendingGroupJoin(null);
  }, [inCall, joinCallInternal, joining, pendingGroupJoin]);

  useEffect(() => {
    inCallHardRef.current = Boolean(inCall);
  }, [inCall]);

  const ensureLocalTrackReady = useCallback(async () => {
    if (!inCall) return localTrackRef.current;
    const activeTrack = localTrackRef.current;
    const activeMediaTrack = activeTrack?.getMediaStreamTrack?.();
    if (activeTrack && activeMediaTrack && activeMediaTrack.readyState === "live") {
      return activeTrack;
    }

    if (client.connectionState && client.connectionState !== "CONNECTED") {
      return null;
    }

    try {
      const recoveredTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: buildMicEncoderConfig(),
      });
      const oldTrack = localTrackRef.current;
      if (oldTrack) {
        await client.unpublish([oldTrack]).catch(() => {});
        oldTrack.stop?.();
        oldTrack.close?.();
      }
      if (micLowered) {
        recoveredTrack.setVolume?.(20);
      } else {
        recoveredTrack.setVolume?.(100);
      }
      await applyTrackMutedState(recoveredTrack, isMuted || adminMuteLocked);
      await client.publish([recoveredTrack]);
      localTrackRef.current = recoveredTrack;
      return recoveredTrack;
    } catch (_error) {
      return null;
    }
  }, [adminMuteLocked, buildMicEncoderConfig, client, inCall, isMuted, micLowered]);

  useEffect(() => {
    if (!inCall) return undefined;
    let cancelled = false;
    const probe = async () => {
      if (cancelled || !inCall) return;
      await ensureLocalTrackReady();
    };
    probe();
    const interval = setInterval(probe, 5500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ensureLocalTrackReady, inCall]);

  const toggleMute = useCallback(async () => {
    const track = (await ensureLocalTrackReady()) || localTrackRef.current;
    if (!track) {
      await notify(t.waitingBackend, "warning", "", { autoCloseMs: 1800 });
      return;
    }
    if (adminMuteLocked && isMuted) {
      await notify(t.onlyAdminCanUnmute, "warning");
      return;
    }
    const nextMuted = !isMuted;
    const changed = await applyTrackMutedState(track, nextMuted);
    if (!changed) {
      await notify(t.backendTokenError, "warning", "", { autoCloseMs: 1800 });
      return;
    }
    setIsMuted((prev) => !prev);
    if (!isMuted && userUID !== null) {
      setSpeakingUsers((prev) => ({ ...prev, [userUID]: false }));
    }
  }, [adminMuteLocked, ensureLocalTrackReady, isMuted, notify, t.backendTokenError, t.onlyAdminCanUnmute, t.waitingBackend, userUID]);

  const toggleMicVolume = useCallback(async () => {
    const track = (await ensureLocalTrackReady()) || localTrackRef.current;
    if (!track) {
      await notify(t.waitingBackend, "warning", "", { autoCloseMs: 1800 });
      return;
    }

    if (micLowered) {
      try {
        track.setVolume?.(100);
      } catch (_error) {
        await notify(t.backendTokenError, "warning", "", { autoCloseMs: 1800 });
        return;
      }
      setMicLowered(false);
    } else {
      try {
        track.setVolume?.(20);
      } catch (_error) {
        await notify(t.backendTokenError, "warning", "", { autoCloseMs: 1800 });
        return;
      }
      setMicLowered(true);
    }
  }, [ensureLocalTrackReady, micLowered, notify, t.backendTokenError, t.waitingBackend]);

  const toggleRecording = useCallback(async () => {
    const track = (await ensureLocalTrackReady()) || localTrackRef.current;
    if (!track || !activeRoomKey) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      await set(ref(db, `recordingStatus/${activeRoomKey}`), {
        isRecording: false,
        by: userUID || null,
        at: Date.now(),
      });
      await notify(t.recordingStopped, "info", "", { autoCloseMs: 2000 });
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      await notify(t.backendTokenError, "warning", "", { autoCloseMs: 1800 });
      return;
    }
    const preferredMimeType = "audio/webm";
    const recorderOptions =
      MediaRecorder.isTypeSupported?.(preferredMimeType)
        ? { mimeType: preferredMimeType }
        : undefined;
    let recorder;
    try {
      recorder = recorderOptions
        ? new MediaRecorder(new MediaStream([track.getMediaStreamTrack()]), recorderOptions)
        : new MediaRecorder(new MediaStream([track.getMediaStreamTrack()]));
    } catch (_error) {
      await notify(t.backendTokenError, "warning", "", { autoCloseMs: 1800 });
      return;
    }
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
    await notify(t.recordingStarted, "success", "", { autoCloseMs: 2000 });
  }, [activeRoomKey, ensureLocalTrackReady, isRecording, notify, t.backendTokenError, t.recordingStarted, t.recordingStopped, userUID]);

  const finalizeCallHistory = useCallback(async () => {
    if (!profileId || !callStartedAt || !activeRoomName) return;
    const endedAt = Date.now();
    const durationSeconds = Math.max(0, Math.floor((endedAt - callStartedAt) / 1000));
    const participants = Object.values(callParticipantsRef.current || {}).filter(Boolean);
    const sessionId = activeSessionIdRef.current || `${endedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const speakingSecondsInSession = Math.max(0, Math.round(speakingSecondsRef.current || 0));

    const nextTotal = (profileCallSeconds || 0) + durationSeconds;
    const nextSpeakingTotal = (profileSpeakingSeconds || 0) + speakingSecondsInSession;
    setProfileCallSeconds(nextTotal);
    setProfileSpeakingSeconds(nextSpeakingTotal);
    setProfileHistory((prev) => [
      {
        id: sessionId,
        roomName: activeRoomName,
        type: roomMode === "create" ? t.historyOutgoing : t.historyIncoming,
        startedAt: callStartedAt,
        endedAt,
        durationSeconds,
        speakingSeconds: speakingSecondsInSession,
        qualityAtEnd: connectionQuality,
        participants,
      },
      ...prev,
    ]);

    await update(ref(db, `profiles/${profileId}`), {
      totalCallSeconds: nextTotal,
      totalSpeakingSeconds: nextSpeakingTotal,
      [`history/${sessionId}`]: {
        roomName: activeRoomName,
        type: roomMode === "create" ? t.historyOutgoing : t.historyIncoming,
        startedAt: callStartedAt,
        endedAt,
        durationSeconds,
        speakingSeconds: speakingSecondsInSession,
        qualityAtEnd: connectionQuality,
        participants,
      },
    }).catch(() => {});
    speakingSecondsRef.current = 0;
  }, [
    activeRoomName,
    callStartedAt,
    connectionQuality,
    profileCallSeconds,
    profileId,
    profileSpeakingSeconds,
    roomMode,
    t.historyIncoming,
    t.historyOutgoing,
  ]);

  const leaveCall = useCallback(async () => {
    const ok = await confirmDialog(t.leaveCallConfirm, t.leaveCallConfirmTitle);
    if (!ok) return;
    isLeavingCallRef.current = true;
    const leavingRoomKey = activeRoomKey;
    const leavingUserUid = userUID;
    const leavingCallEntryKey = localCallEntryKeyRef.current;
    const leaveTs = Date.now();
    callActionCooldownUntilRef.current = Date.now() + 10 * 1000;
    autoJoinCooldownUntilRef.current = leaveTs + 15000;
    ignoreRoomReadyBeforeRef.current = leaveTs;
    autoRoomPermissionRef.current = { until: 0, reason: "" };
    incomingJoinDialogOpenRef.current = false;
    hideCallProgressDialog();
    outgoingRequestDialogOpenRef.current = false;
    setOutgoingCallRequest(null);
    receiverJoinFlowRef.current = { callId: "", joining: false };
    joinInFlightRef.current = false;
    joinInFlightStartedAtRef.current = 0;
    inCallHardRef.current = false;
    setJoining(false);
    setInCall(false);
    try {
      mediaRecorderRef.current?.stop();
      localTrackRef.current?.stop();
      localTrackRef.current?.close();
      localTrackRef.current = null;
      client.removeAllListeners();
      await client.leave();
    } finally {
      await finalizeCallHistory();
      callUserDisconnectRef.current?.cancel?.();
      callUserDisconnectRef.current = null;
      if (leavingRoomKey) {
        await set(ref(db, `recordingStatus/${leavingRoomKey}`), {
          isRecording: false,
          by: leavingUserUid || null,
          at: Date.now(),
        }).catch(() => {});
      }

      if (leavingRoomKey && leavingCallEntryKey) {
        await remove(ref(db, `callUsers/${leavingRoomKey}/${leavingCallEntryKey}`)).catch(() => {});
      }

      if (leavingRoomKey && isInviteRequestRoomSession && profileUid) {
        blockedInviteRoomKeysRef.current[leavingRoomKey] = Date.now();
        await update(ref(db, `roomMeta/${leavingRoomKey}`), {
          [`blockedRejoinByUid/${profileUid}`]: Date.now(),
        }).catch(() => {});
      }

      if (leavingRoomKey) {
        const usersSnap = await get(ref(db, `callUsers/${leavingRoomKey}`)).catch(() => null);
        const usersObj = usersSnap?.val?.() || {};
        if (Object.keys(usersObj).length === 0) {
          const emptySinceAt = Date.now();
          await update(ref(db, `roomMeta/${leavingRoomKey}`), { emptySince: emptySinceAt }).catch(() => {});
          setTimeout(async () => {
            const latestUsersSnap = await get(ref(db, `callUsers/${leavingRoomKey}`)).catch(() => null);
            const latestUsers = latestUsersSnap?.val?.() || {};
            if (Object.keys(latestUsers).length > 0) return;
            await Promise.allSettled([
              remove(ref(db, `roomMeta/${leavingRoomKey}`)),
              remove(ref(db, `callUsers/${leavingRoomKey}`)),
              remove(ref(db, `recordingStatus/${leavingRoomKey}`)),
              remove(ref(db, `muteCommands/${leavingRoomKey}`)),
            ]);
          }, ROOM_EMPTY_CLEANUP_DELAY_MS + 100);
        } else {
          await update(ref(db, `roomMeta/${leavingRoomKey}`), { emptySince: null }).catch(() => {});
        }
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
      setRoomName("");
      setRoomPassword("");
      setUserUID(null);
      setActiveBackendUrl("");
      setCallStartedAt(null);
      activeSessionIdRef.current = "";
      callParticipantsRef.current = {};
      setLocalNetworkStatus(NETWORK_STATUS.good);
      setLocalSpeaking(false);
      setAdminMuteLocked(false);
      setIsGroupCallSession(false);
      setIsInviteRequestRoomSession(false);
      setSelectedCallUser(null);
      setPendingGroupJoin(null);
      speakingSecondsRef.current = 0;
      previousUserIdsRef.current = [];
      localCallEntryKeyRef.current = "";
      receiverJoinFlowRef.current = { callId: "", joining: false };
      joinInFlightRef.current = false;
      joinInFlightStartedAtRef.current = 0;
      inCallHardRef.current = false;
      setJoining(false);
      setInCall(false);
      isLeavingCallRef.current = false;
    }
  }, [activeRoomKey, client, confirmDialog, finalizeCallHistory, hideCallProgressDialog, isInviteRequestRoomSession, profileUid, t.leaveCallConfirm, t.leaveCallConfirmTitle, userUID]);

  const inviteCode = useMemo(() => {
    if (!activeRoomName || !roomPassword.trim()) return "-";
    return `${activeRoomName} | ${roomPassword.trim()}`;
  }, [activeRoomName, roomPassword]);

  const copyInviteCode = useCallback(async () => {
    if (!activeRoomName || !roomPassword.trim()) return;
    await navigator.clipboard.writeText(inviteCode);
    await notify(t.copied, "success");
  }, [activeRoomName, inviteCode, notify, roomPassword, t.copied]);

  const saveAdminBackend = useCallback(async () => {
    const value = adminBackendUrl.trim().replace(/\/+$/, "");
    if (!value) {
      setAdminBackendUrl(LOCAL_BACKEND_URL);
      setActiveBackendUrl("");
      await notify(t.backendConnected, "success", "", { autoCloseMs: 2000 });
      localStorage.setItem(BACKEND_ONBOARDING_KEY, "1");
      setShouldAutoOpenBackendAfterProfileSave(false);
      setTimeout(() => window.location.reload(), 2100);
      return;
    }
    if (!isHttpUrl(value)) {
      await notify(t.backendInvalidUrl, "warning", "", { autoCloseMs: 2000 });
      return;
    }
    setAdminBackendUrl(value);
    setActiveBackendUrl(value);
    await notify(`${t.backendConnected}: ${value}`, "success", "", { autoCloseMs: 2000 });
    localStorage.setItem(BACKEND_ONBOARDING_KEY, "1");
    setShouldAutoOpenBackendAfterProfileSave(false);
    setTimeout(() => window.location.reload(), 2100);
  }, [adminBackendUrl, notify, t.backendConnected, t.backendInvalidUrl]);

  useEffect(() => {
    if (!showSettingsPanel || settingsTab !== "contacts") return;
    if (contactRequests.length > 0) {
      setShowRequestsModal(true);
    }
  }, [showSettingsPanel, settingsTab, contactRequests.length]);

  const copyUid = useCallback(
    async (uid) => {
      if (!uid) return;
      await navigator.clipboard.writeText(uid);
      await notify(t.copiedUid, "success");
    },
    [notify, t.copiedUid]
  );

  const clearCallHistory = useCallback(async () => {
    if (!profileId) return;
    await remove(ref(db, `profiles/${profileId}/history`)).catch(() => {});
    await update(ref(db, `profiles/${profileId}`), { totalCallSeconds: 0, totalSpeakingSeconds: 0 }).catch(() => {});
    setProfileHistory([]);
    setProfileCallSeconds(0);
    setProfileSpeakingSeconds(0);
    await notify(t.historyCleared, "success");
  }, [notify, profileId, t.historyCleared]);

  const clearMissedCalls = useCallback(async () => {
    if (!profileUid) return;
    await remove(ref(db, `missedCalls/${profileUid}`)).catch(() => {});
    setMissedCalls([]);
    await notify(t.missedCleared, "success");
  }, [notify, profileUid, t.missedCleared]);

  const previewRingtone = useCallback((ringtoneId) => {
    const src = RINGTONES[ringtoneId];
    if (!src) return;
    if (ringtonePreviewRef.current) {
      ringtonePreviewRef.current.pause();
      ringtonePreviewRef.current.currentTime = 0;
    }
    const audio = new Audio(src);
    audio.volume = 0.9;
    audio.play().catch(() => {});
    ringtonePreviewRef.current = audio;
  }, []);

  const selectRingtone = useCallback(
    async (ringtoneId) => {
      setSelectedRingtone(ringtoneId);
      if (profileId) {
        await update(ref(db, `profiles/${profileId}`), { ringtoneId }).catch(() => {});
      }
      await notify(t.ringtoneSaved, "success", "", { autoCloseMs: 1500 });
    },
    [notify, profileId, t.ringtoneSaved]
  );

  const openCallUserInfo = useCallback(
    async (rawUser) => {
      const base = normalizeCallUser(rawUser);
      if (!base.uid) {
        setSelectedCallUser(base);
        return;
      }
      const snap = await get(ref(db, `uidDirectory/${base.uid}`)).catch(() => null);
      const merged = { ...base, ...(snap?.val?.() || {}) };
      setSelectedCallUser(merged);
    },
    []
  );

  const openGroupLobby = useCallback(async () => {
    if (!profileUid || !profileId) return;
    const canUseSession = await ensureExclusiveSession();
    if (!canUseSession) return;
    if (groupLobbyId) {
      setShowGroupLobby(true);
      return;
    }
    const lobbyId = `lobby_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await set(ref(db, `groupLobbies/${lobbyId}`), {
      id: lobbyId,
      adminUid: profileUid,
      adminProfileId: profileId,
      adminName: profileName || username || profileUid,
      status: "waiting",
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
    await set(ref(db, `groupLobbies/${lobbyId}/members/${profileUid}`), {
      uid: profileUid,
      profileId,
      name: profileName || username || profileUid,
      avatar: profileAvatar || "",
      emoji: profileEmoji || "",
      status: "admin",
      joinedAt: Date.now(),
    });
    setGroupLobbyId(lobbyId);
    setShowGroupLobby(true);
  }, [ensureExclusiveSession, groupLobbyId, profileAvatar, profileEmoji, profileId, profileName, profileUid, username]);

  const inviteContactToLobby = useCallback(
    async (target) => {
      if (!groupLobbyId || !target?.uid) return;
      if (groupLobbyMeta?.adminUid !== profileUid) return;
      if (target.uid === groupLobbyMeta?.adminUid) return;
      if (groupLobbyMembers[target.uid]) return;
      const livePresence = await get(ref(db, `uidDirectory/${target.uid}`)).catch(() => null);
      const presence = livePresence?.val?.() || contactsPresence[target.uid] || {};
      if (!presence.isOnline || presence.inCallRoomKey) {
        await notify(t.groupInviteOnlyOnline, "warning");
        return;
      }
      setGroupInviteBusy(true);
      try {
        const inviteId = `ginv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await set(ref(db, `groupLobbyInvites/${target.uid}/${inviteId}`), {
          lobbyId: groupLobbyId,
          adminUid: profileUid,
          adminName: profileName || username || profileUid,
          createdAt: Date.now(),
          status: CONTACT_REQUEST_STATUS.pending,
        });
        await notify(t.groupInviteSent, "success");
      } finally {
        setGroupInviteBusy(false);
      }
    },
    [
      contactsPresence,
      groupLobbyId,
      groupLobbyMembers,
      groupLobbyMeta?.adminUid,
      notify,
      profileName,
      profileUid,
      t.groupInviteOnlyOnline,
      t.groupInviteSent,
      username,
    ]
  );

  const searchUidForLobby = useCallback(async () => {
    const uid = groupSearchUid.trim().toUpperCase();
    if (!uid || uid === profileUid) return;
    const snapshot = await get(ref(db, `uidDirectory/${uid}`)).catch(() => null);
    const data = snapshot?.val?.();
    if (!data) {
      setGroupSearchResult(null);
      await notify(t.userNotFound, "warning");
      return;
    }
    setGroupSearchResult(data);
  }, [groupSearchUid, notify, profileUid, t.userNotFound]);

  const removeMemberFromLobby = useCallback(
    async (memberUid) => {
      if (!groupLobbyId || !memberUid) return;
      if (groupLobbyMeta?.adminUid !== profileUid) return;
      if (memberUid === groupLobbyMeta?.adminUid) return;
      await remove(ref(db, `groupLobbies/${groupLobbyId}/members/${memberUid}`)).catch(() => {});
      await notify(t.groupMemberRemoved, "info");
    },
    [groupLobbyId, groupLobbyMeta?.adminUid, notify, profileUid, t.groupMemberRemoved]
  );

  const closeGroupLobby = useCallback(async () => {
    if (!groupLobbyId || !profileUid) {
      setShowGroupLobby(false);
      return;
    }
    const ok = await confirmDialog(t.leaveLobbyConfirm, t.groupLobbyTitle);
    if (!ok) return;
    const isAdmin = groupLobbyMeta?.adminUid === profileUid;
    if (isAdmin) {
      await update(ref(db, `groupLobbies/${groupLobbyId}`), {
        status: "cancelled",
        cancelledAt: Date.now(),
        closedBy: profileUid,
      }).catch(() => {});
    } else {
      await remove(ref(db, `groupLobbies/${groupLobbyId}/members/${profileUid}`)).catch(() => {});
    }
    hideGroupCreatingDialog();
    setShowGroupLobby(false);
    setGroupLobbyId("");
    setGroupLobbyMembers({});
    setGroupLobbyMeta(null);
  }, [confirmDialog, groupLobbyId, groupLobbyMeta?.adminUid, hideGroupCreatingDialog, profileUid, t.groupLobbyTitle, t.leaveLobbyConfirm]);

  const startGroupCallFromLobby = useCallback(async () => {
    if (!groupLobbyId || !profileUid) return;
    if (groupLobbyMeta?.adminUid !== profileUid) return;
    const members = Object.values(groupLobbyMembers || {}).filter((item) => item?.uid && item.uid !== profileUid);
    if (!members.length) {
      await notify(t.waitingMembers, "warning");
      return;
    }
    const room = randomRoomValue("group");
    const password = randomRoomValue("pw");

    await update(ref(db, `groupLobbies/${groupLobbyId}`), {
      status: "creating",
      roomName: room,
      roomPassword: password,
      creatingAt: Date.now(),
    });
    showGroupCreatingDialog();

    setShowGroupLobby(false);
    setRoomMode("create");
    setRoomName(room);
    setRoomPassword(password);
    autoRoomPermissionRef.current = {
      until: Date.now() + 3 * 60 * 1000,
      reason: "group_start",
    };
    const ok = await joinCallInternal({
      mode: "create",
      roomName: room,
      roomPassword: password,
      isGroupCall: true,
      allowFromLobbyStart: true,
    });
    if (!ok) {
      await update(ref(db, `groupLobbies/${groupLobbyId}`), { status: "waiting" }).catch(() => {});
      hideGroupCreatingDialog();
      await notify(t.roomCreateFailed, "error");
      return;
    }
    await update(ref(db, `groupLobbies/${groupLobbyId}`), {
      status: "started",
      startedAt: Date.now(),
    }).catch(() => {});
  }, [
    groupLobbyId,
    groupLobbyMembers,
    groupLobbyMeta?.adminUid,
    hideGroupCreatingDialog,
    joinCallInternal,
    notify,
    profileUid,
    t.roomCreateFailed,
    t.waitingMembers,
    showGroupCreatingDialog,
  ]);

  const muteMemberInRoom = useCallback(
    async (targetUid, shouldUnmute = false) => {
      if (!isRoomAdmin || !activeRoomKey || !targetUid) return;
      const action = shouldUnmute ? "unmute" : "mute";
      await set(ref(db, `muteCommands/${activeRoomKey}/${targetUid}`), {
        byUid: profileUid,
        byName: profileName || username || "Admin",
        action,
        status: "pending",
        createdAt: Date.now(),
      }).catch(() => {});

      const usersSnap = await get(ref(db, `callUsers/${activeRoomKey}`)).catch(() => null);
      const usersMap = usersSnap?.val?.() || {};
      const updates = {};
      Object.entries(usersMap).forEach(([entryKey, value]) => {
        const normalized = normalizeCallUser(value);
        if (normalized.uid === targetUid) {
          updates[`${entryKey}/adminMuted`] = !shouldUnmute;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(ref(db, `callUsers/${activeRoomKey}`), updates).catch(() => {});
      }
    },
    [activeRoomKey, isRoomAdmin, profileName, profileUid, username]
  );

  const deleteProfile = useCallback(async () => {
    const ok = await confirmDialog(t.profileDeleteConfirm, t.profileDelete);
    if (!ok || !profileId) return;

    const contactRows = Object.values(contacts || {});
    await Promise.allSettled(
      contactRows.map((item) => {
        if (!item?.profileId || !profileUid) return Promise.resolve();
        return remove(ref(db, `contacts/${item.profileId}/${profileUid}`)).catch(() => {});
      })
    );

    await Promise.allSettled([
      remove(ref(db, `profiles/${profileId}`)).catch(() => {}),
      remove(ref(db, `contacts/${profileId}`)).catch(() => {}),
      remove(ref(db, `blockedContacts/${profileId}`)).catch(() => {}),
      remove(ref(db, `contactRequests/${profileUid}`)).catch(() => {}),
      remove(ref(db, `invites/${profileUid}`)).catch(() => {}),
      remove(ref(db, `missedCalls/${profileUid}`)).catch(() => {}),
      remove(ref(db, `uidDirectory/${profileUid}`)).catch(() => {}),
    ]);
    localStorage.removeItem(PROFILE_STORAGE_KEY);

    const nextId = generateProfileId();
    localStorage.setItem(PROFILE_STORAGE_KEY, nextId);
    setProfileId(nextId);
    setProfileUid("");
    setProfileName("");
    setUsername("");
    setProfileAvatar("");
    setProfileEmoji("");
    setSelectedRingtone("ringtone_1");
    setProfileColor(DEFAULT_PROFILE_COLOR);
    setStabilityMode(STABILITY_MODES.balanced);
    setIsAnonymous(false);
    setProfileGender("not_set");
    setProfileBirthDate("");
    setProfileCallSeconds(0);
    setProfileSpeakingSeconds(0);
    setProfileHistory([]);
    setScreen("profile");
    await notify(t.profileDeleted, "success", "", { autoCloseMs: 1200 });
    setTimeout(() => window.location.reload(), 1300);
  }, [confirmDialog, contacts, notify, profileId, profileUid, t.profileDelete, t.profileDeleteConfirm, t.profileDeleted]);

  const formatDuration = useCallback((seconds) => {
    const safe = Math.max(0, Number(seconds || 0));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }, []);

  const formatLastSeen = useCallback((timestamp) => {
    const ts = Number(timestamp || 0);
    if (!ts) return "-";
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleString();
  }, []);

  const contactsByUid = useMemo(() => {
    const map = {};
    Object.entries(contacts || {}).forEach(([key, item]) => {
      const uid = item?.uid || key;
      if (uid) map[uid] = { ...(item || {}), uid };
    });
    return map;
  }, [contacts]);

  const isBlockedLocally = useCallback(
    (targetUid) => Boolean(targetUid && blockedContacts && blockedContacts[targetUid]),
    [blockedContacts]
  );

  const isBlockedByRemote = useCallback(async (targetProfileId) => {
    if (!targetProfileId || !profileUid) return false;
    const blockedSnapshot = await get(ref(db, `blockedContacts/${targetProfileId}/${profileUid}`)).catch(() => null);
    return Boolean(blockedSnapshot?.exists?.());
  }, [profileUid]);

  const writeMissedCall = useCallback(
    async (targetUid, payload = {}) => {
      if (!targetUid || !profileUid) return;
      const itemId = `miss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await set(ref(db, `missedCalls/${targetUid}/${itemId}`), {
        fromUid: profileUid,
        fromName: profileName || username || profileUid,
        at: Date.now(),
        handled: false,
        ...payload,
      });
    },
    [profileName, profileUid, username]
  );

  const getCallActionCooldownSeconds = useCallback(() => {
    return Math.max(0, Math.ceil((callActionCooldownUntilRef.current - Date.now()) / 1000));
  }, []);

  const grantAutoRoomPermission = useCallback((reason, ttlMs = INVITE_TTL_MS + 30000) => {
    autoRoomPermissionRef.current = {
      until: Date.now() + Math.max(10000, Number(ttlMs || 0)),
      reason: reason || "unknown",
    };
  }, []);

  const hasAutoRoomPermission = useCallback(() => {
    return Date.now() < Number(autoRoomPermissionRef.current.until || 0);
  }, []);

  const markRoomReadyConsumed = useCallback(
    async (inviteId, consumeRefPath, extraPayload = {}) => {
      if (!inviteId || !consumeRefPath || !profileUid) return;
      const payload = {
        consumedAt: Date.now(),
        ...extraPayload,
      };
      const mirrorPath = consumeRefPath.startsWith(`invites/${profileUid}/`)
        ? `roomReadyByInvite/${profileUid}/${inviteId}`
        : consumeRefPath.startsWith(`roomReadyByInvite/${profileUid}/`)
          ? `invites/${profileUid}/${inviteId}`
          : "";
      const paths = [consumeRefPath, mirrorPath].filter(Boolean);
      await Promise.allSettled(
        paths.map((path) =>
          update(ref(db, path), payload).catch(() => {})
        )
      );
    },
    [profileUid]
  );

  const triggerJoinWithRetries = useCallback(
    async (mode, nextRoomName, nextRoomPassword, extraOptions = {}) => {
      if (isLeavingCallRef.current) return false;
      if (joinInFlightRef.current) {
        const joinLockAge = Date.now() - Number(joinInFlightStartedAtRef.current || 0);
        const staleJoinLockMs = isLegacyAndroid ? 180000 : 120000;
        if (!joinInFlightStartedAtRef.current || joinLockAge > staleJoinLockMs) {
          joinInFlightRef.current = false;
          joinInFlightStartedAtRef.current = 0;
          if (!inCall) {
            inCallHardRef.current = false;
          }
        } else {
          return false;
        }
      }
      setRoomMode(mode);
      setRoomName(nextRoomName);
      setRoomPassword(nextRoomPassword);
      const maxAttempts = isLegacyAndroid ? 6 : 4;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (inCall) return true;
        if (isLeavingCallRef.current) return false;
        const joined = await joinCallInternal({
          mode,
          roomName: nextRoomName,
          roomPassword: nextRoomPassword,
          suppressErrorNotify: attempt < maxAttempts,
          ...extraOptions,
        });
        if (joined) return true;
        if (attempt < maxAttempts) {
          const delay = Math.min(3600, 500 + attempt * 650) + Math.floor(Math.random() * 220);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      return false;
    },
    [inCall, isLegacyAndroid, joinCallInternal]
  );

  const waitForInviteSenderReady = useCallback(async (roomNameValue, senderUid, timeoutMs = 45000) => {
    if (!roomNameValue || !senderUid) return true;
    const roomKey = toRoomKey(roomNameValue);
    const started = Date.now();
    const safeTimeout = Math.max(1200, Number(timeoutMs || 0));
    while (Date.now() - started < safeTimeout) {
      const remainingMs = safeTimeout - (Date.now() - started);
      const pollTimeoutMs = Math.max(700, Math.min(2200, remainingMs));
      const snap = await withPromiseTimeout(
        get(ref(db, `callUsers/${roomKey}`)).catch(() => null),
        pollTimeoutMs,
        "invite sender ready poll timeout"
      ).catch(() => null);
      const users = snap?.val?.() || {};
      const senderPresent = Object.values(users).some((user) => {
        const normalized = normalizeCallUser(user);
        return normalized.uid === senderUid;
      });
      if (senderPresent) return true;
      if (remainingMs <= 0) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(800, Math.max(250, remainingMs))));
    }
    return false;
  }, []);

  const stopIncomingRingtone = useCallback(() => {
    if (!incomingRingtoneRef.current) return;
    incomingRingtoneRef.current.pause();
    incomingRingtoneRef.current.currentTime = 0;
    incomingRingtoneRef.current = null;
  }, []);

  const playIncomingRingtone = useCallback(() => {
    stopIncomingRingtone();
    const source = RINGTONES[selectedRingtone] || RINGTONES.ringtone_1;
    const audio = new Audio(source);
    audio.loop = true;
    audio.volume = 0.9;
    audio.play().catch(() => {});
    incomingRingtoneRef.current = audio;
  }, [selectedRingtone, stopIncomingRingtone]);

  const processReceiverRoomReadyInvite = useCallback(
    async (roomReadyInvite, consumeRefPath, handledKey) => {
      if (!roomReadyInvite?.id || !roomReadyInvite?.roomName || !roomReadyInvite?.roomPassword) return;
      const roomReadyCreatedAt = inviteEventTs(roomReadyInvite);
      const releaseHandledKey = () => {
        if (handledKey) {
          delete handledRoomReadyInviteRef.current[handledKey];
        }
      };
      const roomAgeMs = roomReadyCreatedAt > 0 ? Date.now() - roomReadyCreatedAt : 0;
      if (roomAgeMs > INVITE_TTL_MS) {
        markRoomReadyConsumed(roomReadyInvite.id, consumeRefPath, {
          ignoredExpired: true,
          ignoredAt: Date.now(),
        }).catch(() => {});
        releaseHandledKey();
        return;
      }
      const consumeSnap = await get(ref(db, consumeRefPath)).catch(() => null);
      const consumeData = consumeSnap?.val?.();
      if (!consumeData || consumeData.consumedAt) {
        releaseHandledKey();
        return;
      }
      const acceptedByMe = (consumeData?.acceptedBy || roomReadyInvite?.acceptedBy || "") === profileUid;
      if (!hasAutoRoomPermission() && !acceptedByMe) {
        releaseHandledKey();
        return;
      }
      const latestCreatedAt = inviteEventTs(consumeData) || roomReadyCreatedAt || 0;
      if (latestCreatedAt > 0 && Date.now() - latestCreatedAt > INVITE_TTL_MS) {
        markRoomReadyConsumed(roomReadyInvite.id, consumeRefPath, {
          ignoredExpired: true,
          ignoredAt: Date.now(),
        }).catch(() => {});
        releaseHandledKey();
        return;
      }
      const staleByLeaveTs = ignoreRoomReadyBeforeRef.current;
      if (roomReadyCreatedAt > 0 && staleByLeaveTs > 0 && roomReadyCreatedAt <= staleByLeaveTs) {
        markRoomReadyConsumed(roomReadyInvite.id, consumeRefPath, {
          ignoredByLeave: true,
          ignoredAt: Date.now(),
        }).catch(() => {});
        releaseHandledKey();
        return;
      }
      const cooldownLeft = autoJoinCooldownUntilRef.current - Date.now();
      if (cooldownLeft > 0) {
        setTimeout(() => {
          processReceiverRoomReadyInvite(roomReadyInvite, consumeRefPath, handledKey);
        }, cooldownLeft + 140);
        return;
      }
      if (inCall || isLeavingCallRef.current) {
        releaseHandledKey();
        return;
      }
      const flowCallId = `recv_${roomReadyInvite.id}`;
      if (
        receiverJoinFlowRef.current.joining &&
        !joinInFlightRef.current &&
        !inCall &&
        !inCallHardRef.current &&
        !isLeavingCallRef.current
      ) {
        receiverJoinFlowRef.current = { callId: "", joining: false };
      }
      if (receiverJoinFlowRef.current.callId === flowCallId && receiverJoinFlowRef.current.joining) return;
      if (receiverJoinFlowRef.current.joining && receiverJoinFlowRef.current.callId !== flowCallId) {
        releaseHandledKey();
        return;
      }
      receiverJoinFlowRef.current = { callId: flowCallId, joining: true };
      if (!incomingJoinDialogOpenRef.current) incomingJoinDialogOpenRef.current = true;
      showCallProgressDialog(t.incomingCall, t.waitingBackend);

      try {
        const senderUid = roomReadyInvite.fromUid || roomReadyInvite.from || "";
        if (!inCall && !joinInFlightRef.current && inCallHardRef.current) {
          inCallHardRef.current = false;
        }
        const senderReadyDeadline = Date.now() + (isLegacyAndroid ? 22000 : 14000);
        let senderReady = await waitForInviteSenderReady(
          roomReadyInvite.roomName,
          senderUid,
          isLegacyAndroid ? 5000 : 3200
        ).catch(() => false);

        const joinDelay = Math.min(5000, Math.max(0, Number(roomReadyInvite.receiverJoinDelayMs || 2000)));
        if (joinDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, joinDelay));
        }
        let joined = false;
        const receiverJoinDeadline = Date.now() + CALL_PROGRESS_TIMEOUT_MS;
        while (!joined && !inCallHardRef.current && !isLeavingCallRef.current && Date.now() < receiverJoinDeadline) {
          if (!senderReady && Date.now() < senderReadyDeadline) {
            senderReady = await waitForInviteSenderReady(
              roomReadyInvite.roomName,
              senderUid,
              isLegacyAndroid ? 3500 : 2500
            ).catch(() => false);
            if (!senderReady && Date.now() < senderReadyDeadline) {
              await new Promise((resolve) => setTimeout(resolve, 850));
              continue;
            }
          }
          if (joinInFlightRef.current) {
            const joinLockAge = Date.now() - Number(joinInFlightStartedAtRef.current || 0);
            const staleJoinLockMs = isLegacyAndroid ? 180000 : 120000;
            if (!joinInFlightStartedAtRef.current || joinLockAge > staleJoinLockMs) {
              joinInFlightRef.current = false;
              joinInFlightStartedAtRef.current = 0;
              if (!inCall) {
                inCallHardRef.current = false;
              }
            } else {
              await new Promise((resolve) => setTimeout(resolve, 300));
              continue;
            }
          }
          joined = await triggerJoinWithRetries(
            "join",
            roomReadyInvite.roomName,
            roomReadyInvite.roomPassword,
            { allowFromLobbyStart: true, isInviteRequestRoom: true }
          );
          if (joined || inCallHardRef.current) break;
          if (Date.now() < senderReadyDeadline) {
            senderReady = false;
          }
          await new Promise((resolve) => setTimeout(resolve, 900));
        }

        if (joined || inCall || inCallHardRef.current) {
          if (incomingJoinDialogOpenRef.current) incomingJoinDialogOpenRef.current = false;
          hideCallProgressDialog();
          markRoomReadyConsumed(roomReadyInvite.id, consumeRefPath, {
            consumedBy: profileUid,
          }).catch(() => {});
          return;
        }

        if (incomingJoinDialogOpenRef.current) incomingJoinDialogOpenRef.current = false;
        hideCallProgressDialog();
        markRoomReadyConsumed(roomReadyInvite.id, consumeRefPath, {
          failedToJoin: true,
          failedAt: Date.now(),
          failedBy: profileUid,
        }).catch(() => {});
        notify(t.roomCreateFailed, "error", "", { autoCloseMs: 2000 }).catch(() => {});
      } finally {
        receiverJoinFlowRef.current = { callId: "", joining: false };
        if (handledKey) {
          setTimeout(() => {
            delete handledRoomReadyInviteRef.current[handledKey];
          }, 5000);
        }
      }
    },
    [
      hideCallProgressDialog,
      inCall,
      isLegacyAndroid,
      notify,
      profileUid,
      showCallProgressDialog,
      t.incomingCall,
      t.roomCreateFailed,
      t.waitingBackend,
      triggerJoinWithRetries,
      waitForInviteSenderReady,
      hasAutoRoomPermission,
      markRoomReadyConsumed,
    ]
  );

  useEffect(() => {
    if (!incomingInvites.length) return;
    const invite = incomingInvites[0];
    if (!invite?.id) return;
    if (Date.now() < Number(incomingInviteSnoozeUntilRef.current[invite.id] || 0)) return;
    if (handledIncomingInviteRef.current[invite.id]) return;
    handledIncomingInviteRef.current[invite.id] = true;

    const ask = async () => {
      playIncomingRingtone();
      pushBrowserNotification(t.incomingCall, invite.fromName || invite.fromUid || "");
      const accepted = await confirmDialog(
        `${invite.fromName || invite.fromUid}\n${t.incomingCallBody}`,
        t.incomingCall
      );
      stopIncomingRingtone();
      if (accepted) {
        grantAutoRoomPermission("incoming_accept");
        autoJoinCooldownUntilRef.current = 0;
        if (!joinInFlightRef.current && !isLeavingCallRef.current) {
          inCallHardRef.current = false;
          receiverJoinFlowRef.current = { callId: "", joining: false };
        }
        if (!incomingJoinDialogOpenRef.current) incomingJoinDialogOpenRef.current = true;
        showCallProgressDialog(t.incomingCall, t.waitingBackend);
        await update(ref(db, `invites/${profileUid}/${invite.id}`), {
          status: CONTACT_REQUEST_STATUS.accepted,
          respondedAt: Date.now(),
          acceptedBy: profileUid,
        });
      } else {
        await update(ref(db, `invites/${profileUid}/${invite.id}`), {
          status: CONTACT_REQUEST_STATUS.declined,
          respondedAt: Date.now(),
        });
      }
    };

    ask().finally(() => {
      delete handledIncomingInviteRef.current[invite.id];
    });
    return () => stopIncomingRingtone();
  }, [
    confirmDialog,
    hideCallProgressDialog,
    incomingInvites,
    playIncomingRingtone,
    profileId,
    profileName,
    profileUid,
    pushBrowserNotification,
    notify,
    stopIncomingRingtone,
    grantAutoRoomPermission,
    t.incomingCall,
    t.incomingCallBody,
    t.waitingBackend,
    username,
    showCallProgressDialog,
  ]);

  useEffect(() => {
    if (!profileUid) return undefined;
    const inviteRef = ref(db, `invites/${profileUid}`);
    const unsubscribe = onValue(inviteRef, (snapshot) => {
      const now = Date.now();
      const rows = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }));
      const roomReadyInvite = rows
        .filter(
          (item) =>
            item.status === "room_ready" &&
            item.roomName &&
            item.roomPassword &&
            item.toUid === profileUid &&
            now - inviteEventTs(item) <= INVITE_TTL_MS &&
            !item.consumedAt
        )
        .sort((a, b) => inviteEventTs(b) - inviteEventTs(a))
        .find((item) => !handledRoomReadyInviteRef.current[`any_${item.id}`]);
      if (!roomReadyInvite) return;
      const globalHandledKey = `any_${roomReadyInvite.id}`;
      handledRoomReadyInviteRef.current[globalHandledKey] = true;
      setTimeout(() => {
        processReceiverRoomReadyInvite(
          roomReadyInvite,
          `invites/${profileUid}/${roomReadyInvite.id}`,
          globalHandledKey
        );
      }, 100);
    });
    return () => unsubscribe();
  }, [processReceiverRoomReadyInvite, profileUid]);

  useEffect(() => {
    if (!profileUid) return undefined;
    const readyRef = ref(db, `roomReadyByInvite/${profileUid}`);
    const unsubscribe = onValue(readyRef, (snapshot) => {
      const now = Date.now();
      const rows = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...(value || {}) }));
      const roomReadyInvite = rows
        .filter(
          (item) =>
            item.roomName &&
            item.roomPassword &&
            item.toUid === profileUid &&
            now - inviteEventTs(item) <= INVITE_TTL_MS &&
            !item.consumedAt
        )
        .sort((a, b) => inviteEventTs(b) - inviteEventTs(a))
        .find((item) => !handledRoomReadyInviteRef.current[`any_${item.id}`]);
      if (!roomReadyInvite) return;
      const globalHandledKey = `any_${roomReadyInvite.id}`;
      handledRoomReadyInviteRef.current[globalHandledKey] = true;
      setTimeout(() => {
        processReceiverRoomReadyInvite(
          roomReadyInvite,
          `roomReadyByInvite/${profileUid}/${roomReadyInvite.id}`,
          globalHandledKey
        );
      }, 100);
    });
    return () => unsubscribe();
  }, [processReceiverRoomReadyInvite, profileUid]);

  const searchByUid = useCallback(async () => {
    const query = searchUid.trim();
    if (!query) return;
    const uid = query.toUpperCase();
    if (uid === profileUid || query === profileName) {
      await notify(t.cannotAddSelf, "warning");
      return;
    }
    const snapshot = await get(ref(db, `uidDirectory/${uid}`));
    if (!snapshot.exists()) {
      const allSnap = await get(ref(db, "uidDirectory")).catch(() => null);
      const all = Object.values(allSnap?.val?.() || {});
      const byName = all
        .filter((item) => item?.uid !== profileUid)
        .filter((item) => String(item?.name || "").toLowerCase().includes(query.toLowerCase()))
        .slice(0, 12);
      setSearchResults(byName);
      if (!byName.length) {
        await notify(t.userNotFound, "warning");
      }
      return;
    }
    const single = snapshot.val();
    setSearchResults(single ? [single] : []);
  }, [notify, profileName, profileUid, searchUid, t.cannotAddSelf, t.userNotFound]);

  useEffect(() => {
    if (searchUid.trim()) return;
    setSearchResults([]);
  }, [searchUid]);

  const sendContactRequest = useCallback(
    async (targetUid, targetProfileId) => {
      if (!profileUid || !profileId || !targetUid) return;
      if (groupLobbyId) {
        await notify(t.busyInLobby, "warning");
        return;
      }
      if (isBlockedLocally(targetUid)) {
        await notify(t.alreadyBlocked, "warning");
        return;
      }
      const targetPresenceSnap = await get(ref(db, `uidDirectory/${targetUid}`)).catch(() => null);
      const targetPresence = targetPresenceSnap?.val?.() || {};
      const resolvedTargetProfileId = targetProfileId || targetPresence.profileId || "";
      const inOtherCall = Boolean(
        targetPresence.inCallRoomKey &&
        (!activeRoomKey || targetPresence.inCallRoomKey !== activeRoomKey)
      );
      if (inOtherCall || targetPresence.inGroupLobbyId) {
        await notify(t.cannotCallNow, "warning");
        return;
      }
      const remoteHasBlocked = await isBlockedByRemote(resolvedTargetProfileId);
      if (remoteHasBlocked) {
        await notify(t.blockedYou, "warning");
        return;
      }
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await set(ref(db, `contactRequests/${targetUid}/${requestId}`), {
        fromUid: profileUid,
        fromProfileId: profileId,
        fromName: profileName || username || profileUid,
        fromAvatar: profileAvatar || "",
        fromEmoji: profileEmoji || "",
        fromColor: profileColor || DEFAULT_PROFILE_COLOR,
        targetProfileId: resolvedTargetProfileId,
        status: CONTACT_REQUEST_STATUS.pending,
        createdAt: Date.now(),
        expiresAt: Date.now() + INVITE_TTL_MS,
      });
      await notify(t.requestSent, "success", "", { autoCloseMs: 2000 });
    },
    [
      isBlockedByRemote,
      isBlockedLocally,
      notify,
      profileAvatar,
      profileEmoji,
      profileColor,
      profileId,
      profileName,
      profileUid,
      groupLobbyId,
      activeRoomKey,
      t.alreadyBlocked,
      t.busyInLobby,
      t.blockedYou,
      t.cannotCallNow,
      t.requestSent,
      username,
    ]
  );

  const addContactPair = useCallback(
    async (remote) => {
      if (!profileId || !profileUid || !remote?.profileId || !remote?.uid) return;
      const meName = profileName || username || profileUid;
      const now = Date.now();
      await update(ref(db, `contacts/${profileId}/${remote.uid}`), {
        uid: remote.uid,
        profileId: remote.profileId,
        name: remote.name || remote.uid,
        avatar: remote.avatar || "",
        emoji: remote.emoji || "",
        color: remote.color || DEFAULT_PROFILE_COLOR,
        addedAt: now,
      });
      await update(ref(db, `contacts/${remote.profileId}/${profileUid}`), {
        uid: profileUid,
        profileId,
        name: meName,
        avatar: profileAvatar || "",
        emoji: profileEmoji || "",
        color: profileColor || DEFAULT_PROFILE_COLOR,
        addedAt: now,
      });
    },
    [profileAvatar, profileColor, profileEmoji, profileId, profileName, profileUid, username]
  );

  const acceptRequest = useCallback(
    async (request) => {
      if (!request?.id || !request?.fromUid || !profileUid) return;
      try {
        let resolvedProfileId = request.fromProfileId || "";
        if (!resolvedProfileId) {
          const fromSnap = await get(ref(db, `uidDirectory/${request.fromUid}`)).catch(() => null);
          resolvedProfileId = fromSnap?.val?.()?.profileId || "";
        }
        if (!resolvedProfileId) {
          await notify(t.userNotFound, "warning", "", { autoCloseMs: 2000 });
          return;
        }
        await addContactPair({
          uid: request.fromUid,
          profileId: resolvedProfileId,
          name: request.fromName,
          avatar: request.fromAvatar,
          emoji: request.fromEmoji,
          color: request.fromColor,
        });
        await update(ref(db, `contactRequests/${profileUid}/${request.id}`), {
          status: CONTACT_REQUEST_STATUS.accepted,
          respondedAt: Date.now(),
          fromProfileId: resolvedProfileId,
        });
        await notify(t.requestAccepted, "success", "", { autoCloseMs: 2000 });
      } catch (_error) {
        await notify(t.backendTokenError, "error", "", { autoCloseMs: 2000 });
      }
    },
    [addContactPair, notify, profileUid, t.backendTokenError, t.requestAccepted, t.userNotFound]
  );

  const declineRequest = useCallback(
    async (request) => {
      await update(ref(db, `contactRequests/${profileUid}/${request.id}`), {
        status: CONTACT_REQUEST_STATUS.declined,
        respondedAt: Date.now(),
      });
      await notify(t.requestDeclined, "info", "", { autoCloseMs: 2000 });
    },
    [notify, profileUid, t.requestDeclined]
  );

  const blockContact = useCallback(
    async (contact) => {
      const contactUid = contact?.uid || contact?.contactUid || "";
      if (!profileId || !contactUid) return;
      const ok = await confirmDialog(t.confirmBlock, t.actionConfirm);
      if (!ok) return;
      await update(ref(db, `blockedContacts/${profileId}/${contactUid}`), {
        uid: contactUid,
        profileId: contact.profileId || "",
        name: contact.name || contactUid,
        blockedAt: Date.now(),
      });
      await remove(ref(db, `contacts/${profileId}/${contactUid}`)).catch(() => {});
      await notify(t.blockedContact, "success", "", { autoCloseMs: 2000 });
    },
    [confirmDialog, notify, profileId, t.actionConfirm, t.blockedContact, t.confirmBlock]
  );

  const unblockContact = useCallback(
    async (targetUid) => {
      if (!profileId || !targetUid) return;
      await remove(ref(db, `blockedContacts/${profileId}/${targetUid}`));
      await notify(t.unblockedContact, "success");
    },
    [notify, profileId, t.unblockedContact]
  );

  const removeContactFromList = useCallback(
    async (contact) => {
      const contactUid = contact?.uid || contact?.contactUid || "";
      if (!profileId || !contactUid) return;
      const ok = await confirmDialog(t.confirmRemove, t.actionConfirm);
      if (!ok) return;
      await remove(ref(db, `contacts/${profileId}/${contactUid}`));
      await notify(t.contactRemoved, "success", "", { autoCloseMs: 2000 });
    },
    [confirmDialog, notify, profileId, t.actionConfirm, t.confirmRemove, t.contactRemoved]
  );

  const sendCallInvite = useCallback(
    async (target) => {
      const targetUid = target?.uid || target?.contactUid || "";
      if (!targetUid || !profileUid) return false;
      const waitSeconds = getCallActionCooldownSeconds();
      if (waitSeconds > 0) {
        await notify(`wait (${waitSeconds}) seconds and try again`, "warning", "", { autoCloseMs: 1800 });
        return false;
      }
      if (groupLobbyId || inCall) {
        await notify(t.busyInLobby, "warning");
        return false;
      }
      if (isBlockedLocally(targetUid)) {
        await notify(t.blockedUserCannotCall, "warning");
        return false;
      }
      let targetProfileId = target?.profileId || "";
      if (!targetProfileId) {
        const profileSnap = await get(ref(db, `uidDirectory/${targetUid}`)).catch(() => null);
        targetProfileId = profileSnap?.val?.()?.profileId || "";
      }
      if (await isBlockedByRemote(targetProfileId)) {
        await notify(t.blockedYou, "warning");
        return false;
      }

      const targetPresenceSnapshot = await get(ref(db, `uidDirectory/${targetUid}`)).catch(() => null);
      const targetPresence = targetPresenceSnapshot?.val?.() || {};
      const isOnline = Boolean(targetPresence.isOnline);
      const isBusy = Boolean(targetPresence.inCallRoomKey);
      const inLobby = Boolean(targetPresence.inGroupLobbyId);

      if (!isOnline) {
        await writeMissedCall(targetUid, { reason: "offline" });
        await notify(t.callUnavailableOffline, "info");
        return false;
      }
      if (isBusy || inLobby) {
        await writeMissedCall(targetUid, { reason: "busy" });
        await notify(t.cannotCallNow, "info");
        return false;
      }

      const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      grantAutoRoomPermission("outgoing_invite");
      await set(ref(db, `invites/${targetUid}/${inviteId}`), {
        fromUid: profileUid,
        fromProfileId: profileId,
        fromName: profileName || username || profileUid,
        toUid: targetUid,
        toProfileId: targetProfileId,
        status: CONTACT_REQUEST_STATUS.pending,
        createdAt: Date.now(),
        expiresAt: Date.now() + INVITE_TTL_MS,
      });

      setOutgoingCallRequest({
        targetUid,
        inviteId,
        requestedAt: Date.now(),
      });
      if (!outgoingRequestDialogOpenRef.current) {
        outgoingRequestDialogOpenRef.current = true;
        openSwalSafely({
          title: t.requestingCall,
          text: t.expiresIn,
          icon: "info",
          buttons: false,
          closeOnClickOutside: false,
          closeOnEsc: false,
        });
      }
      return true;
    },
    [
      isBlockedByRemote,
      isBlockedLocally,
      notify,
      inCall,
      groupLobbyId,
      getCallActionCooldownSeconds,
      profileId,
      profileName,
      profileUid,
      grantAutoRoomPermission,
      t.blockedUserCannotCall,
      t.blockedYou,
      t.busyInLobby,
      t.cannotCallNow,
      t.callUnavailableOffline,
      t.expiresIn,
      t.requestingCall,
      openSwalSafely,
      username,
      writeMissedCall,
    ]
  );

  const inviteContactToCall = useCallback(
    async (contact) => {
      await sendCallInvite(contact);
    },
    [sendCallInvite]
  );

  useEffect(() => {
    if (!outgoingCallRequest?.targetUid || !outgoingCallRequest?.inviteId || !profileUid) return undefined;
    const outgoingProcessMap = outgoingInviteProcessRef.current;
    const inviteRef = ref(db, `invites/${outgoingCallRequest.targetUid}/${outgoingCallRequest.inviteId}`);
    const processKey = `${outgoingCallRequest.targetUid}_${outgoingCallRequest.inviteId}`;
    const unsubscribe = onValue(inviteRef, async (snapshot) => {
      if (outgoingProcessMap[processKey]) return;
      try {
        const item = snapshot.val();
        if (!item) {
          if (outgoingRequestDialogOpenRef.current) {
            closeSwalSafely();
            outgoingRequestDialogOpenRef.current = false;
          }
          hideCallProgressDialog();
          setOutgoingCallRequest(null);
          return;
        }
        const expired = Date.now() - Number(item.createdAt || 0) > INVITE_TTL_MS;
        if (expired && item.status === CONTACT_REQUEST_STATUS.pending) {
          await update(inviteRef, { status: "expired", respondedAt: Date.now() }).catch(() => {});
          return;
        }
        if (item.status === CONTACT_REQUEST_STATUS.declined || item.status === "expired") {
          if (outgoingRequestDialogOpenRef.current) {
            closeSwalSafely();
            outgoingRequestDialogOpenRef.current = false;
          }
          hideCallProgressDialog();
          setOutgoingCallRequest(null);
          await notify(t.requestNoAcceptExpired, "info", "", { autoCloseMs: 2200 });
          return;
        }
        if (item.status === CONTACT_REQUEST_STATUS.accepted && !item.roomName) {
          if (!hasAutoRoomPermission()) {
            return;
          }
          if (item.fromUid && item.fromUid !== profileUid) {
            return;
          }
          outgoingProcessMap[processKey] = true;
          showCallProgressDialog(t.roomCreating, t.waitingBackend);
          const room = randomRoomValue("room");
          const password = randomRoomValue("pw");
          const mirrorRef = ref(
            db,
            `roomReadyByInvite/${outgoingCallRequest.targetUid}/${outgoingCallRequest.inviteId}`
          );
          const joined = await triggerJoinWithRetries("create", room, password, { isInviteRequestRoom: true });
          if (outgoingRequestDialogOpenRef.current) outgoingRequestDialogOpenRef.current = false;
          if (!joined) {
            hideCallProgressDialog();
            setOutgoingCallRequest(null);
            delete outgoingProcessMap[processKey];
            return;
          }
          const roomReadyAt = Date.now();
          const roomReadyPayload = {
            status: "room_ready",
            roomName: room,
            roomPassword: password,
            roomCreatedBy: profileUid,
            fromUid: profileUid,
            toUid: outgoingCallRequest.targetUid,
            inviteId: outgoingCallRequest.inviteId,
            roomCreatedAt: roomReadyAt,
            receiverJoinDelayMs: 2000,
            respondedAt: roomReadyAt,
          };

          const publishRoomReady = async () => {
            const publishTs = Date.now();
            const publishResults = await Promise.allSettled([
              update(inviteRef, {
                ...roomReadyPayload,
                roomCreatedAt: roomReadyAt,
                respondedAt: publishTs,
              }),
              set(mirrorRef, {
                ...roomReadyPayload,
                toUid: outgoingCallRequest.targetUid,
                fromUid: profileUid,
                inviteId: outgoingCallRequest.inviteId,
                roomCreatedAt: roomReadyAt,
                respondedAt: publishTs,
                createdAt: publishTs,
              }),
            ]);
            return publishResults.some((result) => result.status === "fulfilled");
          };

          let initialPublished = false;
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            initialPublished = await publishRoomReady();
            if (initialPublished) break;
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          if (!initialPublished) {
            hideCallProgressDialog();
            await notify(t.roomCreateFailed, "error", "", { autoCloseMs: 2000 });
            setOutgoingCallRequest(null);
            delete outgoingProcessMap[processKey];
            return;
          }

          void (async () => {
            const maxRepublishRounds = 10;
            for (let round = 1; round <= maxRepublishRounds; round += 1) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
              const latestInvite = await get(inviteRef).catch(() => null);
              if (latestInvite?.val?.()?.consumedAt) break;
              await publishRoomReady().catch(() => {});
            }
          })();

          hideCallProgressDialog();
          setOutgoingCallRequest(null);
          delete outgoingProcessMap[processKey];
          return;
        }
        if (item.status === "room_ready" && item.roomName && item.roomPassword) {
          if (!hasAutoRoomPermission()) {
            return;
          }
          outgoingProcessMap[processKey] = true;
          showCallProgressDialog(t.roomCreating, t.waitingBackend);
          const joined = await triggerJoinWithRetries("join", item.roomName, item.roomPassword, { isInviteRequestRoom: true });
          if (outgoingRequestDialogOpenRef.current) outgoingRequestDialogOpenRef.current = false;
          if (!joined) {
            hideCallProgressDialog();
            setOutgoingCallRequest(null);
            delete outgoingProcessMap[processKey];
            return;
          }
          hideCallProgressDialog();
          setOutgoingCallRequest(null);
          delete outgoingProcessMap[processKey];
          return;
        }
      } catch (_error) {
        hideCallProgressDialog();
        if (outgoingRequestDialogOpenRef.current) {
          closeSwalSafely();
          outgoingRequestDialogOpenRef.current = false;
        }
        setOutgoingCallRequest(null);
        delete outgoingProcessMap[processKey];
        await notify(t.roomCreateFailed, "error", "", { autoCloseMs: 2000 });
      }
    });
    return () => {
      unsubscribe();
    };
  }, [closeSwalSafely, hasAutoRoomPermission, hideCallProgressDialog, notify, openSwalSafely, outgoingCallRequest, profileUid, showCallProgressDialog, t.expiresIn, t.requestNoAcceptExpired, t.requestingCall, t.roomCreateFailed, t.roomCreating, t.waitingBackend, triggerJoinWithRetries]);

  useEffect(() => {
    if (!outgoingCallRequest?.targetUid || !outgoingCallRequest?.inviteId) return undefined;
    const ttlTimer = setTimeout(async () => {
      const inviteRef = ref(db, `invites/${outgoingCallRequest.targetUid}/${outgoingCallRequest.inviteId}`);
      const snap = await get(inviteRef).catch(() => null);
      const item = snap?.val?.();
      if (!item || item.status !== CONTACT_REQUEST_STATUS.pending) return;
      await update(inviteRef, {
        status: "expired",
        respondedAt: Date.now(),
      }).catch(() => {});
      hideCallProgressDialog();
      if (outgoingRequestDialogOpenRef.current) {
        closeSwalSafely();
        outgoingRequestDialogOpenRef.current = false;
      }
      setOutgoingCallRequest(null);
      await notify(t.requestNoAcceptExpired, "info", "", { autoCloseMs: 2200 });
    }, INVITE_TTL_MS + 500);
    return () => clearTimeout(ttlTimer);
  }, [closeSwalSafely, hideCallProgressDialog, notify, outgoingCallRequest, t.requestNoAcceptExpired]);

  useEffect(() => {
    if (!inCall) return;
    closeSwalSafely();
    outgoingRequestDialogOpenRef.current = false;
    incomingJoinDialogOpenRef.current = false;
    hideCallProgressDialog();
  }, [closeSwalSafely, hideCallProgressDialog, inCall]);

  useEffect(() => {
    if (outgoingCallRequest || joining || inCall) return;
    hideCallProgressDialog();
  }, [hideCallProgressDialog, inCall, joining, outgoingCallRequest]);

  const addUserFromCall = useCallback(
    async (_agoraUid, rawUser) => {
      const userInfo = normalizeCallUser(rawUser);
      const targetUid = userInfo.uid;
      if (!targetUid) {
        await notify(t.userNotFound, "warning");
        return;
      }
      const targetPresence = await get(ref(db, `uidDirectory/${targetUid}`));
      const data = targetPresence.val();
      if (!data?.profileId || !data?.uid) {
        await notify(t.userNotFound, "warning");
        return;
      }
      await sendContactRequest(data.uid, data.profileId);
    },
    [notify, sendContactRequest, t.userNotFound]
  );

  const uiLockedOverlay = sessionBlocked ? (
    <div className="session-block-overlay">
      <div className="session-block-card">
        <h4>{t.sessionInUse}</h4>
        <p>{t.adminGuide}</p>
      </div>
    </div>
  ) : null;

  if (!profileLoaded) {
    return (
      <div className="entry-screen">
        <div className="entry-card">
          <div className="profile-loading-row">
            <p className="entry-subtitle loading-text">Loading profile</p>
            <div className="loadingspinner" aria-hidden="true">
              <div id="square1"></div>
              <div id="square2"></div>
              <div id="square3"></div>
              <div id="square4"></div>
              <div id="square5"></div>
            </div>
          </div>
        </div>
        {uiLockedOverlay}
      </div>
    );
  }

  if (screen === "profile") {
    return (
      <div className="entry-screen">
        <button className="lang-toggle" onClick={() => setShowSettingsPanel(true)}>
          <Settings fontSize="small" />
          <span className="lang-toggle-label">{t.settings}</span>
          {pendingNotifications > 0 ? <span className="notif-badge">{pendingNotifications}</span> : null}
        </button>

        <div className="entry-card profile-card">
          <h1 className="entry-title">{t.profileTitle}</h1>
          <p className="entry-subtitle">{t.profileSubtitle}</p>
          <div className="uid-row">
            <p className="section-label">{t.profileUidLabel}: {profileUid || "-"}</p>
            <button className="icon-ghost-btn" onClick={() => copyUid(profileUid)} title={t.copiedUid}>
              <ContentCopy fontSize="small" />
            </button>
          </div>

          <div className="profile-avatar-wrap">
            {profileAvatar ? (
              <img src={profileAvatar} alt="avatar" className="profile-avatar-preview" />
            ) : profileEmoji ? (
              <div className="profile-emoji-fallback">{profileEmoji}</div>
            ) : (
              <div className="profile-avatar-fallback">
                <AccountCircle sx={{ fontSize: 72 }} />
              </div>
            )}
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onAvatarFileChange}
          />

          <div className="mode-grid">
            <button className="btn-gradient" onClick={() => avatarInputRef.current?.click()}>
              <PhotoCamera fontSize="small" /> {t.chooseAvatar}
            </button>
            <button className="btn-gradient" onClick={() => setProfileAvatar("")}>
              {t.removeAvatar}
            </button>
          </div>

          <div className="profile-section">
            <button className="section-toggle" onClick={() => setShowEmojiPicker((prev) => !prev)}>
              {t.setEmojiAvatar}
            </button>
            {showEmojiPicker ? (
              <div className="emoji-grid">
                {PROFILE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className={`emoji-btn ${profileEmoji === emoji ? "selected" : ""}`}
                    onClick={() => {
                      setProfileEmoji(emoji);
                      setProfileAvatar("");
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                <button className="emoji-btn clear" onClick={() => setProfileEmoji("")}>
                  {t.noImageAvatar}
                </button>
              </div>
            ) : null}
          </div>

          <input
            dir={language === "fa" ? "rtl" : "ltr"}
            className="nameInput"
            placeholder={t.profileNameLabel}
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            disabled={isAnonymous}
          />

          <div className="mode-grid">
            <select className="nameInput" value={profileGender} onChange={(event) => setProfileGender(event.target.value)}>
              <option value="not_set">{t.genderNotSet}</option>
              <option value="male">{t.genderMale}</option>
              <option value="female">{t.genderFemale}</option>
            </select>
            <input
              className="nameInput"
              type="date"
              value={profileBirthDate}
              onChange={(event) => setProfileBirthDate(event.target.value)}
              title={t.birthDateLabel}
            />
          </div>
          <p className="section-label">{t.speakingTotal}: {formatDuration(profileSpeakingSeconds)}</p>

          <button
            className={`btn-gradient ${isAnonymous ? "mode-active" : ""}`}
            onClick={() => setIsAnonymous((prev) => !prev)}
          >
            {t.anonymousMode}
          </button>

          <div className="profile-section">
            <button className="section-toggle" onClick={() => setShowColorPicker((prev) => !prev)}>
              {t.profileColorLabel}
            </button>
            {showColorPicker ? (
              <div className="color-grid">
                {PROFILE_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`color-dot ${profileColor === color ? "selected" : ""}`}
                    style={{ background: color }}
                    onClick={() => setProfileColor(color)}
                    aria-label={color}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="profile-section">
            <button className="section-toggle" onClick={() => setShowStabilityPicker((prev) => !prev)}>
              {t.stabilityLabel}
            </button>
            {showStabilityPicker ? (
              <>
                <div className="mode-grid">
                  <button
                    className={`btn-gradient ${stabilityMode === STABILITY_MODES.balanced ? "mode-active" : ""}`}
                    onClick={() => setStabilityMode(STABILITY_MODES.balanced)}
                  >
                    {t.stabilityBalanced}
                  </button>
                  <button
                    className={`btn-gradient ${stabilityMode === STABILITY_MODES.high ? "mode-active" : ""}`}
                    onClick={() => setStabilityMode(STABILITY_MODES.high)}
                  >
                    {t.stabilityHigh}
                  </button>
                  <button
                    className={`btn-gradient ${stabilityMode === STABILITY_MODES.higher ? "mode-active" : ""}`}
                    onClick={() => setStabilityMode(STABILITY_MODES.higher)}
                  >
                    {t.stabilityHigher}
                  </button>
                  <button
                    className={`btn-gradient ${stabilityMode === STABILITY_MODES.ultra ? "mode-active" : ""}`}
                    onClick={() => setStabilityMode(STABILITY_MODES.ultra)}
                  >
                    {t.stabilityUltra}
                  </button>
                </div>
                <p className="admin-guide">{t.stabilityHelp}</p>
              </>
            ) : null}
          </div>

          <button className="btn-gradient" onClick={() => setShowRingtoneModal(true)}>
            {t.callRingtone}
          </button>

          <button className="start-btn" onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? t.waitingBackend : t.profileSave}
          </button>

          {profileLoaded && (isAnonymous || Boolean(profileName.trim())) ? (
            <button className="btn-gradient" onClick={() => setScreen("entry")}>
              {t.adminClose}
            </button>
          ) : null}
        </div>
        {showRingtoneModal ? (
          <div className="settings-overlay" onClick={() => setShowRingtoneModal(false)}>
            <div className="settings-panel small-modal" onClick={(event) => event.stopPropagation()}>
              <h3>{t.callRingtone}</h3>
              <div className="history-list">
                {Object.keys(RINGTONES).map((id) => (
                  <div className="history-item" key={id}>
                    <strong>{id.replace("_", " ").toUpperCase()}</strong>
                    <div className="mode-grid">
                      <button className="btn-gradient" onClick={() => previewRingtone(id)}>{t.preview}</button>
                      <button
                        className={`btn-gradient ${selectedRingtone === id ? "mode-active" : ""}`}
                        onClick={() => selectRingtone(id)}
                      >
                        {t.useThis}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-gradient" onClick={() => setShowRingtoneModal(false)}>{t.adminClose}</button>
            </div>
          </div>
        ) : null}
        {uiLockedOverlay}
      </div>
    );
  }

  if (!inCall) {
    const isLobbyAdmin = groupLobbyMeta?.adminUid === profileUid;
    return (
      <div className="entry-screen">
        <button className="lang-toggle" onClick={() => setShowSettingsPanel(true)}>
          <Settings fontSize="small" />
          <span className="lang-toggle-label">{t.settings}</span>
          {pendingNotifications > 0 ? <span className="notif-badge">{pendingNotifications}</span> : null}
        </button>

        <div className="entry-card">
          <h1 className="entry-title brand-title">
            {APP_DISPLAY_NAME}
          </h1>
          <p className="entry-subtitle">{t.subtitle}</p>

          <button className="profile-pill" style={myProfileButtonStyle} onClick={() => setScreen("profile")}>
            <CloudDone fontSize="small" />
            {t.myProfile}: {(profileName || username || "-").trim()}
          </button>

          <input
            dir={language === "fa" ? "rtl" : "ltr"}
            className="nameInput"
            placeholder={t.enterName}
            value={profileName || username}
            readOnly
          />
          <p className="entry-subtitle">{t.profileUpdatedOnlyInSettings}</p>

          <input
            dir={language === "fa" ? "rtl" : "ltr"}
            className="nameInput"
            placeholder={t.enterRoomName}
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
          />

          <div className="password-wrap">
            <input
              dir={language === "fa" ? "rtl" : "ltr"}
              className="nameInput"
              type={showRoomPassword ? "text" : "password"}
              placeholder={t.enterRoomPassword}
              value={roomPassword}
              onChange={(event) => setRoomPassword(event.target.value)}
            />
            <button
              className="icon-ghost-btn password-toggle"
              onClick={() => setShowRoomPassword((prev) => !prev)}
              title={showRoomPassword ? t.hidePassword : t.showPassword}
            >
              {showRoomPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </button>
          </div>

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

          <button className="start-btn" onClick={joinCall} disabled={joining || sessionBlocked}>
            {joining ? t.waitingBackend : t.startCall}
          </button>
          <button className="btn-gradient group-call-btn" onClick={openGroupLobby} disabled={joining || sessionBlocked}>
            <Group fontSize="small" /> {t.groupCall}
          </button>
          {groupLobbyId ? (
            <button className="btn-gradient group-call-btn" onClick={() => setShowGroupLobby(true)}>
              <Group fontSize="small" /> {t.inLobby}
            </button>
          ) : null}

          {activeBackendUrl ? <p className="backend-badge">{t.backendConnected}: {activeBackendUrl}</p> : null}
          {sessionBlocked ? <p className="admin-guide">{t.sessionInUse}</p> : null}
        </div>

        {showGroupLobby ? (
          <div className="settings-overlay" onClick={() => setShowGroupLobby(false)}>
            <div className="settings-panel group-lobby-panel" onClick={(event) => event.stopPropagation()}>
              <div className="settings-header">
                <Group fontSize="small" />
                <strong>{t.groupLobbyTitle}</strong>
              </div>
              <div className="settings-body">
                <p className="section-label">Admin: {groupLobbyMeta?.adminName || groupLobbyMeta?.adminUid || "-"}</p>
                <p className="section-label">{t.inviteOnlineContacts}</p>
                <div className="search-row">
                  <input
                    dir="ltr"
                    className="nameInput"
                    placeholder={t.searchUserToInvite}
                    value={groupSearchUid}
                    onChange={(event) => setGroupSearchUid(event.target.value.toUpperCase())}
                  />
                  <button className="btn-gradient" onClick={searchUidForLobby}>
                    {t.searchUserToInvite}
                  </button>
                </div>
                {groupSearchResult ? (
                  <div className="history-item">
                    <span className="contact-line">
                      {groupSearchResult.avatar ? (
                        <img src={groupSearchResult.avatar} alt={groupSearchResult.name || groupSearchResult.uid} className="mini-avatar large" />
                      ) : (
                        <span className="mini-avatar-emoji large">{groupSearchResult.emoji || "🙂"}</span>
                      )}
                      <strong>{groupSearchResult.name || groupSearchResult.uid}</strong>
                    </span>
                    <span>{groupSearchResult.isOnline ? t.onlineNow : `${t.lastSeen}: ${formatLastSeen(groupSearchResult.lastSeen)}`}</span>
                    <button
                      className="btn-gradient"
                      onClick={() => inviteContactToLobby(groupSearchResult)}
                      disabled={!isLobbyAdmin || groupSearchResult.uid === groupLobbyMeta?.adminUid || Boolean(groupLobbyMembers[groupSearchResult.uid])}
                    >
                      {t.inviteToLobby}
                    </button>
                  </div>
                ) : null}
                <div className="history-list">
                  {Object.entries(contacts || {})
                    .map(([uidKey, item]) => ({ ...(item || {}), uid: item?.uid || uidKey }))
                    .filter((item) => contactsPresence[item.uid]?.isOnline).length ? (
                    Object.entries(contacts || {})
                      .map(([uidKey, item]) => ({ ...(item || {}), uid: item?.uid || uidKey }))
                      .filter((item) => contactsPresence[item.uid]?.isOnline)
                      .map((contact) => (
                        <div className="history-item" key={`lobby_${contact.uid}`}>
                          <span className="contact-line">
                            {contact.avatar ? (
                              <img src={contact.avatar} alt={contact.name} className="mini-avatar large" />
                            ) : (
                              <span className="mini-avatar-emoji large">{contact.emoji || "🙂"}</span>
                            )}
                            <strong>{contact.name}</strong>
                          </span>
                          <button
                            className="btn-gradient"
                            onClick={() => inviteContactToLobby(contact)}
                            disabled={groupInviteBusy || Boolean(groupLobbyMembers[contact.uid]) || !isLobbyAdmin}
                          >
                            {groupLobbyMembers[contact.uid] ? t.inLobby : t.sendRequest}
                          </button>
                        </div>
                      ))
                  ) : (
                    <p className="admin-guide">{t.noOnlineContacts}</p>
                  )}
                </div>

                <p className="section-label">{t.lobbyMembers}</p>
                <div className="history-list">
                  {Object.values(groupLobbyMembers).map((member) => (
                    <div className="history-item" key={`member_${member.uid}`}>
                      <span className="contact-line">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="mini-avatar large" />
                        ) : (
                          <span className="mini-avatar-emoji large">{member.emoji || "🙂"}</span>
                        )}
                        <strong>{member.name}</strong>
                      </span>
                      <span>{member.status || "ready"}</span>
                      {member.uid !== profileUid ? (
                        <button className="btn-gradient danger-btn" onClick={() => removeMemberFromLobby(member.uid)} disabled={!isLobbyAdmin}>
                          <PersonOff fontSize="small" /> {t.removeFromLobby}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {isLobbyAdmin ? <button className="start-btn" onClick={startGroupCallFromLobby}>{t.startGroupCall}</button> : null}
                <button className="btn-gradient danger-btn" onClick={closeGroupLobby}>
                  {isLobbyAdmin ? t.cancelGroupLobby : t.adminClose}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showSettingsPanel ? (
          <div className="settings-overlay" onClick={() => setShowSettingsPanel(false)}>
            <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
              <div className="settings-header">
                <Settings fontSize="small" />
                <strong>{t.settingsHeader}</strong>
              </div>
              <div className="settings-tabs">
                <button className={`btn-gradient ${settingsTab === "profile" ? "mode-active" : ""}`} onClick={() => setSettingsTab("profile")}>
                  <Person fontSize="small" /> {t.settingsProfile}
                </button>
                <button className={`btn-gradient ${settingsTab === "contacts" ? "mode-active" : ""}`} onClick={() => setSettingsTab("contacts")}>
                  <Badge fontSize="small" /> {t.settingsContacts}
                </button>
                <button className={`btn-gradient ${settingsTab === "appearance" ? "mode-active" : ""}`} onClick={() => setSettingsTab("appearance")}>
                  <Tune fontSize="small" /> {t.settingsAppearance}
                </button>
                <button className={`btn-gradient ${settingsTab === "about" ? "mode-active" : ""}`} onClick={() => setSettingsTab("about")}>
                  <Info fontSize="small" /> {t.settingsAbout}
                </button>
                <button className={`btn-gradient ${settingsTab === "backend" ? "mode-active" : ""}`} onClick={() => setSettingsTab("backend")}>
                  <CloudDone fontSize="small" /> {t.settingsBackend}
                </button>
              </div>

              {settingsTab === "profile" ? (
                <div className="settings-body">
                  <div className="uid-row">
                    <p className="section-label">{t.profileUidLabel}: {profileUid || "-"}</p>
                    <button className="icon-ghost-btn" onClick={() => copyUid(profileUid)} title={t.copiedUid}>
                      <ContentCopy fontSize="small" />
                    </button>
                  </div>
                  <div className="profile-stats-grid">
                    <p className="section-label profile-stat profile-stat-name">{t.myProfile}: {profileName || "-"}</p>
                    <p className="section-label profile-stat profile-stat-call">{t.totalCallTime}: {formatDuration(profileCallSeconds)}</p>
                    <p className="section-label profile-stat profile-stat-speak">{t.speakingTotal}: {formatDuration(profileSpeakingSeconds)}</p>
                    <p className="section-label profile-stat profile-stat-gender">{t.genderLabel}: {profileGender === "male" ? t.genderMale : profileGender === "female" ? t.genderFemale : t.genderNotSet}</p>
                    <p className="section-label profile-stat profile-stat-birth">{t.birthDateLabel}: {profileBirthDate || "-"}</p>
                  </div>
                  <button className="btn-gradient" onClick={() => { setScreen("profile"); setShowSettingsPanel(false); }}>
                    {t.openProfile}
                  </button>
                  <div className="mode-grid">
                    <button className="btn-gradient danger-btn" onClick={clearCallHistory}>
                      <History fontSize="small" /> {t.clearCallHistory}
                    </button>
                    <button className="btn-gradient danger-btn" onClick={clearMissedCalls}>
                      <NotificationsOff fontSize="small" /> {t.clearMissedCalls}
                    </button>
                  </div>
                  <button className="section-toggle" onClick={() => setShowHistoryPanel((prev) => !prev)}>
                    {t.callHistory}
                  </button>
                  {showHistoryPanel ? (
                    <div className="embedded-modal">
                      <div className="history-list contacts-scroll-list">
                        {profileHistory.length ? (
                          profileHistory.slice(0, 12).map((item) => (
                            <div className="history-item call-history-item" key={item.id}>
                              <strong>{t.room}: {item.roomName || "-"}</strong>
                              <span className="history-type">{item.type || t.historyAdvanced}</span>
                              <span className="history-meta">{new Date(item.startedAt || Date.now()).toLocaleString()}</span>
                              <span className="history-duration">{formatDuration(item.durationSeconds)}</span>
                              <span className="history-quality">{t.connectionQuality}: {item.qualityAtEnd || "-"}</span>
                              <span className="history-meta">{t.participants}: {(item.participants || []).join(", ") || "-"}</span>
                            </div>
                          ))
                        ) : (
                          <p className="admin-guide">{t.noHistory}</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <button className="section-toggle" onClick={() => setShowMissedPanel((prev) => !prev)}>
                    {t.missedModal}
                  </button>
                  {showMissedPanel ? (
                    <div className="embedded-modal">
                      <div className="history-list">
                        {missedCalls.length ? (
                          missedCalls.slice(0, 25).map((item) => (
                            <div className="history-item missed-history-item" key={`missed_inpanel_${item.id}`}>
                              <strong>{t.missedBy}: {item.fromName || item.fromUid || "-"}</strong>
                              <span className="history-meta">{new Date(item.at || Date.now()).toLocaleString()}</span>
                            </div>
                          ))
                        ) : (
                          <p className="admin-guide">{t.noHistory}</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <button className="btn-gradient danger-btn" onClick={deleteProfile}>
                    <DeleteForever fontSize="small" /> {t.profileDelete}
                  </button>
                </div>
              ) : null}

              {settingsTab === "contacts" ? (
                <div className="settings-body">
                  <button className="section-toggle" onClick={() => setShowContactsModal((prev) => !prev)}>
                    {t.contactsModal}
                  </button>
                  {showContactsModal ? (
                    <div className="embedded-modal">
                      <p className="section-label">{t.contactsTitle}</p>
                      <div className="history-list contacts-scroll-list">
                        {Object.entries(contacts || {}).length ? (
                          Object.entries(contacts || {}).map(([contactUidKey, contactRaw]) => {
                            const contact = { ...(contactRaw || {}), uid: contactRaw?.uid || contactUidKey };
                            const presence = contactsPresence[contact.uid] || {};
                            const cardColor = presence.color || contact.color || DEFAULT_PROFILE_COLOR;
                            const statusText = presence.isOnline
                              ? `${t.contactsOnline} - ${t.onlineNow}`
                              : `${t.contactsOffline} - ${t.lastSeen}: ${formatLastSeen(presence.lastSeen || contact.lastSeen)}`;
                            return (
                              <div
                                className={`history-item contact-card ${blockedContacts[contact.uid] ? "is-blocked" : ""}`}
                                key={contact.uid}
                                style={{
                                  ...buildSoftCardStyle(cardColor, 0.24, 0.14, 0.2),
                                }}
                              >
                                <div className="contact-head">
                                  <span className="contact-line">
                                    {presence.avatar || contact.avatar ? (
                                      <img src={presence.avatar || contact.avatar} alt={presence.name || contact.name} className="mini-avatar large" />
                                    ) : (
                                      <span className="mini-avatar-emoji large">{presence.emoji || contact.emoji || "🙂"}</span>
                                    )}
                                    <strong className="contact-name">{presence.name || contact.name}</strong>
                                  </span>
                                  <span className="uid-copy-row">
                                    <span>{t.contactUid}: {contact.uid}</span>
                                    <button className="icon-ghost-btn inline-btn" onClick={() => copyUid(contact.uid)} title={t.copiedUid}>
                                      <ContentCopy fontSize="small" />
                                    </button>
                                  </span>
                                  <span className={`status-meta ${presence.isOnline ? "status-online" : "status-offline"}`}>
                                    {statusText}
                                  </span>
                                </div>
                                <div className="contact-actions">
                                  <button className="btn-gradient action-compact" onClick={() => inviteContactToCall({ ...contact, ...presence, contactUid: contact.uid })}>
                                    {t.inviteToCall}
                                  </button>
                                  <button className="btn-gradient danger-btn action-compact" onClick={() => removeContactFromList({ ...contact, contactUid: contact.uid })}>
                                    <PersonRemove fontSize="small" /> {t.removeContact}
                                  </button>
                                  <button className="btn-gradient danger-btn action-compact" onClick={() => blockContact({ ...contact, contactUid: contact.uid })}>
                                    <Block fontSize="small" /> {t.blockContact}
                                  </button>
                                </div>
                                {blockedContacts[contact.uid] ? (
                                  <button className="btn-gradient action-sm" onClick={() => unblockContact(contact.uid)}>
                                    <Check fontSize="small" /> {t.unblockContact}
                                  </button>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <p className="admin-guide">{t.noContacts}</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <button className="section-toggle" onClick={() => setShowRequestsModal((prev) => !prev)}>
                    {t.requestsModal}
                  </button>
                  {showRequestsModal ? (
                    <div className="embedded-modal">
                      <p className="section-label">{t.incomingRequests}</p>
                      <div className="history-list">
                        {contactRequests.length ? (
                          contactRequests.map((request) => (
                            <div className="history-item request-card" key={request.id} style={{
                              ...buildSoftCardStyle(request.fromColor || DEFAULT_PROFILE_COLOR, 0.28, 0.16, 0.24),
                            }}>
                              <span className="contact-line">
                                {request.fromAvatar ? (
                                  <img src={request.fromAvatar} alt={request.fromName} className="mini-avatar large" />
                                ) : (
                                  <span className="mini-avatar-emoji large">{request.fromEmoji || "🙂"}</span>
                                )}
                                <strong className="contact-name">{request.fromName}</strong>
                              </span>
                              <span className="uid-copy-row">
                                <span>{request.fromUid} {t.requestedYou}</span>
                                <button className="icon-ghost-btn inline-btn" onClick={() => copyUid(request.fromUid)} title={t.copiedUid}>
                                  <ContentCopy fontSize="small" />
                                </button>
                              </span>
                              <div className="mode-grid">
                                <button className="btn-gradient" onClick={() => acceptRequest(request)}>{t.accept}</button>
                                <button className="btn-gradient danger-btn" onClick={() => declineRequest(request)}>{t.decline}</button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="admin-guide">{t.noRequests}</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <p className="section-label">{t.contactsTitle}</p>
                  <div className="search-row">
                    <input
                      dir="ltr"
                      className="nameInput"
                      placeholder={t.searchByNameOrUid}
                      value={searchUid}
                      onChange={(event) => setSearchUid(event.target.value)}
                    />
                    <button className="btn-gradient" onClick={searchByUid}>
                      {t.contactsSearchUid}
                    </button>
                  </div>

                  {searchResults.length
                    ? searchResults.map((row) => (
                        <div className="history-item contact-card search-result-card" key={`search_${row.uid}`}>
                          <span className="contact-line">
                            {row.avatar ? (
                              <img src={row.avatar} alt={row.name || row.uid} className="mini-avatar large" />
                            ) : (
                              <span className="mini-avatar-emoji large">{row.emoji || "🙂"}</span>
                            )}
                            <strong>{row.name || row.uid}</strong>
                          </span>
                          <span>{t.contactUid}: {row.uid}</span>
                          <span>{row.isOnline ? t.onlineNow : `${t.lastSeen}: ${formatLastSeen(row.lastSeen)}`}</span>
                          <button className="icon-ghost-btn" onClick={() => copyUid(row.uid)} title={t.copiedUid}>
                            <ContentCopy fontSize="small" />
                          </button>
                          <span>{t.expiresIn}</span>
                          <div className="mode-grid search-result-actions">
                            <button
                              className="btn-gradient"
                              onClick={() => sendContactRequest(row.uid, row.profileId)}
                              disabled={Boolean(contactsByUid[row.uid]) || isBlockedLocally(row.uid)}
                            >
                              {Boolean(contactsByUid[row.uid]) ? t.requestAccepted : t.sendRequest}
                            </button>
                            <button className="btn-gradient" onClick={() => sendCallInvite(row)}>
                              <PhoneInTalk fontSize="small" /> {t.callNow}
                            </button>
                          </div>
                        </div>
                      ))
                    : null}

                  <p className="section-label">{t.blockContact}</p>
                  <div className="history-list">
                    {Object.keys(blockedContacts || {}).length ? (
                      Object.values(blockedContacts).map((item) => (
                        <div className="history-item" key={`blocked_${item.uid}`}>
                          <strong>{item.name || item.uid}</strong>
                          <span>{t.contactUid}: {item.uid}</span>
                          <button className="btn-gradient" onClick={() => unblockContact(item.uid)}>
                            <Check fontSize="small" /> {t.unblockContact}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="admin-guide">{t.noRequests}</p>
                    )}
                  </div>
                </div>
              ) : null}
              {settingsTab === "appearance" ? (
                <div className="settings-body">
                  <p className="section-label">{t.languageLabel}</p>
                  <div className="mode-grid">
                    <button className={`btn-gradient ${language === "en" ? "mode-active" : ""}`} onClick={() => setLanguage("en")}>English</button>
                    <button className={`btn-gradient ${language === "fa" ? "mode-active" : ""}`} onClick={() => setLanguage("fa")}>فارسی</button>
                  </div>
                  <p className="section-label">{t.themeLabel}</p>
                  <div className="mode-grid">
                    <button className={`btn-gradient ${theme === "dark" ? "mode-active" : ""}`} onClick={() => setTheme("dark")}>{t.themeDark}</button>
                    <button className={`btn-gradient ${theme === "light" ? "mode-active" : ""}`} onClick={() => setTheme("light")}>{t.themeLight}</button>
                  </div>
                  <p className="section-label">{t.fontLabel}</p>
                  <div className="mode-grid">
                    <button className={`btn-gradient ${fontChoice === "vazirmatn" ? "mode-active" : ""}`} onClick={() => setFontChoice("vazirmatn")}>{t.fontVazir}</button>
                    <button className={`btn-gradient ${fontChoice === "system" ? "mode-active" : ""}`} onClick={() => setFontChoice("system")}>{t.fontSystem}</button>
                  </div>
                  <button className={`btn-gradient ${fontChoice === "serif" ? "mode-active" : ""}`} onClick={() => setFontChoice("serif")}>{t.fontSerif}</button>
                  <p className="section-label">{t.buttonHoverColorLabel}</p>
                  <div className="hover-color-row">
                    <input
                      type="color"
                      className="hover-color-input"
                      value={buttonHoverColor}
                      onChange={(event) => setButtonHoverColor(event.target.value)}
                    />
                    <button className="btn-gradient action-sm" onClick={() => setButtonHoverColor("#13b57f")}>
                      {t.buttonHoverColorReset}
                    </button>
                  </div>
                </div>
              ) : null}

              {settingsTab === "about" ? (
                <div className="settings-body about-body">
                  <div className="about-brand">
                    <img src={appLogo} alt="Happy Talk logo" className="about-logo" />
                    <h3>{APP_DISPLAY_NAME}</h3>
                  </div>
                  <h3>About This App 🚀</h3>
                  <p>
                    This application is the result of months of dedicated effort, continuous learning, and real-world testing.
                    Every part of it has been carefully crafted with passion, precision, and a strong vision to build something truly reliable and meaningful 💡
                  </p>
                  <p>
                    It is designed to deliver high-quality private voice communication, even under challenging network conditions.
                    The goal was simple yet powerful: create a system that just works fast, stable, and secure no matter where the user is 🌍
                  </p>
                  <h4>⚙️ Full Technology Stack (Complete System)</h4>
                  <p>This is not just a simple app it is a fully integrated system including frontend, backend, real-time communication, and database.</p>
                  <h4>🧠 Backend</h4>
                  <p>Built with Node.js + ngrok</p>
                  <p>Handles secure token generation, manages communication between services, and enables external access.</p>
                  <h4>🎨 Frontend</h4>
                  <p>Developed using JavaScript + React with modern, dynamic, and responsive UI and smooth UX ✨</p>
                  <h4>📡 Real-Time Communication</h4>
                  <p>Powered by Agora for high-quality voice calls, low latency, and optimization for unstable networks 🔊</p>
                  <h4>🗄️ Database & Real-Time Sync</h4>
                  <p>Using Firebase for real-time sync, user presence tracking, contacts, history, and live updates.</p>
                  <h4>💬 Vision</h4>
                  <p>
                    This app was built with a strong belief that communication should be simple, fast, and accessible for everyone,
                    even in low-bandwidth environments users should connect without frustration ❤️
                  </p>
                  <h4>👨‍💻 Creator</h4>
                  <p><strong>Wahidullah Khajeh Seddiqi (Mr.Happy)</strong></p>
                  <p>
                    <strong>
                      Gmail:{" "}
                      <a href="mailto:wahidmovahed813@gmail.com">
                        wahidmovahed813@gmail.com
                      </a>
                    </strong>
                  </p>
                  <p>
                    <strong>
                      Telegram:{" "}
                      <a href="https://t.me/JustBeHappy3" target="_blank" rel="noreferrer">
                        t.me/JustBeHappy3
                      </a>
                    </strong>
                  </p>
                  <p>✨ Built with passion, persistence, and a love for creating real-world solutions.</p>
                </div>
              ) : null}

              {settingsTab === "backend" ? (
                <div className="settings-body">
                  <input
                    dir="ltr"
                    className="nameInput"
                    placeholder={t.adminBackendLabel}
                    value={adminBackendUrl}
                    onChange={(event) => setAdminBackendUrl(event.target.value)}
                  />
                  <button className="start-btn" onClick={saveAdminBackend}>{t.adminSave}</button>
                  <p className="admin-guide">{t.adminGuide}</p>
                </div>
              ) : null}

              <div className="settings-close-sticky">
                <button className="btn-gradient" onClick={() => setShowSettingsPanel(false)}>{t.adminClose}</button>
              </div>
            </div>
          </div>
        ) : null}

        {uiLockedOverlay}
      </div>
    );
  }

  const safeUsersInCall =
    usersInCall && typeof usersInCall === "object" && !Array.isArray(usersInCall)
      ? usersInCall
      : {};

  return (
    <div className="call-screen">
      <div className="call-card">
        <div className="call-header">
          <h3>{activeRoomName}</h3>
          <div className="header-pills">
            <div className="quality-pill" style={{ color: qualityColor(connectionQuality, t) }}>
              <Circle sx={{ fontSize: 11 }} />
              {t.connectionQuality}: {connectionQuality}
            </div>
            <div
              className={`quality-pill ${
                stabilityMode === STABILITY_MODES.ultra
                  ? "stability-ultra"
                  : stabilityMode === STABILITY_MODES.higher
                    ? "stability-higher"
                    : stabilityMode === STABILITY_MODES.high
                      ? "stability-high"
                      : ""
              }`}
            >
              <Tune sx={{ fontSize: 12 }} />
              {stabilityMode === STABILITY_MODES.ultra
                ? t.stabilityUltra
                : stabilityMode === STABILITY_MODES.higher
                  ? t.stabilityHigher
                : stabilityMode === STABILITY_MODES.high
                  ? t.stabilityHigh
                  : t.stabilityBalanced}
            </div>
          </div>
        </div>

        <div className="timer-row">
          <GraphicEq sx={{ color: "#8ec5ff" }} />
          <span>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</span>
          <span className={`local-speak-dot ${localSpeaking ? "talking" : ""}`} />
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
            <PersonIcon fontSize="small" /> {t.users} ({Object.keys(safeUsersInCall).length})
          </h4>
          <div className="users-list">
            {Object.keys(safeUsersInCall).map((uid) => {
              const userInfo = normalizeCallUser(safeUsersInCall[uid]);
              const isSelf = String(userInfo.agoraUid) === String(userUID);
              const isSpeaking = Boolean(speakingUsers[userInfo.agoraUid]);
              const shouldShowSpeaking = isSpeaking && !(isSelf && isMuted);
              const stale = Date.now() - Number(userInfo.lastSeen || 0) > CALL_USER_STALE_MS;
              const resolvedNetwork = stale ? NETWORK_STATUS.weak : userInfo.networkStatus;
              const canAddContact = !isSelf && userInfo.uid && !contactsByUid[userInfo.uid];
              const canAdminMute = isRoomAdmin && !isSelf && userInfo.uid;
              const baseColor = userInfo.color || DEFAULT_PROFILE_COLOR;
              const idleBackground = `linear-gradient(135deg, ${hexToRgba(baseColor, 0.36)} 0%, ${hexToRgba(
                baseColor,
                0.2
              )} 100%)`;
              const speakingBackground = `linear-gradient(135deg, ${hexToRgba(baseColor, 0.9)} 0%, ${hexToRgba(
                baseColor,
                0.72
              )} 100%)`;

              return (
                <div
                  key={uid}
                  className={`user-chip ${shouldShowSpeaking ? "is-speaking" : "is-idle"} ${
                    isSelf && isMuted ? "is-muted" : ""
                  }`}
                  onClick={() => openCallUserInfo(safeUsersInCall[uid])}
                  style={{
                    background: shouldShowSpeaking ? speakingBackground : idleBackground,
                    borderColor: shouldShowSpeaking ? shadeColor(baseColor, -0.12) : shadeColor(baseColor, 0.02),
                    opacity: shouldShowSpeaking ? 1 : 0.76,
                  }}
                >
                  <span className="chip-user-main">
                    {userInfo.avatar ? (
                      <img src={userInfo.avatar} alt={userInfo.name} className="chip-avatar" />
                    ) : (
                      <span className="chip-avatar-emoji">{userInfo.emoji || "🙂"}</span>
                    )}
                    <span>{userInfo.name}</span>
                  </span>
                  <span className="chip-status">
                    {canAddContact ? (
                      <button
                        className="add-contact-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          addUserFromCall(uid, safeUsersInCall[uid]);
                        }}
                        title={t.addContact}
                      >
                        +
                      </button>
                    ) : null}
                    {canAdminMute ? (
                      <button
                        className="add-contact-btn admin-mute-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          muteMemberInRoom(userInfo.uid, userInfo.adminMuted);
                        }}
                        title={userInfo.adminMuted ? t.unmute : t.muteMember}
                      >
                        {userInfo.adminMuted ? <Mic fontSize="small" /> : <MicOff fontSize="small" />}
                      </button>
                    ) : null}
                    {resolvedNetwork === NETWORK_STATUS.offline ? (
                      <span title={t.netOffline}><CloudOff fontSize="small" className="net-offline" /></span>
                    ) : resolvedNetwork === NETWORK_STATUS.weak ? (
                      <span title={t.netWeak}><CloudQueue fontSize="small" className="net-weak" /></span>
                    ) : (
                      <span title={t.netGood}><CloudDone fontSize="small" className="net-good" /></span>
                    )}
                  </span>
                  {shouldShowSpeaking ? (
                    <GraphicEq fontSize="small" className="chip-icon speaking-icon" />
                  ) : isSelf && isMuted ? (
                    <MicOff fontSize="small" className="chip-icon muted-icon" />
                  ) : (
                    <Circle sx={{ fontSize: 10 }} className="chip-icon idle-icon" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="control-grid">
          <button
            className={`control-btn icon-only ${isMuted ? "active" : ""}`}
            onClick={toggleMute}
            title={isMuted ? t.unmute : t.mute}
            aria-label={isMuted ? t.unmute : t.mute}
          >
            {isMuted ? <MicOff /> : <Mic />}
          </button>

          <button
            className={`control-btn icon-only ${micLowered ? "active" : ""}`}
            onClick={toggleMicVolume}
            title={micLowered ? t.normalMic : t.lowerMic}
            aria-label={micLowered ? t.normalMic : t.lowerMic}
          >
            {micLowered ? <VolumeUp /> : <VolumeDown />}
          </button>

          <button
            className={`control-btn icon-only ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            title={isRecording ? t.stopRecord : t.record}
            aria-label={isRecording ? t.stopRecord : t.record}
          >
            {isRecording ? <Stop /> : <FiberManualRecord />}
          </button>

          <button className="control-btn icon-only leave" onClick={leaveCall} title={t.leaveCall} aria-label={t.leaveCall}>
            <CallEnd />
          </button>
        </div>
      </div>
      {selectedCallUser ? (
        <div className="user-info-overlay" onClick={() => setSelectedCallUser(null)}>
          <div className="user-info-modal" onClick={(event) => event.stopPropagation()}>
            <button className="icon-ghost-btn close-user-info" onClick={() => setSelectedCallUser(null)}>
              <Close fontSize="small" />
            </button>
            <div className="user-info-avatar-wrap">
              {selectedCallUser.avatar ? (
                <img src={selectedCallUser.avatar} alt={selectedCallUser.name} className="profile-avatar-preview" />
              ) : (
                <div className="profile-emoji-fallback">{selectedCallUser.emoji || "🙂"}</div>
              )}
            </div>
            <h4>{selectedCallUser.name || "User"}</h4>
            <p><Badge fontSize="inherit" /> {t.contactUid}: {selectedCallUser.uid || "-"}</p>
            <p><Person fontSize="inherit" /> {t.genderLabel}: {selectedCallUser.gender === "male" ? t.genderMale : selectedCallUser.gender === "female" ? t.genderFemale : t.genderNotSet}</p>
            <p><Cake fontSize="inherit" /> {t.birthDateLabel}: {selectedCallUser.birthDate || "-"}</p>
            <p>{t.age}: {calcAge(selectedCallUser.birthDate)}</p>
          </div>
        </div>
      ) : null}
      {uiLockedOverlay}
    </div>
  );
};

export default App;

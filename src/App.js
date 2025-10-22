// ⚡ نسخه اصلاح‌شده با رفع باگ ماندن نام در Firebase
import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import * as Tone from "tone";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove } from "firebase/database";
import notificationSound from "./assets/welcomeNotif.mp3";
import {
  Mic,
  MicOff,
  CallEnd,
  VolumeUp,
  VoiceOverOff,
  RecordVoiceOver,
} from "@mui/icons-material";
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

const App = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [voiceOn, setVoiceOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [usersInCall, setUsersInCall] = useState({});
  const [userUID, setUserUID] = useState(null);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [micLowered, setMicLowered] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioRef = useRef(new Audio(notificationSound));

  const APP_ID = "717d9262657d4caab56f3d8a9a7b2089";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYDjUahCgwMn3ah5v3JN9M+bw/t1gnns65XNeXP55B79wk3cKDOaG5imWRmZGZqbmKSbJiYlJpmZpxikWiZaJ5klGBhaWZ/Z8z2gIZGT42tzEzMgAgSA+D0NOflmqbnJGYl5eag4DAwBhvSOL";

  // ✅ وقتی تب یا پنجره بسته شود، اگر کاربر در تماس بود حذف شود
  useEffect(() => {
    const handleUnload = () => {
      if (userUID) {
        remove(ref(db, `callUsers/${userUID}`));
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("unload", handleUnload);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && userUID) {
        remove(ref(db, `callUsers/${userUID}`));
      }
    });

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("unload", handleUnload);
    };
  }, [userUID]);

  useEffect(() => {
    const usersRef = ref(db, "callUsers/");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const prevUsers = Object.keys(usersInCall);
      const newUsers = Object.keys(data).filter(
        (uid) => !prevUsers.includes(uid)
      );
      if (newUsers.length > 0 && nameEntered) {
        const audio = audioRef.current;
        audio.volume = 0.3;
        audio.play();
      }
      setUsersInCall(data);
      if (Object.keys(data).length > 1) setTimerActive(true);
      else setTimerActive(false);
    });
    return () => unsubscribe();
  }, [usersInCall, nameEntered]);

  useEffect(() => {
    let interval = null;
    if (timerActive) {
      interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (inCall) {
        try {
          const stats = await client.getRTCStats();
          const rtt = stats.rtt || 0;
          if (rtt < 150) setConnectionQuality("عالی ✅");
          else if (rtt < 300) setConnectionQuality("خوب ⚡");
          else if (rtt < 500) setConnectionQuality("متوسط ⚠️");
          else setConnectionQuality("ضعیف ❌");
        } catch {
          setConnectionQuality("–");
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [client, inCall]);

  const createVoiceTrack = async (enableVoice, nameLabel) => {
    if (!rawStreamRef.current) {
      rawStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    }

    await Tone.start();
    const audioCtx = Tone.context;
    audioCtxRef.current = audioCtx;
    const micSource = audioCtx.createMediaStreamSource(rawStreamRef.current);
    gainNodeRef.current = audioCtx.createGain();
    gainNodeRef.current.gain.value = 1;
    micSource.connect(gainNodeRef.current);
    const dest = audioCtx.createMediaStreamDestination();
    gainNodeRef.current.connect(dest);
    const processedTrack = dest.stream.getAudioTracks()[0];
    const customTrack = await AgoraRTC.createCustomAudioTrack({
      mediaStreamTrack: processedTrack,
    });
    customTrack._userName = nameLabel;
    return customTrack;
  };

  const toggleMicVolume = () => {
    if (!gainNodeRef.current) return;
    if (!micLowered) {
      gainNodeRef.current.gain.value = 0.1;
      setMicLowered(true);
      setOverlayVisible(true);
    } else {
      gainNodeRef.current.gain.value = 1;
      setMicLowered(false);
      setOverlayVisible(false);
    }
  };

  const overlayDoubleClick = () => {
    gainNodeRef.current.gain.value = 1;
    setMicLowered(false);
    setOverlayVisible(false);
  };

  const joinCall = async () => {
    if (!username.trim()) {
      alert("لطفاً نام خود را وارد کنید!");
      return;
    }
    if (password !== "12213412") {
      alert("پسورد اشتباه است!");
      return;
    }

    const UID = await client.join(APP_ID, CHANNEL, TOKEN, null);
    setUserUID(UID);
    const track = await createVoiceTrack(voiceOn, username);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    await set(ref(db, `callUsers/${UID}`), username);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack.play();
    });

    client.on("user-left", (user) => {
      remove(ref(db, `callUsers/${user.uid}`));
    });

    setInCall(true);
  };

  const toggleVoice = async () => {
    if (!localTrackRef.current) return;
    await client.unpublish([localTrackRef.current]);
    localTrackRef.current.stop();
    localTrackRef.current.close?.();
    const newTrack = await createVoiceTrack(!voiceOn, username);
    localTrackRef.current = newTrack;
    setLocalAudioTrack(newTrack);
    await client.publish([newTrack]);
    setVoiceOn(!voiceOn);
  };

  const toggleMute = async () => {
    if (!localTrackRef.current) return;
    await localTrackRef.current.setEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  const leaveCall = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    await client.leave();
    if (userUID) remove(ref(db, `callUsers/${userUID}`));
    setInCall(false);
    setConnectionQuality("–");
    setOverlayVisible(false);
    setMicLowered(false);
  };

  if (!nameEntered) {
    return (
      <div
        className="css-gradient-animation"
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <h2 style={{ marginBottom: "50px", color: "white" }}>ورود به تماس صوتی</h2>
        <input
          dir="rtl"
          type="text"
          placeholder="نام خود را وارد کنید"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            color: "white",
            padding: "5px 10px",
            fontSize: "18px",
            borderRadius: "6px",
            marginBottom: "10px",
            backgroundColor: "inherit",
            width: "29%",
          }}
        />
        <input
          dir="rtl"
          type="password"
          placeholder="رمز عبور را وارد کنید"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            color: "white",
            padding: "5px 10px",
            fontSize: "18px",
            borderRadius: "6px",
            backgroundColor: "inherit",
            width: "29%",
          }}
        />
        <button
          onClick={() => setNameEntered(true)}
          style={{
            marginTop: "15px",
            padding: "10px 20px",
            borderRadius: "7px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            border: "none",
            width: "31.5%",
          }}
        >
          ادامه
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "94.7vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#163044",
        flexDirection: "column",
        padding: "20px",
      }}
    >
      {inCall ? (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#fff", width: "100%",}}> ㅤㅤㅤㅤ {Math.floor(timer / 60)}:{("0" + (timer % 60)).slice(-2)}ㅤㅤㅤㅤ</h2>
          <p style={{ color: "lightgreen" }}>
            🔹 کیفیت اتصال: {connectionQuality}
          </p>

          <div style={{ marginTop: "20px" }}>
            <h3 style={{ color: "white" }}>👥 کاربران حاضر:</h3>
            <ul
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexFlow: "column",
                border: "solid 1px white",
                borderRadius: "5px",
              }}
            >
              {Object.keys(usersInCall).map((uid) => (
                <li
                  key={uid}
                  style={{
                    listStyleType: "none",
                    boxSizing: "border-box",
                    margin: "5px",
                    background: "rgba(216, 238, 144, 0.4)",
                    display: "block",
                    padding: "10px",
                    borderRadius: "5px",
                    width: "115%",
                    position: "relative",
                    right: "20px",
                    fontSize: "15px",
                    fontFamily: "vazirmatn",
                  }}
                >
                  {usersInCall[uid]}
                </li>
              ))}
            </ul>
          </div>

          <div
            style={{
              display: "flex",
              flexFlow: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <button
              onClick={toggleMicVolume}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                background: micLowered ? "#f94b4be7" : "#007bff",
                color: "white",
                fontSize: "16px",
                width: "100%",
              }}
            >
              {micLowered ? "🔈" : <VolumeUp />}
            </button>

            <button
              onClick={toggleVoice}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                background: voiceOn ? "#f94b4be7" : "lightgreen",
                color: "white",
                fontSize: "16px",
                marginBottom: "10px",
                marginTop: "10px",
                width: "100%",
              }}
            >
              {voiceOn ? <VoiceOverOff /> : <RecordVoiceOver />}
            </button>

            <button
              onClick={toggleMute}
              style={{
                padding: "10px 20px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                background: isMuted ? "gray" : "#007bff",
                color: "white",
                fontSize: "16px",
                marginBottom: "10px",
                width: "100%",
              }}
            >
              {isMuted ? <MicOff /> : <Mic />}
            </button>

            <button
              onClick={leaveCall}
              style={{
                padding: "20px 10px",
                borderRadius: "100px",
                background: "#f94b4be7",
                color: "white",
                border: "none",
                cursor: "pointer",
                marginTop: "10px",
                fontSize: "30px",
                width: "30%",
              }}
            >
              <CallEnd fontSize="50px" />
            </button>

            {overlayVisible && (
              <div
                onDoubleClick={overlayDoubleClick}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  backgroundColor: "rgba(0,0,0,0.95)",
                  zIndex: 9999,
                }}
              ></div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={joinCall}
          style={{
            padding: "15px 30px",
            borderRadius: "15px",
            background: "inherit",
            color: "lightgreen",
            fontSize: "18px",
            border: "solid 1px lightgreen",
            cursor: "pointer",
            boxShadow: "0px 0px 10px rgba(26, 255, 0, 0.44)",
          }}
        >
          شروع تماس با مخاطب
        </button>
      )}
    </div>
  );
};

export default App;
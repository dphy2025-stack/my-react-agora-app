import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import * as Tone from "tone";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove } from "firebase/database";

// تنظیمات Firebase
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
  const [nameEntered, setNameEntered] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [voiceOn, setVoiceOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [usersInCall, setUsersInCall] = useState({});
  const [userUID, setUserUID] = useState(null); // نگهداری UID برای حذف
  const [client] = useState(() => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }));
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);

  const APP_ID = "717d9262657d4caab56f3d8a9a7b2089";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYKjau9nrJnPLJf33P4sXfghyDdpdPntz8W6mIln3vPSHNzkUGMwNzVMsjcyMzEzNU0ySExOTTM3SjFMsEi0TzZOMDCwsW6I+ZzQEMjIcOvqYgREKQXwehpz8slTd5IzEvLzUHAYGANlxJHk=";

  // 👥 مانیتور کاربران حاضر از Firebase (ریل‌تایم)
  useEffect(() => {
    const usersRef = ref(db, "callUsers/");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setUsersInCall(data);
    });
    return () => unsubscribe();
  }, []);

  // 🔹 بررسی کیفیت اتصال
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

  // 🎤 ایجاد ترک صوتی
  const createVoiceTrack = async (enableVoice, nameLabel) => {
    if (!rawStreamRef.current) {
      rawStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    if (!enableVoice) {
      const track = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "low_quality",
        AEC: true,
        AGC: true,
        ANS: true,
      });
      track._userName = nameLabel;
      return track;
    }

    await Tone.start();
    const audioCtx = Tone.context;
    const micSource = audioCtx.createMediaStreamSource(rawStreamRef.current);
    const delayNode = audioCtx.createDelay(2.0);
    micSource.connect(delayNode);

    const pitchShift = new Tone.PitchShift({ pitch: 7, windowSize: 0.1 });
    const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.2 });
    const dest = audioCtx.createMediaStreamDestination();
    const toneSource = new Tone.UserMedia();
    await toneSource.open();
    toneSource.connect(pitchShift);
    pitchShift.connect(reverb);
    const toneGain = audioCtx.createGain();
    reverb.connect(toneGain);
    toneGain.connect(dest);

    const processedTrack = dest.stream.getAudioTracks()[0];
    processedTrack.label = nameLabel;
    const customTrack = await AgoraRTC.createCustomAudioTrack({
      mediaStreamTrack: processedTrack,
    });
    customTrack._userName = nameLabel;
    return customTrack;
  };

  // 📞 ورود به تماس
  const joinCall = async () => {
    if (!username.trim()) {
      alert("لطفاً نام خود را وارد کنید!");
      return;
    }

    const UID = await client.join(APP_ID, CHANNEL, TOKEN, null);
    setUserUID(UID); // ذخیره UID برای حذف
    const track = await createVoiceTrack(voiceOn, username);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    // ✅ ذخیره نام کاربر در Firebase
    await set(ref(db, `callUsers/${UID}`), username);

    window.addEventListener("beforeunload", () => {
      if (userUID) remove(ref(db, `callUsers/${userUID}`));
    });

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack.play();
    });

    client.on("user-left", (user) => {
      remove(ref(db, `callUsers/${user.uid}`));
    });

    setInCall(true);
  };

  // 🎚️ فعال/غیرفعال‌سازی تغییر صدا
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

  // 🔇 میوت
  const toggleMute = async () => {
    if (!localTrackRef.current) return;
    await localTrackRef.current.setEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  // 🚪 خروج
  const leaveCall = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    await client.leave();
    if (userUID) remove(ref(db, `callUsers/${userUID}`));
    setInCall(false);
    setConnectionQuality("–");
  };

  // 👤 صفحه ورود نام
  if (!nameEntered) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          background: "#303c43ff",
        }}
      >
        <input
          type="text"
          placeholder="نام خود را وارد کنید"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: "10px", fontSize: "16px", borderRadius: "8px" }}
        />
        <button
          onClick={() => setNameEntered(true)}
          style={{
            marginTop: "15px",
            padding: "10px 20px",
            borderRadius: "10px",
            fontSize: "16px",
            cursor: "pointer",
            background: "lightgreen",
            border: "none",
          }}
        >
          ادامه
        </button>
      </div>
    );
  }

  // 🎧 صفحه تماس
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        background: "#303c43ff",
        flexDirection: "column",
        padding: "20px",
      }}
    >
      {inCall ? (
        <>
          <h2 style={{ color: "#fff" }}>📞 در حال تماس با مخاطب</h2>
          <p style={{ color: "lightgreen" }}>🔹 کیفیت اتصال: {connectionQuality}</p>

          <div style={{ marginTop: "20px" }}>
            <h3 style={{ color: "white" }}>👥 کاربران حاضر:</h3>
            <ul>
              {Object.keys(usersInCall).map((uid) => (
                <li key={uid} style={{ color: "lightgreen" }}>
                  {usersInCall[uid]}
                </li>
              ))}
            </ul>
          </div>

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
              marginTop: "15px",
            }}
          >
            {voiceOn
              ? "🔴 تغییر صدا **فعال** → غیرفعال کن"
              : "🟢 تغییر صدا **غیرفعال** → فعال کن"}
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
            }}
          >
            {isMuted ? "🔇 میوت فعال → آن‌میوت کن" : "🎙️ میکروفون روشن → میوت کن"}
          </button>

          <button
            onClick={leaveCall}
            style={{
              padding: "15px 30px",
              borderRadius: "15px",
              background: "#f94b4be7",
              color: "white",
              border: "none",
              cursor: "pointer",
              marginTop: "10px",
              fontSize: "17px",
            }}
          >
            قطع تماس
          </button>
        </>
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
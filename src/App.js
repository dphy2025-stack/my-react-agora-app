import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import * as Tone from "tone";

const App = () => {
  const [username, setUsername] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [voiceOn, setVoiceOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);

  // ✅ لیست کاربران حاضر: uid → name
  const [usersInCall, setUsersInCall] = useState({});

  const APP_ID = "717d9262657d4caab56f3d8a9a7b2089";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYDDf9DSX4YE90+tK8ShN33WbD572v+n+tOfX7k7hTbfvbM9TYDA3NE+xNDIzMjM1TzFJTkxMMjVLM06xSLRMNE8yMrCwLDHakdEQyMhg/PApMyMDBIL4PAw5+WWpuskZiXl5qTkMDADaKCRk";

  useEffect(() => {
    client.on("connection-state-change", (cur) => {
      if (cur === "DISCONNECTED") console.log("Waiting..");
    });

    const interval = setInterval(async () => {
      if (inCall) {
        try {
          const stats = await client.getRTCStats();
          const rtt = stats.rtt || 0;
          if (rtt < 150) setConnectionQuality("عالی ✅");
          else if (rtt < 300) setConnectionQuality("خوب ⚡");
          else if (rtt < 500) setConnectionQuality("متوسط ⚠️");
          else setConnectionQuality("ضعیف ❌");
        } catch (e) {
          setConnectionQuality("–");
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [client, inCall]);

  const createVoiceTrack = async (enableVoice) => {
    if (!rawStreamRef.current) {
      rawStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    }

    if (!enableVoice) {
      return await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "low_quality",
        AEC: true,
        AGC: true,
        ANS: true,
      });
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
    return await AgoraRTC.createCustomAudioTrack({
      mediaStreamTrack: processedTrack,
    });
  };

  // ✅ تابع joinCall با ثبت نام کاربر
  const joinCall = async () => {
    if (!username.trim()) {
      alert("لطفاً نام خود را وارد کنید!");
      return;
    }

    await client.join(APP_ID, CHANNEL, TOKEN, null);

    // اضافه کردن نام خود به لیست کاربران حاضر
    const localUID = client.uid;
    setUsersInCall((prev) => ({ ...prev, [localUID]: username }));

    const track = await createVoiceTrack(voiceOn);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);

      // وقتی کاربر جدید وارد شد، نامش را ثبت می‌کنیم
      setUsersInCall((prev) => ({
        ...prev,
        [user.uid]: user.name || "کاربر ناشناس",
      }));

      if (mediaType === "audio") user.audioTrack.play();
    });

    setInCall(true);
  };

  const toggleVoice = async () => {
    if (!localTrackRef.current) return;

    await client.unpublish([localTrackRef.current]);
    localTrackRef.current.stop();
    localTrackRef.current.close && localTrackRef.current.close();

    const newTrack = await createVoiceTrack(!voiceOn);
    localTrackRef.current = newTrack;
    setLocalAudioTrack(newTrack);
    await client.publish([newTrack]);

    setVoiceOn(!voiceOn);
  };

  const toggleMute = async () => {
    if (!localTrackRef.current) return;
    if (isMuted) {
      await localTrackRef.current.setEnabled(true); // آن‌میوت
    } else {
      await localTrackRef.current.setEnabled(false); // میوت
    }
    setIsMuted(!isMuted);
  };

  const leaveCall = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    await client.leave();
    setInCall(false);
    setConnectionQuality("–");
    setUsersInCall({});
  };

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

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
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

          {/* لیست کاربران حاضر */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={{ color: "white" }}>👥 کاربران حاضر:</h3>
            <ul>
              {Object.values(usersInCall).map((name, idx) => (
                <li key={idx} style={{ color: "lightgreen" }}>
                  {name}
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
            }}
          >
            {voiceOn
              ? "🔴 تغییر صدا **فعال** → غیرفعال کن"
              : "🟢 تغییر صدا **غیر فعال** → فعال کن"}
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
            {isMuted
              ? "🔇 میوت فعال → آن‌میوت کن"
              : "🎙️ میکروفون روشن → میوت کن"}
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

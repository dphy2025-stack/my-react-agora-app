import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import * as Tone from "tone";

const App = () => {
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [voiceOn, setVoiceOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [userName, setUserName] = useState(""); // ✅ اسم کاربر
  const [usersInCall, setUsersInCall] = useState([]); // ✅ لیست افراد
  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);

  const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYIic/+bs6ZVswrnll9bPOnnZ8OsOf6Erf2/esWiu0o//qZepwGBuaJ5iaWRmZGZqnmKSnJiYZGqWZpxikWiZaJ5kZGBh+URmR0ZDICND4I0gJkYGCATxeRhy8stSdZMzEvPyUnMYGAAy3CTd";

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

  const joinCall = async () => {
    if (!userName.trim()) {
      alert("لطفا نام خود را وارد کنید");
      return;
    }

    await client.join(APP_ID, CHANNEL, TOKEN, null);
    const track = await createVoiceTrack(voiceOn);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    // ✅ اضافه کردن اسم کاربر خودت به لیست
    setUsersInCall((prev) => [...prev, { uid: "local", name: userName }]);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack.play();

      // وقتی کاربر جدید اومد → اسمشو اضافه کن
      setUsersInCall((prev) => [
        ...prev,
        { uid: user.uid, name: `کاربر ${user.uid}` },
      ]);
    });

    client.on("user-unpublished", (user) => {
      setUsersInCall((prev) => prev.filter((u) => u.uid !== user.uid));
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
      await localTrackRef.current.setEnabled(true);
    } else {
      await localTrackRef.current.setEnabled(false);
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
    setUsersInCall([]);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#303c43ff",
        flexDirection: "column",
      }}
    >
      {!inCall ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <input
            type="text"
            placeholder="نام خود را وارد کنید"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid lightgreen",
              fontSize: "16px",
              textAlign: "center",
            }}
          />
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
            ورود به تماس
          </button>
        </div>
      ) : (
        <>
          <h2 style={{ color: "#ffffffff" }}>📞 در حال تماس</h2>
          <p style={{ color: "lightgreen", marginTop: "10px" }}>
            🔹 کیفیت اتصال: {connectionQuality}
          </p>

          {/* ✅ نمایش لیست کاربران */}
          <div style={{ color: "white", margin: "10px 0" }}>
            👥 افراد حاضر در تماس:
            <ul>
              {usersInCall.map((u) => (
                <li key={u.uid} style={{ marginTop: "5px" }}>
                  {u.name}
                  {u.uid === "local" ? " (شما)" : ""}
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
      )}
    </div>
  );
};

export default App;
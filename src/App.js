import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const App = () => {
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceAIOn, setVoiceAIOn] = useState(false);
  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const [localAudioTrack, setLocalAudioTrack] = useState(null);

  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);
  const voiceAISocketRef = useRef(null);

  const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYBCNvRXt1KfClGhxOFXpoNzLzGX/7MOYAie8fHdktmxyT48Cg7mheYqlkZmRmal5iklyYmKSqVmacYpFomWieZKRgYVl6JP1GQ2BjAzTJf4xMTJAIIjPw5CTX5aqm5yRmJeXmsPAAADzgSHp";

  useEffect(() => {
    client.on("connection-state-change", (cur) => {
      if (cur === "DISCONNECTED") console.log("در حال تلاش برای اتصال مجدد...");
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

  const createVoiceTrack = async (enableVoice, useVoiceAI = false) => {
    if (!rawStreamRef.current) {
      rawStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    if (!enableVoice) {
      return await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "low_quality",
        AEC: true,
        AGC: true,
        ANS: true,
      });
    }

    // اگر Voice.ai فعال باشد
    if (useVoiceAI) {
      // WebSocket به Voice.ai
      if (!voiceAISocketRef.current) {
        const socket = new WebSocket("wss://api.voice.ai/realtime"); // URL واقعی Voice.ai
        socket.binaryType = "arraybuffer";
        socket.onopen = () => console.log("Voice.ai WebSocket connected");
        socket.onclose = () => console.log("Voice.ai WebSocket closed");
        socket.onerror = (e) => console.error("Voice.ai Error", e);
        voiceAISocketRef.current = socket;
      }

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const micSource = audioCtx.createMediaStreamSource(rawStreamRef.current);
      const dest = audioCtx.createMediaStreamDestination();

      // MediaRecorder با بافر 3 ثانیه‌ای
      const mediaRecorder = new MediaRecorder(rawStreamRef.current);
      mediaRecorder.ondataavailable = (event) => {
        if (voiceAISocketRef.current && voiceAISocketRef.current.readyState === WebSocket.OPEN) {
          // می‌توان پارامتر "voice" را برای صدای دختر معمولی تنظیم کرد
          // (در صورت پشتیبانی API Voice.ai)
          voiceAISocketRef.current.send(event.data);
        }
      };
      mediaRecorder.start(3000);

      // دریافت صداهای پردازش شده
      voiceAISocketRef.current.onmessage = (msg) => {
        audioCtx.decodeAudioData(msg.data, (buffer) => {
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(dest);
          source.start();
        });
      };

      return await AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: dest.stream.getAudioTracks()[0] });
    }

    // حالت قدیمی Tone.js
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const micSource = audioCtx.createMediaStreamSource(rawStreamRef.current);
    const delayNode = audioCtx.createDelay(2.0);
    micSource.connect(delayNode);

    return await AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: rawStreamRef.current.getAudioTracks()[0] });
  };

  const joinCall = async () => {
    await client.join(APP_ID, CHANNEL, TOKEN, null);
    const track = await createVoiceTrack(voiceOn, voiceAIOn);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack.play();
    });

    setInCall(true);
  };

  const toggleVoice = async () => {
    if (!localTrackRef.current) return;

    await client.unpublish([localTrackRef.current]);
    localTrackRef.current.stop();
    localTrackRef.current.close && localTrackRef.current.close();

    const newTrack = await createVoiceTrack(!voiceOn, voiceAIOn);
    localTrackRef.current = newTrack;
    setLocalAudioTrack(newTrack);
    await client.publish([newTrack]);

    setVoiceOn(!voiceOn);
  };

  const toggleVoiceAI = async () => {
    if (!localTrackRef.current) return;

    await client.unpublish([localTrackRef.current]);
    localTrackRef.current.stop();
    localTrackRef.current.close && localTrackRef.current.close();

    const newTrack = await createVoiceTrack(true, !voiceAIOn);
    localTrackRef.current = newTrack;
    setLocalAudioTrack(newTrack);
    await client.publish([newTrack]);

    setVoiceAIOn(!voiceAIOn);
  };

  const leaveCall = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    await client.leave();
    setInCall(false);
    setConnectionQuality("–");
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
      {inCall ? (
        <>
          <h2 style={{ color: "#ffffffff" }}>📞 در حال تماس با مخاطب مورد نظر</h2>
          <p style={{ color: "lightgreen", marginTop: "10px" }}>
            🔹 کیفیت اتصال: {connectionQuality}
          </p>
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
              ? "🔴 صدای زنانه فعال است → غیرفعال کن"
              : "🟢 صدای زنانه خاموش → فعال کن"}
          </button>

          {/* دکمه Voice.ai */}
          <button
            onClick={toggleVoiceAI}
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              background: voiceAIOn ? "#f94b4be7" : "lightblue",
              color: "white",
              fontSize: "16px",
              marginBottom: "10px",
            }}
          >
            {voiceAIOn ? "🔴 Voice.ai فعال → غیرفعال کن" : "🟢 Voice.ai خاموش → فعال کن"}
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
          شروع تماس با مخاطب مورد نظر
        </button>
      )}
    </div>
  );
};

export default App;
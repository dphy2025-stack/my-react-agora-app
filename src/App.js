import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import * as Tone from "tone";

const App = () => {
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [voiceOn, setVoiceOn] = useState(false);
  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const [localAudioTrack, setLocalAudioTrack] = useState(null);

  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [currentOutput, setCurrentOutput] = useState(null);
  const [isEarpiece, setIsEarpiece] = useState(false);

  const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYCgxrpI7cbo4a//j0LQlVonpau0sd5Ivf/7sdqNvcl+fQr8Cg7mheYqlkZmRmal5iklyYmKSqVmacYpFomWieZKRgYVl7OJtGQ2BjAzbD5kzMTJAIIjPw5CTX5aqm5yRmJeXmsPAAACaiiOE";

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
    return await AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: processedTrack });
  };

  const joinCall = async () => {
    await client.join(APP_ID, CHANNEL, TOKEN, null);
    const track = await createVoiceTrack(voiceOn);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack.play(remoteAudioRef.current);
    });

    setInCall(true);

    // پیش‌فرض روی اسپیکر
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const outputs = devices.filter(d => d.kind === "audiooutput");
      const speaker = outputs.find(d => d.label.toLowerCase().includes("speaker"));
      if (speaker && remoteAudioRef.current?.setSinkId) {
        remoteAudioRef.current.setSinkId(speaker.deviceId);
        setCurrentOutput(speaker.deviceId);
        setIsEarpiece(false);
      }
    });
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

  const leaveCall = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    await client.leave();
    setInCall(false);
    setConnectionQuality("–");
  };

  const toggleOutput = async () => {
    if (!remoteAudioRef.current?.setSinkId) {
      alert("مرورگر شما اجازه تغییر خروجی صدا را نمی‌دهد");
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === "audiooutput");

    const earpiece = outputs.find(d => d.label.toLowerCase().includes("earpiece"));
    const speaker = outputs.find(d => d.label.toLowerCase().includes("speaker"));

    if (!speaker && !earpiece) {
      alert("اسپیکر یا گوشی شما شناسایی نشد");
      return;
    }

    if (currentOutput === speaker?.deviceId && earpiece) {
      await remoteAudioRef.current.setSinkId(earpiece.deviceId);
      setCurrentOutput(earpiece.deviceId);
      setIsEarpiece(true);
    } else if (speaker) {
      await remoteAudioRef.current.setSinkId(speaker.deviceId);
      setCurrentOutput(speaker.deviceId);
      setIsEarpiece(false);
    }
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
        position: "relative"
      }}
    >
      {isEarpiece && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "black",
            zIndex: 9999,
          }}
          onClick={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
        />
      )}

      <audio ref={remoteAudioRef} autoPlay />

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
              ? "🔴 تغییر صدا **فعال** → غیرفعال کن"
              : "🟢 تغییر صدا **غیر فعال**  → فعال کن"}
          </button>

          {/* دکمه همیشه نمایش داده می‌شود */}
          <button
            onClick={toggleOutput}
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              background: "#4b6ef7",
              color: "white",
              fontSize: "16px",
              marginBottom: "10px",
            }}
          >
            {isEarpiece ? "🔊 انتقال به اسپیکر" : "🎧 انتقال به گوشی"}
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


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

  const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYCjKvib78XRE6eki3pLHJwJlDZ81LLq7lOfHP70ttyzZe5sUGMwNzVMsjcyMzEzNU0ySExOTTM3SjFMsEi0TzZOMDCwsJ2/blNEQyMiwscCIgREKQXwehpz8slTd5IzEvLzUHAYGANnnI/0=";

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

  // ایجاد Track با Tone.js
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

    // بافر 2 ثانیه‌ای
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
              ? "🔴 تغییر صدا **فعال** → غیرفعال کن"
              : "🟢 تغییر صدا **غیر فعال**  → فعال کن"}
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
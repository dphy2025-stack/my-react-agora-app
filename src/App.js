import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import * as Tone from "tone";

const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7";
const CHANNEL = "love-channel";
const TOKEN =
  "007eJxTYIic/+bs6ZVswrnll9bPOnnZ8OsOf6Erf2/esWiu0o//qZepwGBuaJ5iaWRmZGZqnmKSnJiYZGqWZpxikWiZaJ5kZGBh+URmR0ZDICND4I0gJkYGCATxeRhy8stSdZMzEvPyUnMYGAAy3CTd";

const App = () => {
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [voiceOn, setVoiceOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [username, setUsername] = useState("");
  const [participants, setParticipants] = useState([]);

  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const [rtmClient] = useState(() => AgoraRTM.createInstance(APP_ID));
  const [rtmChannel, setRtmChannel] = useState(null);

  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);

  // ---------------- اتصال صوتی ----------------
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

  // ---------------- ورود به تماس ----------------
  const joinCall = async () => {
    if (!username.trim()) return alert("لطفا نام خود را وارد کنید ✅");

    // RTC join
    await client.join(APP_ID, CHANNEL, TOKEN, null);
    const track = await createVoiceTrack(voiceOn);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack.play();
    });

    // RTM join
    await rtmClient.login({ uid: username + "_" + Date.now() }); // یکتا کردن UID
    const channel = rtmClient.createChannel(CHANNEL);
    await channel.join();
    setRtmChannel(channel);

    // وقتی کسی پیام فرستاد
    channel.on("ChannelMessage", ({ text }) => {
      const data = JSON.parse(text);
      if (data.type === "join") {
        setParticipants((prev) => [...new Set([...prev, data.name])]);
      } else if (data.type === "leave") {
        setParticipants((prev) => prev.filter((n) => n !== data.name));
      }
    });

    // اسم خودتو اضافه کن و به همه اطلاع بده
    setParticipants((prev) => [...new Set([...prev, username])]);
    channel.sendMessage({ text: JSON.stringify({ type: "join", name: username }) });

    setInCall(true);
  };

  // ---------------- تغییر صدا ----------------
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

  // ---------------- میوت / آن‌میوت ----------------
  const toggleMute = async () => {
    if (!localAudioTrack) return;
    if (isMuted) {
      await localAudioTrack.setEnabled(true);
    } else {
      await localAudioTrack.setEnabled(false);
    }
    setIsMuted(!isMuted);
  };

  // ---------------- قطع تماس ----------------
  const leaveCall = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    await client.leave();

    if (rtmChannel) {
      await rtmChannel.sendMessage({
        text: JSON.stringify({ type: "leave", name: username }),
      });
      await rtmChannel.leave();
    }
    await rtmClient.logout();

    setInCall(false);
    setParticipants([]);
    setConnectionQuality("–");
  };

  // ---------------- کیفیت اتصال ----------------
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
        <>
          <h2 style={{ color: "white", marginBottom: "15px" }}>
            👤 لطفا نام خود را وارد کنید
          </h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="نام شما..."
            style={{
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid lightgreen",
              marginBottom: "15px",
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
        </>
      ) : (
        <>
          <h2 style={{ color: "#ffffffff" }}>📞 در حال تماس</h2>
          <p style={{ color: "lightgreen", marginTop: "10px" }}>
            🔹 کیفیت اتصال: {connectionQuality}
          </p>

          <h3 style={{ color: "lightblue", marginTop: "20px" }}>
            👥 کاربران حاضر در تماس:
          </h3>
          <ul style={{ color: "white" }}>
            {participants.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>

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
              ? "🔴 تغییر صدا فعال → غیرفعال کن"
              : "🟢 تغییر صدا غیر فعال → فعال کن"}
          </button>

          <button
            onClick={toggleMute}
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              background: isMuted ? "gray" : "orange",
              color: "white",
              fontSize: "16px",
              marginBottom: "10px",
            }}
          >
            {isMuted ? "🔇 میوت شده" : "🎙️ میکروفون روشن"}
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
import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import * as Tone from "tone";

const App = () => {
  const [username, setUsername] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [voiceOn, setVoiceOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // RTC client
  const [client] = useState(() => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }));
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);

  // RTM client و کانال
  const [rtmClient] = useState(() => AgoraRTM.createInstance("717d9262657d4caab56f3d8a9a7b2089"));
  const [rtmChannel, setRtmChannel] = useState(null);

  // لیست کاربران حاضر: uid → name
  const [usersInCall, setUsersInCall] = useState({});

  const APP_ID = "717d9262657d4caab56f3d8a9a7b2089";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYPh0Zb8ci/bjW4qLhTca7LzJbmyfmpH37PXh6Tf8jVU9Ju9XYDA3NE+xNDIzMjM1TzFJTkxMMjVLM06xSLRMNE8yMrCwZLLck9EQyMggIH2VhZEBAkF8Hoac/LJU3eSMxLy81BwGBgA+vyGD";

  /*--------------------------------------
    بررسی کیفیت اتصال (RTC)
  --------------------------------------*/
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

  /*--------------------------------------
    ایجاد ترک صدا با قابلیت تغییر صدا (Tone.js)
  --------------------------------------*/
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

  /*--------------------------------------
    ورود به تماس و تنظیم RTC + RTM
  --------------------------------------*/
  const joinCall = async () => {
    if (!username.trim()) return alert("لطفاً نام خود را وارد کنید!");

    // RTC join
    await client.join(APP_ID, CHANNEL, TOKEN, null);

    // اضافه کردن نام خود به لیست کاربران حاضر محلی
    const localUID = client.uid;
    setUsersInCall((prev) => ({ ...prev, [localUID]: username }));

    const track = await createVoiceTrack(voiceOn);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    // RTM join
    await rtmClient.login({ uid: username, token: TOKEN });
    const channel = rtmClient.createChannel(CHANNEL);
    await channel.join();
    setRtmChannel(channel);

    // اعلام حضور خود به دیگران
    await channel.sendMessage({ text: JSON.stringify({ type: "join", name: username }) });

    // دریافت پیام‌ها از کانال RTM
    channel.on("ChannelMessage", ({ text, memberId }) => {
      try {
        const msg = JSON.parse(text);
        setUsersInCall((prev) => {
          const copy = { ...prev };
          if (msg.type === "join") copy[memberId] = msg.name;
          if (msg.type === "leave") delete copy[memberId];
          return copy;
        });
      } catch (e) {}
    });

    // RTC: کاربر جدید منتشر کرد
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack.play();
    });

    // RTC: کاربر ترک کرد
    client.on("user-left", (user) => {
      setUsersInCall((prev) => {
        const copy = { ...prev };
        delete copy[user.uid];
        return copy;
      });
    });

    // خروج هنگام بستن صفحه
    window.addEventListener("beforeunload", async () => {
      if (channel) await channel.sendMessage({ text: JSON.stringify({ type: "leave", name: username }) });
      await rtmClient.logout();
    });

    setInCall(true);
  };

  /*--------------------------------------
    تغییر صدا
  --------------------------------------*/
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

  /*--------------------------------------
    میوت و آن‌میوت
  --------------------------------------*/
  const toggleMute = async () => {
    if (!localTrackRef.current) return;
    if (isMuted) await localTrackRef.current.setEnabled(true);
    else await localTrackRef.current.setEnabled(false);
    setIsMuted(!isMuted);
  };

  /*--------------------------------------
    خروج از تماس
  --------------------------------------*/
  const leaveCall = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    await client.leave();
    if (rtmChannel) await rtmChannel.sendMessage({ text: JSON.stringify({ type: "leave", name: username }) });
    await rtmClient.logout();
    setInCall(false);
    setUsersInCall({});
    setConnectionQuality("–");
  };

  /*--------------------------------------
    فرم وارد کردن نام
  --------------------------------------*/
  if (!nameEntered) {
    return (
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", background: "#303c43ff" }}>
        <input
          type="text"
          placeholder="نام خود را وارد کنید"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: "10px", fontSize: "16px", borderRadius: "8px" }}
        />
        <button
          onClick={() => setNameEntered(true)}
          style={{ marginTop: "15px", padding: "10px 20px", borderRadius: "10px", fontSize: "16px", cursor: "pointer", background: "lightgreen", border: "none" }}
        >
          ادامه
        </button>
      </div>
    );
  }

  /*--------------------------------------
    رابط کاربری تماس
  --------------------------------------*/
  return (
    <div style={{ height: "100vh", display: "flex", justifyContent: "flex-start", alignItems: "flex-start", background: "#303c43ff", flexDirection: "column", padding: "20px" }}>
      {inCall ? (
        <>
          <h2 style={{ color: "#fff" }}>📞 در حال تماس با مخاطب</h2>
          <p style={{ color: "lightgreen" }}>🔹 کیفیت اتصال: {connectionQuality}</p>

          {/* لیست کاربران حاضر */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={{ color: "white" }}>👥 کاربران حاضر:</h3>
            <ul>
              {Object.values(usersInCall).map((name, idx) => (
                <li key={idx} style={{ color: "lightgreen" }}>{name}</li>
              ))}
            </ul>
          </div>

          {/* دکمه‌ها */}
          <button onClick={toggleVoice} style={{ padding: "10px 20px", borderRadius: "12px", border: "none", cursor: "pointer", background: voiceOn ? "#f94b4be7" : "lightgreen", color: "white", fontSize: "16px", marginBottom: "10px", marginTop: "15px" }}>
            {voiceOn ? "🔴 تغییر صدا فعال → غیرفعال کن" : "🟢 تغییر صدا غیر فعال → فعال کن"}
          </button>

          <button onClick={toggleMute} style={{ padding: "10px 20px", borderRadius: "12px", border: "none", cursor: "pointer", background: isMuted ? "gray" : "#007bff", color: "white", fontSize: "16px", marginBottom: "10px" }}>
            {isMuted ? "🔇 میوت فعال → آن‌میوت کن" : "🎙️ میکروفون روشن → میوت کن"}
          </button>

          <button onClick={leaveCall} style={{ padding: "15px 30px", borderRadius: "15px", background: "#f94b4be7", color: "white", border: "none", cursor: "pointer", marginTop: "10px", fontSize: "17px" }}>
            قطع تماس
          </button>
        </>
      ) : (
        <button onClick={joinCall} style={{ padding: "15px 30px", borderRadius: "15px", background: "inherit", color: "lightgreen", fontSize: "18px", border: "solid 1px lightgreen", cursor: "pointer", boxShadow: "0px 0px 10px rgba(26, 255, 0, 0.44)" }}>
          شروع تماس با مخاطب
        </button>
      )}
    </div>
  );
};

export default App;

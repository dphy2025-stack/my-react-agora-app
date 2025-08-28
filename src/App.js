import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const App = () => {
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const [localAudioTrack, setLocalAudioTrack] = useState(null);

  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);

  const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7";
  const CHANNEL = "love-channel";
  const TOKEN =
    "007eJxTYBCNvRXt1KfClGhxOFXpoNzLzGX/7MOYAie8fHdktmxyT48Cg7mheYqlkZmRmal5iklyYmKSqVmacYpFomWieZKRgYVl6JP1GQ2BjAzTJf4xMTJAIIjPw5CTX5aqm5yRmJeXmsPAAADzgSHp";

  // بررسی کیفیت اتصال
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

  // گرفتن stream از Virtual Audio Cable
  const createVACAudioTrack = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const vacDevice = devices.find((d) =>
      d.label.includes("CABLE Output")
    );
    if (!vacDevice) {
      alert("Virtual Audio Cable پیدا نشد! مطمئن شو اجرا شده است.");
      return null;
    }

    rawStreamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: vacDevice.deviceId ? { exact: vacDevice.deviceId } : undefined }
    });

    const track = await AgoraRTC.createCustomAudioTrack({
      mediaStreamTrack: rawStreamRef.current.getAudioTracks()[0]
    });
    return track;
  };

  const joinCall = async () => {
    await client.join(APP_ID, CHANNEL, TOKEN, null);
    const track = await createVACAudioTrack();
    if (!track) return;
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack.play();
    });

    setInCall(true);
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
          شروع تماس با صدای زنانه
        </button>
      )}
    </div>
  );
};

export default App;
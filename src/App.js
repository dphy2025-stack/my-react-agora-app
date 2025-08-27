import React, { useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const App = () => {
  const [inCall, setInCall] = useState(false);
  const [client] = useState(() => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }));
  const [localAudioTrack, setLocalAudioTrack] = useState(null);

  const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7"; // همون App ID که دادی
  const CHANNEL = "love-channel";
  const TOKEN = "007eJxTYJBcbb/oZNGrqXFvWMOe3o0LUpu6XrLmcv5LJjufulCRa6UKDOaG5imWRmZGZqbmKSbJiYlJpmZpxikWiZaJ5klGBhaWzYLrMhoCGRncHKMZGKEQxOdhyMkvS9VNzkjMy0vNYWAAACc2ITk="; // تستی می‌تونه null باشه

  const joinCall = async () => {
    await client.join(APP_ID, CHANNEL, TOKEN, null);

    // گرفتن میکروفون
    const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
    setLocalAudioTrack(micTrack);

    // انتشار صدا
    await client.publish([micTrack]);

    // پخش صدای طرف مقابل
    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") {
        const remoteAudioTrack = user.audioTrack;
        remoteAudioTrack.play();
      }
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
          <button
            onClick={leaveCall}
            style={{
              padding: "15px 30px",
              borderRadius: "15px",
              background: "#f94b4be7",
              color: "white",
              border: "none",
              cursor: "pointer",
              marginTop: "20px",
              fontSize: "17px"
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

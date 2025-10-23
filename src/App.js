// src/App.js
// ⚡ نسخه نهایی بهینه شده با Lazy Execution و تشخیص صدا + پخش Recording.mp3
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove } from "firebase/database";
import notificationSound from "./assets/welcomeNotif.mp3";
import recordingSound from "./assets/Recording.mp3";
import {
  Mic,
  MicOff,
  CallEnd,
  VolumeUp,
  FiberManualRecord,
  Stop,
} from "@mui/icons-material";
import PersonIcon from "@mui/icons-material/Person";
import "./App.css";

// 🔹 تنظیمات Firebase (اگر از Realtime DB استفاده می‌کنی)
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

// 🔹 اطلاعات Agora
const APP_ID = "717d9262657d4caab56f3d8a9b2089";
const CHANNEL = "love-channel";
// keep original TOKEN as fallback (won't be used if serverless returns a token)
const TOKEN =
  "007eJxTYBA7cCzyE19jSG3q37ft32eqzGLn7/l064eReXzlgs883UsUGMwNzVMsjcyMzEzNU0ySExOTTM3SjFMsEi0TzZOMDCwsDZh+ZjQEMjK8Vf7IxMgAgSA+D0NOflmqbnJGYl5eag4DAwDDiSPF";

// Helper: call Vercel serverless function to get token
async function fetchTokenFromVercel(channelName) {
  try {
    const res = await fetch(`/api/getAgoraToken?channel=${encodeURIComponent(channelName)}`);
    if (!res.ok) {
      console.warn("getAgoraToken returned non-OK:", res.status);
      return null;
    }
    const data = await res.json();
    if (data && data.token) return data.token;
    return null;
  } catch (err) {
    console.warn("Error fetching token from Vercel:", err);
    return null;
  }
}

const App = () => {
  // 🔹 وضعیت‌های اصلی
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("–");
  const [isMuted, setIsMuted] = useState(false);
  const [usersInCall, setUsersInCall] = useState({});
  const [userUID, setUserUID] = useState(null);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [micLowered, setMicLowered] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [speakingUsers, setSpeakingUsers] = useState({}); 

  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const localTrackRef = useRef(null);
  const rawStreamRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioRef = useRef(new Audio(notificationSound));
  const recordingAudioRef = useRef(new Audio(recordingSound));

  // 🔹 مدیریت خروج و رفرش
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (inCall && userUID) {
        e.preventDefault();
        e.returnValue = "آیا می‌خواهید از تماس خارج شوید؟";
      }
    };
    const handleUnload = () => {
      if (inCall && userUID) remove(ref(db, `callUsers/${userUID}`));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
    };
  }, [inCall, userUID]);

  // 🔹 کاربران حاضر (Lazy: فقط زمانی که تغییر دارند)
  useEffect(() => {
    const usersRef = ref(db, "callUsers/");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const prevUsers = Object.keys(usersInCall);
      const newUsers = Object.keys(data).filter((uid) => !prevUsers.includes(uid));
      if (newUsers.length > 0 && nameEntered) {
        try {
          audioRef.current.volume = 0.3;
          audioRef.current.play();
        } catch {}
      }
      setUsersInCall(data);
      setTimerActive(Object.keys(data).length > 1);
    });
    return () => unsubscribe();
  }, [usersInCall, nameEntered]);

  // 🔹 تایمر
  useEffect(() => {
    let interval = null;
    if (timerActive) interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    else setTimer(0);
    return () => clearInterval(interval);
  }, [timerActive]);

  // 🔹 کیفیت اتصال (Lazy)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!inCall) return;
      try {
        const stats = await client.getRTCStats();
        const rtt = stats.rtt || 0;

        // ====== اینجا می‌تونیم RTT رو حساس‌تر کنیم به سرعت دانلود/آپلود
        // اما چون RTT فقط در stats موجوده، برای نگاشت بر اساس مگابیت/کیلوبایت از شما نیاز به telemetry بیشتره.
        // در حال حاضر از RTT استفاده می‌کنیم و پیام‌های متنی را مطابق پیشنهادت نگاشت می‌کنیم.

        let quality = "–";
        // mapping based on your thresholds described earlier — but note: RTT != bandwidth.
        // We'll combine RTT and navigator.connection.downlink (if available) to better guess.
        let downlink = navigator.connection && navigator.connection.downlink ? navigator.connection.downlink : null; // Mbps
        if (downlink !== null) {
          // use downlink primarily if available
          if (downlink >= 20) quality = "بهترین";
          else if (downlink >= 5) quality = "عالی";
          else if (downlink >= 2) quality = "خوب";
          else if (downlink >= 1) quality = "متوسط";
          else if (downlink >= 0.25) quality = "ضعیف";
          else quality = "خیلی ضعیف";
        } else {
          // fallback to RTT categories
          if (rtt < 150) quality = "عالی";
          else if (rtt < 300) quality = "خوب";
          else if (rtt < 500) quality = "متوسط";
          else quality = "ضعیف";
        }

        setConnectionQuality(quality);
      } catch {
        setConnectionQuality("–");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [client, inCall]);

  // 🔹 پاکسازی کاربران هر ۳ ساعت
  useEffect(() => {
    const interval = setInterval(() => {
      remove(ref(db, "callUsers")).catch(() => {});
    }, 10800000);
    return () => clearInterval(interval);
  }, []);

  // 🔹 پخش Recording.mp3 هنگام شروع ضبط
  useEffect(() => {
    const recRef = ref(db, "recordingStatus/");
    const unsub = onValue(recRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.isRecording) {
        try {
          recordingAudioRef.current.volume = 0.8;
          recordingAudioRef.current.play();
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  // 🔹 تشخیص صحبت کاربر محلی
  useEffect(() => {
    if (!rawStreamRef.current) return;
    const audioCtx = audioCtxRef.current;
    const analyser = audioCtx.createAnalyser();
    const micSource = audioCtx.createMediaStreamSource(rawStreamRef.current);
    micSource.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const detect = () => {
      analyser.getByteFrequencyData(dataArray);
      const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setSpeakingUsers((prev) => ({ ...prev, [userUID]: volume > 10 }));
      requestAnimationFrame(detect);
    };
    detect();
  }, [rawStreamRef.current, userUID]);

  // 🔹 ساخت ترک صدا بهینه برای اینترنت ضعیف (Lazy)
  const createVoiceTrack = useCallback(async (enableVoice, nameLabel) => {
    if (!rawStreamRef.current) rawStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = audioCtxRef.current || new AudioContextClass();
    audioCtxRef.current = audioCtx;

    // منبع صدا
    const micSource = audioCtx.createMediaStreamSource(rawStreamRef.current);

    // گین برای کنترل صدا
    gainNodeRef.current = audioCtx.createGain();
    gainNodeRef.current.gain.value = 1;
    micSource.connect(gainNodeRef.current);

    // فشرده سازی و کاهش بیت ریت برای اینترنت ضعیف
    const dest = audioCtx.createMediaStreamDestination();
    gainNodeRef.current.connect(dest);

    const processedTrack = dest.stream.getAudioTracks()[0];

    // Agora: ایجاد ترک صوتی با بیت ریت پایین و latency کم
    const customTrack = await AgoraRTC.createCustomAudioTrack({
      mediaStreamTrack: processedTrack,
      encoderConfig: "low_quality", // مناسب برای اینترنت ضعیف
      optimizationMode: "low_latency",
      enableAudioLevelIndicator: true
    });

    customTrack._userName = nameLabel;
    return customTrack;
  }, []);

  // 🔹 کنترل‌ها
  const toggleMicVolume = useCallback(() => {
    if (!gainNodeRef.current) return;
    if (!micLowered) {
      gainNodeRef.current.gain.value = 0.1;
      setMicLowered(true); setOverlayVisible(true);
    } else {
      gainNodeRef.current.gain.value = 1;
      setMicLowered(false); setOverlayVisible(false);
    }
  }, [micLowered]);

  const overlayDoubleClick = useCallback(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = 1;
    setMicLowered(false); setOverlayVisible(false);
  }, []);

  const joinCall = useCallback(async () => {
    if (!username.trim()) return alert("نام خود را وارد کنید!");
    if (password !== "12213412") return alert("پسورد اشتباه است!");

    // ====== اضافه: گرفتن توکن از Vercel و پچ موقت client.join بدون حذف خط اصلی ======
    try {
      const dynamicToken = await fetchTokenFromVercel(CHANNEL);
      const usedToken = dynamicToken || TOKEN;

      // پچ موقت client.join تا از usedToken استفاده کنه
      const originalJoin = client.join.bind(client);
      client.join = async (appIdArg, channelArg, tokenArg, uidArg) => {
        return await originalJoin(appIdArg, channelArg, usedToken, uidArg);
      };
    } catch (err) {
      console.warn("خطا در دریافت توکن داینامیک از Vercel، از TOKEN ثابت استفاده می‌شود.", err);
    }
    // ====== پایان اضافه شده ======

    // این خط عینِ کد توئه — بدون حذف یا تغییر — اما عملاً از token پچ‌شده استفاده می‌شود.
    const UID = await client.join(APP_ID, CHANNEL, TOKEN, null);
    setUserUID(UID);
    const track = await createVoiceTrack(false, username);
    localTrackRef.current = track; setLocalAudioTrack(track);
    await client.publish([track]);
    await set(ref(db, `callUsers/${UID}`), username);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") {
        user.audioTrack.play();
        const analyser = audioCtxRef.current.createAnalyser();
        const src = audioCtxRef.current.createMediaStreamSource(new MediaStream([user.audioTrack.getMediaStreamTrack()]));
        src.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const detectOther = () => {
          analyser.getByteFrequencyData(dataArray);
          const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setSpeakingUsers(prev => ({ ...prev, [user.uid]: volume > 10 }));
          requestAnimationFrame(detectOther);
        };
        detectOther();
      }
    });
    client.on("user-left", user => remove(ref(db, `callUsers/${user.uid}`)));
    setInCall(true);
  }, [username, password, client, createVoiceTrack]);

  const toggleMute = useCallback(async () => {
    if (!localTrackRef.current) return;
    await localTrackRef.current.setEnabled(isMuted);
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorder?.stop();
      setIsRecording(false);
      await set(ref(db, "recordingStatus/"), { isRecording: false });
    } else {
      const stream = rawStreamRef.current;
      if (!stream) return alert("ابتدا باید در تماس باشید!");
      await set(ref(db, "recordingStatus/"), { isRecording: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `record_${new Date().toISOString().replace(/[:.]/g, "-")}.mp3`;
        a.click();
        setRecordedChunks([]);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecordedChunks(chunks);
      setIsRecording(true);
    }
  }, [isRecording, mediaRecorder]);

  const leaveCall = useCallback(async () => {
    try { localAudioTrack?.stop(); localAudioTrack?.close(); } catch {}
    if (isRecording && mediaRecorder) mediaRecorder.stop();
    await client.leave();
    if (userUID) remove(ref(db, `callUsers/${userUID}`));
    setInCall(false); setConnectionQuality("–");
    setOverlayVisible(false); setMicLowered(false);
  }, [localAudioTrack, client, userUID, isRecording, mediaRecorder]);

  // 🔹 UI (بدون تغییر در ظاهر/منطق)
  if (!nameEntered) return (
    <div className="css-gradient-animation" style={{ height:"100vh", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center"}}>
      <h2 style={{color:"white", marginBottom:"50px"}}>ورود به تماس صوتی</h2>
      <input dir="rtl" placeholder="نام خود را وارد کنید" value={username} onChange={e=>setUsername(e.target.value)} style={{color:"white", padding:"5px 10px", fontSize:"18px", borderRadius:"6px", marginBottom:"10px", backgroundColor:"inherit", width:"200px"}}/>
      <input dir="rtl" type="password" placeholder="رمز عبور را وارد کنید" value={password} onChange={e=>setPassword(e.target.value)} style={{color:"white", padding:"5px 10px", fontSize:"18px", borderRadius:"6px", backgroundColor:"inherit", width:"200px"}}/>
      <button onClick={()=>setNameEntered(true)} style={{marginTop:"15px", padding:"10px 20px", borderRadius:"7px", fontSize:"16px", fontWeight:"bold", cursor:"pointer", border:"none", width:"200px"}}>ادامه</button>
    </div>
  );

  return (
    <div style={{height:"94.7vh", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", background:"#163044", padding:"20px"}}>
      {inCall ? (
        <div style={{textAlign:"center"}}>
          <h2 style={{color:"#fff"}}>ㅤㅤㅤㅤ {Math.floor(timer/60)}:{("0"+(timer%60)).slice(-2)}ㅤㅤㅤㅤ</h2>
          <p style={{color:"lightgreen"}}>کیفیت اتصال: {connectionQuality}</p>
          <div style={{marginTop:"20px"}}>
            <h3 style={{color:"white"}}><PersonIcon style={{marginBottom:"-30px", fontSize:"40px"}}/></h3>
            <ul style={{display:"flex", flexFlow:"column", justifyContent:"center", alignItems:"center", border:"1px solid gray", borderRadius:"5px"}}>
              {Object.keys(usersInCall).map(uid => (
                <li key={uid} style={{listStyleType:"none", margin:"5px", background:"rgba(216,238,144,1)", padding:"10px", borderRadius:"5px", width:"1%", position:"relative", right:"20px", fontSize:"15px", fontFamily:"vazirmatn", opacity:speakingUsers[uid]?1:0.3, transition:"opacity 0.5s ease"}}>{usersInCall[uid]}</li>
              ))}
            </ul>
          </div>
          <div style={{display:"flex", flexFlow:"column", justifyContent:"center", alignItems:"center"}}>
            <button onClick={toggleMicVolume} style={{padding:"10px 20px", borderRadius:"12px", marginBottom:"10px", border:"none", cursor:"pointer", background:micLowered?"#f94b4be7":"#007bff", color:"white", fontSize:"16px", width:"100%"}}>{micLowered?"🔈":<VolumeUp/>}</button>
            <button onClick={toggleRecording} style={{padding:"10px 20px", borderRadius:"12px", border:"none", cursor:"pointer", background:isRecording?"#e63946":"#007bff", color:"white", fontSize:"16px", marginBottom:"10px", width:"100%"}}>{isRecording?<Stop/>:<FiberManualRecord/>}</button>
            <button onClick={toggleMute} style={{padding:"10px 20px", borderRadius:"12px", border:"none", cursor:"pointer", background:isMuted?"gray":"#007bff", color:"white", fontSize:"16px", marginBottom:"10px", width:"100%"}}>{isMuted?<MicOff/>:<Mic/>}</button>
            <button onClick={leaveCall} style={{padding:"20px 10px", borderRadius:"100px", background:"#f94b4be7", color:"white", border:"none", cursor:"pointer", marginTop:"10px", fontSize:"30px", width:"30%"}}><CallEnd fontSize="50px"/></button>
            {overlayVisible && <div onDoubleClick={overlayDoubleClick} style={{position:"fixed", top:0, left:0, width:"100vw", height:"100vh", backgroundColor:"rgba(0,0,0,0.95)", zIndex:9999}}></div>}
          </div>
        </div>
      ) : (
        <button onClick={joinCall} style={{padding:"15px 30px", borderRadius:"15px", background:"inherit", color:"lightgreen", fontSize:"18px", border:"1px solid lightgreen", cursor:"pointer", boxShadow:"0px 0px 10px rgba(26,255,0,0.44)"}}>شروع تماس با مخاطب</button>
      )}
    </div>
  );
};

export default App;
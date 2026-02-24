// ⚡ نسخه نهایی بهینه شده با Lazy Execution و تشخیص صدا + پخش Recording.mp3 + قابلیت‌های جدید
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
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
  Speed,
  Translate,
  VolumeDown,
  Hearing,
  PhoneForwarded
} from "@mui/icons-material";
import PersonIcon from "@mui/icons-material/Person";
import "./App.css";

// 🔹 تنظیمات Firebase
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

const APP_ID = "717d9262657d4caab56f3d8a9b2089";
const CHANNEL = "voice-call-channel";
const TOKEN =
  "007eJxTYEiy2Wz3vVpK94mh4vS9uh2zjgRVnmY+pfHzQInWh/oDLy0VGMwNzVMsjcyMzEzNU0ySExOTTM3SjFMsEi0TzZMMDCwsJ0TMzWwIZGQINDFjYWSAQBBfiKEsPzM5VTc5MSdHNzkjMS8vNYeBAQAp4iRD";

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
  const [language, setLanguage] = useState('fa'); // 'fa' for Persian, 'en' for English
  const [isEarpieceMode, setIsEarpieceMode] = useState(false);
  const [isOptimizedMode, setIsOptimizedMode] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);

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
  const audioOutputRef = useRef(null);

  // 🔹 ترجمه‌ها
  const translations = {
    fa: {
      enterCall: "ورود به تماس صوتی",
      enterName: "نام خود را وارد کنید",
      enterPassword: "رمز عبور را وارد کنید",
      continue: "ادامه",
      connectionQuality: "کیفیت اتصال",
      perfect: "عالی",
      good: "خوب",
      medium: "متوسط",
      weak: "ضعیف",
      users: "کاربران حاضر",
      mute: "قطع صدا",
      unmute: "وصل صدا",
      record: "ضبط مکالمه",
      stopRecord: "توقف ضبط",
      lowerMic: "کاهش صدا",
      normalMic: "صدای عادی",
      leaveCall: "خروج از تماس",
      startCall: "شروع تماس با مخاطب",
      earpieceMode: "حالت گوشی",
      speakerMode: "حالت بلندگو",
      optimizedMode: "تماس بهینه",
      normalMode: "حالت عادی",
      doubleTapToNormal: "دوبار ضربه بزنید تا به حالت عادی برگردید"
    },
    en: {
      enterCall: "Enter Voice Call",
      enterName: "Enter your name",
      enterPassword: "Enter password",
      continue: "Continue",
      connectionQuality: "Connection Quality",
      perfect: "Perfect",
      good: "Good",
      medium: "Medium",
      weak: "Weak",
      users: "Users in call",
      mute: "Mute",
      unmute: "Unmute",
      record: "Record",
      stopRecord: "Stop Recording",
      lowerMic: "Lower Volume",
      normalMic: "Normal Volume",
      leaveCall: "Leave Call",
      startCall: "Start Call",
      earpieceMode: "Earpiece Mode",
      speakerMode: "Speaker Mode",
      optimizedMode: "Optimized Call",
      normalMode: "Normal Mode",
      doubleTapToNormal: "Double tap to return to normal"
    }
  };

  const t = translations[language];

  // 🔹 تشخیص دستگاه اندروید
  const isAndroid = useMemo(() => {
    return /Android/i.test(navigator.userAgent);
  }, []);

  // 🔹 دریافت دستگاه‌های صوتی
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
        setAudioDevices(audioOutputs);
      } catch (error) {
        console.error("Error getting audio devices:", error);
      }
    };
    getAudioDevices();
  }, []);

  // 🔹 مدیریت خروج و رفرش
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (inCall && userUID) {
        e.preventDefault();
        e.returnValue = language === 'fa' ? "آیا می‌خواهید از تماس خارج شوید؟" : "Do you want to leave the call?";
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
  }, [inCall, userUID, language]);

  // 🔹 کاربران حاضر
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

  // 🔹 کیفیت اتصال
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!inCall) return;
      try {
        const stats = await client.getRTCStats();
        const rtt = stats.RTT || 0;
        if (rtt < 150) setConnectionQuality(t.perfect);
        else if (rtt < 300) setConnectionQuality(t.good);
        else if (rtt < 500) setConnectionQuality(t.medium);
        else setConnectionQuality(t.weak);
      } catch {
        setConnectionQuality("–");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [client, inCall, language, t]);

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

  // 🔹 ساخت ترک صدا با قابلیت بهینه‌سازی
  const createVoiceTrack = useCallback(async (enableVoice, nameLabel, optimized = false) => {
    if (!rawStreamRef.current) {
      rawStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: !optimized,
          noiseSuppression: !optimized,
          autoGainControl: !optimized,
          channelCount: optimized ? 1 : 2,
          sampleRate: optimized ? 16000 : 48000,
          sampleSize: optimized ? 8 : 16
        } 
      });
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = audioCtxRef.current || new AudioContextClass();
    audioCtxRef.current = audioCtx;

    const micSource = audioCtx.createMediaStreamSource(rawStreamRef.current);
    gainNodeRef.current = audioCtx.createGain();
    gainNodeRef.current.gain.value = 1;
    micSource.connect(gainNodeRef.current);

    const dest = audioCtx.createMediaStreamDestination();
    gainNodeRef.current.connect(dest);
    const processedTrack = dest.stream.getAudioTracks()[0];

    const customTrack = await AgoraRTC.createCustomAudioTrack({
      mediaStreamTrack: processedTrack,
      encoderConfig: optimized ? "speech_low_quality" : "music_standard",
      optimizationMode: optimized ? "extremely_low_latency" : "low_latency",
      enableAudioLevelIndicator: true
    });

    customTrack._userName = nameLabel;
    return customTrack;
  }, []);

  // 🔹 تغییر مسیر صدا برای حالت گوشی (Android)
  const setAudioOutput = useCallback(async (earpieceMode) => {
    if (!isAndroid) return;
    
    try {
      if (earpieceMode) {
        // تلاش برای استفاده از خروجی گوشی (earpiece)
        if (audioOutputRef.current) {
          // @ts-ignore - ویژگی اختصاصی برای اندروید
          if (audioOutputRef.current.setSinkId) {
            // پیدا کردن خروجی گوشی (معمولاً با نام "Earpiece" یا "Handset")
            const earpieceDevice = audioDevices.find(d => 
              d.label.toLowerCase().includes('earpiece') || 
              d.label.toLowerCase().includes('handset') ||
              d.label.toLowerCase().includes('receiver')
            );
            if (earpieceDevice) {
              // @ts-ignore
              await audioOutputRef.current.setSinkId(earpieceDevice.deviceId);
            }
          }
        }
        
        // روش جایگزین: تنظیم حالت صوتی
        // @ts-ignore - ویژگی اختصاصی برای اندروید
        if (navigator.audio && navigator.audio.setMode) {
          // @ts-ignore
          await navigator.audio.setMode('earpiece');
        }
      } else {
        // برگشت به حالت بلندگو
        // @ts-ignore
        if (audioOutputRef.current && audioOutputRef.current.setSinkId) {
          // @ts-ignore
          await audioOutputRef.current.setSinkId('default');
        }
        // @ts-ignore
        if (navigator.audio && navigator.audio.setMode) {
          // @ts-ignore
          await navigator.audio.setMode('speaker');
        }
      }
    } catch (error) {
      console.error("Error setting audio output:", error);
    }
  }, [isAndroid, audioDevices]);

  // 🔹 کنترل‌ها
  const toggleMicVolume = useCallback(() => {
    if (!gainNodeRef.current) return;
    if (!micLowered) {
      gainNodeRef.current.gain.value = 0.1;
      setMicLowered(true);
      setOverlayVisible(true);
    } else {
      gainNodeRef.current.gain.value = 1;
      setMicLowered(false);
      setOverlayVisible(false);
    }
  }, [micLowered]);

  const overlayDoubleClick = useCallback(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = 1;
    setMicLowered(false);
    setOverlayVisible(false);
  }, []);

  const toggleEarpieceMode = useCallback(async () => {
    if (!isAndroid) {
      alert(language === 'fa' ? 'این قابلیت فقط در دستگاه‌های اندرویدی قابل استفاده است' : 'This feature is only available on Android devices');
      return;
    }
    
    const newMode = !isEarpieceMode;
    setIsEarpieceMode(newMode);
    await setAudioOutput(newMode);
    
    // تنظیم volume برای بهینه‌سازی حالت گوشی
    if (audioOutputRef.current) {
      audioOutputRef.current.volume = newMode ? 0.7 : 1.0;
    }
  }, [isEarpieceMode, isAndroid, setAudioOutput, language]);

  const toggleOptimizedMode = useCallback(async () => {
    const newMode = !isOptimizedMode;
    setIsOptimizedMode(newMode);
    
    if (inCall && localTrackRef.current) {
      // قطع و اتصال مجدد با تنظیمات جدید
      await client.unpublish([localTrackRef.current]);
      localTrackRef.current.close();
      
      const newTrack = await createVoiceTrack(false, username, newMode);
      localTrackRef.current = newTrack;
      setLocalAudioTrack(newTrack);
      await client.publish([newTrack]);
      
      // تنظیم بیت‌ریت بسیار پایین برای اینترنت ضعیف
      if (newMode) {
        // @ts-ignore - تنظیمات اختصاصی Agora
        client.setStreamParameters({
          audio: {
            bitrate: 8000, // 8kbps بسیار پایین
            channels: 1, // Mono
            sampleRate: 8000 // 8kHz
          }
        });
      }
    }
  }, [isOptimizedMode, inCall, client, createVoiceTrack, username]);

  const joinCall = useCallback(async () => {
    if (!username.trim()) return alert(language === 'fa' ? "نام خود را وارد کنید!" : "Please enter your name!");
    if (password !== "12213412") return alert(language === 'fa' ? "پسورد اشتباه است!" : "Wrong password!");
    
    const UID = await client.join(APP_ID, CHANNEL, TOKEN, null);
    setUserUID(UID);
    
    const track = await createVoiceTrack(false, username, isOptimizedMode);
    localTrackRef.current = track;
    setLocalAudioTrack(track);
    await client.publish([track]);
    await set(ref(db, `callUsers/${UID}`), username);

    client.on("user-published", async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") {
        user.audioTrack.play();
        audioOutputRef.current = user.audioTrack;
        
        if (isEarpieceMode && isAndroid) {
          await setAudioOutput(true);
        }
        
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
  }, [username, password, client, createVoiceTrack, language, isOptimizedMode, isEarpieceMode, isAndroid, setAudioOutput]);

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
      if (!stream) return alert(language === 'fa' ? "ابتدا باید در تماس باشید!" : "You need to be in a call first!");
      
      await set(ref(db, "recordingStatus/"), { isRecording: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: isOptimizedMode ? 8000 : 128000
      });
      
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `record_${new Date().toISOString().replace(/[:.]/g, "-")}.mp3`;
        a.click();
        setRecordedChunks([]);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecordedChunks(chunks);
      setIsRecording(true);
    }
  }, [isRecording, mediaRecorder, language, isOptimizedMode]);

  const leaveCall = useCallback(async () => {
    try { 
      localAudioTrack?.stop(); 
      localAudioTrack?.close(); 
    } catch {}
    
    if (isRecording && mediaRecorder) mediaRecorder.stop();
    await client.leave();
    
    if (userUID) remove(ref(db, `callUsers/${userUID}`));
    setInCall(false);
    setConnectionQuality("–");
    setOverlayVisible(false);
    setMicLowered(false);
    setIsEarpieceMode(false);
    setIsOptimizedMode(false);
  }, [localAudioTrack, client, userUID, isRecording, mediaRecorder]);

  // 🔹 UI با طراحی جدید و دو زبانه
  if (!nameEntered) {
    return (
      <div className="css-gradient-animation" style={{ 
        height: "100vh", 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "center", 
        alignItems: "center",
        position: "relative"
      }}>
        {/* دکمه تغییر زبان */}
        <button
          onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "transparent",
            border: "1px solid white",
            color: "white",
            padding: "10px 15px",
            borderRadius: "25px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "14px"
          }}
        >
          <Translate />
          {language === 'fa' ? 'English' : 'فارسی'}
        </button>

        <h2 style={{ color: "white", marginBottom: "50px", fontSize: "28px" }}>
          {t.enterCall}
        </h2>
        
        <input
          dir={language === 'fa' ? "rtl" : "ltr"}
          className="nameInput"
          placeholder={t.enterName}
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{
            color: "white",
            padding: "12px 20px",
            fontSize: "16px",
            borderRadius: "12px",
            marginBottom: "15px",
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.3)",
            width: "280px",
            outline: "none",
            transition: "all 0.3s ease"
          }}
        />
        
        <input
          dir={language === 'fa' ? "rtl" : "ltr"}
          className="passwordInput"
          type="password"
          placeholder={t.enterPassword}
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{
            color: "white",
            padding: "12px 20px",
            fontSize: "16px",
            borderRadius: "12px",
            marginBottom: "20px",
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.3)",
            width: "280px",
            outline: "none",
            transition: "all 0.3s ease"
          }}
        />
        
        <button
          className="btn-gradient"
          onClick={() => setNameEntered(true)}
          style={{
            marginTop: "10px",
            padding: "14px 30px",
            borderRadius: "12px",
            fontSize: "18px",
            fontWeight: "bold",
            cursor: "pointer",
            border: "none",
            width: "280px",
            background: "linear-gradient(45deg, #2196F3, #00BCD4)",
            color: "white",
            transition: "transform 0.2s ease",
            boxShadow: "0 4px 15px rgba(33,150,243,0.3)"
          }}
        >
          {t.continue}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(135deg, #163044 0%, #1a3a52 100%)",
      padding: "20px",
      position: "relative"
    }}>
      {/* دکمه تغییر زبان */}
      <button
        onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "white",
          padding: "8px 15px",
          borderRadius: "25px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          fontSize: "14px",
          backdropFilter: "blur(10px)",
          zIndex: 1000
        }}
      >
        <Translate fontSize="small" />
        {language === 'fa' ? 'English' : 'فارسی'}
      </button>

      {inCall ? (
        <div style={{
          textAlign: "center",
          width: "100%",
          maxWidth: "400px",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(10px)",
          borderRadius: "30px",
          padding: "30px 20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.1)"
        }}>
          {/* تایمر */}
          <div style={{
            background: "rgba(0,0,0,0.3)",
            padding: "15px",
            borderRadius: "20px",
            marginBottom: "20px"
          }}>
            <h2 style={{ color: "#fff", fontSize: "48px", margin: "0", fontFamily: "monospace" }}>
              {Math.floor(timer / 60)}:{("0" + (timer % 60)).slice(-2)}
            </h2>
            <p style={{ color: connectionQuality === t.perfect ? "#4caf50" : 
                               connectionQuality === t.good ? "#8bc34a" :
                               connectionQuality === t.medium ? "#ff9800" : "#f44336",
                       fontSize: "14px",
                       marginTop: "5px"
            }}>
              {t.connectionQuality}: {connectionQuality}
            </p>
          </div>

          {/* لیست کاربران */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: "20px",
            padding: "20px",
            marginBottom: "20px"
          }}>
            <h3 style={{ color: "white", fontSize: "18px", marginBottom: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <PersonIcon />
              {t.users} ({Object.keys(usersInCall).length})
            </h3>
            
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "200px",
              overflowY: "auto",
              padding: "5px"
            }}>
              {Object.keys(usersInCall).map(uid => (
                <div
                  key={uid}
                  style={{
                    background: speakingUsers[uid] ? "rgba(76,175,80,0.3)" : "rgba(255,255,255,0.05)",
                    padding: "12px 15px",
                    borderRadius: "12px",
                    color: "white",
                    fontSize: "16px",
                    border: speakingUsers[uid] ? "1px solid #4caf50" : "1px solid rgba(255,255,255,0.1)",
                    transition: "all 0.3s ease",
                    opacity: speakingUsers[uid] ? 1 : 0.7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative"
                  }}
                >
                  {usersInCall[uid]}
                  {speakingUsers[uid] && (
                    <Hearing style={{
                      position: "absolute",
                      right: "10px",
                      fontSize: "18px",
                      color: "#4caf50"
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* دکمه‌های کنترل */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}>
            {/* ردیف اول دکمه‌ها */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px"
            }}>
              <button
                onClick={toggleMicVolume}
                style={{
                  padding: "15px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  background: micLowered ? "linear-gradient(45deg, #f94b4b, #e63946)" : "linear-gradient(45deg, #2196F3, #00BCD4)",
                  color: "white",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.3s ease",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                }}
                title={micLowered ? t.normalMic : t.lowerMic}
              >
                {micLowered ? <VolumeDown /> : <VolumeUp />}
                {micLowered ? t.normalMic : t.lowerMic}
              </button>

              <button
                onClick={toggleRecording}
                style={{
                  padding: "15px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  background: isRecording ? "linear-gradient(45deg, #e63946, #d32f2f)" : "linear-gradient(45deg, #4caf50, #45a049)",
                  color: "white",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.3s ease",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                }}
              >
                {isRecording ? <Stop /> : <FiberManualRecord />}
                {isRecording ? t.stopRecord : t.record}
              </button>
            </div>

            {/* ردیف دوم دکمه‌ها */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px"
            }}>
              <button
                onClick={toggleEarpieceMode}
                style={{
                  padding: "15px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  background: isEarpieceMode ? "linear-gradient(45deg, #ff9800, #f57c00)" : "linear-gradient(45deg, #9c27b0, #7b1fa2)",
                  color: "white",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.3s ease",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                  opacity: isAndroid ? 1 : 0.5
                }}
                disabled={!isAndroid}
                title={!isAndroid ? (language === 'fa' ? 'فقط مخصوص اندروید' : 'Android only') : ''}
              >
                <PhoneForwarded />
                {isEarpieceMode ? t.speakerMode : t.earpieceMode}
              </button>

              <button
                onClick={toggleOptimizedMode}
                style={{
                  padding: "15px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  background: isOptimizedMode ? "linear-gradient(45deg, #ff9800, #f57c00)" : "linear-gradient(45deg, #607d8b, #455a64)",
                  color: "white",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.3s ease",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                }}
              >
                <Speed />
                {isOptimizedMode ? t.normalMode : t.optimizedMode}
              </button>
            </div>

            {/* دکمه Mute */}
            <button
              onClick={toggleMute}
              style={{
                padding: "15px",
                borderRadius: "16px",
                border: "none",
                cursor: "pointer",
                background: isMuted ? "linear-gradient(45deg, #9e9e9e, #757575)" : "linear-gradient(45deg, #2196F3, #00BCD4)",
                color: "white",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
              }}
            >
              {isMuted ? <MicOff /> : <Mic />}
              {isMuted ? t.unmute : t.mute}
            </button>

            {/* دکمه خروج */}
            <button
              onClick={leaveCall}
              style={{
                padding: "20px",
                borderRadius: "50px",
                background: "linear-gradient(45deg, #f44336, #d32f2f)",
                color: "white",
                border: "none",
                cursor: "pointer",
                marginTop: "10px",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                transition: "all 0.3s ease",
                boxShadow: "0 8px 25px rgba(244,67,54,0.4)"
              }}
            >
              <CallEnd />
              {t.leaveCall}
            </button>
          </div>

          {/* اوورلی برای حالت کاهش صدا */}
          {overlayVisible && (
            <div
              onDoubleClick={overlayDoubleClick}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0,0,0,0.95)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "18px",
                cursor: "pointer"
              }}
            >
              <div style={{
                background: "rgba(255,255,255,0.1)",
                padding: "30px",
                borderRadius: "20px",
                backdropFilter: "blur(10px)",
                textAlign: "center"
              }}>
                <VolumeDown style={{ fontSize: "60px", color: "#f94b4b" }} />
                <p style={{ marginTop: "15px" }}>{t.doubleTapToNormal}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={joinCall}
          style={{
            padding: "20px 40px",
            borderRadius: "50px",
            background: "linear-gradient(45deg, #4caf50, #45a049)",
            color: "white",
            fontSize: "20px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 25px rgba(76,175,80,0.4)",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          <CallEnd style={{ transform: "rotate(135deg)" }} />
          {t.startCall}
        </button>
      )}
    </div>
  );
};

export default App;

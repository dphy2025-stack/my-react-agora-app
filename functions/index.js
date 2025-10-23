// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {RtcTokenBuilder, RtcRole} = require("agora-access-token");

admin.initializeApp();

// تنظیمات امن: مقدارها را از functions.config() بگیر (یا از env)
const APP_ID = functions.config("717d9262657d4caab56f3d8a9a7b2089").agora?.appid || process.env.AGORA_APP_ID;
const APP_CERT = functions.config("abb877a32746494d99cdb9fa5578e81d").agora?.appcert || process.env.AGORA_APP_CERT;

if (!APP_ID || !APP_CERT) {
  console.warn("Warning: APP_ID or APP_CERT not set in functions config. Set them before deploy.");
}

// 10 years in seconds
const TEN_YEARS_SECONDS = 10 * 365 * 24 * 60 * 60; // 315360000

exports.getAgoraToken = functions.https.onCall(async (data, context) => {
  // (اختیاری) احراز هویت: توصیه می‌شود کاربران قبل از درخواست login شده باشند
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const channel = data?.channel || "love-channel";

  // تعیین uid اختصاصی براساس uid فایربیس (برای امنیت بیشتر)
  const authUid = context.auth.uid || "";
  let uidNum = 0;
  try {
    uidNum = Math.abs(authUid.split("").reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7)) % 1000000000;
  } catch (e) {
    uidNum = Math.floor(Math.random() * 1000000000);
  }

  const currentTs = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = currentTs + TEN_YEARS_SECONDS;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERT,
        channel,
        uidNum,
        RtcRole.PUBLISHER,
        privilegeExpireTs,
    );

    return {
      token,
      expiresAt: privilegeExpireTs,
      channel,
      uid: uidNum,
    };
  } catch (err) {
    console.error("Error generating Agora token:", err);
    throw new functions.https.HttpsError("internal", "Could not generate token.");
  }
});

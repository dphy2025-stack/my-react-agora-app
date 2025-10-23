// api/getAgoraToken.js
// Vercel Serverless Function for generating Agora RTC token (10 years).
// IMPORTANT: set AGORA_APP_ID and AGORA_APP_CERT as Vercel Environment Variables.

const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

module.exports = async (req, res) => {
  try {
    // allow GET or POST
    const channel = (req.query.channel || req.body && req.body.channel) || "love-channel";
    // optional uid param
    const uid = req.query.uid || (req.body && req.body.uid) || 0;

    const APP_ID = "717d9262657d4caab56f3d8a9b2089";
    const APP_CERT = "abb877a32746494d99cdb9fa5578e81d";

    if (!APP_ID || !APP_CERT) {
      return res.status(500).json({ error: "Agora APP_ID / APP_CERT not configured on server." });
    }

    // 10 years in seconds (approx)
    const TEN_YEARS = 10 * 365 * 24 * 60 * 60; // 315360000
    const currentTs = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = currentTs + TEN_YEARS;

    // build token with uid (number)
    const uidNum = isNaN(Number(uid)) ? 0 : Number(uid);

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERT,
      channel,
      uidNum,
      RtcRole.PUBLISHER,
      privilegeExpireTs
    );

    return res.status(200).json({ token, expiresAt: privilegeExpireTs });
  } catch (err) {
    console.error("Error generating Agora token:", err);
    return res.status(500).json({ error: "internal_error", details: String(err) });
  }
};
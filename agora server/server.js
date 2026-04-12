require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

const app = express();
app.use(cors());
app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_CERT = process.env.APP_CERTIFICATE;

app.post("/api/token", (req, res) => {
  const { channelName, uid } = req.body;

  if (!channelName || uid === undefined) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  const expirationTimeInSeconds = 3600; // توکن 1 ساعت اعتبار دارد
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERT,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs
  );

  return res.json({ token });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
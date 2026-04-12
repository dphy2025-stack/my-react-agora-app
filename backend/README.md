# Voice Call Backend (Agora Token)

This backend creates 3-hour Agora tokens per private room.

## 1) Install

```bash
cd backend
npm install
```

## 2) Configure env

```bash
copy .env.example .env
```

Fill these values in `.env`:

- `APP_ID` => Agora App ID
- `APP_CERTIFICATE` => Agora App Certificate
- `PORT` => default `5000`
- `ALLOWED_ORIGINS` => comma-separated frontend domains (or `*` for testing)
- `ROOM_TTL_SECONDS` => default `10800` (3 hours)

## 3) Run backend

```bash
npm start
```

Server endpoints:

- `GET /health`
- `POST /api/rooms/token`

Request body:

```json
{
  "mode": "create" | "join",
  "roomName": "my-private-room",
  "roomPassword": "123456"
}
```

## 4) ngrok

Run ngrok against your backend port:

```bash
ngrok http 5000
```

Use the HTTPS URL from ngrok in frontend field:

- `Backend URL (ngrok or localhost)`

Example:

`https://abcd-1234.ngrok-free.app`

## 5) Vercel frontend

If frontend is on Vercel, add that domain to `ALLOWED_ORIGINS` in backend `.env`:

```env
ALLOWED_ORIGINS=https://your-app.vercel.app,https://abcd-1234.ngrok-free.app
```

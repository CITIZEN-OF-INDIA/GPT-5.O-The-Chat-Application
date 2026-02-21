# GPT 5.O Chat Application

A full-stack real-time chat application with web and desktop targets.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Zustand, React Router, Socket.IO client
- Offline/local data: IndexedDB via `idb`
- Backend: Node.js, Express, TypeScript, Socket.IO, JWT auth
- Database: MongoDB with Mongoose
- Desktop: Electron + electron-builder
- Monorepo/workspaces: npm workspaces

## Features

- Username/password signup and login with JWT access/refresh token flow
- Real-time messaging with Socket.IO
- Presence and last-seen updates
- Typing indicators
- Message reply, edit, pin/unpin
- Delete message for me / delete for everyone
- Message delivery/read status updates
- Offline-first behavior:
  - Messages are stored locally in IndexedDB
  - Unsent messages are queued when offline
  - Queue flush + incremental sync runs when reconnecting/focus/online
  - Chat/message local cache for fast reloads
- Desktop runtime support via Electron (bundled UI fallback)

## Project Structure

- `apps/server`: Express + Socket.IO API server
- `apps/web`: React web client (also used by Electron build)
- `electron`: Electron desktop shell + Windows packaging config
- `packages/shared-types`: Shared TS types used by server and client

## Environment Files

### 1) Root env (`.env`)
Create `.env` in project root (copy from `.env.example`) and set:

- `NODE_ENV=development`
- `PORT=4000`
- `CLIENT_URL=http://localhost:5173` (for local web dev CORS)
- `MONGO_URI=mongodb://localhost:27017/chatapp` (or your Mongo URL)
- `JWT_ACCESS_SECRET=your_access_secret`
- `JWT_REFRESH_SECRET=your_refresh_secret`

Notes:
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are required by auth code.
- `MONGO_URI` is optional in code but strongly recommended to set explicitly.

### 2) Web env (`apps/web/.env`)
Create `apps/web/.env` (copy from `apps/web/.env.example`) and set:

- `VITE_API_BASE_URL=http://localhost:4000`
- `VITE_WS_URL=http://localhost:4000`
- `VITE_UI_VERSION=1.0.0`

## Run Locally (Web + API)

1. Install dependencies (from repo root):

```bash
npm install
```

2. Start backend:

```bash
npm run dev --prefix apps/server
```

3. In another terminal, start frontend:

```bash
npm run dev --prefix apps/web
```

4. Open the app in browser:

- `http://localhost:5173`

5. Create users from the Signup screen and start chatting.

## Run Locally (Desktop)

### Dev desktop shell

1. Build web UI first:

```bash
npm run build --prefix apps/web
```

2. Start Electron:

```bash
npm run dev --prefix electron
```

### Windows installer build

From repo root:

```bash
npm run build:desktop
```

Installer output will be under `electron/release`.

## Useful Scripts

- Root lint: `npm run lint`
- Format: `npm run format`
- Web build: `npm run build --prefix apps/web`
- Server build: `npm run build --prefix apps/server`
- Desktop pack (Windows): `npm run pack:win --prefix electron`

## Notes

- There is no dedicated automated test suite configured yet.
- For local desktop usage with local backend, ensure the built web app uses local `VITE_API_BASE_URL`/`VITE_WS_URL` values before packaging.

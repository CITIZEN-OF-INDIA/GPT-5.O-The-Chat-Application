<div align="center">



<img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=20&pause=1000&color=0EA5E9&center=true&vCenter=true&width=750&lines=Real-time+chat+experience;Offline+queue+%2B+auto-sync+engine;Web+%7C+Desktop+%7C+Android+ready" alt="typing animation" />

<br/>

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-RealTime-010101?logo=socket.io&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white)
![Android](https://img.shields.io/badge/Android-Available-3DDC84?logo=android&logoColor=white)

</div>

## Overview

`GPT 5.O` is a full-stack real-time chat application with an offline-first messaging flow.

Supported platforms:

- Web
- Desktop (Electron)
- Android (Capacitor)

## App Screenshot

![GPT 5.O App Screenshot](./docs/app-screenshot.png)

Place your screenshot file at `docs/app-screenshot.png`.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Zustand, React Router
- Real-time: Socket.IO client/server
- Offline data: IndexedDB via `idb`
- Backend: Node.js, Express, JWT auth
- Database: MongoDB + Mongoose
- Desktop shell: Electron + electron-builder
- Mobile shell: Capacitor (Android)
- Monorepo: npm workspaces

## Core Features

- Secure signup/login with access and refresh token flow
- Real-time chat delivery via WebSocket events
- Presence updates with online/offline and last seen
- Typing indicators
- Reply, edit, pin/unpin, and delete message actions
- Delete for me and delete for everyone flows
- Delivery and read status updates
- Offline-first sync system
- Messages stored locally in IndexedDB
- Outgoing queue when offline
- Queue auto-flush after reconnect
- Incremental sync on reconnect, focus, and online events

## Project Structure

- `apps/server` - Express + Socket.IO backend
- `apps/web` - React client
- `electron` - Desktop runtime and Windows packaging
- `packages/shared-types` - Shared TypeScript models/types

## Environment Setup

### Root `.env`

Create `.env` in repo root (based on `.env.example`):

```env
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/chatapp
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

### Web `.env`

Create `apps/web/.env` (based on `apps/web/.env.example`):

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_WS_URL=http://localhost:4000
VITE_UI_VERSION=1.0.0
```

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start backend:

```bash
npm run dev --prefix apps/server
```

3. Start frontend in a new terminal:

```bash
npm run dev --prefix apps/web
```

4. Open in browser: `http://localhost:5173`

## Desktop Local Run

1. Build web UI:

```bash
npm run build --prefix apps/web
```

2. Start Electron shell:

```bash
npm run dev --prefix electron
```

3. Build Windows installer:

```bash
npm run build:desktop
```

Installer output: `electron/release`

## Useful Commands

- `npm run lint`
- `npm run format`
- `npm run build --prefix apps/server`
- `npm run build --prefix apps/web`
- `npm run pack:win --prefix electron`

## Note

No dedicated automated test suite is configured yet.

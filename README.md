# Zoom Clone

A real-time, peer-to-peer video conferencing application built with a modern Next.js frontend, a Django + Django Channels backend, and WebRTC for direct media connections.

This repository demonstrates real-time signaling, peer-to-peer WebRTC connections, transient host elections, session-local chat messaging, and browser-side meeting recording without external media server wrappers.

---

## 1. Technology Stack

### Frontend
- **Framework**: Next.js (App Router, React 19)
- **Language**: TypeScript (Strict typing, no `any`)
- **Styling**: Tailwind CSS & custom glassmorphism overlays
- **Media**: Native Browser APIs (WebRTC `RTCPeerConnection`, `MediaRecorder`, `getDisplayMedia`)

### Backend
- **Framework**: Django 5.2 (REST framework for APIs)
- **Real-Time**: Django Channels 4.3 (ASGI WebSocket connections)
- **Server**: Daphne 4.2 (ASGI server serving HTTP and WebSockets)
- **Database**: SQLite (Local development database for meeting lifecycle)

---

## 2. Architecture

```text
                     +---------------------------------------+
                     |                Browser                |
                     +---+-------------------------------+---+
                         |                               |
                   HTTP  | REST API            WebSocket | Signaling, Presence, Chat
                         v                               v
             +-----------+-----------+       +-----------+-----------+
             | Django REST Framework |       |  Django Channels WS   |
             +-----------+-----------+       +-----------+-----------+
                         |                               |
                         +---------------+---------------+
                                         |
                                         v
                               +---------+---------+
                               |    Daphne ASGI    |
                               +-------------------+

                                      WebRTC
                  Browser A <=========================> Browser B
                                Peer-to-peer media
```

### Components
- **Django REST Framework**: Handles persistence operations like creating, scheduling, and validating meetings.
- **Django Channels / Daphne**: Acts as the real-time coordinator. Manages WebSocket sessions, tracks participant presence, broadcasts media state changes, routes ICE candidates/SDP offers/answers, handles host handoffs, and relays in-meeting chat.
- **WebRTC**: Establishes a direct peer-to-peer connection for low-latency audio/video streams once the WebSocket signaling handshake is completed.

---

## 3. Project Structure

```text
zoom-clone/
├── backend/                  # Django REST & Daphne Signaling Application
│   ├── config/               # Settings, ASGI routing, and urls
│   ├── meetings/             # REST views, models, consumers, and unit tests
│   ├── manage.py
│   └── requirements.txt      # Python dependencies
│
├── frontend/                 # Next.js React client
│   ├── app/                  # Application pages and routing logic
│   ├── components/           # UI elements (Controls, Header, Video grid)
│   ├── lib/                  # REST endpoints client and TypeScript typings
│   ├── package.json          # Node dependencies
│   └── package-lock.json
│
├── .env.example              # Environment variables template
├── .gitignore                # Global git ignore configuration
└── README.md                 # Project documentation
```

---

## 4. Feature Matrix

| Feature | Status | Description |
| :--- | :--- | :--- |
| **Instant Meetings** | ✅ Implemented | Instantly create a meeting room and acquire a shareable link. |
| **Scheduled Meetings** | ✅ Implemented | Schedule meetings for future dates/times with validation locks. |
| **Pre-Join Screen** | ✅ Implemented | Local camera preview, display-name validation, and toggle buttons. |
| **WebRTC Media** | ✅ Implemented | Direct browser-to-browser audio and video streaming. |
| **Screen Sharing** | ✅ Implemented | Cast your display and toggle back to camera streams dynamically. |
| **In-Meeting Chat** | ✅ Implemented | Send instant messages with a 1000-character validation limit. |
| **Local Recording** | ✅ Implemented | Record meetings locally in browser RAM and download as `.webm`. |
| **Host Controls** | ✅ Implemented | Host-only capabilities to end meetings or transfer host status. |
| **Reconnection UX** | ✅ Implemented | Bounded exponential backoff retries with warning overlays. |
| **Authentication** | ❌ Not Implemented | Transient identity flow based on meeting IDs and name validations. |
| **Cloud Recording** | ❌ Not Implemented | Recordings remain client-side; no server storage is used. |
| **Persistent Chat** | ❌ Not Implemented | Chat is session-based; history is cleared upon leaving the meeting. |

---

## 5. Local Development Setup

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run database migrations:
   ```bash
   python manage.py migrate
   ```
5. Start the Daphne ASGI server:
   ```bash
   python -m daphne -b 127.0.0.1 -p 8000 config.asgi:application
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 6. Environment Variables

Create a `.env.local` file inside the `frontend/` directory and configure it as shown below. Refer to `.env.example` in the root folder for backend deployment templates.

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

---

## 7. Testing & Verification

Run the full verification suite to ensure code health.

### Run Frontend Linter & Compiler
```bash
cd frontend
npm run lint
npm run build
```

### Run Backend Unit Tests
```bash
cd backend
source venv/bin/activate
python manage.py test
```

---

## 8. Known Limitations

- **Transient Identity**: There is no database-backed account registration or JWT authentication. Participant identities are transient and session-based.
- **Local Recording Only**: Meeting recording captures media streams directly in the browser's memory. Reloading or closing the tab before downloading the recording will discard the file.
- **Session-Local Chat**: Messages are routed via memory channels and are not stored in the database. When a participant leaves, their message logs are lost.
- **In-Memory Channel Layer**: The Channels layer uses an in-memory configuration suitable for development but not scaled for multi-node clusters.

---

## 9. Future Roadmap

- **User Accounts**: Introduce authentication (JWT or session cookies) with persistent user models.
- **Persistent Chat History**: Store chat messages in the database and support cross-session history retrieve.
- **Production TURN Servers**: Configure TURN servers (e.g. coturn) to bypass restrictive NAT configurations in production.
- **Redis Channel Layer**: Connect Redis to Django Channels to support cluster-based scale.
- **Cloud Recording**: Move video processing to the backend or cloud storage buckets (e.g., AWS S3).

---

## 10. Evaluation & Interview Value

This project showcases engineering proficiency in:
- **Asynchronous Architectures**: Implementing Django Channels consumers alongside Daphne to orchestrate real-time signaling.
- **Low-Latency Networks**: Setting up raw WebRTC negotiation (offer, answer, ICE exchange) without heavy third-party SDK dependencies.
- **Connection Resilience**: Coding reconnect handlers with progressive backoff delays and managing browser memory leaks by cleaning up media tracks on unmount.
- **Typing Integrity**: Maintaining a clean TypeScript codebase with precise payload interfaces, zero `any` variables, and DRF validation checks.

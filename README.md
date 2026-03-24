# Somvo

> The agent does the craft. You keep the intent.

Somvo is an AI-assisted video editor built for mid-tier content creators — people who film consistently but edit inconsistently. You describe what you want. The agent proposes every edit as a discrete, visible step. You approve or reject each one before anything is committed. No black boxes. No loss of control.

---

## What it does

Most creators spend 30–90 minutes on a first cut that's 80% mechanical — removing silence, cutting filler words, burning in captions. Somvo does that first 80% in minutes, then gets out of the way.

The core interaction never changes regardless of version:

```
1. Upload your video
2. Describe your intent in plain language
3. The agent thinks visibly — a list of proposed discrete steps
4. You approve or reject each step individually
5. The agent executes only what you approved
6. Export
```

---

## Who it's for

**Primary** — Mid-tier content creators publishing on Instagram Reels, TikTok, or YouTube Shorts. They understand content but don't use Premiere Pro. They want the first cut done fast.

**Secondary** — Small businesses, coaches, and educators producing talking-head content who care about captions, clarity, and export speed above all else.

---

## Tech stack

| Layer             | Technology                                     |
| ----------------- | ---------------------------------------------- |
| Frontend          | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend           | FastAPI (Python)                               |
| GPU / Processing  | Modal.com                                      |
| Video Processing  | FFmpeg                                         |
| Transcription     | WhisperX (word-level timestamps)               |
| Silence Detection | Silero VAD                                     |
| Timeline UI       | Peaks.js + React Player                        |
| Database + Auth   | Supabase (Postgres, Storage, Auth)             |
| Billing           | Stripe                                         |
| Frontend Deploy   | Vercel                                         |
| Backend Deploy    | Modal                                          |

---

## How a video gets processed

```
User uploads video
       │
       ▼
Supabase Storage  ←  file stored at raw/{user_id}/{project_id}/original.mp4
       │
       ▼
projects table row created  →  status: 'processing'
       │
       ▼
FastAPI triggers Modal job
       ├── Silero VAD        →  silence segments + timestamps
       ├── WhisperX          →  word-level transcript
       └── FFmpeg            →  proposed cut list generated
       │
       ▼
Agent builds step list (structured JSON)
stored in edit_steps table
       │
       ▼
Frontend receives steps via Supabase Realtime
shows reasoning panel  →  user approves / rejects each step
       │
       ▼
FastAPI  →  Modal  →  FFmpeg executes approved steps
       │
       ▼
Processed video stored at processed/{user_id}/{project_id}/output.mp4
projects table updated  →  status: 'done'
       │
       ▼
User downloads export
```

---

## Project structure

```
somvo/
├── docs/
│   ├── SOMVO_MVP.md          # Full MVP scope, feature checklist, data models
│   └── SOMVO_DESIGN.md       # Design system, tokens, component specs
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql
└── apps/
    ├── web/                  # Next.js frontend
    │   ├── app/
    │   │   ├── globals.css
    │   │   ├── layout.tsx
    │   │   ├── (auth)/
    │   │   │   ├── login/
    │   │   │   └── signup/
    │   │   └── (dashboard)/
    │   │       ├── projects/
    │   │       ├── usage/
    │   │       └── settings/
    │   ├── components/
    │   │   ├── sidebar.tsx
    │   │   ├── topbar.tsx
    │   │   └── upload-zone.tsx
    │   └── lib/
    │       └── supabase/
    │           ├── client.ts
    │           ├── server.ts
    │           └── middleware.ts
    └── server/               # FastAPI backend (in progress)
```

---

## Database schema

| Table         | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `users`       | Mirrors `auth.users`, stores plan (`free` / `creator` / `pro`) |
| `projects`    | One row per uploaded video — status, file paths, duration      |
| `transcripts` | WhisperX word-level output + SRT captions per project          |
| `edit_steps`  | Proposed step list and approved steps per project              |
| `usage`       | Export minutes consumed per user per project                   |

All tables have Row Level Security enabled. Users can only access their own data.

Storage buckets: `raw` (original uploads, private) and `processed` (exported videos, private).

---

## Pricing

| Tier    | Price      | Limits                                               |
| ------- | ---------- | ---------------------------------------------------- |
| Free    | $0         | Limited exports/month, watermark on export, 720p max |
| Creator | ~$15–20/mo | Higher export minutes, no watermark, up to 1080p     |
| Pro     | ~$40–50/mo | Agency volume, all features                          |

Billing via Stripe. Usage tracked per export in the `usage` table.

---

## Roadmap

| Version      | Focus                                                        |
| ------------ | ------------------------------------------------------------ |
| **v1 — now** | Upload, silence cut, captions, approve/reject loop, export   |
| **v2**       | B-roll suggestions, music ducking, colour presets, re-prompt |
| **v3**       | Brand kits, templates, intro/outro builder                   |
| **v4**       | Multi-clip projects, team workspaces, client handoff         |

---

## Local development

```bash
# Install dependencies
cd apps/web
npm install

# Set up environment variables
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run the dev server
npm run dev
```

App runs at `http://localhost:3000`.

For the backend, see `apps/server/README.md` (in progress — Modal + FastAPI setup documented there when built).

---

## Environment variables

```env
# apps/web/.env.local

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Design system

All visual decisions are documented in `docs/SOMVO_DESIGN.md`. The short version:

- **Dark editorial** aesthetic — near-black backgrounds, amber accent (`#f5a623`), no box shadows
- **Fonts** — Syne (headings), Inter (body), IBM Plex Mono (timestamps, metadata, agent output)
- **Tokens** — all defined as CSS variables in `apps/web/app/globals.css`
- **Icons** — Lucide React only, `stroke-width: 1.5`

---

<sub>Built by Oliver Söderlund Granzer</sub>

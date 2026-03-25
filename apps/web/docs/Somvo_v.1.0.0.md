# Somvo – MVP Build Guide & Todo List

> **v1 scope:** Prompt-driven edit loop with visible agent reasoning, per-edit approval, silence cutting, auto-captions, dual timeline, and export. This document is the source of truth for Copilot. Check off tasks as they are completed.

---

## Stack

| Layer             | Technology                                     |
| ----------------- | ---------------------------------------------- |
| Frontend          | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend / API     | FastAPI (Python)                               |
| GPU / Processing  | Modal.com                                      |
| Video Processing  | FFmpeg                                         |
| Transcription     | WhisperX (word-level timestamps)               |
| Silence Detection | Silero VAD                                     |
| Timeline UI       | Peaks.js + React Player                        |
| Database          | Supabase (Postgres + Storage)                  |
| Auth              | Supabase Auth                                  |
| Billing           | Stripe                                         |
| Deployment        | Vercel (frontend), Modal (backend jobs)        |

---

## Architecture Overview

```
User uploads video
       │
       ▼
Supabase Storage (raw video)
       │
       ▼
FastAPI → Modal job triggered
       │
       ├── Silero VAD        → silence segments
       ├── WhisperX          → word-level transcript + timestamps
       └── FFmpeg            → initial cut list generated
       │
       ▼
Agent builds step list (structured JSON)
       │
       ▼
Frontend receives step list → shows reasoning UI
       │
User approves / rejects each step
       │
       ▼
FastAPI → Modal → FFmpeg executes approved steps
       │
       ▼
Supabase Storage (processed video)
       │
       ▼
Export (watermarked on free tier, clean on paid)
```

---

## Core Interaction Model

Every edit follows this loop — this never changes across versions:

1. **User prompts** — describes intent in plain language
2. **Agent thinks visibly** — shows a list of proposed discrete steps
3. **User approves or rejects** each step individually
4. **Agent executes** only approved steps via FFmpeg
5. **Preview updates** — user sees result before final export

---

## Feature Checklist

### 1. Project & Auth Setup

- [x] Initialise Next.js project with TypeScript and Tailwind
- [x] Set up Supabase project (Postgres + Storage buckets)
- [x] Implement Supabase Auth (email + OAuth)
- [x] Create `users` table with plan field (`free` | `creator` | `pro`)
- [x] Protect routes — redirect unauthenticated users to login
- [x] Set up FastAPI project structure
- [x] Connect FastAPI to Supabase via service role key
- [x] Set up Modal.com account and link to FastAPI

---

### 2. Video Upload

- [x] Build upload UI — drag and drop + file picker
- [x] Validate file type (mp4, mov, webm) and size limit on client
- [x] Upload raw video to Supabase Storage (`raw/` bucket)
- [x] Generate a unique `project_id` per upload
- [x] Store project metadata in `projects` table (user_id, filename, status, created_at)
- [x] Show upload progress indicator
- [x] On upload complete, trigger backend processing job

---

### 3. Backend Processing Pipeline (Modal)

- [x] Set up Modal app with GPU-enabled functions
- [x] Build FFmpeg wrapper utility for Python
- [x] Integrate Silero VAD — detect silence segments, return timestamps
- [x] Integrate WhisperX — transcribe video, return word-level timestamps
- [x] Build cut list generator — combines VAD + transcript into proposed edit steps (JSON)
- [x] Store raw transcript and cut list in Supabase
- [x] Update project status in DB as pipeline progresses (`processing` → `ready`)
- [x] Handle pipeline errors gracefully — update status to `failed`, surface to frontend

---

### 4. Agent Reasoning UI

- [x] Poll or subscribe (Supabase Realtime) for project status change to `ready`
- [x] Fetch proposed step list from backend
- [x] Render step list as a visible, ordered reasoning panel
- [x] Each step shows: type (cut, caption, trim), reason, affected timestamp range
- [x] Each step has Approve / Reject toggle
- [x] Show step count and estimated time saved
- [x] "Approve All" shortcut button
- [x] "Reject All" shortcut button
- [x] Approved steps highlighted, rejected steps visually dimmed
- [x] Confirm button — sends approved step list to execution endpoint

---

### 5. Dual Timeline

- [x] Integrate Peaks.js for waveform visualisation
- [x] Render two tracks — raw audio (top) and edited audio (bottom)
- [x] Highlight silence regions on raw track
- [x] Mark cut regions as greyed out on edited track
- [x] Integrate React Player for video preview playback
- [x] Clicking a region in timeline seeks video to that point
- [x] Timeline and video player stay in sync during playback
- [x] Show caption markers on timeline as coloured ticks

---

### 6. Edit Execution

- [x] Build `/execute` API endpoint — accepts approved step list + project_id
- [x] Trigger Modal job to run FFmpeg commands for each approved step in order
- [x] Steps are applied sequentially and atomically — one failure does not block others
- [x] Store processed video in Supabase Storage (`processed/` bucket)
- [x] Update project status to `done`
- [x] Return processed video URL to frontend

---

### 7. Captions

- [x] Use WhisperX word-level timestamps to generate caption segments
- [x] Store captions as SRT and as JSON in Supabase
- [ ] Render captions as an overlay on the video preview
- [ ] Basic caption style controls — font size, colour, position (top / bottom)
- [ ] Allow user to edit individual caption lines in a caption panel
- [x] Burn captions into exported video via FFmpeg (free and paid tiers)

---

### 8. Export

- [x] Build export trigger button in UI
- [x] Trigger Modal FFmpeg job to produce final export file
- [x] **Free tier:** apply watermark (bottom-right logo overlay), cap at 720p / 30fps
- [x] **Paid tiers:** clean export, up to 1080p / 60fps
- [ ] Track export minutes in `usage` table (linked to user + project)
- [x] Show export progress indicator
- [x] On complete, provide download link (signed Supabase Storage URL)
- [ ] Store export metadata (resolution, duration, tier, timestamp)

---

### 9. Billing & Usage

- [ ] Set up Stripe account and products (Creator ~$15–20/mo, Pro ~$40–50/mo)
- [ ] Build `/billing/upgrade` page with Stripe Checkout
- [ ] Handle Stripe webhooks — update user plan in Supabase on payment events
- [ ] Enforce free tier limits (export minutes cap, watermark, resolution)
- [ ] Show usage meter in dashboard (exports used / limit this month)
- [ ] Show upgrade prompt when free tier limit is reached

---

### 10. Dashboard

- [x] Project list view — all user projects with status badges
- [x] Create new project button
- [x] Project card shows: thumbnail, filename, status, created date
- [x] Delete project (soft delete — mark as deleted, do not purge storage immediately)
- [x] Account settings page — name, email, plan info
- [x] Link to billing portal (Stripe Customer Portal)

---

### 11. Error Handling & Edge Cases

- [x] Handle upload failures — retry or clear and re-upload
- [x] Handle pipeline timeouts on Modal — surface friendly error to user
- [ ] Handle empty transcript (no speech detected) — inform user, allow manual edit
- [ ] Handle video with no silence (nothing to cut) — inform user, show transcript only
- [x] Validate approved step list before execution — reject malformed inputs
- [ ] Rate limit API endpoints per user

---

### 12. Polish & Pre-launch

- [ ] Responsive layout — usable on tablet and desktop (mobile is stretch goal)
- [x] Loading states on all async actions
- [x] Empty states for new users (onboarding prompt)
- [ ] Basic onboarding tooltip flow (first upload walkthrough)
- [ ] Privacy policy and terms of service pages
- [x] Favicon, og:image, basic SEO meta tags
- [ ] Environment variable audit — no secrets in client bundle
- [ ] End-to-end test: upload → process → approve → execute → export

---

## Data Models (Supabase)

### `users`

| Field      | Type        | Notes                        |
| ---------- | ----------- | ---------------------------- |
| id         | uuid        | Supabase Auth UID            |
| email      | text        |                              |
| plan       | text        | `free` \| `creator` \| `pro` |
| created_at | timestamptz |                              |

### `projects`

| Field            | Type        | Notes                                                        |
| ---------------- | ----------- | ------------------------------------------------------------ |
| id               | uuid        |                                                              |
| user_id          | uuid        | FK → users                                                   |
| filename         | text        | Original filename                                            |
| status           | text        | `uploading` \| `processing` \| `ready` \| `done` \| `failed` |
| raw_url          | text        | Supabase Storage path                                        |
| processed_url    | text        | Supabase Storage path                                        |
| duration_seconds | integer     |                                                              |
| created_at       | timestamptz |                                                              |

### `transcripts`

| Field      | Type        | Notes                      |
| ---------- | ----------- | -------------------------- |
| id         | uuid        |                            |
| project_id | uuid        | FK → projects              |
| words      | jsonb       | WhisperX word-level output |
| srt        | text        | SRT format captions        |
| created_at | timestamptz |                            |

### `edit_steps`

| Field          | Type        | Notes                   |
| -------------- | ----------- | ----------------------- |
| id             | uuid        |                         |
| project_id     | uuid        | FK → projects           |
| steps          | jsonb       | Full proposed step list |
| approved_steps | jsonb       | Steps approved by user  |
| created_at     | timestamptz |                         |

### `usage`

| Field          | Type        | Notes                           |
| -------------- | ----------- | ------------------------------- |
| id             | uuid        |                                 |
| user_id        | uuid        | FK → users                      |
| project_id     | uuid        | FK → projects                   |
| export_minutes | numeric     | Minutes consumed by this export |
| created_at     | timestamptz |                                 |

---

## Key Libraries

| Library             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `ffmpeg-python`     | Python FFmpeg wrapper for cut execution     |
| `silero-vad`        | Voice activity detection (silence segments) |
| `whisperx`          | Transcription with word-level timestamps    |
| `peaks.js`          | Waveform + timeline UI                      |
| `react-player`      | Video playback in preview                   |
| `stripe`            | Billing and webhooks                        |
| `supabase-js`       | Frontend Supabase client                    |
| `supabase` (Python) | Backend Supabase client                     |

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Modal
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Out of Scope for v1

The following are explicitly deferred to later versions:

- B-roll suggestion or insertion
- Music / audio track support
- Colour grading
- Brand kits or templates
- Multi-clip projects
- Team workspaces or collaboration
- Mobile layout
- Re-prompt or undo on individual edits (planned for v2)

# Somvo

> The agent does the craft. You keep the intent.

## What it is

Somvo is an AI-assisted video editor for short-form content creators. Most of a first cut is mechanical — removing silence, cutting filler, burning in captions. Somvo handles that in minutes and proposes every edit as a discrete, visible step before anything is committed.

The agent never edits silently. Every proposed change comes with a reason. You decide what happens.

## How it works

1. Upload your video
2. Describe your intent in plain language
3. The agent generates a list of proposed edits — each one labeled with its reasoning
4. You review each step individually: approve it, reject it, alter the parameters, or re-prompt to refine
5. The agent executes only what you approved
6. Export

Nothing is applied without your explicit sign-off. The interaction model is the same regardless of what the agent is doing.

## Creator memory

Somvo learns your editing preferences over time — preferred cut style, caption placement, pacing, intro/outro structure. This memory is used to bias future edit proposals so they arrive closer to your voice from the start.

## Stack

| Layer            | Technology           |
| ---------------- | -------------------- |
| Frontend         | Next.js + TypeScript |
| Backend          | FastAPI              |
| GPU / Processing | Modal.com            |
| Video            | FFmpeg + WhisperX    |
| Database / Auth  | Supabase             |
| Billing          | Stripe               |

## Running locally

```bash
cd apps/web
npm install
cp .env.local.example .env.local
npm run dev
```

```bash
# Backend
cd apps/server
modal serve main.py
```

---

_Built by Oliver Söderlund Granzer_

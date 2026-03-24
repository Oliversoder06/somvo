# Somvo — API Server

FastAPI backend for video processing pipeline.

## Setup (TODO)

```bash
cd apps/server
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Stack

- **FastAPI** — API framework
- **Modal.com** — GPU compute (FFmpeg, WhisperX, Silero VAD)
- **Supabase** — Database & storage (Python client)

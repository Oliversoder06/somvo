# Somvo Server

FastAPI backend for the Somvo video processing pipeline.

## Setup

1. Create and activate a Python virtual environment:

   ```bash
   cd apps/server
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Copy env file and fill in values:

   ```bash
   cp .env.example .env
   ```

4. Authenticate with Modal (requires Modal account at modal.com):

   ```bash
   modal token new
   ```

5. Run FastAPI locally:

   ```bash
   uvicorn main:app --reload --port 8000
   ```

6. Deploy Modal functions:
   ```bash
   modal deploy modal_app/deploy.py
   ```

## Architecture

```
POST /api/process   → spawns Modal pipeline (non-blocking)
POST /api/execute   → applies approved edits via FFmpeg
GET  /health        → health check
```

The Modal pipeline runs GPU functions for:

- **Silero VAD** — silence detection
- **WhisperX** — transcription with word-level timestamps
- **FFmpeg** — audio extraction, video cutting, caption burning

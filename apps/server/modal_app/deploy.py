# Run with: modal deploy modal_app/deploy.py
from modal_app.app import app  # noqa: F401
from modal_app.pipeline import run_pipeline  # noqa: F401
from modal_app.transcribe import transcribe  # noqa: F401
from modal_app.vad import detect_silence  # noqa: F401

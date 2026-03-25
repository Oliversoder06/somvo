import modal
from pathlib import Path

app = modal.App("somvo")

# Secret containing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY
secrets = [modal.Secret.from_name("somvo-secrets")]

server_root = Path(__file__).resolve().parent.parent

# CPU image — no GPU needed with OpenAI Whisper API
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install([
        "ffmpeg-python",
        "supabase",
        "openai",
        "pydantic",
    ])
    .add_local_dir(str(server_root / "lib"), remote_path="/root/lib")
    .add_local_dir(str(server_root / "modal_app"), remote_path="/root/modal_app")
)

# Volume for caching between runs
model_cache = modal.Volume.from_name("somvo-model-cache", create_if_missing=True)

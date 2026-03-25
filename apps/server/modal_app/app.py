import modal
from pathlib import Path

app = modal.App("somvo")

# Secret containing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
secrets = [modal.Secret.from_name("somvo-secrets")]

server_root = Path(__file__).resolve().parent.parent

# GPU image with all dependencies + local source baked in
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install([
        "whisperx",
        "silero-vad",
        "ffmpeg-python",
        "supabase",
        "torch",
        "torchaudio",
        "pydantic",
    ])
    .add_local_dir(str(server_root / "lib"), remote_path="/root/lib")
    .add_local_dir(str(server_root / "modal_app"), remote_path="/root/modal_app")
)

# Volume for caching model weights between runs
model_cache = modal.Volume.from_name("somvo-model-cache", create_if_missing=True)

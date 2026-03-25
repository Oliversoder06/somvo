import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.process import router as process_router
from api.execute import router as execute_router
from api.analyse import router as analyse_router

app = FastAPI(title="Somvo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.environ.get("NEXT_PUBLIC_APP_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_router, prefix="/api")
app.include_router(execute_router, prefix="/api")
app.include_router(analyse_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}

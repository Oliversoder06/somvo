from pydantic import BaseModel
from typing import Any, Literal, Optional


class EditStep(BaseModel):
    id: str
    type: Literal["cut_silence", "cut_filler", "shorten", "split", "trim", "caption", "broll"]
    reason: str
    start_time: float
    end_time: float
    confidence: Optional[float] = None
    # B-roll specific fields
    query: Optional[str] = None
    clip_url: Optional[str] = None
    clip_id: Optional[int] = None
    thumbnail_url: Optional[str] = None
    label: Optional[str] = None
    alternatives: Optional[list[dict[str, Any]]] = None

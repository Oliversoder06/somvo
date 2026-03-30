from pydantic import BaseModel
from typing import Literal, Optional


class EditStep(BaseModel):
    id: str
    type: Literal["cut_silence", "cut_filler", "shorten", "split", "trim", "caption"]
    reason: str
    start_time: float
    end_time: float
    confidence: Optional[int] = None

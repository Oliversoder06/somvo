from pydantic import BaseModel
from typing import Literal


class EditStep(BaseModel):
    id: str
    type: Literal["cut_silence", "cut_filler", "trim", "caption"]
    reason: str
    start_time: float
    end_time: float

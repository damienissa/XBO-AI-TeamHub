import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator


class ColumnHistoryOut(BaseModel):
    """Schema for column history entries with computed time_spent."""
    id: uuid.UUID
    ticket_id: uuid.UUID
    column: str
    entered_at: datetime
    exited_at: Optional[datetime] = None
    time_spent: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def compute_time_spent(self) -> "ColumnHistoryOut":
        """Compute human-readable time spent in column for closed rows."""
        if self.exited_at is not None:
            delta = self.exited_at - self.entered_at
            total_seconds = int(delta.total_seconds())
            if total_seconds < 3600:
                minutes = max(total_seconds // 60, 1)
                self.time_spent = f"{minutes}m in column"
            elif total_seconds < 86400:
                hours = total_seconds // 3600
                self.time_spent = f"{hours}h in column"
            else:
                days = total_seconds // 86400
                self.time_spent = f"{days}d in column"
        return self

from enum import Enum
from typing import Optional, Dict, Any


class EventType(str, Enum):
    CONVERSATION = "conversation"
    LOCATION = "location"
    PHYSIOLOGICAL = "physiological"
    NOTE = "note"

    @classmethod
    def values(cls) -> set[str]:
        return {item.value for item in cls}


class AuditAction(str, Enum):
    CREATE_EVENT = "CREATE_EVENT"
    GET_EVENT = "GET_EVENT"
    LIST_EVENTS = "LIST_EVENTS"
    DELETE_EVENT = "DELETE_EVENT"
    UPDATE_PERMISSION = "UPDATE_PERMISSION"
    BLOCKED_ACCESS = "BLOCKED_ACCESS"


class AuditResult(str, Enum):
    ALLOWED = "ALLOWED"
    DENIED = "DENIED"
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"


# Default initial permissions for all categories (all ON)
DEFAULT_PERMISSIONS: Dict[str, bool] = {
    EventType.CONVERSATION.value: True,
    EventType.LOCATION.value: True,
    EventType.PHYSIOLOGICAL.value: True,
    EventType.NOTE.value: True,
}

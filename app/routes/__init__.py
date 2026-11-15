from app.routes.events import events_bp
from app.routes.permissions import permissions_bp
from app.routes.audit import audit_bp
from app.routes.docs import docs_bp

__all__ = ["events_bp", "permissions_bp", "audit_bp", "docs_bp"]

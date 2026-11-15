from flask import Blueprint, request, jsonify, current_app
from app.services import AuditService

audit_bp = Blueprint("audit", __name__)


def get_current_user_id() -> str:
    return (
        request.headers.get("X-User-Id")
        or request.args.get("user_id")
        or current_app.config.get("DEFAULT_USER_ID", "user_demo")
    )


@audit_bp.route("/audit-log", methods=["GET"])
def get_audit_log():
    """
    GET /audit-log
    Retrieve immutable audit log records for the user. Read-only endpoint.
    """
    user_id = get_current_user_id()

    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = max(1, min(int(request.args.get("limit", 50)), 200))
    except (ValueError, TypeError):
        return jsonify({"error": "BadRequest", "detail": "Parameters 'page' and 'limit' must be integers"}), 400

    logs, total = AuditService.get_audit_logs(user_id=user_id, page=page, limit=limit)

    return jsonify({
        "audit_logs": logs,
        "total": total,
        "page": page,
        "limit": limit
    }), 200


@audit_bp.route("/audit-log", methods=["POST", "PUT", "DELETE", "PATCH"])
def audit_log_immutable():
    """Explicitly reject any write or modification attempts to the audit log."""
    return jsonify({
        "error": "MethodNotAllowed",
        "detail": "Audit logs are strictly read-only and immutable. Modifications are prohibited."
    }), 405

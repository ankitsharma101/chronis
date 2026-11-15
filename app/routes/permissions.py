from flask import Blueprint, request, jsonify, current_app
from app.services import PrivacyService
from app.models import EventType

permissions_bp = Blueprint("permissions", __name__)


def get_current_user_id() -> str:
    return (
        request.headers.get("X-User-Id")
        or request.args.get("user_id")
        or current_app.config.get("DEFAULT_USER_ID", "user_demo")
    )


@permissions_bp.route("/permissions", methods=["GET"])
def get_permissions():
    """
    GET /permissions
    Retrieve the current privacy permissions for the active user.
    """
    user_id = get_current_user_id()
    perms = PrivacyService.get_permissions(user_id)
    return jsonify({
        "user_id": user_id,
        "permissions": perms
    }), 200


@permissions_bp.route("/permissions", methods=["PUT", "PATCH"])
def update_permissions():
    """
    PUT /permissions | PATCH /permissions
    Update one or more category privacy toggles.
    Expected JSON payload:
    {
      "conversation": true|false,
      "location": true|false,
      "physiological": true|false,
      "note": true|false
    }
    Or nested:
    {
      "permissions": { ... }
    }
    """
    user_id = get_current_user_id()
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "BadRequest", "detail": "Missing JSON payload"}), 400

    # Support either top-level keys or nested 'permissions' object
    payload = data.get("permissions") if isinstance(data.get("permissions"), dict) else data

    valid_keys = EventType.values()
    updates = {}
    for key, val in payload.items():
        if key in valid_keys:
            if not isinstance(val, bool):
                return jsonify({
                    "error": "ValidationError",
                    "detail": f"Permission for '{key}' must be a boolean (true or false)"
                }), 400
            updates[key] = val

    if not updates:
        return jsonify({
            "error": "BadRequest",
            "detail": f"No valid permission categories provided. Allowed categories: {', '.join(valid_keys)}"
        }), 400

    updated_perms = PrivacyService.update_permissions(user_id, updates)

    return jsonify({
        "message": "Permissions updated successfully",
        "user_id": user_id,
        "permissions": updated_perms
    }), 200

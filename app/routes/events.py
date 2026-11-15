from flask import Blueprint, request, jsonify, current_app
from pydantic import ValidationError
from app.schemas import EventCreate, EventResponse, EventListResponse
from app.services import EventService, EventNotFoundException, PrivacyDeniedException

events_bp = Blueprint("events", __name__)


def get_current_user_id() -> str:
    """Extract user_id from headers, query string, or fallback to default configured user."""
    return (
        request.headers.get("X-User-Id")
        or request.args.get("user_id")
        or current_app.config.get("DEFAULT_USER_ID", "user_demo")
    )


@events_bp.route("/events", methods=["GET"])
def list_events():
    """
    GET /events
    List chronological events with type filtering, pagination, and backend privacy enforcement.
    """
    user_id = get_current_user_id()
    type_filter = request.args.get("type", None)
    if type_filter:
        type_filter = type_filter.strip().lower()

    # Pagination: support both page/limit and offset/limit
    try:
        limit = int(request.args.get("limit", 10))
        limit = max(1, min(limit, 100))  # clamp between 1 and 100
    except (ValueError, TypeError):
        return jsonify({"error": "BadRequest", "detail": "Parameter 'limit' must be an integer"}), 400

    try:
        if "offset" in request.args:
            offset = int(request.args.get("offset", 0))
            page = (offset // limit) + 1
        else:
            page = int(request.args.get("page", 1))
            page = max(1, page)
    except (ValueError, TypeError):
        return jsonify({"error": "BadRequest", "detail": "Parameter 'page' or 'offset' must be an integer"}), 400

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    try:
        events, total, has_more = EventService.list_events(
            user_id=user_id,
            type_filter=type_filter,
            page=page,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as ve:
        return jsonify({"error": "BadRequest", "detail": str(ve)}), 400

    return jsonify({
        "events": events,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": has_more
    }), 200


@events_bp.route("/events/<event_id>", methods=["GET"])
def get_event(event_id: str):
    """
    GET /events/{id}
    Retrieve a single event by ID.
    Enforces privacy policy: returns HTTP 403 Forbidden if the event's category is OFF.
    """
    user_id = get_current_user_id()
    try:
        event = EventService.get_event_by_id(event_id, user_id)
        return jsonify(event), 200
    except EventNotFoundException as e:
        return jsonify({"error": "NotFound", "detail": str(e)}), 404
    except PrivacyDeniedException as pe:
        return jsonify({
            "error": "Forbidden",
            "detail": str(pe),
            "category": pe.event_type,
            "privacy_blocked": True
        }), 403


@events_bp.route("/events", methods=["POST"])
def create_event():
    """
    POST /events
    Create a new memory event.
    """
    user_id = get_current_user_id()
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "BadRequest", "detail": "Invalid or missing JSON payload"}), 400

    # If user_id is explicitly passed in body, allow it, else use resolved user_id
    effective_user_id = data.get("user_id") or user_id

    try:
        event_create = EventCreate(**data)
    except ValidationError as e:
        errors = e.errors()
        error_msgs = [f"{err['loc'][-1]}: {err['msg']}" for err in errors]
        return jsonify({"error": "ValidationError", "detail": ", ".join(error_msgs), "errors": errors}), 400

    created = EventService.create_event(event_create, effective_user_id)
    return jsonify(created), 201


@events_bp.route("/events/<event_id>", methods=["DELETE"])
def delete_event(event_id: str):
    """
    DELETE /events/{id}
    Delete an event by ID.
    """
    user_id = get_current_user_id()
    try:
        EventService.delete_event(event_id, user_id)
        return jsonify({
            "message": "Event deleted successfully",
            "id": event_id
        }), 200
    except EventNotFoundException as e:
        return jsonify({"error": "NotFound", "detail": str(e)}), 404

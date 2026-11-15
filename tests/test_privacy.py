import json
import pytest


def test_default_permissions_all_enabled(client, auth_headers):
    """Test that all four categories default to ON (enabled)."""
    res = client.get("/permissions", headers=auth_headers)
    assert res.status_code == 200
    perms = res.get_json()["permissions"]
    assert perms["conversation"] is True
    assert perms["location"] is True
    assert perms["physiological"] is True
    assert perms["note"] is True


def test_enabled_category_is_returned(client, auth_headers):
    """Test that all categories are returned when all are enabled."""
    types = ["conversation", "location", "physiological", "note"]
    for t in types:
        client.post("/events", headers=auth_headers, data=json.dumps({
            "type": t,
            "title": f"Sample {t}",
            "content": f"Content for {t}"
        }))

    res = client.get("/events", headers=auth_headers)
    assert res.status_code == 200
    returned_types = {e["type"] for e in res.get_json()["events"]}
    assert returned_types == set(types)


def test_disabled_category_is_not_returned_by_backend(client, auth_headers):
    """
    Core requirement: If a user turns a category OFF, the backend must stop returning that data.
    Ensures privacy is enforced at the backend API boundary.
    """
    # Create one event of each category
    for t in ["conversation", "location", "physiological", "note"]:
        client.post("/events", headers=auth_headers, data=json.dumps({
            "type": t,
            "title": f"Sample {t}",
            "content": f"Content for {t}"
        }))

    # Turn conversation and location OFF
    perm_res = client.put("/permissions", headers=auth_headers, data=json.dumps({
        "conversation": False,
        "location": False
    }))
    assert perm_res.status_code == 200
    assert perm_res.get_json()["permissions"]["conversation"] is False
    assert perm_res.get_json()["permissions"]["location"] is False

    # Fetch events - backend must NEVER return conversation or location
    events_res = client.get("/events", headers=auth_headers)
    assert events_res.status_code == 200
    events = events_res.get_json()["events"]

    returned_types = [e["type"] for e in events]
    assert "conversation" not in returned_types
    assert "location" not in returned_types
    assert "physiological" in returned_types
    assert "note" in returned_types


def test_single_event_direct_fetch_blocked_403(client, auth_headers):
    """
    Test direct GET /events/{id} on a disabled category.
    Backend must refuse to serve the event with HTTP 403 Forbidden.
    """
    # Create a physiological event
    create_res = client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "physiological",
        "title": "Heart Rate Spike",
        "content": "Peak 162 bpm during workout"
    }))
    event_id = create_res.get_json()["id"]

    # Verify readable initially
    get_init = client.get(f"/events/{event_id}", headers=auth_headers)
    assert get_init.status_code == 200

    # Turn physiological OFF
    client.put("/permissions", headers=auth_headers, data=json.dumps({
        "physiological": False
    }))

    # Attempt to read directly via ID
    get_blocked = client.get(f"/events/{event_id}", headers=auth_headers)
    assert get_blocked.status_code == 403
    body = get_blocked.get_json()
    assert body["error"] == "Forbidden"
    assert "physiological" in body["detail"]
    assert "title" not in body
    assert "content" not in body


def test_changing_permission_affects_later_requests(client, auth_headers):
    """Test that toggling a permission ON or OFF immediately takes effect on subsequent calls."""
    create_res = client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "note",
        "title": "Secret Note",
        "content": "Sensitive thoughts"
    }))
    note_id = create_res.get_json()["id"]

    # 1. Turn OFF
    client.put("/permissions", headers=auth_headers, data=json.dumps({"note": False}))
    r1 = client.get("/events", headers=auth_headers)
    assert not any(e["id"] == note_id for e in r1.get_json()["events"])
    assert client.get(f"/events/{note_id}", headers=auth_headers).status_code == 403

    # 2. Turn back ON
    client.put("/permissions", headers=auth_headers, data=json.dumps({"note": True}))
    r2 = client.get("/events", headers=auth_headers)
    assert any(e["id"] == note_id for e in r2.get_json()["events"])
    assert client.get(f"/events/{note_id}", headers=auth_headers).status_code == 200


def test_explicit_query_for_disabled_category_returns_empty(client, auth_headers):
    """When a client requests GET /events?type=location while location is OFF, return 0 items."""
    client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "location",
        "title": "Home",
        "content": "Living room"
    }))

    client.put("/permissions", headers=auth_headers, data=json.dumps({"location": False}))

    res = client.get("/events?type=location", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["events"]) == 0
    assert data["total"] == 0

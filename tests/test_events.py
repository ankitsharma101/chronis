import json
import pytest


def test_create_event_success(client, auth_headers):
    """Test creating an event with valid payload."""
    payload = {
        "type": "conversation",
        "title": "Meeting with Product Lead",
        "content": "Discussed roadmap and privacy requirements",
        "timestamp": "2026-11-15T10:00:00Z"
    }
    res = client.post("/events", headers=auth_headers, data=json.dumps(payload))
    assert res.status_code == 201

    data = res.get_json()
    assert "id" in data
    assert data["user_id"] == "test_user_1"
    assert data["type"] == "conversation"
    assert data["title"] == payload["title"]
    assert data["content"] == payload["content"]


def test_create_event_invalid_type(client, auth_headers):
    """Test creating an event with an unsupported category returns 400."""
    payload = {
        "type": "weather",
        "title": "Sunny morning",
        "content": "22C outside"
    }
    res = client.post("/events", headers=auth_headers, data=json.dumps(payload))
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data


def test_create_event_missing_fields(client, auth_headers):
    """Test creating an event with missing title or content returns 400."""
    res = client.post("/events", headers=auth_headers, data=json.dumps({"type": "note"}))
    assert res.status_code == 400


def test_get_event_by_id(client, auth_headers):
    """Test fetching an existing event by ID."""
    create_res = client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "location",
        "title": "Central Park",
        "content": "Morning walk by the lake"
    }))
    event_id = create_res.get_json()["id"]

    get_res = client.get(f"/events/{event_id}", headers=auth_headers)
    assert get_res.status_code == 200
    data = get_res.get_json()
    assert data["id"] == event_id
    assert data["type"] == "location"
    assert data["title"] == "Central Park"


def test_get_nonexistent_event(client, auth_headers):
    """Test fetching a non-existent event ID returns 404."""
    res = client.get("/events/non-existent-uuid-1234", headers=auth_headers)
    assert res.status_code == 404


def test_delete_event(client, auth_headers):
    """Test deleting an event by ID."""
    create_res = client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "note",
        "title": "Temporary Note",
        "content": "To be deleted soon"
    }))
    event_id = create_res.get_json()["id"]

    del_res = client.delete(f"/events/{event_id}", headers=auth_headers)
    assert del_res.status_code == 200

    # Ensure it is now gone
    get_res = client.get(f"/events/{event_id}", headers=auth_headers)
    assert get_res.status_code == 404


def test_pagination(client, auth_headers):
    """Test pagination with page and limit parameters."""
    for i in range(12):
        client.post("/events", headers=auth_headers, data=json.dumps({
            "type": "note",
            "title": f"Note {i + 1}",
            "content": f"Content for note {i + 1}",
            "timestamp": f"2026-11-15T{10 + (i // 60):02d}:{i % 60:02d}:00Z"
        }))

    # Page 1, limit 5
    res1 = client.get("/events?page=1&limit=5", headers=auth_headers)
    assert res1.status_code == 200
    d1 = res1.get_json()
    assert len(d1["events"]) == 5
    assert d1["total"] == 12
    assert d1["page"] == 1
    assert d1["has_more"] is True

    # Page 3, limit 5 (should have 2 items: 12 - 10 = 2)
    res3 = client.get("/events?page=3&limit=5", headers=auth_headers)
    assert res3.status_code == 200
    d3 = res3.get_json()
    assert len(d3["events"]) == 2
    assert d3["has_more"] is False


def test_type_filtering(client, auth_headers):
    """Test filtering events by type."""
    # Seed 2 conversations, 1 location
    client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "conversation", "title": "Conv 1", "content": "Text 1"
    }))
    client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "conversation", "title": "Conv 2", "content": "Text 2"
    }))
    client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "location", "title": "Office", "content": "Work desk"
    }))

    res = client.get("/events?type=conversation", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 2
    assert all(e["type"] == "conversation" for e in data["events"])

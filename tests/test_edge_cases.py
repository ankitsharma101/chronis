import json
import pytest


def test_invalid_permission_type_rejected(client, auth_headers):
    """Test updating permissions with non-boolean values returns 400."""
    res = client.put("/permissions", headers=auth_headers, data=json.dumps({
        "conversation": "invalid-string"
    }))
    assert res.status_code == 400
    assert "ValidationError" in res.get_json()["error"]


def test_unsupported_permission_category(client, auth_headers):
    """Test updating permissions with completely unrecognized category."""
    res = client.put("/permissions", headers=auth_headers, data=json.dumps({
        "social_media": True
    }))
    assert res.status_code == 400


def test_invalid_pagination_parameters(client, auth_headers):
    """Test that invalid non-integer pagination params return 400."""
    res = client.get("/events?page=abc", headers=auth_headers)
    assert res.status_code == 400

    res2 = client.get("/events?limit=xyz", headers=auth_headers)
    assert res2.status_code == 400


def test_multi_user_isolation(client):
    """Test that User A and User B have separate events and independent permissions."""
    headers_a = {"X-User-Id": "alice", "Content-Type": "application/json"}
    headers_b = {"X-User-Id": "bob", "Content-Type": "application/json"}

    # Alice creates a note
    res_a = client.post("/events", headers=headers_a, data=json.dumps({
        "type": "note",
        "title": "Alice's Secret Note",
        "content": "Secret text"
    }))
    alice_event_id = res_a.get_json()["id"]

    # Bob lists events -> Bob should NOT see Alice's event
    res_b = client.get("/events", headers=headers_b)
    bob_events = res_b.get_json()["events"]
    assert not any(e["id"] == alice_event_id for e in bob_events)

    # Bob attempts to fetch Alice's event directly by ID -> 404 (or not found in Bob's tenancy)
    res_b_direct = client.get(f"/events/{alice_event_id}", headers=headers_b)
    assert res_b_direct.status_code == 404

    # Alice turns note OFF -> Bob's note permissions should remain unaffected
    client.put("/permissions", headers=headers_a, data=json.dumps({"note": False}))
    bob_perms = client.get("/permissions", headers=headers_b).get_json()["permissions"]
    assert bob_perms["note"] is True

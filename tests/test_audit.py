import json
import pytest


def test_audit_log_read_only(client, auth_headers):
    """
    Requirement: The audit log should be read-only.
    Mutating methods (POST, PUT, DELETE, PATCH) must be rejected with 405 Method Not Allowed.
    """
    assert client.post("/audit-log", headers=auth_headers, data=json.dumps({"action": "FAKE"})).status_code == 405
    assert client.put("/audit-log", headers=auth_headers, data=json.dumps({"action": "FAKE"})).status_code == 405
    assert client.delete("/audit-log", headers=auth_headers).status_code == 405
    assert client.patch("/audit-log", headers=auth_headers).status_code == 405


def test_audit_log_recorded_on_create_event(client, auth_headers):
    """Verify that creating an event generates an audit record."""
    client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "note",
        "title": "Audit Test Note",
        "content": "Verifying audit trail creation"
    }))

    res = client.get("/audit-log", headers=auth_headers)
    assert res.status_code == 200
    logs = res.get_json()["audit_logs"]

    create_entries = [l for l in logs if l["action"] == "CREATE_EVENT" and l["event_type"] == "note"]
    assert len(create_entries) >= 1
    assert create_entries[0]["result"] == "SUCCESS"
    assert "user_id" in create_entries[0]
    assert "timestamp" in create_entries[0]


def test_audit_log_recorded_on_permission_change(client, auth_headers):
    """Verify that toggling permissions generates an audit record."""
    client.put("/permissions", headers=auth_headers, data=json.dumps({
        "conversation": False
    }))

    res = client.get("/audit-log", headers=auth_headers)
    assert res.status_code == 200
    logs = res.get_json()["audit_logs"]

    perm_entries = [l for l in logs if l["action"] == "UPDATE_PERMISSION" and l["event_type"] == "conversation"]
    assert len(perm_entries) >= 1
    assert perm_entries[0]["result"] == "SUCCESS"
    assert "OFF" in perm_entries[0]["details"]


def test_audit_log_recorded_on_privacy_blocked_read(client, auth_headers):
    """
    Verify that an unauthorized access attempt to a disabled category
    is logged with result='DENIED'.
    """
    # 1. Create a location event
    create_res = client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "location",
        "title": "Secret Meeting Spot",
        "content": "Classified location"
    }))
    event_id = create_res.get_json()["id"]

    # 2. Turn location OFF
    client.put("/permissions", headers=auth_headers, data=json.dumps({"location": False}))

    # 3. Direct GET (blocked 403)
    probe_res = client.get(f"/events/{event_id}", headers=auth_headers)
    assert probe_res.status_code == 403

    # 4. Check audit log
    audit_res = client.get("/audit-log", headers=auth_headers)
    logs = audit_res.get_json()["audit_logs"]

    denied_entries = [l for l in logs if l["result"] == "DENIED" and l["event_type"] == "location"]
    assert len(denied_entries) >= 1
    assert denied_entries[0]["action"] == "GET_EVENT"
    assert "blocked" in denied_entries[0]["details"].lower()


def test_audit_log_recorded_on_delete_event(client, auth_headers):
    """Verify that deleting an event creates a DELETE_EVENT audit entry."""
    create_res = client.post("/events", headers=auth_headers, data=json.dumps({
        "type": "physiological",
        "title": "Sleep data",
        "content": "8 hours sleep"
    }))
    event_id = create_res.get_json()["id"]

    client.delete(f"/events/{event_id}", headers=auth_headers)

    res = client.get("/audit-log", headers=auth_headers)
    logs = res.get_json()["audit_logs"]

    del_entries = [l for l in logs if l["action"] == "DELETE_EVENT" and l["event_type"] == "physiological"]
    assert len(del_entries) >= 1
    assert del_entries[0]["result"] == "SUCCESS"

# Chronis — Privacy-Aware Memory Timeline

A lightweight, robust backend prototype and interface for Chronis that stores user memory events, displays them in a chronological timeline, and enforces category-level privacy controls with an immutable audit log.

---

## Table of Contents
1. [Architecture](#architecture)
2. [Setup & Quickstart](#setup--quickstart)
3. [Privacy Controls & Authorization Logic](#privacy-controls--authorization-logic)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [Testing](#testing)
7. [Demo Video Script](#demo-video-script)
8. [Short Engineering Note](#short-engineering-note)

---

## Architecture

The project follows a standard layered architecture with strict separation between HTTP routing, domain validation, access control, and persistence.

```
+------------------------------------------------------------------------+
|                              Frontend UI                               |
|          (Timeline View, Privacy Toggles, Audit Trail, Verifier)       |
+------------------------------------------------------------------------+
                                    │  HTTP (JSON)
                                    ▼
+------------------------------------------------------------------------+
|                          Flask API Boundary                            |
|        (/events • /events/{id} • /permissions • /audit-log • /docs)     |
+------------------------------------------------------------------------+
            │                                           │
            ▼                                           ▼
+───────────────────────────+               +───────────────────────────+
|      Event Service        |               |      Privacy Service      |
|  (CRUD, Filtering,        |◄─────────────►| (Enforces Category Toggles|
|     Pydantic Validation)  |               |  & Access Control Rules)  |
+───────────────────────────+               +───────────────────────────+
            │                                           │
            ▼                                           ▼
+───────────────────────────────────────────────────────────────────────+
|                      Audit Service (Write-Only)                       |
|   (Logs ALLOWED, DENIED, CREATE, DELETE, UPDATE_PERMISSION actions)   |
+───────────────────────────────────────────────────────────────────────+
                                    │
                                    ▼
+------------------------------------------------------------------------+
|                      SQLite Relational Database                        |
|       (users • events • permissions • immutable audit_logs)            |
+------------------------------------------------------------------------+
```

### Key Decisions
- **Backend Authorization Boundary**: Filtering is not delegated to the client. Categories toggled OFF are excluded at the SQL level for queries and blocked with HTTP 403 on direct ID lookups.
- **Minimal External Dependencies**: Built with Python, Flask, Pydantic, and standard library SQLite. Evaluators can clone and run tests immediately without configuring external database services or running separate node build pipelines.
- **Immutable Audit Logging**: Write-only audit service records every read, write, toggle, and denied access attempt.

---

## Setup & Quickstart

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Git

### 1. Clone & Setup Environment
```bash
git clone https://github.com/<your-username>/chronis-memory-timeline.git
cd chronis-memory-timeline

python -m venv venv
# Linux / macOS:
source venv/bin/activate
# Windows:
.\venv\Scripts\activate

pip install -r requirements.txt
```

### 2. Configuration
Copy the configuration template:
```bash
cp .env.example .env
```
Default configuration uses SQLite (`chronis.db`) and runs on port `5000`.

### 3. Run the Server
```bash
python run.py
```
- Web Application: [http://127.0.0.1:5000/](http://127.0.0.1:5000/)
- Swagger Documentation: [http://127.0.0.1:5000/docs](http://127.0.0.1:5000/docs)
- OpenAPI Specification: [http://127.0.0.1:5000/openapi.json](http://127.0.0.1:5000/openapi.json)

---

## Privacy Controls & Authorization Logic

The system manages 4 data categories:
- `conversation`: Transcripts, chat sessions, spoken dialogue summaries
- `location`: Geo-coordinates, visited venues, check-ins
- `physiological`: Heart rate, vitals, sleep cycles, HRV
- `note`: Personal reflections, quick memos

### Enforcement Mechanism
1. **List Queries (`GET /events`)**:
   - The user's active permissions are retrieved.
   - The query dynamically binds only allowed categories: `WHERE user_id = ? AND type IN (...)`.
   - If a specific disabled category is queried (`GET /events?type=location` when location is OFF), the backend returns an empty list (`[]`) and writes an audit event. Data for disabled categories is never loaded from disk into memory.
2. **Direct Resource Access (`GET /events/{id}`)**:
   - If an event exists but its category is currently disabled, the backend halts execution and returns **HTTP 403 Forbidden**:
     ```json
     {
       "error": "Forbidden",
       "detail": "Access to category 'location' is disabled by privacy controls.",
       "category": "location",
       "privacy_blocked": true
     }
     ```
   - No content or title is leaked.
   - A security audit log entry is written with `result: "DENIED"`.

---

## API Endpoints

| Method | Endpoint | Description | Auth / Headers |
|---|---|---|---|
| `GET` | `/events` | List events chronologically. Supports `type` filtering and pagination (`page`, `limit`). Filters out disabled categories. | `X-User-Id` (optional) |
| `GET` | `/events/{id}` | Fetch single event. Returns `403 Forbidden` if category is OFF. | `X-User-Id` (optional) |
| `POST` | `/events` | Create a new timeline event. Validates body against schema. | `X-User-Id` (optional) |
| `DELETE` | `/events/{id}` | Permanently delete an event by ID. | `X-User-Id` (optional) |
| `GET` | `/permissions` | Get current ON/OFF status of the 4 categories. | `X-User-Id` (optional) |
| `PUT` | `/permissions` | Update one or more category toggles (ON/OFF). | `X-User-Id` (optional) |
| `GET` | `/audit-log` | Retrieve paginated audit records (Read-Only). | `X-User-Id` (optional) |
| `GET` | `/docs` | Interactive Swagger API documentation. | None |
| `GET` | `/openapi.json` | OpenAPI 3.0 specification in JSON format. | None |

A ready-to-use Postman collection is included in [`chronis_postman_collection.json`](./chronis_postman_collection.json).

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

-- Permissions
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK(event_type IN ('conversation', 'location', 'physiological', 'note')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1)),
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, event_type)
);

-- Events
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('conversation', 'location', 'physiological', 'note')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_events_user_time ON events(user_id, timestamp DESC);
CREATE INDEX idx_events_user_type ON events(user_id, type);

-- Audit Logs (Read-only, append-only)
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    event_type TEXT,
    result TEXT NOT NULL CHECK(result IN ('ALLOWED', 'DENIED', 'SUCCESS', 'ERROR')),
    details TEXT
);
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, timestamp DESC);
```

---

## Testing

Run the full automated test suite with pytest:
```bash
pytest -v
```

### Coverage
- Event CRUD operations (`POST`, `GET`, `DELETE`)
- Pydantic payload validation and error handling
- Offset/limit pagination and category filtering
- Default permission verification (all ON)
- Backend privacy enforcement on list queries (disabled category omitted)
- Direct resource retrieval blocking (**HTTP 403 Forbidden**) when category is disabled
- Dynamic permission toggling immediately affecting subsequent requests
- Audit trail creation for all actions (creates, deletes, permission updates, blocked reads)
- Audit log read-only enforcement (**HTTP 405 Method Not Allowed** on write attempts)
- Multi-user isolation and tenant separation

---

## Demo Video Script

Recommended 3-5 minute demo walkthrough:

1. **Overview (30s)**:
   - Introduce the app running locally at `http://127.0.0.1:5000/`.
2. **Timeline & Creation (1m)**:
   - Show timeline displaying initial seeded events across all 4 categories.
   - Use the category filter chips to filter by Conversation, Location, etc.
   - Click "New Event" to add a new event and see it appear immediately.
3. **Privacy Controls (1.5m)**:
   - Toggle the **Location** switch to **OFF**.
   - Show the timeline updating instantly: location events disappear.
   - Open the **Direct API Verifier** tab (or make a curl request to `GET /events/{id}`).
   - Show that the backend returns **HTTP 403 Forbidden** with an explicit error message, proving privacy is enforced on the API, not just the UI.
4. **Audit Trail (30s)**:
   - Switch to the **Audit Log** tab.
   - Point out the `UPDATE_PERMISSION` log and the `DENIED` record from the blocked attempt.
5. **Run Tests (30s)**:
   - In terminal, execute `pytest -v` to show all 23 tests passing.

---

## Short Engineering Note

### 1. Where is authorization enforced and why?
Authorization is enforced in the **backend application layer (Privacy Service & Data Repository)** before any data read or serialization occurs.
- **For Collection Queries (`GET /events`)**: The user's active permissions are evaluated first, and only enabled categories are included in the SQL `WHERE type IN (...)` clause. Disallowed categories are never read from disk into application memory or transmitted over the network.
- **For Single-Resource Lookups (`GET /events/{id}`)**: Before returning an event, `EventService` checks whether the event's category is currently active. If disabled, it immediately halts, writes a `DENIED` audit record, and raises an HTTP 403 Forbidden error.
- **Why**: Client-side filtering is insecure because any client or script can inspect HTTP responses or call endpoints directly. Enforcing authorization at the backend query layer guarantees zero data leakage, prevents unauthorized access, and maintains an auditable trail of all access decisions.

### 2. What happens when a user requests data they are not allowed to see?
- **List Queries (`GET /events`)**: Disabled categories are excluded from results. If a client explicitly requests a disabled category (`GET /events?type=location` when location is OFF), the backend returns an empty list `{"events": [], "total": 0}` and logs the filtered access.
- **Direct Resource Lookups (`GET /events/{id}`)**: If an event belongs to a disabled category, the backend returns **HTTP 403 Forbidden** with a clear message:
  ```json
  {
    "error": "Forbidden",
    "detail": "Access to category 'location' is disabled by privacy controls.",
    "category": "location",
    "privacy_blocked": true
  }
  ```
  The sensitive title and content are never leaked, and an immutable entry is recorded in `audit_logs` with `result: "DENIED"`.

### 3. What is one weakness that still exists in your implementation?
**Coarse Binary Category Granularity:**
The permission model uses a binary ON/OFF switch per category. It does not support:
- **Temporal constraints**: e.g., "allow location data from the last 24 hours, but hide older history."
- **Field-level redaction / Coarse precision**: e.g., sharing city-level location while stripping exact GPS coordinates, or hiding heart rate numbers while keeping activity labels.
- **Purpose- or Audience-based access**: e.g., granting read access to a specific health professional while blocking third-party integrations.

### 4. How would you change the system if it grew to 1 million events per user?
At 1,000,000 events per user, SQLite single-file queries and offset pagination would experience performance degradation. Architectural adjustments would include:
1. **Keyset / Cursor Pagination**: Replace `OFFSET / LIMIT` with keyset pagination:
   ```sql
   SELECT * FROM events
   WHERE user_id = :uid AND (timestamp, id) < (:last_timestamp, :last_id)
   ORDER BY timestamp DESC, id DESC
   LIMIT 20;
   ```
   This ensures constant $O(\log N)$ retrieval cost via index lookup instead of scanning millions of offset rows.
2. **Partitioning & Time-Series Engine**: Migrate to PostgreSQL or TimescaleDB with table partitioning by `(user_id, timestamp)`.
3. **Composite B-Tree Indexes**: Add composite indexes on `(user_id, type, timestamp DESC)`.
4. **Permission Caching**: Cache user permission vectors in Redis with write-through invalidation on permission updates.
5. **Asynchronous Audit Logging**: Offload audit writes to an event stream (Kafka or SQS) so that read endpoints are not burdened with synchronous audit database writes.

### 5. What would you improve with one additional day?
1. **Tamper-Evident Audit Chains**: Add cryptographic hash chaining (`SHA-256(prev_hash + log_record)`) to ensure the audit log cannot be retroactively altered.
2. **Time-Bounded & Redaction Policies**: Allow users to configure retention windows and field-level masking.
3. **Authentication & Scoped API Tokens**: Replace the demo header with JWT/OAuth2 authentication supporting granular scopes (e.g. `events:read:notes`).
4. **Database Migrations**: Add Alembic to support automated schema migrations without table drops.

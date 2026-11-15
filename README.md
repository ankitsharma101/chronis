# ⏳ Chronis — Privacy-Aware Memory Timeline

A production-grade prototype for Chronis that securely ingests personal memory events, renders them chronologically, and enforces strict, backend-level category privacy controls with an immutable audit trail.

---

## 📋 Table of Contents
1. [Architecture & Design Principles](#-architecture--design-principles)
2. [Quickstart & Setup Instructions](#-quickstart--setup-instructions)
3. [Privacy Controls & Authorization Engine](#-privacy-controls--authorization-engine)
4. [API Reference & Documentation](#-api-reference--documentation)
5. [Database Schema](#-database-schema)
6. [Automated Testing](#-automated-testing)
7. [Demo Video Walkthrough Script](#-demo-video-walkthrough-script)
8. [Short Engineering Note (Mandatory Questions)](#-short-engineering-note)

---

## 🏗️ Architecture & Design Principles

```
+------------------------------------------------------------------------+
|                              Frontend UI                               |
|   (Interactive Timeline • 4 Privacy Switches • Live Audit Log View)    |
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
|  (CRUD, Keyset Ordering,  |◄─────────────►| (Enforces Category Toggles|
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
|                      SQLite / Relational Database                      |
|       (users • events • permissions • immutable audit_logs)            |
+------------------------------------------------------------------------+
```

### Core Design Principles:
1. **Zero-Leakage Backend Enforcement**: Privacy permissions are evaluated at the database query level for lists and at the service boundary for single resources. Data from disabled categories is **never fetched, serialized, or transmitted to the client**.
2. **Separation of Concerns**: Modular organization separating database management, Pydantic schemas, domain business logic (services), and HTTP routing (blueprints).
3. **Immutable Auditing**: Every access decision—whether allowed, filtered, or blocked—is recorded in a read-only audit log.
4. **Frictionless Developer Experience**: Uses Python standard library SQLite and pre-installed dependencies so reviewers can clone, test, and run the server immediately without complex database setup or node/npm build chains.

---

## 🚀 Quickstart & Setup Instructions

### Prerequisites
- **Python**: 3.10+ (tested on Python 3.13)
- **Git**

### 1. Clone & Navigate to Repository
```bash
git clone https://github.com/<your-username>/chronis-memory-timeline.git
cd chronis-memory-timeline
```

### 2. Set Up Virtual Environment (Recommended)
```bash
python -m venv venv

# On Linux / macOS:
source venv/bin/activate

# On Windows:
.\venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configuration
An environment file template is provided in `.env.example`. Copy it to `.env`:
```bash
cp .env.example .env
```
*(Default settings use SQLite at `chronis.db` and port `5000`)*.

### 5. Run the Application
```bash
python run.py
```

The application will start at:
- 🌐 **Web Application UI**: [http://127.0.0.1:5000/](http://127.0.0.1:5000/)
- 📖 **Interactive Swagger UI**: [http://127.0.0.1:5000/docs](http://127.0.0.1:5000/docs)
- 📑 **OpenAPI Specification**: [http://127.0.0.1:5000/openapi.json](http://127.0.0.1:5000/openapi.json)

---

## 🛡️ Privacy Controls & Authorization Engine

The system supports four distinct categories:
- `conversation`: Transcripts, chat sessions, verbal summaries
- `location`: Geo-coordinates, venues, check-ins
- `physiological`: Heart rate, vitals, sleep cycles, HRV
- `note`: Personal thoughts, reflections, quick reminders

### How Backend Privacy is Enforced:
1. **Collection Queries (`GET /events`)**:
   - The user's active permissions are evaluated before querying.
   - Disallowed categories are excluded directly in the SQL statement: `WHERE user_id = ? AND type IN (allowed_types)`.
   - If a client requests `GET /events?type=location` while `location` is OFF, the backend returns an empty list `[]` (`total: 0`) and logs a `DENIED` filter audit event.
2. **Direct Resource Access (`GET /events/{id}`)**:
   - The event's category is inspected against current user permissions.
   - If that category is OFF, the backend immediately halts and returns **HTTP 403 Forbidden**:
     ```json
     {
       "error": "Forbidden",
       "detail": "Access to category 'location' is disabled by privacy controls. (Event ID: ...)",
       "category": "location",
       "privacy_blocked": true
     }
     ```
   - An immutable audit log entry is written with `result: "DENIED"`.

---

## 📡 API Reference & Documentation

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

> **Postman Collection**: A ready-to-import Postman collection is included in [`chronis_postman_collection.json`](./chronis_postman_collection.json).

---

## 🗄️ Database Schema

Separated into 4 dedicated relational tables:

```sql
-- 1. Users Table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

-- 2. Permissions Table
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK(event_type IN ('conversation', 'location', 'physiological', 'note')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1)),
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, event_type)
);

-- 3. Events Table
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

-- 4. Audit Logs Table (Immutable & Append-Only)
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

## 🧪 Automated Testing

Automated test suite covers all requirements using `pytest`.

### Run Test Suite
```bash
pytest -v
```

### Verified Test Cases:
- ✅ **`test_create_event_success`**: Validates event ingestion and property storage.
- ✅ **`test_create_event_invalid_type`**: Rejects unsupported event types with HTTP 400.
- ✅ **`test_create_event_missing_fields`**: Rejects payloads lacking required fields.
- ✅ **`test_get_event_by_id`**: Fetches existing event with valid category.
- ✅ **`test_get_nonexistent_event`**: Returns HTTP 404 for missing IDs.
- ✅ **`test_delete_event`**: Deletes event and verifies subsequent lookups return 404.
- ✅ **`test_pagination`**: Validates `page`, `limit`, `total`, and `has_more` indicators.
- ✅ **`test_type_filtering`**: Validates filtering by specific categories.
- ✅ **`test_default_permissions_all_enabled`**: Validates all categories default to ON.
- ✅ **`test_enabled_category_is_returned`**: All enabled categories appear in timeline.
- ✅ **`test_disabled_category_is_not_returned_by_backend`**: Backend query filters out disabled categories.
- ✅ **`test_single_event_direct_fetch_blocked_403`**: Calling `GET /events/{id}` for a disabled category returns **HTTP 403 Forbidden** without content leakage.
- ✅ **`test_changing_permission_affects_later_requests`**: Dynamic toggle immediately updates data visibility.
- ✅ **`test_explicit_query_for_disabled_category_returns_empty`**: `GET /events?type=X` returns 0 records when X is OFF.
- ✅ **`test_audit_log_read_only`**: Rejects POST, PUT, DELETE to `/audit-log` with **HTTP 405 Method Not Allowed**.
- ✅ **`test_audit_log_recorded_on_create_event`**: Logs `CREATE_EVENT` on new event.
- ✅ **`test_audit_log_recorded_on_permission_change`**: Logs `UPDATE_PERMISSION` on toggle.
- ✅ **`test_audit_log_recorded_on_privacy_blocked_read`**: Logs `GET_EVENT` with result `DENIED` when access is blocked.
- ✅ **`test_audit_log_recorded_on_delete_event`**: Logs `DELETE_EVENT` upon deletion.
- ✅ **`test_multi_user_isolation`**: Verifies strict multi-tenant boundary between distinct users.

---

## 🎬 Demo Video Walkthrough Script

A 3–5 minute demo video can be recorded following this flow:

1. **Introduction (30s)**:
   - Introduce Chronis: Privacy-Aware Memory Timeline.
   - Show server running on `http://127.0.0.1:5000/`.
2. **Timeline & Event Creation (1m)**:
   - Show timeline displaying initial seeded events across all 4 categories (Conversation, Location, Physiological, Note).
   - Demonstrate the type filter chips (e.g. click "Location" to see only locations).
   - Click "➕ New Event" and create a new Location event (e.g. "Coffee Break at Blue Bottle"). Verify it appears immediately at the top of the timeline.
3. **Privacy Controls Demonstration (1.5m - Most Important)**:
   - Point to the Privacy Controls panel at the top.
   - Toggle the **Location** switch to **OFF**.
   - Show the timeline automatically refreshing: all location events immediately vanish from the UI.
   - Switch to the **Direct API Verifier** tab (or open terminal / curl):
     - Probe `GET /events/{id}` for the Location event.
     - Demonstrate that the backend returns **HTTP 403 Forbidden** with message: `"Access to category 'location' is disabled by privacy controls"`.
     - Highlight: *Data is NOT simply hidden in the frontend; the backend API rejects unauthorized retrieval.*
4. **Audit Log Inspection (30s)**:
   - Switch to the **Audit Log** tab.
   - Show the audit trail: highlight the `UPDATE_PERMISSION` entry (Location set to OFF) and the subsequent `GET_EVENT` entry marked as **`DENIED`** in red.
5. **Running Automated Tests (30s)**:
   - Switch to terminal and run `pytest -v`.
   - Show all 23 automated tests passing in ~1 second.

---

## 📝 Short Engineering Note

### 1. Where is authorization enforced and why?
**Enforcement Location:** Authorization is strictly enforced in the **backend application layer (Privacy Service & Event Repository)** prior to database reads and HTTP serialization.
- **For Collection Queries (`GET /events`)**: The authorization engine intercepts the request, looks up the user's active category permissions, and injects a parameterized `type IN (...)` clause directly into the SQL query. Disallowed categories are never loaded from disk into application memory or transmitted over the wire.
- **For Direct Lookups (`GET /events/{id}`)**: Before returning an event, `EventService` verifies whether the event's category is currently active in `permissions`. If disabled, it immediately aborts the transaction, logs a `DENIED` audit event, and raises an HTTP `403 Forbidden` exception.
- **Why**: Client-side filtering is fundamentally insecure—any malicious actor, compromised client, or third-party API integration can inspect HTTP response payloads or directly query the REST endpoints. Enforcing authorization at the backend query boundary guarantees zero data leakage, minimizes memory/network overhead, and maintains an immutable audit trail of every access decision.

### 2. What happens when a user requests data they are not allowed to see?
- **Collection Queries (`GET /events`)**: Disallowed event types are omitted from the results. If a user explicitly specifies a disabled type parameter (e.g., `GET /events?type=location` when location is OFF), the backend returns an empty list (`{"events": [], "total": 0}`) and records an audit log entry indicating the category filter was restricted.
- **Individual Event Access (`GET /events/{id}`)**: If an event belongs to a disabled category, the backend returns **HTTP 403 Forbidden** with an explicit error response:
  ```json
  {
    "error": "Forbidden",
    "detail": "Access to category 'location' is disabled by privacy controls. (Event ID: ...)",
    "category": "location",
    "privacy_blocked": true
  }
  ```
  The sensitive title, content, coordinates, and metadata are **never returned**. Crucially, this event triggers an immediate entry in the immutable `audit_logs` table with `action: "GET_EVENT"`, `event_type: "location"`, and `result: "DENIED"`.

### 3. What is one weakness that still exists in your implementation?
**Coarse Binary Category Granularity:**
The current model applies an all-or-nothing binary toggle per category. A user cannot grant conditional or contextual access—for instance:
- **Temporal constraints**: "Allow physiological data from the past 7 days, but hide older data."
- **Attribute-level redaction / Coarse precision**: Redacting exact GPS coordinates in location events while preserving city/neighborhood, or stripping sentiment analysis while retaining the title.
- **Audience / Purpose-based consent**: Permitting a healthcare professional to see physiological data while blocking third-party integrations from accessing it.

### 4. How would you change the system if it grew to 1 million events per user?
At $1,000,000$ events per user, SQLite single-file scans and offset-based pagination would suffer severe performance degradation. The following architectural evolutions would be made:
1. **Keyset (Cursor-Based) Pagination**:
   - Replace `LIMIT / OFFSET` (which requires scanning and discarding $N$ rows) with keyset pagination:
     ```sql
     SELECT * FROM events
     WHERE user_id = :uid AND (timestamp, id) < (:last_timestamp, :last_id)
     ORDER BY timestamp DESC, id DESC
     LIMIT 20;
     ```
   - This keeps page retrieval cost at $O(\log N)$ via index lookup regardless of depth.
2. **Database Partitioning & Time-Series Storage**:
   - Migrate to PostgreSQL or a time-series engine (e.g., TimescaleDB / ClickHouse) with declarative table partitioning by `(user_id, hash(user_id))` and sub-partitioning by month/quarter (`timestamp`).
3. **Composite B-Tree Indexes**:
   - Add composite indexes on `(user_id, type, timestamp DESC)`.
4. **Distributed Caching for Permissions**:
   - Cache user permission vectors in Redis with write-through invalidation on `PUT /permissions`. This prevents checking the database for permission state on every single timeline query.
5. **Asynchronous Audit Ingestion**:
   - Decouple audit logging from the read path using an event bus (e.g., Kafka / AWS SQS) and worker consumers. This eliminates synchronous database write latency from GET requests.

### 5. What would you improve with one additional day?
1. **Cryptographically Verifiable / Tamper-Evident Audit Chain**:
   - Implement hash-chained audit blocks (where each audit row stores `SHA-256(prev_hash + current_row_data)`). Any retroactive manipulation of audit rows would invalidate subsequent hashes, guaranteeing non-repudiation.
2. **Granular Time-Bounded & Redaction Policies**:
   - Allow users to set date-range boundaries (e.g., "Mute location tracking during weekends" or "Auto-archive notes older than 90 days").
3. **Full Authentication & Scoped API Tokens**:
   - Replace the demo user header with secure JWT / OAuth2 authentication supporting granular scopes (e.g., `events:read:physiological`, `events:write`).
4. **Database Migration Pipeline**:
   - Add Alembic database migrations to support seamless schema evolution without recreating tables.

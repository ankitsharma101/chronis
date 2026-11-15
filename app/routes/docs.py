from flask import Blueprint, jsonify, render_template_string

docs_bp = Blueprint("docs", __name__)

OPENAPI_SPEC = {
    "openapi": "3.0.3",
    "info": {
        "title": "Chronis Privacy-Aware Memory Timeline API",
        "version": "1.0.0",
        "description": "Backend API for managing personal memory events with category-level privacy controls and immutable audit logging.",
        "contact": {
            "name": "Chronis Engineering Team"
        }
    },
    "paths": {
        "/events": {
            "get": {
                "summary": "List memory events",
                "description": "Retrieve chronological events. Automatically excludes categories disabled by privacy controls.",
                "parameters": [
                    {
                        "name": "type",
                        "in": "query",
                        "description": "Filter by event category (conversation, location, physiological, note)",
                        "required": False,
                        "schema": {
                            "type": "string",
                            "enum": ["conversation", "location", "physiological", "note"]
                        }
                    },
                    {
                        "name": "page",
                        "in": "query",
                        "description": "Page number (1-indexed)",
                        "required": False,
                        "schema": {"type": "integer", "default": 1}
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "description": "Number of items per page (max 100)",
                        "required": False,
                        "schema": {"type": "integer", "default": 10}
                    },
                    {
                        "name": "X-User-Id",
                        "in": "header",
                        "description": "User identifier header (optional; defaults to user_demo)",
                        "required": False,
                        "schema": {"type": "string", "default": "user_demo"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "List of events returned successfully",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/EventListResponse"}
                            }
                        }
                    },
                    "400": {"description": "Invalid query parameters"}
                }
            },
            "post": {
                "summary": "Create memory event",
                "description": "Create a new event in the user's timeline.",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/EventCreate"}
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Event created",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/Event"}
                            }
                        }
                    },
                    "400": {"description": "Validation error or invalid payload"}
                }
            }
        },
        "/events/{id}": {
            "get": {
                "summary": "Get event by ID",
                "description": "Retrieve a single event. Enforces privacy permissions: returns 403 Forbidden if event's category is OFF.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "description": "Unique event ID",
                        "schema": {"type": "string"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Event retrieved",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/Event"}
                            }
                        }
                    },
                    "403": {
                        "description": "Forbidden - Category disabled by privacy settings"
                    },
                    "404": {
                        "description": "Event not found"
                    }
                }
            },
            "delete": {
                "summary": "Delete event by ID",
                "description": "Permanently delete an event from the timeline.",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "description": "Event ID to delete",
                        "schema": {"type": "string"}
                    }
                ],
                "responses": {
                    "200": {"description": "Event deleted successfully"},
                    "404": {"description": "Event not found"}
                }
            }
        },
        "/permissions": {
            "get": {
                "summary": "Get privacy permissions",
                "description": "Fetch the current ON/OFF status of the four event categories.",
                "responses": {
                    "200": {
                        "description": "Permissions retrieved",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/PermissionsResponse"}
                            }
                        }
                    }
                }
            },
            "put": {
                "summary": "Update privacy permissions",
                "description": "Toggle one or more categories ON or OFF.",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/PermissionsUpdate"}
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Permissions updated successfully",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/PermissionsResponse"}
                            }
                        }
                    },
                    "400": {"description": "Invalid permission payload"}
                }
            }
        },
        "/audit-log": {
            "get": {
                "summary": "Get audit logs",
                "description": "Retrieve immutable, read-only audit log records documenting data access and privacy updates.",
                "parameters": [
                    {
                        "name": "page",
                        "in": "query",
                        "schema": {"type": "integer", "default": 1}
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "schema": {"type": "integer", "default": 50}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Audit records retrieved",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AuditLogListResponse"}
                            }
                        }
                    }
                }
            }
        }
    },
    "components": {
        "schemas": {
            "Event": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "user_id": {"type": "string"},
                    "timestamp": {"type": "string", "format": "date-time"},
                    "type": {"type": "string", "enum": ["conversation", "location", "physiological", "note"]},
                    "title": {"type": "string"},
                    "content": {"type": "string"},
                    "created_at": {"type": "string", "format": "date-time"}
                },
                "required": ["id", "user_id", "timestamp", "type", "title", "content"]
            },
            "EventCreate": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "example": "Coffee with Alice"},
                    "content": {"type": "string", "example": "Discussed privacy architecture"},
                    "type": {"type": "string", "enum": ["conversation", "location", "physiological", "note"]},
                    "timestamp": {"type": "string", "format": "date-time", "example": "2026-11-15T10:00:00Z"},
                    "user_id": {"type": "string", "example": "user_demo"}
                },
                "required": ["title", "content", "type"]
            },
            "EventListResponse": {
                "type": "object",
                "properties": {
                    "events": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/Event"}
                    },
                    "total": {"type": "integer"},
                    "page": {"type": "integer"},
                    "limit": {"type": "integer"},
                    "has_more": {"type": "boolean"}
                }
            },
            "PermissionsUpdate": {
                "type": "object",
                "properties": {
                    "conversation": {"type": "boolean"},
                    "location": {"type": "boolean"},
                    "physiological": {"type": "boolean"},
                    "note": {"type": "boolean"}
                }
            },
            "PermissionsResponse": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "permissions": {
                        "type": "object",
                        "properties": {
                            "conversation": {"type": "boolean"},
                            "location": {"type": "boolean"},
                            "physiological": {"type": "boolean"},
                            "note": {"type": "boolean"}
                        }
                    }
                }
            },
            "AuditLogListResponse": {
                "type": "object",
                "properties": {
                    "audit_logs": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "integer"},
                                "timestamp": {"type": "string", "format": "date-time"},
                                "user_id": {"type": "string"},
                                "action": {"type": "string"},
                                "event_type": {"type": "string", "nullable": True},
                                "result": {"type": "string", "enum": ["ALLOWED", "DENIED", "SUCCESS", "ERROR"]},
                                "details": {"type": "string", "nullable": True}
                            }
                        }
                    },
                    "total": {"type": "integer"},
                    "page": {"type": "integer"},
                    "limit": {"type": "integer"}
                }
            }
        }
    }
}


@docs_bp.route("/openapi.json", methods=["GET"])
def openapi_json():
    """Return OpenAPI 3.0 specification."""
    return jsonify(OPENAPI_SPEC)


@docs_bp.route("/docs", methods=["GET"])
def swagger_ui():
    """Render interactive Swagger UI."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chronis API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏳</text></svg>">
  <style>
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none; }
    .swagger-ui .info { margin: 25px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        deepLinking: true
      });
    };
  </script>
</body>
</html>"""
    return render_template_string(html)

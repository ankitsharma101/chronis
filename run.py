#!/usr/bin/env python3
"""
Chronis — Privacy-Aware Memory Timeline Server
Main entry point.
"""
import os
from app import create_app
from app.config import Config

app = create_app(Config)

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")

    print("\n" + "=" * 60)
    print("⏳ CHRONIS - Privacy-Aware Memory Timeline Server")
    print("=" * 60)
    print(f" * Web Application UI:  http://{host}:{port}/")
    print(f" * Interactive Docs:     http://{host}:{port}/docs")
    print(f" * OpenAPI Schema:       http://{host}:{port}/openapi.json")
    print(f" * SQLite Database:      {app.config.get('DATABASE_PATH')}")
    print("=" * 60 + "\n")

    app.run(host=host, port=port, debug=debug)

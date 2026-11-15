from flask import Flask, render_template, jsonify
from flask_cors import CORS
from app.config import Config
from app.database import init_db, close_db
from app.routes.events import events_bp
from app.routes.permissions import permissions_bp
from app.routes.audit import audit_bp
from app.routes.docs import docs_bp


def create_app(config_class=Config) -> Flask:
    """Application factory for Chronis Backend & UI."""
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.from_object(config_class)

    # Enable CORS for API consumption
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Teardown database connections
    app.teardown_appcontext(close_db)

    # Initialize tables and seed defaults within app context
    with app.app_context():
        init_db(
            db_path=app.config.get("DATABASE_PATH"),
            seed_sample_data=not app.config.get("TESTING", False)
        )

    # Register blueprints
    app.register_blueprint(events_bp)
    app.register_blueprint(permissions_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(docs_bp)

    # Serve Single Page Application UI
    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    # Sensible JSON error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "BadRequest", "detail": str(e.description if hasattr(e, 'description') else e)}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "NotFound", "detail": "The requested endpoint or resource was not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "MethodNotAllowed", "detail": "The requested HTTP method is not allowed on this endpoint."}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "InternalServerError", "detail": "An unexpected server error occurred."}), 500

    return app

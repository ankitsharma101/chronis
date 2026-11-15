import os
import tempfile
import pytest
from app import create_app
from app.config import Config
from app.database import init_db


@pytest.fixture
def app_instance():
    """Create a temporary test app with an isolated SQLite database."""
    db_fd, db_path = tempfile.mkstemp(suffix=".sqlite3")

    class TestEnvironmentConfig(Config):
        TESTING = True
        DEBUG = False
        DATABASE_PATH = db_path
        DEFAULT_USER_ID = "test_user_1"
        DEFAULT_USER_NAME = "Test User"

    app = create_app(TestEnvironmentConfig)

    # Initialize empty tables without sample events
    with app.app_context():
        init_db(db_path=db_path, seed_sample_data=False)

    yield app

    os.close(db_fd)
    if os.path.exists(db_path):
        try:
            os.unlink(db_path)
        except PermissionError:
            pass


@pytest.fixture
def client(app_instance):
    """Test client for HTTP requests."""
    return app_instance.test_client()


@pytest.fixture
def auth_headers():
    """Headers identifying the test user."""
    return {
        "X-User-Id": "test_user_1",
        "Content-Type": "application/json"
    }

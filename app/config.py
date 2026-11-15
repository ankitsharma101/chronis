import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    """Base application configuration."""
    SECRET_KEY = os.getenv("SECRET_KEY", "chronis-dev-secret-key-change-in-prod")
    DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "user_demo")
    DEFAULT_USER_NAME = os.getenv("DEFAULT_USER_NAME", "Demo User")
    DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "chronis.db"))
    TESTING = False
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", "5000"))


class TestConfig(Config):
    """Configuration for testing with an isolated in-memory or temporary database."""
    TESTING = True
    DEBUG = False
    DATABASE_PATH = ":memory:"
    DEFAULT_USER_ID = "test_user"
    DEFAULT_USER_NAME = "Test User"

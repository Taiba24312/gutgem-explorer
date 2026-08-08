import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database", "gutgem.sqlite")

class Settings:
    PROJECT_NAME: str = "GutGEM Explorer API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    DATABASE_PATH: str = os.getenv("GUTGEM_DB_PATH", DB_PATH)
    CORS_ORIGINS: list = ["*"]
    REQUEST_TIMEOUT_SECONDS: float = 1.5

settings = Settings()

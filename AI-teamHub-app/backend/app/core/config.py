from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    SEED_ADMIN_PASSWORD: str
    COOKIE_SAMESITE: str = "strict"
    COOKIE_SECURE: bool = True  # Override with COOKIE_SECURE=false for local dev
    DB_ECHO: bool = False
    AI_TEAM_HOURLY_RATE: float = 75.0
    AI_ENABLED: bool = False          # safe default — app starts without API key
    ANTHROPIC_API_KEY: str = ""       # empty string when AI_ENABLED=false; pydantic-settings won't crash
    AI_MODEL: str = "claude-haiku-4-5"  # fastest/cheapest; overridable via env
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_BYTES: int = 10_485_760  # 10 MB
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    SEED_ADMIN_PASSWORD: str
    COOKIE_SAMESITE: str = "strict"
    COOKIE_SECURE: bool = False
    DB_ECHO: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

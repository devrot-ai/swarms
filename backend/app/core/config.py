from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite:///./swarms.db"

    # OpenAI
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.4"
    enable_llm: bool = False

    # Policy
    auto_approve: bool = True
    worker_policy: str = "allow_all"

    # JWT Authentication
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60


settings = Settings()

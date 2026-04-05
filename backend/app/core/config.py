from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite:///./swarms.db"

    # Redis and queues
    redis_url: str = "redis://localhost:6379/0"
    enable_redis: bool = False
    queue_name: str = "mission_tasks"

    # OpenAI
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.4"

    # Anthropic
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-7-sonnet-latest"

    # Local model endpoint (Ollama compatible)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"

    # Encryption for user-provided keys
    api_key_encryption_secret: str = "dev-only-change-me-32bytes-minimum"

    enable_llm: bool = False

    # Policy
    auto_approve: bool = True
    worker_policy: str = "allow_all"

    # JWT Authentication
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60


settings = Settings()

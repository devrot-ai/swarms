from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./swarms.db"
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.4"
    enable_llm: bool = False
    auto_approve: bool = True
    worker_policy: str = "allow_all"

settings = Settings()

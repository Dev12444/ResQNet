"""App settings loaded from environment / .env. Owner: BE1."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./resqnet.db"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"  # fastest; eval: 100% type acc on 50-report set
    # Tried when the primary model is overloaded (503/429) or unavailable.
    gemini_fallback_model: str = "gemini-3.6-flash"
    # "minimal" | "low" | "" (model default). Lower = faster; ignored by models that don't support it.
    gemini_thinking_level: str = "minimal"
    gemini_embed_model: str = "gemini-embedding-001"
    ai_enabled: bool = True

    telegram_bot_token: str = ""
    telegram_authority_chat_id: str = ""
    telegram_responder_chat_id: str = ""

    cors_origins: str = "http://localhost:3000"

    sla_p1_dispatch_sec: int = 120
    sla_p2_dispatch_sec: int = 300
    sla_no_update_sec: int = 600
    escalation_tick_sec: int = 15

    @property
    def ai_available(self) -> bool:
        return self.ai_enabled and bool(self.gemini_api_key)

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""App settings loaded from environment / .env. Owner: BE1."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./resqnet.db"

    # BE2: AI providers, tried in this order (then rule-based fallback). Comma-separated: openai, gemini.
    llm_providers: str = "openai,gemini"
    # Gemini embeddings first: OpenAI's score EN↔Gujarati duplicates ~0.1 cosine (see dedup.THRESHOLDS).
    embed_providers: str = "gemini,openai"

    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_fallback_model: str = "gpt-4.1-nano"   # comma-separated list allowed
    openai_embed_model: str = "text-embedding-3-small"
    openai_reasoning_effort: str = "minimal"      # only sent to reasoning models (gpt-5*, o*)
    openai_rpm: int = 300
    # Hard stop for OpenAI spend (estimated from token usage) — protects the $10 credit. 0 = no cap.
    openai_budget_usd: float = 8.0

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"  # fastest; eval: 100% type acc on 50-report set
    # Tried in order when the primary is overloaded (503), rate-limited (429) or out of daily quota.
    # Comma-separated; each model has its OWN free-tier quota, so more models = more capacity.
    gemini_fallback_model: str = "gemini-3.1-flash-lite,gemini-3.6-flash"
    # Client-side pacing per model (free tier is ~15 RPM for flash-lite; lower if you still see 429s).
    gemini_rpm: int = 12
    # "minimal" | "low" | "" (model default). Lower = faster; ignored by models that don't support it.
    gemini_thinking_level: str = "minimal"
    gemini_embed_model: str = "gemini-embedding-001"
    ai_enabled: bool = True
    # BE2: persistent AI cache (relative to backend/). Empty string disables it.
    llm_cache_path: str = ".cache/llm_cache.sqlite3"

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
        return self.ai_enabled and bool(self.openai_api_key or self.gemini_api_key)

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str = "EcoWatt ML"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    DATABASE_URL: str = "sqlite:///./ecowatt.db"

    MODEL_DIR: str = "ml/saved_models"
    DEFAULT_FORECAST_MODEL: str = "hist_gradient_boosting"
    ANOMALY_CONTAMINATION: float = 0.04
    ANOMALY_SCORE_THRESHOLD: float = 0.70

    DEFAULT_CURRENCY: str = "USD"
    DEFAULT_CURRENCY_SYMBOL: str = "$"
    DEFAULT_FIXED_CHARGE: float = 15.00
    DEFAULT_TAX_RATE: float = 0.07
    DEFAULT_SURCHARGE: float = 0.03

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

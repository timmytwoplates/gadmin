from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    log_format: str = "pretty"

    gam_path: str = r"C:\GAM7\gam.exe"
    db_path: str = "data/gadmin.db"

    @property
    def db_file(self) -> Path:
        p = Path(self.db_path)
        return p if p.is_absolute() else _ROOT / p

    @property
    def logs_dir(self) -> Path:
        return _ROOT / "logs"

    @property
    def data_dir(self) -> Path:
        return _ROOT / "data"

    def ensure_dirs(self):
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()

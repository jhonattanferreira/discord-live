import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    discord_bot_token: str
    text_channel_id: int
    # Vazio = monitora todos os canais de voz
    voice_channel_ids: frozenset[int]
    google_credentials_file: str
    google_token_file: str


def load_config() -> Config:
    load_dotenv()

    token = os.getenv("DISCORD_BOT_TOKEN", "").strip()
    text_channel_id = os.getenv("DISCORD_TEXT_CHANNEL_ID", "").strip()
    if not token:
        raise SystemExit("DISCORD_BOT_TOKEN não definido no .env")
    if not text_channel_id.isdigit():
        raise SystemExit("DISCORD_TEXT_CHANNEL_ID ausente ou inválido no .env")

    raw_voice_ids = os.getenv("DISCORD_VOICE_CHANNEL_IDS", "")
    voice_ids = frozenset(int(v) for v in raw_voice_ids.split(",") if v.strip())

    return Config(
        discord_bot_token=token,
        text_channel_id=int(text_channel_id),
        voice_channel_ids=voice_ids,
        google_credentials_file=os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json"),
        google_token_file=os.getenv("GOOGLE_TOKEN_FILE", "token.json"),
    )

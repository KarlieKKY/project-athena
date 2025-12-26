from pydantic import BaseSettings

class Settings(BaseSettings):
    model_name: str = "htdemucs"
    audio_extensions: list = ["mp3", "wav", "ogg", "flac"]
    output_format: str = "mp3"
    mp3_rate: int = 320
    float32: bool = False
    int24: bool = False
    input_audio_path: str = "music/input_audio.mp3"
    output_audio_path: str = "music/output_audio/"

    class Config:
        env_file = ".env"

settings = Settings()
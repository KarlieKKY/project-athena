import torch
from demucs import pretrained
from demucs.audio import AudioFile, save_audio
from pathlib import Path

def load_model(model_name="htdemucs", device='cpu'):
    model = pretrained.get_model(model_name)
    model.to(device)
    return model

def load_audio(in_path, model):
    wav = AudioFile(in_path).read(
        streams=0,
        samplerate=model.samplerate,
        channels=model.audio_channels
    )
    return wav

def normalize_audio(wav):
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()
    return wav, ref

def denormalize_audio(sources, ref):
    return sources * ref.std() + ref.mean()

def save_separated_audio(sources, stems, out_path, mp3=True, mp3_rate=320, float32=False, int24=False):
    out_path = Path(out_path)
    out_path.mkdir(parents=True, exist_ok=True)

    for source, name in zip(sources, stems):
        stem_path = out_path / f"{name}"
        save_audio(
            source,
            str(stem_path) + (".mp3" if mp3 else ".wav"),
            samplerate=model.samplerate,
            bitrate=mp3_rate if mp3 else None,
            clip='rescale',
            as_float=float32,
            bits_per_sample=24 if int24 else None
        )
        print(f"Saved: {stem_path}")
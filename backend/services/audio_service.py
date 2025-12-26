from demucs import pretrained
from demucs.apply import apply_model
from demucs.audio import AudioFile, save_audio
import torch
from pathlib import Path

class AudioService:
    def __init__(self, model_name="htdemucs", device='cpu'):
        self.model_name = model_name
        self.device = device
        self.model = self.load_model()

    def load_model(self):
        model = pretrained.get_model(self.model_name)
        model.to(self.device)
        return model

    def process_audio(self, in_path, out_path, two_stems=None, mp3=True, mp3_rate=320, float32=False, int24=False):
        wav = AudioFile(in_path).read(
            streams=0,
            samplerate=self.model.samplerate,
            channels=self.model.audio_channels
        )

        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()

        with torch.no_grad():
            sources = apply_model(self.model, wav[None].to(self.device), device=self.device)[0]
        sources = sources.cpu()

        sources = sources * ref.std() + ref.mean()

        stems = [two_stems, f"no_{two_stems}"] if two_stems else self.model.sources

        out_path = Path(out_path)
        out_path.mkdir(parents=True, exist_ok=True)

        result_paths = []
        for source, name in zip(sources, stems):
            extension = ".mp3" if mp3 else ".wav"
            stem_path = out_path / f"{Path(in_path).stem}_{name}{extension}"
            save_audio(
                source,
                str(stem_path),
                samplerate=self.model.samplerate,
                bitrate=mp3_rate if mp3 else None,
                clip='rescale',
                as_float=float32,
                bits_per_sample=24 if int24 else None
            )
            result_paths.append(str(stem_path))
            print(f"Saved: {stem_path}")
        
        return result_paths
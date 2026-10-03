import json, os, sys
from dataclasses import asdict
from pathlib import Path

SPLITTER = Path(os.environ.get("ATL_SPLITTER_ROOT", r"D:\Projects\Audio Album Splitter AI"))
sys.path.insert(0, str(SPLITTER))

from core.audio_info import read_audio_info
from core.audio.source_timeline import AudioSource
from core.audio.source_preview import build_source_preview
from core.analysis.streaming_source_analyzer import StreamingSourceAnalyzer

def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: analyze-upload.py <audio-file>")
    filepath = os.path.abspath(sys.argv[1])
    info = read_audio_info(filepath)
    source = AudioSource.from_metadata(info)
    result = StreamingSourceAnalyzer().analyze_source(source)
    preview = build_source_preview(source)
    payload = {
        "source_id": source.source_id,
        "filename": source.filename,
        "duration": source.duration,
        "sample_rate": source.sample_rate,
        "channels": source.channels,
        "total_samples": source.total_samples,
        "detections": [
            {"frame": d.frame, "time": d.time, "confidence": d.confidence, "source": d.source}
            for d in result.detections
        ],
        "level_diagnostics": asdict(result.level_diagnostics) if result.level_diagnostics is not None else None,
        "waveform": {
            "minimum": preview.minimum.tolist(),
            "maximum": preview.maximum.tolist(),
        },
    }
    print(json.dumps(payload, ensure_ascii=False))

if __name__ == "__main__":
    main()

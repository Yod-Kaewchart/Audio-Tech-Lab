import json, os, sys
from pathlib import Path

SPLITTER = Path(os.environ.get("ATL_SPLITTER_ROOT", r"D:\Projects\Audio Album Splitter AI"))
sys.path.insert(0, str(SPLITTER))

from core.audio.qc import analyze_audio_qc

def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: audio-qc-upload.py <audio-file>")
    filepath = os.path.abspath(sys.argv[1])
    result = analyze_audio_qc(filepath, repo_root=SPLITTER)
    fmt, loudness, overall = result.format, result.loudness, result.overall
    payload = {
        "format": {"container_format": fmt.container_format, "codec_name": fmt.codec_name, "sample_rate": fmt.sample_rate, "bit_depth": fmt.bit_depth, "channels": fmt.channels, "channel_layout": fmt.channel_layout, "duration": fmt.duration, "sample_format": fmt.sample_format},
        "loudness": {"integrated_lufs": loudness.integrated_lufs, "loudness_range_lu": loudness.loudness_range_lu, "true_peak_dbtp": loudness.true_peak_dbtp, "threshold_lufs": loudness.threshold_lufs},
        "overall": {"dc_offset": overall.dc_offset, "peak_dbfs": overall.peak_dbfs, "rms_dbfs": overall.rms_dbfs, "sample_count": overall.sample_count, "nan_count": overall.nan_count, "inf_count": overall.inf_count, "denormal_count": overall.denormal_count},
        "channels": [{"channel": c.channel, "dc_offset": c.dc_offset, "peak_dbfs": c.peak_dbfs, "rms_dbfs": c.rms_dbfs, "dynamic_range_db": c.dynamic_range_db, "nan_count": c.nan_count, "inf_count": c.inf_count, "denormal_count": c.denormal_count} for c in result.channels],
    }
    print(json.dumps(payload, ensure_ascii=False))

if __name__ == "__main__":
    main()

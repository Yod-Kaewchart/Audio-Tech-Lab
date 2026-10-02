import json, math, os, subprocess, sys
from pathlib import Path

SPLITTER = Path(os.environ.get("ATL_SPLITTER_ROOT", r"D:\Projects\Audio Album Splitter AI"))
sys.path.insert(0, str(SPLITTER))

from core.audio_info import read_audio_info
from core.export.ffmpeg_locator import resolve_ffmpeg_executable

def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage: preview-upload.py <audio-file> <preview-root> <file-id>")
    source = Path(sys.argv[1]).resolve()
    preview_root = Path(sys.argv[2]).resolve()
    file_id = sys.argv[3]
    request = json.loads(sys.stdin.read() or "{}")
    preview_root.mkdir(parents=True, exist_ok=True)
    output = preview_root / (file_id + ".flac")
    if output.exists() and output.is_file() and output.stat().st_size > 0:
        print(json.dumps({"name": output.name, "size": output.stat().st_size, "cached": True}))
        return
    budget = request.get("maxOutputBytes")
    info = read_audio_info(str(source))
    duration = float(info["duration"])
    sr = int(info["sample_rate"])
    channels = int(info["channel_count"])
    if not info.get("metadata_valid") or not math.isfinite(duration) or duration <= 0:
        raise SystemExit("Invalid audio metadata")
    estimate = math.ceil(duration * sr * channels * 4) + 65536
    if not isinstance(budget, int) or budget <= 0 or estimate > budget:
        raise SystemExit(22)
    temp = preview_root / (file_id + ".flac.part")
    temp.unlink(missing_ok=True)
    ffmpeg = resolve_ffmpeg_executable(repo_root=SPLITTER)
    try:
        proc = subprocess.run([
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-i", str(source),
            "-map", "0:a:0", "-vn", "-sn", "-dn", "-map_metadata", "-1",
            "-c:a", "flac", "-compression_level", "5", "-f", "flac", "-y", str(temp)
        ], capture_output=True, text=True)
        if proc.returncode or not temp.exists() or temp.stat().st_size <= 0:
            raise RuntimeError("Preview conversion failed")
        os.replace(temp, output)
        print(json.dumps({"name": output.name, "size": output.stat().st_size, "cached": False}))
    finally:
        temp.unlink(missing_ok=True)

if __name__ == "__main__":
    main()

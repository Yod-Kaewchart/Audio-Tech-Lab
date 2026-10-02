"""Generate lossless fixtures and verify downloaded PCM on the backend host."""
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
import subprocess
import numpy as np
import soundfile as sf
sys.path.insert(0, os.environ["ATL_SPLITTER_ROOT"])
from core.export.ffmpeg_locator import resolve_ffmpeg_executable
parser = argparse.ArgumentParser()
parser.add_argument("mode", choices=("create", "create-long", "compare", "fingerprint"))
parser.add_argument("files", nargs="+")
args = parser.parse_args()
ffmpeg = str(resolve_ffmpeg_executable())
def pcm(file):
    proc = subprocess.run([ffmpeg, "-v", "error", "-i", str(file), "-map", "0:a:0", "-f", "s32le", "-acodec", "pcm_s32le", "-"], capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype="<i4").reshape(-1, 2)
if args.mode == "create":
    root = Path(args.files[0])
    root.mkdir(parents=True, exist_ok=True)
    rate, count = 48000, 576017
    t = np.arange(count, dtype=np.float64) / rate
    frequency = np.where(t < 5, 440, np.where(t < 10, 880, 220))
    amplitude = np.where(((t >= 4) & (t < 5)) | ((t >= 9) & (t < 10)), 0, 0.2)
    audio = np.column_stack((amplitude * np.sin(2 * np.pi * frequency * t), amplitude * np.cos(2 * np.pi * frequency * t)))
    wav = root / "fixture.wav"
    sf.write(wav, audio, rate, subtype="PCM_24")
    for name, codec in (("fixture.flac", "flac"), ("fixture.m4a", "alac")):
        subprocess.run([ffmpeg, "-v", "error", "-y", "-i", str(wav), "-c:a", codec, str(root / name)], check=True)
    print(json.dumps({"rate": rate, "frames": count, "channels": 2, "bits": 24}))
elif args.mode == "create-long":
    output, seconds = args.files
    subprocess.run([ffmpeg, "-v", "error", "-y", "-f", "lavfi", "-i",
                    "aevalsrc=0.18*sin(2*PI*440*t)|0.14*sin(2*PI*880*t):s=48000:d=" + seconds,
                    "-c:a", "flac", "-sample_fmt", "s32", output], check=True)
    print(json.dumps({"rate": 48000, "frames": int(seconds) * 48000, "channels": 2, "bits": 24}))
elif args.mode == "fingerprint":
    digest, count = hashlib.sha256(), 0
    for file in args.files:
        with subprocess.Popen([ffmpeg, "-v", "error", "-i", file, "-map", "0:a:0",
                               "-f", "s32le", "-acodec", "pcm_s32le", "-"], stdout=subprocess.PIPE) as proc:
            while chunk := proc.stdout.read(1024 * 1024):
                digest.update(chunk)
                count += len(chunk)
            if proc.wait():
                raise SystemExit("PCM decode failed")
    print(json.dumps({"frames": count // 8, "sha256": digest.hexdigest()}))
else:
    expected = pcm(args.files[0])
    actual = np.concatenate([pcm(file) for file in args.files[1:]], axis=0)
    if not np.array_equal(expected, actual):
        raise SystemExit("PCM mismatch: expected %s, actual %s" % (expected.shape, actual.shape))
    print(json.dumps({"frames": len(actual), "pcmExact": True}))

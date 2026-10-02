import json, math, os, shutil, sys, uuid
from pathlib import Path

SPLITTER=Path(os.environ.get("ATL_SPLITTER_ROOT", r"D:\Projects\Audio Album Splitter AI"))
sys.path.insert(0,str(SPLITTER))
from core.audio_info import BIT_DEPTH_BY_SUBTYPE, read_audio_info
from core.export.codecs import flac_bits_for_source_subtype, wav_codec_for_source_subtype
from core.export.batch_exporter import BatchExporter
from core.export.batch_models import BatchExportRequest, BatchTrack, ExportSource
from core.export.ffmpeg_locator import resolve_ffmpeg_executable
from core.export.models import TargetFormat

def estimate_output_bytes(info, fmt, track_count):
    source = ExportSource.from_metadata(info)
    if fmt is TargetFormat.WAV:
        wav_codec_for_source_subtype(source.source_subtype)
        bits = BIT_DEPTH_BY_SUBTYPE[source.source_subtype]
    else:
        bits = flac_bits_for_source_subtype(source.source_subtype)
    # Allow at least 32-bit PCM per sample, FLAC overhead and track headers.
    # WAV DOUBLE still reserves 64-bit PCM; the 4 GB policy is unchanged.
    width = max(4, (bits + 7) // 8)
    return source.total_samples * int(info["channel_count"]) * width + track_count * 65536

def main():
    source_path=Path(sys.argv[1]).resolve()
    export_root=Path(sys.argv[2]).resolve()
    request=json.loads(sys.stdin.read())
    fmt=TargetFormat(str(request["format"]).lower())
    boundaries=sorted(float(x) for x in request.get("boundaries",[]))
    info=read_audio_info(str(source_path))
    duration=float(info["duration"])
    boundaries=[x for x in boundaries if 0<x<duration]
    budget=request.get("maxOutputBytes")
    # An already-running older Node process can still invoke this bridge during
    # an in-place upgrade. Keep it usable until restart, with a disk safety floor.
    if budget is None:
        budget=min(4_000_000_000, max(0, shutil.disk_usage(export_root).free-5_000_000_000))
    # Bound expansion using the codec selected by the lossless export core.
    if not info.get("metadata_valid") or duration <= 0 or not math.isfinite(duration):
        raise SystemExit("Invalid audio metadata")
    estimate=estimate_output_bytes(info, fmt, len(boundaries)+1)
    if not isinstance(budget, int) or budget <= 0 or estimate > budget:
        raise SystemExit(22)  # Recognized by the process runner; no private paths in the response.
    starts=[0.0,*boundaries]; ends=[*boundaries,duration]
    tracks=tuple(BatchTrack(i+1,f"Track {i+1:02d}",start,end) for i,(start,end) in enumerate(zip(starts,ends)))
    job_id=str(uuid.UUID(request["jobId"])) if request.get("jobId") else str(uuid.uuid4())
    output_dir=export_root/job_id
    output_dir.mkdir(parents=True,exist_ok=False)
    batch=BatchExportRequest(source=ExportSource.from_metadata(info),tracks=tracks,output_dir=output_dir,target_format=fmt,overwrite=False)
    result=BatchExporter().export(request=batch,ffmpeg_executable=resolve_ffmpeg_executable(repo_root=SPLITTER))
    files=[{"name":item.output_path.name,"size":item.output_path.stat().st_size} for item in result.items if item.status.value=="success"]
    print(json.dumps({"jobId":job_id,"success":result.success_count,"failed":result.failed_count,"files":files}))

if __name__=="__main__":
    main()

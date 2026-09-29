import json, os, sys, uuid
from pathlib import Path

SPLITTER=Path(r"D:\Projects\Audio Album Splitter AI")
sys.path.insert(0,str(SPLITTER))
from core.audio_info import read_audio_info
from core.export.batch_exporter import BatchExporter
from core.export.batch_models import BatchExportRequest, BatchTrack, ExportSource
from core.export.ffmpeg_locator import resolve_ffmpeg_executable
from core.export.models import TargetFormat

def main():
    source_path=Path(sys.argv[1]).resolve()
    export_root=Path(sys.argv[2]).resolve()
    request=json.loads(sys.stdin.read())
    fmt=TargetFormat(str(request["format"]).lower())
    boundaries=sorted(float(x) for x in request.get("boundaries",[]))
    info=read_audio_info(str(source_path))
    duration=float(info["duration"])
    boundaries=[x for x in boundaries if 0<x<duration]
    starts=[0.0,*boundaries]; ends=[*boundaries,duration]
    tracks=tuple(BatchTrack(i+1,f"Track {i+1:02d}",start,end) for i,(start,end) in enumerate(zip(starts,ends)))
    job_id=str(uuid.uuid4())
    output_dir=export_root/job_id
    output_dir.mkdir(parents=True,exist_ok=False)
    batch=BatchExportRequest(source=ExportSource.from_metadata(info),tracks=tracks,output_dir=output_dir,target_format=fmt,overwrite=False)
    result=BatchExporter().export(request=batch,ffmpeg_executable=resolve_ffmpeg_executable(repo_root=SPLITTER))
    files=[{"name":item.output_path.name,"size":item.output_path.stat().st_size} for item in result.items if item.status.value=="success"]
    print(json.dumps({"jobId":job_id,"success":result.success_count,"failed":result.failed_count,"files":files}))

if __name__=="__main__":
    main()

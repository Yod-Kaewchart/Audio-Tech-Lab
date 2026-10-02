import json, math, os, shutil, subprocess, sys, uuid
from pathlib import Path

SPLITTER=Path(os.environ.get("ATL_SPLITTER_ROOT", r"D:\Projects\Audio Album Splitter AI"))
sys.path.insert(0,str(SPLITTER))
from core.audio_info import read_audio_info
from core.export.ffmpeg_locator import resolve_ffmpeg_executable

def safe_name(value):
    name="".join(c if c not in '<>:"/\\|?*\x00' and ord(c)>=32 else "_" for c in str(value)).strip(" .")
    return (name[:140] or "Merged Album")

def main():
    if len(sys.argv)<4:
        raise SystemExit("Merge requires at least two audio files")
    sources=[Path(x).resolve() for x in sys.argv[1:-1]]
    export_root=Path(sys.argv[-1]).resolve()
    request=json.loads(sys.stdin.read() or "{}")
    fmt=str(request.get("format","flac")).lower()
    if fmt not in {"wav","flac"}:
        raise SystemExit("Unsupported output format")
    infos=[read_audio_info(str(p)) for p in sources]
    if any(not x.get("metadata_valid") for x in infos):
        raise SystemExit("Invalid audio metadata")
    def signature(x):
        return (int(x["sample_rate"]),int(x["channel_count"]),int(x.get("bits_per_sample") or x.get("bit_depth") or 0))
    signatures=[signature(x) for x in infos]
    if any(s != signatures[0] for s in signatures[1:]):
        raise SystemExit("Audio formats do not match. Sample rate, channels and bit depth must be identical")
    duration=sum(float(x["duration"]) for x in infos)
    if not math.isfinite(duration) or duration<=0:
        raise SystemExit("Invalid audio duration")
    budget=request.get("maxOutputBytes")
    if budget is None:
        budget=min(4_000_000_000,max(0,shutil.disk_usage(export_root).free-5_000_000_000))
    sr,ch,bits=signatures[0]
    estimate=math.ceil(duration*sr*ch*max(bits,24)/8)+65536
    if not isinstance(budget,int) or budget<=0 or estimate>budget:
        raise SystemExit(22)
    job_id=str(uuid.UUID(request["jobId"])) if request.get("jobId") else str(uuid.uuid4())
    out_dir=export_root/job_id
    out_dir.mkdir(parents=True,exist_ok=False)
    name=safe_name(request.get("name","Merged Album"))+"."+fmt
    output=out_dir/name
    try:
        inputs=[]
        filters=[]
        for index, source in enumerate(sources):
            inputs.extend(["-i", str(source)])
            filters.append(f"[{index}:a:0]asetpts=PTS-STARTPTS[a{index}]")
        labels="".join(f"[a{index}]" for index in range(len(sources)))
        filters.append(labels+f"concat=n={len(sources)}:v=0:a=1[out]")
        ffmpeg=resolve_ffmpeg_executable(repo_root=SPLITTER)
        codec="flac" if fmt=="flac" else ("pcm_s16le" if bits<=16 else "pcm_s24le" if bits<=24 else "pcm_s32le")
        proc=subprocess.run([str(ffmpeg),"-hide_banner","-loglevel","error",*inputs,"-filter_complex",";".join(filters),"-map","[out]","-map_metadata","-1","-c:a",codec,str(output)],capture_output=True,text=True)
        if proc.returncode:
            raise RuntimeError("FFmpeg merge failed")
        if not output.exists() or output.stat().st_size<=0:
            raise RuntimeError("Merge output was not created")
        print(json.dumps({"jobId":job_id,"files":[{"name":output.name,"size":output.stat().st_size}],"tracks":len(sources),"duration":duration}))
    except Exception:
        shutil.rmtree(out_dir,ignore_errors=True)
        raise

if __name__=="__main__":
    main()

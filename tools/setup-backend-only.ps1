param([string]$SplitterRoot = 'D:\Projects\Audio Album Splitter AI')
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$environment = Join-Path $SplitterRoot '.venv-backend'
$python = Join-Path $environment 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    & py -3.12 -m venv $environment
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Python 3.12 backend environment' }
}
& $python -m pip install -r (Join-Path $project 'server\requirements-backend.txt')
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed' }
& $python -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency check failed' }
$env:ATL_SPLITTER_ROOT = $SplitterRoot
$env:ATL_AUDIO_PYTHON = $python
Push-Location -LiteralPath $SplitterRoot
try {
    & $python -c "import importlib.util; from core.analysis.streaming_source_analyzer import StreamingSourceAnalyzer; from core.audio.qc import analyze_audio_qc; from core.export.batch_exporter import BatchExporter; from core.export.ffmpeg_locator import resolve_ffmpeg_executable, resolve_ffprobe_executable; assert all(importlib.util.find_spec(m) is None for m in ('PySide6', 'pyqtgraph', 'sounddevice', 'pyaudio')); print(resolve_ffmpeg_executable()); print(resolve_ffprobe_executable())"
    if ($LASTEXITCODE -ne 0) { throw 'Backend imports, GUI isolation, or FFmpeg preflight failed' }
} finally {
    Pop-Location
}
Write-Output 'Backend-only environment ready. Start with node tools/start-backend-only.cjs'

# Web Demo checkpoint: 2 October 2026

Checkpoint tag: `checkpoint/web-demo-20261002-history-audit`
Previous source tag: `rollback/web-demo-before-20261002`

This checkpoint includes Audio QC, browser lossless previews, file Remove controls,
Merge playback/removal improvements, and file-bound user history with a separate admin-only audit API.
The Activity Log user interface is deferred.

Validation: 44 backend/deployment tests passed, including real Analyze/QC/Export.
The runtime uses Node 24.21.0; audit/history storage requires built-in node:sqlite.
Python audio workers also require the existing Audio Album Splitter AI environment on Modify.

Local recovery material is under `tools/runtime/checkpoint-20261002-0416/`:
the source before commit, archived .bak files, a security state snapshot, an SQLite snapshot,
and a Git bundle. Runtime state, credentials and audio files are excluded from Git.

To inspect a source recovery point without overwriting this branch:
`git switch -c recovery/web-demo checkpoint/web-demo-20261002-history-audit`
For the earlier source, use `rollback/web-demo-before-20261002` instead.

Before applying a live rollback, finish queued/running jobs and stop the backend through its supervisor.
Preserve current audit data and accounts; a source rollback does not restore expired audio.
Restore runtime snapshots only if state recovery is also necessary, after preserving newer state.
The old source does not provide the new Audio QC/Preview/History behavior.

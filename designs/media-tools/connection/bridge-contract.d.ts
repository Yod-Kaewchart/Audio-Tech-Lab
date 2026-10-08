/** Design contract only: no preload, IPC handler or executable runner is implemented. */
export type Mode = 'download' | 'convert';
export type OpaqueId = string;
export type ErrorCode =
  | 'UNAVAILABLE' | 'DEPENDENCY_MISSING' | 'DEPENDENCY_INVALID'
  | 'UNSUPPORTED_SOURCE' | 'INVALID_REQUEST' | 'STALE_SOURCE'
  | 'CANCELLED_SELECTION' | 'ACCESS_DENIED' | 'NO_SPACE' | 'FILE_MISSING'
  | 'BUSY' | 'NETWORK_FAILED' | 'ENCODING_FAILED' | 'PROBE_FAILED'
  | 'CLEANUP_REQUIRED' | 'INTERRUPTED';
export type Reply<T> = { ok: true; value: T } | {
  ok: false; error: { code: ErrorCode; message: string; retryable: boolean };
};
export interface ToolStatus {
  installed: boolean;
  verified: boolean;
  version: string | null;
  reason: string | null;
}
export interface Capabilities {
  contractVersion: 1;
  execution: 'user-computer';
  tools: Record<'ytDlp' | 'ffmpeg' | 'ffprobe' | 'jsRuntime' | 'processHelper', ToolStatus>;
  downloadReady: boolean;
  convertReady: boolean;
  downloadProviders: string[];
}
export interface AudioMetadata {
  durationSeconds: number | null;
  bytes: number | null;
  codec: string | null;
  container: string | null;
  sampleRateHz: number | null;
  bitsPerSample: number | null;
  channels: number | null;
}
export interface Source {
  sourceId: OpaqueId;
  mode: Mode;
  displayName: string;
  metadata: AudioMetadata;
  /** Native registry expiry; changed URL or file identity invalidates this token. */
  validUntil: string;
}
export interface Destination {
  folderId: OpaqueId;
  displayPath: string;
  writable: boolean;
  freeBytes: number | null;
}
export type Encoding =
  | { format: 'original' }
  | { format: 'mp3'; bitrateKbps: 128 | 192 | 256 | 320 }
  | { format: 'wav' | 'flac' | 'alac'; sampleRateHz: 'source' | 44100 | 48000; bitsPerSample: 16 | 24 };
export type JobStatus =
  | 'starting' | 'running' | 'cancelling'
  | 'succeeded' | 'failed' | 'cancelled' | 'interrupted' | 'cleanup-required';
export type Stage = 'inspecting' | 'downloading' | 'probing-input'
  | 'converting' | 'probing-output' | 'saving' | 'stopping' | 'complete';
export interface Progress {
  stage: Stage;
  /** Null means indeterminate, not zero. Percent is per-stage, not overall success. */
  stagePercent: number | null;
  bytesDownloaded: number | null;
  totalBytes: number | null;
  processedSeconds: number | null;
  durationSeconds: number | null;
}
export interface Output {
  resultId: OpaqueId;
  fileName: string;
  displayPath: string;
  metadata: AudioMetadata;
  /** No source/download URL, shell command or raw executable arguments. */
  available: boolean;
}
export interface JobSnapshot {
  jobId: OpaqueId;
  sequence: number;
  mode: Mode;
  status: JobStatus;
  progress: Progress;
  sourceName: string;
  destinationDisplayPath: string;
  encoding: Encoding;
  output: Output | null;
  error: { code: ErrorCode; message: string; retryable: boolean } | null;
}
export interface StartRequest {
  sourceId: OpaqueId;
  folderId: OpaqueId;
  /** Native idempotency key: reuse returns same job, never another spawn. */
  requestId: OpaqueId;
  encoding: Encoding;
}
export interface LocalMediaBridge {
  getCapabilities(): Promise<Reply<Capabilities>>;
  /** User action: native paste into the focused, enabled Download URL field only. */
  pasteSourceUrl(): Promise<Reply<{ accepted: boolean }>>;
  chooseInputFile(): Promise<Reply<Source | null>>;
  chooseOutputDirectory(): Promise<Reply<Destination | null>>;
  inspectUrl(request: { requestId: OpaqueId; url: string }): Promise<Reply<Source>>;
  cancelInspection(request: { requestId: OpaqueId }): Promise<Reply<{ stopped: boolean }>>;
  /** Original is accepted only for mode=download, after native validation. */
  startDownload(request: StartRequest): Promise<Reply<JobSnapshot>>;
  startConvert(request: Omit<StartRequest, 'encoding'> & {
    encoding: Exclude<Encoding, { format: 'original' }>;
  }): Promise<Reply<JobSnapshot>>;
  /** Shared across pages; refresh after event subscription to resolve reload races. */
  getCurrentJob(): Promise<Reply<JobSnapshot | null>>;
  /** Accepted means cancellation requested. Wait for terminal event before unlocking. */
  cancelJob(request: { jobId: OpaqueId }): Promise<Reply<{ accepted: boolean }>>;
  openResult(request: {
    resultId: OpaqueId; target: 'file' | 'folder';
  }): Promise<Reply<{ opened: boolean }>>;
  /** The preload copies DTOs only, never exposes IpcRendererEvent or ipcRenderer. */
  subscribeJob(listener: (snapshot: JobSnapshot) => void): () => void;
}
declare global {
  interface Window {
    /** Absent in ordinary browser preview. Never silently treat simulation as native. */
    localMedia?: LocalMediaBridge;
  }
}

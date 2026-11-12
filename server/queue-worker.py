"""Run one audio bridge and keep all of its Windows child processes in one job."""
import ctypes
from ctypes import wintypes
import json
import os
import runpy
import sys
import time


def protect_process_tree():
    if os.name != "nt":
        return None
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    class Basic(ctypes.Structure):
        _fields_ = [("ProcessTime", ctypes.c_longlong), ("JobTime", ctypes.c_longlong),
                    ("Flags", wintypes.DWORD), ("MinWS", ctypes.c_size_t), ("MaxWS", ctypes.c_size_t),
                    ("ActiveProcesses", wintypes.DWORD), ("Affinity", ctypes.c_size_t),
                    ("Priority", wintypes.DWORD), ("Scheduling", wintypes.DWORD)]
    class IO(ctypes.Structure):
        _fields_ = [(name, ctypes.c_ulonglong) for name in ("ReadOps", "WriteOps", "OtherOps", "ReadBytes", "WriteBytes", "OtherBytes")]
    class Extended(ctypes.Structure):
        _fields_ = [("Basic", Basic), ("IO", IO), ("ProcessMemory", ctypes.c_size_t),
                    ("JobMemory", ctypes.c_size_t), ("PeakProcessMemory", ctypes.c_size_t), ("PeakJobMemory", ctypes.c_size_t)]
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel.SetInformationJobObject.restype = wintypes.BOOL
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.AssignProcessToJobObject.restype = wintypes.BOOL
    handle = kernel.CreateJobObjectW(None, None)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    limits = Extended()
    limits.Basic.Flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel.SetInformationJobObject(handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
        raise ctypes.WinError(ctypes.get_last_error())
    if not kernel.AssignProcessToJobObject(handle, kernel.GetCurrentProcess()):
        raise ctypes.WinError(ctypes.get_last_error())
    # Keep this non-inheritable handle open until process exit; the kernel then
    # stops remaining FFmpeg descendants, including on abnormal worker exit.
    return handle


def wait_for_start_marker():
    marker = os.environ.get("ATL_WORKER_MARKER")
    token = sys._xoptions.get("atl_worker")
    if not marker or not token or len(sys.argv) < 3:
        raise SystemExit("Worker start marker is unavailable")
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        try:
            with open(marker, "r", encoding="utf-8") as handle:
                record = json.load(handle)
        except FileNotFoundError:
            time.sleep(0.025)
            continue
        expected = {
            "pid": os.getpid(),
            "token": token,
            "worker": os.path.abspath(__file__),
            "script": sys.argv[1],
            "source": sys.argv[2],
        }
        if any(record.get(key) != value for key, value in expected.items()):
            raise SystemExit("Worker start marker does not match this process")
        return
    raise SystemExit("Worker start marker was not committed before the deadline")


if __name__ == "__main__":
    _job_handle = protect_process_tree()
    wait_for_start_marker()
    if len(sys.argv) < 3:
        raise SystemExit("usage: queue-worker.py <bridge> <audio> [export-root]")
    bridge = os.path.abspath(sys.argv[1])
    sys.argv = sys.argv[1:]
    sys.path.insert(0, os.path.dirname(bridge))
    runpy.run_path(bridge, run_name="__main__")

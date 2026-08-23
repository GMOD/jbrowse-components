---
name: does-a-sixth-alignments-track-want-a-sixth-rpc-worker
description: one `workerCount` line to try; the answer is a memory measurement, not a stopwatch
metadata:
  area: RPC, limits
  category: measure-first
---

# Does a sixth alignments track want a sixth RPC worker

`WebWorkerRpcDriver` sizes its pool `clamp(detectHardwareConcurrency() - 1, 1,
5)` and `rpcSessionId` is per-track, so tracks round-robin — which puts two of a
six-track session's tracks on one worker. Raising the ceiling is one line through
the `workerCount` config slot, which already overrides the hardware default.

The reason it is not obviously right is **memory, not speed**: each worker holds
its own BAM chunk caches and its own bgzf pool, so a sixth worker is a sixth copy
of both. That makes this the same measurement as
[BGZF_WORKER_POOL.md](../reference/BGZF_WORKER_POOL.md) and
[ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)'s per-context entry
rather than a stopwatch — and wasm memory is outside `Runtime.getHeapUsage`, so
it wants process-level RSS per target.

Do not reach for a wall-clock A/B first. Tracks do **not** serialise on one RPC
worker (the pool round-robins on a per-track `rpcSessionId`), and every RPC
worker profiles 100% idle through a six-track pan, so there is no queueing for
more workers to relieve.

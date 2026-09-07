---
name: raise-the-rpc-worker-ceiling-so-a-sixth-alignments-track
description: Raise the RPC worker ceiling so a sixth alignments track gets a sixth worker
area: performance-and-measurement
---

# Raise the RPC worker ceiling so a sixth alignments track gets a sixth worker

declined 2026-08-25: the contention it would relieve was measured
not to exist. `WebWorkerRpcDriver` sizes its pool
`clamp(detectHardwareConcurrency() - 1, 1, 5)` and `rpcSessionId` is
per-track, so a six-track session puts two tracks on one worker — but tracks
do not serialise there, and every RPC worker profiles 100% idle through a
six-track pan, so there is no queue for a sixth worker to drain. The cost side
is real and one-directional: each worker holds its own BAM chunk caches and
its own bgzf pool, so a sixth is a sixth copy of both (see
`ideas/give-the-rpc-workers-one-inflate-pool-and-one-byte-cache-between-them`,
which is where the memory question lives). A reader who wants more workers already
has the lever — the `workerCount` config slot overrides the hardware default —
so nothing is owed but the default, and the default is right.

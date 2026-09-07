---
name: moving-maf-s-instance-packing-to-the-worker
description: Moving MAF's instance packing to the worker
area: performance-and-measurement
---

# Moving MAF's instance packing to the worker

costed 2026-08-24 alongside
wiggle's, which stays alive in `ideas/zoom-perf-followups.md`. MAF's pack is
126ms and looks like the same opportunity. It is not: its `zoomFetchKey` is
empty by design, so it deliberately does not refetch on zoom and re-encodes on
the main thread instead, and its pack depends on `binBp` (a power-of-two tier
off `coarseBpPerPx`) and on the palette. Worker-side packing would turn every
zoom-tier crossing and every theme flip into a full refetch at ~31ms/region
(`reference/MAF_WORKER_PIPELINE.md`). It re-encodes precisely because there is
no RPC to ride along on. **Reopen only if** MAF gains a real
`zoomFetchKey`.

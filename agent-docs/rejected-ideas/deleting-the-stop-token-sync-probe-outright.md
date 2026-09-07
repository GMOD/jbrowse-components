---
name: deleting-the-stop-token-sync-probe-outright
description: Deleting the stop-token sync probe outright
area: performance-and-measurement
---

# Deleting the stop-token sync probe outright

the published plan, declined
2026-08-24 in favour of an opt-in `syncProbe` (see
`ideas/zoom-perf-followups.md`). The plan was: chunk the six await-free worker
loops that need a synchronous cancellation check, then delete `probeBlobUrl`,
the blob, `createObjectURL` and the revoke, collecting a measured ~100ms a
gesture.

Its premise is false in the one place that matters. There are ~27
probe-dependent sites, not six, and `clusterMatrix.ts:67` is not a loop at all
— it is a `checkCancellation` callback invoked from inside a synchronous
`@gmod/hclust` WASM call, where no `await` can be inserted at any stride. All
three cluster executors funnel through it. Ship the deletion on that plan and
Cancel on a large dendrogram does nothing for minutes, silently, and jsdom
cannot see it because `probeBlobUrl` is inert there. **Reopen only** with the
cancel measurement that has never existed: an await-free workload cancelled
mid-flight, probe on vs off.

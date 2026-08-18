---
name: screenshot-perf
description:
  Why heavy screenshot specs take minutes (software rasterization, not app code),
  how that was established, and what is still open. Read before "optimizing" a
  slow figure or raising its timeouts.
audience: internal
---

# Slow figures are SwiftShader, not the app

The tcga specs took 190-230s each to become ready. **None of that was app code.**
`--use-angle=gl` (or `--headed`, which uses the real GPU) renders the same figure
in **14.1s** — ~15x faster — and `--check` then reports **0.000%** drift between
two renders where software raster needed `diffThreshold: 0.02`.

`generate-screenshots` launches Chrome with `--enable-unsafe-swiftshader`, so
every WebGL draw is rasterized on the CPU. For a figure with 1104 rows and 379k
features across 23 regions at 1900px/dSF2, one draw takes seconds.

## The measurements (2026-07-25, `tcga/cohort_cnv_genome`)

Everything JS-visible is small:

| | measured |
| --- | --- |
| worker JS CPU | 17.6s |
| main-thread JS CPU | 2.2s |
| network | 2.1s (18 requests, 5.8MB; whole file downloads in 0.7s) |
| `postMessage` (structured clone) | 0.15s / 406 calls |
| `checkStopToken` sync-XHR probes | 0.3s / 143 probes (~2ms each) |
| `@gmod/hclust` clustering | 0.4s |
| GC | ~1s |
| **accounted** | **~36s of ~200s** |

Chrome `Tracing` found the rest:

| thread | toplevel busy | tasks | longest |
| --- | --- | --- | --- |
| `CrRendererMain` | 181.2s | 4579 | 26,015ms |
| `CrGpuMain` | 179.4s | 537 | 26,010ms |
| `DedicatedWorker thread` | 0.4s | 1178 | 114ms |

~10 renderer tasks of 3.6-26s, **each mirrored to the millisecond by a GPU-process
task** — the renderer blocking synchronously on software rasterization.

## Methodology: "idle" in a JS profile means look outside JS

A sampling JS profiler only sees JS. Both threads reported ~99% idle because the
cost was in the GPU process with the renderer blocked in a sync IPC wait. Four
plausible JS-level explanations were each measured and **refuted** before the
right tool was used:

- stop-token sync-XHR fallback (`checkStopToken`) — 0.3s, and forcing the
  `SharedArrayBuffer` path changed nothing (cancellation now travels by posted
  message; the sync probe remains, throttled, for loops that never yield)
- structured clone of `featureNames` / `featureIds` (the two non-transferable
  string arrays in `packMultiRowFeatures`) — `postMessage` totals 0.15s
- Chrome background/timer throttling and IPC flood protection — the anti-throttling
  flags made no difference (185s vs 190-210s)
- RPC serialization — 24 calls are dispatched in one tick and RPC is in flight for
  96% of the wall clock, with only ~3s between calls

**When wall clock >> JS CPU on every thread, stop forming JS hypotheses.** Go to
`website/scripts/trace-tasks.ts`; a renderer task mirrored by a GPU task is
blocked-on-GPU.

## Tools (all added 2026-07-25, `website/scripts/`)

- `profile-spec.ts <spec>` — CPU-profiles any spec's cold load, main thread and
  every RPC worker, with a milestone timeline (domcontentloaded → view
  initialized → fetch+parse done → painted → readySelector) and per-file network
  attribution. `--angle-gl` renders on the GPU, `--sab` force-enables
  SharedArrayBuffer.
- `trace-rpc.ts <spec>` — wraps `Worker.postMessage` and the reply channel in the
  page (no app changes, runs the built bundle) for per-method RPC call counts and
  durations, plus worker-side accounting of sync XHR, `fetch`, `postMessage` and
  **event-loop lag**. A dead heartbeat means the thread is blocked, not idle.
- `trace-tasks.ts <spec>` — Chrome-level task trace: which thread ran what, and
  the biggest slices. The tool of last resort, and the one that answered this.

## Regenerating a slow figure

Use `--headed` on a machine with a display (`xvfb-run` works too). Capture
geometry is unaffected: `setViewport` sets emulated device metrics and the CDP
screenshot uses those, so dSF 2 still yields the same pixel dimensions no matter
the window size. Don't reach for bigger timeouts first — that treats software
raster as a fact of life.

## Still open

- **~10 full-canvas GPU passes per figure**, one per arriving RPC reply, each
  re-rasterizing all 1104 rows. Real app-side waste for large multi-region views,
  independent of which rasterizer runs it; `trace-tasks.ts` measures it. Batching
  the per-region replies (or debouncing the instance-buffer rebuild until the
  region set settles) is the fix.
- **Whether hardware GL should be the default.** No CI job runs
  `generate-screenshots`, so figures are only regenerated locally — low risk for
  CI, but the appearance differs from SwiftShader (27.8% on the cohort figure), so
  the switch rewrites every committed PNG once and diverges between maintainer
  machines with and without a GPU. `tcga/cohort_cnv_genome.png` is currently the
  only GPU-rendered figure. A per-spec `hardwareGl?: true` opt-in is the
  lower-risk shape.
- **`tcga/cnv_recurrence_genome` at viewportHeight > 860** still dies with "frame
  got detached". Unexamined since this investigation; now suspect the same
  software-raster path (a taller canvas for the same 1104 auto-fit rows), which
  would make it a harness artifact rather than a renderer bug.
- The spec comment claiming clustering costs "three minutes of RPC" was wrong
  (0.4s) and has been corrected; `screenshot-review.json`'s note on
  `cnv_recurrence_genome` still blames the blank frame solely on the height crash,
  when a cold-assembly race was a second, independent cause (fixed by
  `data-view-phase`, see `waitForViewPhases`).

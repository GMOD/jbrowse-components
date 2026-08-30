---
name: zoom-perf
description: Why zoom is the worse of the two gestures on the GPU path, and what it is actually bound by. Covers the label A/B that looked like a win and was a measurement artifact. Of the two targets it names, createObjectURL was sized and declined 2026-08-30 (8 mints a gesture, so the frame is not the mint) and the per-frame component count was attacked with the render census — see zoom-perf-followups.
---

# Zoom is worse than pan, and labels are not the reason

Wheel-driven zoom on the GPU path, 4 tracks:

┌───────────────────────┬─────────┬────────────────┐
│                       │   pan   │      zoom      │
├───────────────────────┼─────────┼────────────────┤
│ page frames in ~4.8 s │     279 │ 152 (31.7 fps) │
├───────────────────────┼─────────┼────────────────┤
│ p90 frame interval    │ 16.7 ms │        66.7 ms │
├───────────────────────┼─────────┼────────────────┤
│ dropped frames        │      65 │            140 │
├───────────────────────┼─────────┼────────────────┤
│ tasks > 50 ms         │       1 │             16 │
└───────────────────────┴─────────┴────────────────┘

Main thread is 95–100% busy in every bin across the whole gesture.

The label A/B on zoom comes out flat

My first zoom A/B looked like a big label win. It was an artifact: the two arms swept different bpPerPx ranges (1.1–1.9 vs 0.6–3.0), so they rendered different amounts of detail. The rate limiter is per elapsed-ms and my turnaround read bpPerPx back, so the slower arm both applied less zoom per event and flipped direction later.

Re-run with a scripted geometric ramp — both arms now report an identical sequence (36.0 2.67 1.76 1.16 0.766 0.505 0.750 1.14 1.72 2.61):

┌──────────────────────────┬───────────┬────────────┐
│ scripted zoom, same ramp │ labels on │ labels off │
├──────────────────────────┼───────────┼────────────┤
│ style recalc             │    700 ms │     751 ms │
├──────────────────────────┼───────────┼────────────┤
│ layout                   │    236 ms │     236 ms │
├──────────────────────────┼───────────┼────────────┤
│ page frames              │       244 │        256 │
├──────────────────────────┼───────────┼────────────┤
│ main busy                │   5422 ms │    5230 ms │
└──────────────────────────┴───────────┴────────────┘

Layout is identical, style recalc is higher with labels off — i.e. inside noise. The container-transform fix helps pan and will do nothing measurable for zoom.

What zoom is actually bound by

Self time, consistent across every 1200 ms bin:

- react-dom-client:1273 ≈ 178 ms and :1254 ≈ 143 ms — React's DOM attribute/property setters, plus setAttribute on top. This is the "too many components re-render per frame" residual your INTERACTION_PERF notes keep landing on, and it's the top cost.
- createObjectURL ≈ 91 ms — the stop-token blob URLs. Your own doc flagged this: one shared Blob retired the constrRL was left "unchanged at ~100 ms and still the substantial cost". It's still there.
- Style recalc 700–750 ms of a 4.8 s gesture (~15%), all (no stack) lifecycle recalcs, plus @emotion/serialize recurring in the long tasks — the CSS-in-JS per-render tax.
- Genuine relayout (GranularRectLayout.addRect), which a zoom legitimately owes.

One lead I'd chase but won't claim yet: the wheel-driven arm books 2158 ms in rAF callbacks against the scripted armount of applied zoom. That points at the wheel controller / zoom spring rather than at rendering. The two runsdidn't cover the same range, so it needs a proper comparison before it means anything.

So, revised

The label container transform is still worth doing — it's a clean pan win with
a11y intact. But it's a pan fix, and zoom is the worse of the two gestures. Zoom
needs a separate attack, and its two named targets are createObjectURL on the
stop-token path and cutting the per-frame component count.

## Both of those were taken up 2026-08-30, and only one survived

- **createObjectURL is not the mint.** A 20-frame zoom over four tracks mints 8
  stop tokens, counted two ways, which puts a registry insert nowhere near the
  ~91ms booked here. Declined in
  [reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md); the count is
  `products/jbrowse-web/src/tests/ZoomStopTokenMints.test.tsx`. Whatever the
  sampler is folding into that frame — plausibly the revoke or the GC of revoked
  entries — is unattributed, and the design that was written against it buys
  none of it.

- **The per-frame component count now has an instrument**, and it is neither a
  flame graph nor React DevTools: a `mobx.spy` render census in jsdom. Three
  fixes came out of pointing it at this list, the largest being a padding
  overlay every track re-rendered per frame to draw nothing.
  [zoom-perf-followups.md](zoom-perf-followups.md) has what it found;
  [reference/INTERACTION_PERF.md](../reference/INTERACTION_PERF.md) has the
  instrument and its limits.

The wheel-arm rAF lead above is still unclaimed, and still needs the
matched-range comparison it asks for before its 2158 ms means anything.

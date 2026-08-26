---
name: capture-stability-by-frame-agreement
description: A rare few-percent cross-backend drift looks like a compositor serving a stale frame, and the obvious answer — shoot the targeted canvas until two consecutive frames agree byte-for-byte — is written and measured on branch `wip-capture-stability`. The theory survived the measurement and the fix did not: the arms that came back clean cannot be affected by what they changed. Settling it needs several hundred runs per arm, or an attack on the compositor rather than on the retry.
---

# Shoot until two frames agree — measured, and not proven

Branch **`wip-capture-stability`** (`ab3d2d3bce`), one commit, no worktree. It is
parked on purpose. **Do not resume it without new evidence**, and read the
commit message before re-deriving any of this — it carries the run tables.

## The failure it is aimed at

Every wait in `waitForCaptureSettled` reads model or DOM state, and none of them
says the *compositor* has presented the settled frame. Both `el.screenshot()`
and `page.screenshot()` serve composited layers, so a capture can come back
holding an earlier frame — blank in the extreme, which `canvasSelfReport`
already names ("canvas 1210x542 HAS content while the screenshot is blank"), or
the settled drawing at a stale offset, which reads as a whole-image few-percent
drift with the model byte-identical on both sides.

The cross-backend gate reported exactly that on `dotplot-default`: a fixed 4.26%
about one run in thirty, on CI and locally, every vertical gridline moved 5px
with no row displaced. Waiting on `phase=ready` does not touch it (45 runs).

## Why the measurement does not support the fix

Drift counts on `dotplot default session`, 60 runs per config unless noted:

| arm | drift |
| --- | --- |
| control (45 runs) | 1 (run 25, 4.26%/3.19%) |
| targeted + fullpage stability | 0 |
| targeted + fullpage stability | 0 |
| targeted only | 1 (run 57, 4.26%/3.18%) |

**Stabilizing the *fullpage* capture cannot affect the targeted number.**
`dualSnapshot` shoots targeted first, `recordCapture` feeds the gate per-name
from each capture's own bytes, and the backends run in separate browsers. So the
two clean arms are the two that changed nothing on the axis being counted, and
0/120 against 1/60 is chance rather than mechanism. At a ~1-in-30 base rate,
P(0 in 60) is about 0.14 — two clean sweeps is weak evidence.

Settling it needs several hundred runs per arm, or an attack on the compositor
directly rather than by retry.

## Two by-products worth not re-deriving

Both were measured on the way and hold regardless of what happens to the retry:

- **Holding an element handle across shots hits `Node is detached from
  document`** — 4 of 60 runs. That is the hazard that reverted `28c6ee6d90`, so
  `shoot` re-queries rather than caching a handle.
- **Pixel stability is the wrong stopping rule for `pageSnapshot`.** An
  alignments page keeps mutating after its model settles, so stability stops each
  backend at a different moment: `fullpage_alignments-bam` went 0.00% to 7.54%
  cross-backend while its targeted canvas stayed at 0.00%. `pageSnapshot` is back
  to one shot.

## An attack on the compositor directly: measured, and it separated

"Or an attack on the compositor directly rather than by retry" is no longer
hypothetical, and it did not need several hundred runs. Every wait this thread
had tried asks the *app* whether it has finished; an `IntersectionObserver`
callback is queued from inside update-the-rendering, so awaiting one asks the
*browser* whether it has produced a frame. Three capture paths alternating on one
settled canvas2d page (`browser-tests/probe-capture-barrier.ts`): `el.screenshot`
3/15 then 0/25 blank, a bare clip 5/15 then 6/25, the clip behind that barrier
**0/15 and 0/25**. `captureElementPng` takes the third.

That is one page and one backend, so it does not close the blank captures — but
it is the first arm in this thread that separated from its controls, and it costs
one frame rather than the two rAF round trips that made the double-rAF version
unaffordable. **Re-measure the retry against a tree that already has the barrier
before spending several hundred runs on it**; the base rate this idea's power
calculation assumes may no longer be the base rate.

The by-product above is the same phenomenon seen from the other side: the handle
detaches because the display *swaps its canvas element*, measured at 100% of
captures on a pileup — `isConnected` false afterwards while
`document.querySelector` still finds one canvas at the same rect. Read geometry
through the selector, never through a cached handle.

Related: [../reference/SCREENSHOT_CAPTURE_RACE.md](../reference/SCREENSHOT_CAPTURE_RACE.md),
whose "The third one" was a *different* drift with a settled attribution — app
chrome composited in after `el.screenshot()` scrolled the element — and is fixed;
and the backlog's
[render webgpu in the blocking gate job](../todo/render-webgpu-in-the-blocking-cross-backend-gate-job.md),
which is what that fix left over.

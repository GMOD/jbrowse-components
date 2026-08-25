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

Related: [../reference/SCREENSHOT_CAPTURE_RACE.md](../reference/SCREENSHOT_CAPTURE_RACE.md)
and the backlog's
[make the capture scroll-invariant](../todo/make-the-snapshot-capture-scroll-invariant-then-widen-the-gate-to-webgpu.md),
which is a *different* drift with a settled attribution — that one is app chrome
composited in after `el.screenshot()` scrolled the element, and is fixable in
`snapshot.ts`.

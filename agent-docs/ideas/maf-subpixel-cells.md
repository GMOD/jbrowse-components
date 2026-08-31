---
name: maf-subpixel-cells
description: Measured 2026-08-31, and no floor wins — the GPU floor moves with the monitor and over-states fragmented runs 2.3x against a supersampled ground truth, while the no-floor rule matches that truth at both dprs; what remains is landing it, and the Canvas2D over-paint it exposed is [[maf-canvas2d-overpaints-the-match-tone]].
---

# What a sub-pixel MAF cell should look like

`rowRect.slang` is drawn by two renderers, and they feed its `viewportWidth`
uniform in different units. That uniform is only ever the denominator of
`extendToMinWidthX`, so it is exactly the minimum cell width:

| renderer | uniform | min cell width |
| --- | --- | --- |
| multi-row features | `clip.scissorW` (CSS px) | 1 CSS px |
| MAF | `clip.pxW` (device px) | 1 device px — **0.5 CSS px at dpr 2** |
| MAF Canvas2D (`drawMafBlocks`) | — | none; natural sub-pixel width |

MAF cells are run-merged, so a sub-pixel cell means "this run is shorter than a
pixel" — the normal case for a multiple alignment at any interesting zoom, not
an edge one. The question this file used to park was which of three rules the
sub-pixel case should get: today's GPU floor at alpha 1, no floor, or a floor
with span-proportional alpha.

## Measured 2026-08-31: no floor wins, at both dprs

The capture the previous version of this doc asked for was run: the MAF
suite's `ctgA:1-4000` volvox view (~3.25 bp/px, `binBp` 1, every base
sub-pixel) on a real GPU (ANGLE Metal, WebGL2, `antialias: true`), all three
candidates from one build via a runtime uniform switch, at deviceScaleFactor 1
and 2. The judgment call the doc predicted turned out to be avoidable: the
no-floor rule shot at dpr 4 — where a 1-bp cell is over a device pixel, so
nothing is floored away — and box-downsampled is a **ground truth**, and
distance from it is a number.

| dpr-1 render | dist. from truth | mean chroma (truth 10.64) | cross-dpr drift |
| --- | --- | --- | --- |
| no floor | **4.31** | 11.23 | **3.67** |
| floor + span alpha | 5.53 | 9.63 | 4.63 |
| today's GPU floor | 15.05 | 24.97 | 11.41 |
| Canvas2D as shipped | 26.58 | 19.98 | 6.02 |

- **Today's floor over-states exactly as predicted**: 2.3x the honest colour
  ink, and *more* hard edges than the truth (101,831 vs 90,835) because
  widened cells overwrite each other. At dpr 2 it draws 39% less colour than
  at dpr 1 — the display genuinely depends on the reader's monitor.
- **No floor is indistinguishable from the truth** and is the most dpr-stable
  rule measured, the shipped Canvas2D path included.
- **Floor + span alpha washes out**, as the `sizeAlpha` analysis below warned:
  it recovers most of the over-statement but blurs the column structure, and
  its geometry still moves with the monitor.

**The predicted MSAA problem did not happen.** The worry was that 4x MSAA
quantises a sub-pixel cell's coverage onto 0 or 1 sample positions. Adjacent
no-floor cells are non-overlapping primitives, so each writes its own samples
and the resolve averages them; nothing dropped out. That concern is closed.

**The Canvas2D path is furthest from the truth, and the floor is not why** —
it over-paints for a reason of its own (translucent match tone stacked ~2.3x
per pixel by the per-cell overdraw pad). That is a separate defect no floor
choice can close: [[maf-canvas2d-overpaints-the-match-tone]].

Captures, crops, ground-truth images, `analysis.json` and the probe scripts
from the run are session artifacts (2026-08-31); the method above is enough to
re-run it, and the probes were written against
`products/jbrowse-web/browser-tests`' existing MAF suite.

## What remains

Land the no-floor rule: MAF's GPU path stops flooring instead of re-uniting
the two backends on a floor neither should have. The earlier warning here
against the standalone `clip.pxW` → `clip.scissorW` swap is thereby moot — the
swap raised the floor, and the answer is that the floor goes. Removing it
fixes the dpr-dependence in the same change. Before landing, eyeball the
crops (the decision is quantitatively one-sided, but the doc's original point
stands: what a multiple alignment should look like deserves one look), then
re-capture the committed figures that show MAF.

## Why `sizeAlpha` was never the answer, kept for the record

The floor+alpha shape is what `plugins/alignments` ships
(`alignmentsUniforms.slang`), and it is deliberately indels-only there: a
mismatch is a point event whose whole value is being visible when a screen
holds more bases than pixels. A MAF cell is per-base identity — the mismatch
analogue — and `sizeAlpha` exists to give back the ink a *widened* mark took,
so applying it to a cell drawn at natural width double-counts the narrowness.
The measurement above agrees: the wash-out is visible in the numbers.

---
status: Accepted
summary: "The variant display's `cell` and `matrixCell` passes go back to the 4x MSAA target and draw rows at fractional y. Snapped to the device grid at one sample, a cohort with more rows than device px, or rows under the cell pass's 2 CSS px floor, showed one row per pixel, the last one drawn, and a different one after every resize, so rows blinked as the track height changed. x stays snapped. Canvas2D, the SVG export and the hit tests keep `rowSnap`, having no samples to blend. The cost is the MSAA target, about 16 bytes per device px of canvas. Amended the same day: `spanMark` (MAF, the multi-row mark display) drew at four samples with snapped rows, which blinked the same way under a fit-to-height MAF, and now places its rows at fractional y too"
---

# ADR-256: Variant rows draw at fractional y on four samples

## Status

Accepted (2026-10-31), Colin's call after seeing rows blink on resize in the
one-sample build.

## Context

- On 2026-10-30 both variant passes declared `//! coverage: analytic` and
  snapped row edges to the device grid (`rowSnap.slang`), so the display drew at
  one sample and allocated no MSAA target. The handoff had named the trade:
  four samples blend up to four rows in a pixel, one sample shows one.
- **Snapped rows blink on resize.** Where rows share a pixel (rows under one
  device px, or the cell pass's 2 CSS px floor overlapping the rows below), the
  last row drawn takes the whole pixel. A resize moves each row's snapped top by
  whole pixels at different moments, so a different row wins, and rows appear
  and vanish.
- **Measured.** A CPU model of a 400-row cohort resized 1 px at a time, rows
  0.375–2.5 CSS px, 15% alt cells drawn after reference: rows flipping between
  visible and hidden per step, snapped at one sample against fractional at four:
  matrix 35.3 / 1.3 at dpr 1 and 6.1 / 0.6 at dpr 2; cell 31.8 / 2.2 at dpr 1.
  Drawing the real WGSL through `scripts/gpu-pixels` as a resize slit-scan shows
  the same: snapped rows break into dashes, fractional rows run smooth. Rows at
  least a device px tall that do not overlap (the matrix at dpr 2) only step by
  whole pixels, and do not blink.

## Decision

- **Both passes drop `//! coverage: analytic`** and draw on the 4x target. Rows
  sit at `row * rowHeight - scrollTop`, `drawnCellHeightPx` tall.
- **x stays on the device grid** (`snapCellEdgePx`, `matrixCell`'s pixel-centre
  columns); only rows changed.
- **Canvas2D, the SVG export and both hit tests keep `rowSnap`.** Canvas2D has
  no samples to blend, and its `fillRect` at fractional y seams every row
  boundary. A GPU row top sits within half a device px of the snapped one the
  hit test reads.
- `matrixCell` loses its `devicePixelRatio` uniform, which only rows read.
  `variantPassCoverage.test.ts` pins both passes at four samples and their
  vertex stages free of `snappedRowTopPx`.

## Rejected

- **Blend sub-pixel rows by coverage at one sample.** OVER compositing turns
  two rows meeting mid-pixel into alpha 0.75, and n rows of coverage 1/n into
  1 − (1 − 1/n)ⁿ, about 0.63, so a dense cohort fades and the background shows
  through.
- **Weight each row by its draw position in the pixel** (alpha 1/k makes OVER an
  exact average). Cells draw reference before alt (`computeVariantCells.ts`), so
  a cell cannot know its position among the rows sharing its pixel.
- **Switch to four samples only when rows go sub-pixel.** The sample count is
  fixed when the backend is created (`deriveSampleCount`), and the row height
  changes after.

## Consequences

- **The MSAA target is back** for variant tracks: about 16 bytes per device px
  of canvas, data or not. A 1500x500 CSS px track at dpr 2 holds about 46 MiB;
  the 1266x4090 CSS px one measured in
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md) held 340 MiB.
  A track scrolled out of the page still hands its target back.
- The Canvas2D fallback still snaps, so it still blinks on resize.
- A row boundary pixel blends two genotype colors again, as before 2026-10-30.
- The `variant-*` pixel fixtures score against fractional rows and carry no
  one-sample budget.

## Amendment (2026-10-31): span rows

- `spanMark` already drew at four samples but placed its rows through
  `rowRectClipPosOnDeviceRows`, on the device grid, so all four samples agreed
  and blended nothing. A MAF fitted to height keeps sub-pixel rows by design
  (`autoRowHeight`: more species than pixels), and the same resize slit-scan
  showed its colored rows dashing on and off.
- It now places rows through `rowRectClipPos`, at fractional y, and drops its
  `devicePixelRatio` uniform; `rowRectClipPosOnDeviceRows` had no other caller
  and is gone. Its Canvas2D painter keeps `rowSnap`, as the variant painters do.
  `markPassCoverage.test.ts` pins the vertex stage free of `snappedRowTopPx`.

## Revisit if

- Rows are averaged into device-px bins before upload, one color per pixel row
  from all the rows it covers. That draws the blend MSAA gives, at one sample,
  and without the four-row limit.

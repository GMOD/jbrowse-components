---
name: per-base-wall-at-wide-zoom
description: The sub-pixel bin that bounded the per-base wall changed what `perBaseLetter` looks like — vivid stripes where the pre-bin blend was muddy olive — and left the 1bp cell exactly one octave of headroom, so a fast multi-octave zoom-in stripes the wall until the refetch lands. The per-window histogram was measured and declined, because the honest aggregate over a 16-512 bp window is one mud colour; a zoom threshold is the answer to the first, and a per-instance span the bin wide is the answer to the second and the enabling step for run-merged cells. Read before changing `subPixelBinBp`, `pileupCellX` or `pileupCellWidth`.
audience: internal
---

# What a per-base wall should look like at wide zoom

Background, and every number quoted here:
[reference/PER_BASE_SUBPIXEL_BIN.md](../../reference/PER_BASE_SUBPIXEL_BIN.md). In
short — the bin took the worker's per-base extract from 30.5M entries and 2.0 GB
to 59.6k and 6.7 MB on a 1 Mb pacbio pileup, and at short-read depth it is the
difference between drawing and an OOM. It also changed the picture in one of the
two modes, which nobody predicted and no test could have caught.

**Nothing below is built.** Two questions. The histogram that looked like the
answer to both was measured on 2026-09-17 and declined; what survives of it is
the span, which answers the second.

## Question one: lettering over-states confidence now

`perBaseQuality` is a narrow ramp, so blending 38 cells into a pixel and
blending 2.4 of them land in the same place — the measurement says visually
equivalent at every zoom captured. `perBaseLetter` is four widely separated
hues, so the same change takes the wall from muddy olive to vivid stripes and
nearly doubles the saturated share. A vivid base colour where the honest answer
is "mixed" is exactly what
[MAF_SUBPIXEL_CELLS.md](../../reference/MAF_SUBPIXEL_CELLS.md) argues against for tiling cells,
in as many words.

**Ship as is, document the trade.** Cheapest, and the status quo. The cost is
the over-statement above.

**Bin `perBaseQuality` only.** One predicate in `isPerBaseScheme`. The bin is
provably invisible there, and quality is the more used of the two. But
lettering then has no bound at all — and force-load, which exempts the byte
gate, is what OOMs.

**Stop painting lettering above a zoom threshold**, falling back to the normal
read body. Bounds the heap absolutely rather than proportionally, and retires
the appearance question instead of answering it. The cost is a mode that visibly
switches itself off as the user zooms out.

**Per-window base histogram, blended in a dedicated shader — measured and
declined.** Four unorm8 ACGT lanes per (read, window) from k sub-samples, the
pre-bin blend made deterministic. Measured on 2026-09-17 over the pacbio HG002
fixture's per-base extract, node only, arms interleaved and one bin per
process; the bench was not kept, so these are the numbers and the method.

- **The honest aggregate is one colour.** Real DNA over a 16-512 bp window is
  near-uniform ACGT: the full-visit histogram's mean window purity is 0.32 at
  binBp 512 and 0.43 at 16, and under 0.3% of windows pass 0.9 at any bin. A
  deterministic blend therefore paints the same mud in every cell, which is the
  pre-bin picture the candidate promised and a featureless band.
- **Sub-sampling cannot approach it.** Mean ΔRGB against the full visit is 134,
  87, 62 and 43 for k = 1, 2, 4 and 8 at binBp 512, falling as 1/√k, so ΔRGB
  under 10 needs k in the low hundreds — the full visit, and the
  viewport-independent cost the bin exists to kill. At k = 4 the window's top
  base is wrong 57-70% of the time, the argmax of a near-uniform multinomial
  being arbitrary. A majority base plus a purity byte costs the same (the
  k-visit is the cost, the lanes are not) and reads worse, at ΔRGB 97.
- **Cost was never the objection.** k = 4 runs at 1.19-1.37x the shipped
  extract; the full visit at 249-506 ms, flat across bins. The 1.5-2x this file
  used to quote came from a deleted handoff with no bench behind it. The GPU
  side would have shrunk: a dedicated shader's instance is 12 bytes against the
  20 lettering pays through `mismatch.slang`, and the +3 bytes is the worker
  payload.
- **It removed no code and closed no drift.** `perBaseLetter/packGpu.ts` left
  with the mark-list refactor; the fade neutralization is in the shared
  `packBaseCells`, which the softclip bases keep alive. And the 16.39%
  cross-backend disagreement in
  [CROSS_BACKEND_GATE.md](../../reference/CROSS_BACKEND_GATE.md) is geometry — a
  snapped left edge against a fractional one plus half a px — that a
  deterministic colour leaves where it is.

So the third candidate answers question one, and the purity numbers are its
argument: a mode that switches itself off is honest where a mud band is not.

The measurement also found a gap nothing records: today's single anchored
sample can land in a deletion or skip op, and the window then gets no cell at
all — 3.97% of (read, window) pairs at binBp 512, 0.64% at 64, 0.29% at 16.
Invisible at the wide end, where neighbouring 1px cells overlap, and a 1px gap
at `binBp == bpPerPx`.

## Question two: the 1bp cell leaves exactly one octave of headroom

Both backends floor a per-base cell to 1 CSS px (`pileupCellX` extends to
`bp + 1u`; `pileupCellWidth` is `max(1, 1/bpPerPx)`), and samples sit `binBp`
apart. So the wall is unbroken iff `binBp <= bpPerPx`, and `binBp` is chosen as
`<= coarseBpPerPx / 2` — **one zoom step of headroom, and no more**.

A single zoom step in is therefore exactly safe. A *multi-octave* zoom-in before
the debounce settles and the refetch lands draws the wall as stripes, for the
debounce plus one RPC. That is a new timing-dependent appearance, which
[MAF_SUBPIXEL_CELLS.md](../../reference/MAF_SUBPIXEL_CELLS.md) argues is a defect on its own
terms.

MAF does not have this because it widens the sampled cell to the bin
(`runEnd = gpos + binBp`, `mafInstanceBuffer.ts`). Alignments cannot, cheaply:
the 1bp span is baked into `pileupCellX` in `alignmentsUniforms.slang`, which
`mismatch.slang` and `packedColorQuad.slang` share through two packers
(`packBaseCells`, `packColorCells`) over five marks. Giving the cell an
explicit span is a real change to shared shaders — and also the enabling step
for anything that wants run-merged cells.

- **Per-instance span** the bin wide, in both cell shaders. Cells pitched
  `binBp` apart and spanning `binBp` abut at every zoom, so the headroom is
  unbounded rather than two octaves, and it fixes `perBaseQuality` as well as
  lettering, which stripes for the same reason. Two conditions: the span is the
  bin the held data was sampled at, not `subPixelBinBp(live bpPerPx)` — the two
  disagree exactly during the window the artifact lives in, which is what
  `dataSuperseded` reads — so it rides on the upload payload, as a
  `PileupChannels` member or MAF-style stride-2 positions; and it widens from
  the anchor `pileupCellX` snaps to, not the midpoint the `span` pivot's
  `expandMinWidthX` uses, or the mismatch layer painted over the wall drifts off
  it again. The Canvas2D twin moves off the one-base `cell` pivot
  (`canvas2dUtils.ts` says why it cannot carry a span on a reversed block) and
  the hit test's `basePos === startBp` becomes a range test. What it does not
  remove is the wide-zoom overdraw: a 16bp cell at 37.9 bp/px still floors to
  1px, and the constant 2-4x composite stays.
- **`binBp <= bpPerPx / 4`.** One line, buys a second octave, halves the win.
- **Accept it.** Self-correcting, bounded by debounce plus one RPC.

**Not on the list: switching to live `bpPerPx`.** The reference doc says why —
the cost that argument ignores is on the moving viewport, where a live key hands
each throttled `FetchVisibleRegions` run the bin of a zoom the gesture is only
passing through.

## Before any of it

`grep perBase` over `products/jbrowse-web/browser-tests/` finds only the probe:
**no cross-backend test covers a per-base mode at any zoom**. Whichever way
these two go, that gap is why the bin shipped believing a claim nothing could
have failed. Closing it with two gate scenes was built, measured and declined
the same day — on the cost of carrying an 18% override, not on the finding —
so the gap stands deliberately; gating the two per-base colour modes against
the other backend was declined.

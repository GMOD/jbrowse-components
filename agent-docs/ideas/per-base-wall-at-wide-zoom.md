---
name: per-base-wall-at-wide-zoom
description: The sub-pixel bin that bounded the per-base wall changed what `perBaseLetter` looks like — vivid stripes where the pre-bin blend was muddy olive — and left the 1bp cell exactly one octave of headroom, so a fast multi-octave zoom-in stripes the wall until the refetch lands. Four candidates for what wide-zoom lettering should be and three ways to close the octave, none built; the fourth candidate closes both, and the shader work it needs is also the enabling step for run-merged cells. Read before changing `subPixelBinBp`, `pileupCellX` or `pileupCellWidth`.
audience: internal
---

# What a per-base wall should look like at wide zoom

Background, and every number quoted here:
[reference/PER_BASE_SUBPIXEL_BIN.md](../reference/PER_BASE_SUBPIXEL_BIN.md). In
short — the bin took the worker's per-base extract from 30.5M entries and 2.0 GB
to 59.6k and 6.7 MB on a 1 Mb pacbio pileup, and at short-read depth it is the
difference between drawing and an OOM. It also changed the picture in one of the
two modes, which nobody predicted and no test could have caught.

**Nothing below is built.** Two questions, and the fourth candidate for the
first is also the best answer to the second, which is why they share a file.

## Question one: lettering over-states confidence now

`perBaseQuality` is a narrow ramp, so blending 38 cells into a pixel and
blending 2.4 of them land in the same place — the measurement says visually
equivalent at every zoom captured. `perBaseLetter` is four widely separated
hues, so the same change takes the wall from muddy olive to vivid stripes and
nearly doubles the saturated share. A vivid base colour where the honest answer
is "mixed" is exactly what
[maf-subpixel-cells.md](maf-subpixel-cells.md) argues against for tiling cells,
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

**Per-window base histogram, blended in a dedicated shader, cell spanning the
bin.** Four unorm8 ACGT lanes per (read, window) from k sub-samples, +3 bytes on
~60k entries. This keeps the base-weighted blend the pre-bin arm had — but
deterministically, and identically on both backends, where the pre-bin version
was an emergent compositing accident no test ever pinned. The span also retires
question two below. Two things make it cheaper than it sounds: the letter pass
ALREADY neutralizes both fades of the shader it borrows
(`perBaseLetter/packGpu.ts` writes `frequency=1` and the `QUAL_UNAVAILABLE`
sentinel), so a dedicated shader removes code rather than adding coupling; and it
touches neither `mismatch.slang` nor `packedColorQuad.slang`, so the five shared
packers stay out of it.

Two constraints on that fourth one, both established:

- **Blend shader-side, not at pack time.** `syncRegion` re-uploads instance
  buffers only on a data identity change, so an ABGR baked into the instance goes
  stale on a theme change and on the show-modifications grey-mute, both of which
  work today by rewriting the UBO. GPU-only, and silent.
- **k matters and is unmeasured.** Sub-sampling k per window keeps the pass
  `O(viewport)`; a full visit does not — benched at ~350-500ms on the pacbio
  fixture *regardless of `binBp`*, which resurrects exactly the
  viewport-independent work the bin killed. k=4 benched at ~1.5-2x the shipped
  extract with entry counts unchanged. Whether k=4 *looks* right is not known and
  needs a third arm through `probe-per-base-bin.ts`.

## Question two: the 1bp cell leaves exactly one octave of headroom

Both backends floor a per-base cell to 1 CSS px (`pileupCellX` extends to
`bp + 1u`; `pileupCellWidth` is `max(1, 1/bpPerPx)`), and samples sit `binBp`
apart. So the wall is unbroken iff `binBp <= bpPerPx`, and `binBp` is chosen as
`<= coarseBpPerPx / 2` — **one zoom step of headroom, and no more**.

A single zoom step in is therefore exactly safe. A *multi-octave* zoom-in before
the debounce settles and the refetch lands draws the wall as stripes, for the
debounce plus one RPC. That is a new timing-dependent appearance, which
[maf-subpixel-cells.md](maf-subpixel-cells.md) argues is a defect on its own
terms.

MAF does not have this because it widens the sampled cell to the bin
(`runEnd = gpos + binBp`, `mafInstanceBuffer.ts`). Alignments cannot, cheaply:
the 1bp span is baked into `pileupCellX`, shared by five packers across
`mismatch.slang` and `packedColorQuad.slang`. Giving the cell an explicit span
is a real change to shared shaders — and also the enabling step for anything
that wants run-merged cells.

- **Per-instance span** in both cell shaders, five packers writing `1`. Correct,
  removes the artifact entirely, biggest diff, and the thing the fourth
  candidate above needs anyway.
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
have failed —
[todo/cover-a-per-base-colour-mode-in-the-cross-backend-gate.md](../todo/cover-a-per-base-colour-mode-in-the-cross-backend-gate.md).

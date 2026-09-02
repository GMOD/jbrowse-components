---
status: Accepted
summary: "The PIF coarse tier is one row per alignment carrying a coarse CIGAR (`cr:Z:`) — the CIGAR folded to the indels at least `--coarse` long and one run between each pair, a run being a match that advances its two axes by different lengths — instead of CIGAR-less rows split into pieces. The renderer walks it where it walks a CIGAR, so a visible indel draws the same in both tiers and the switch changes nothing on screen"
---

# ADR-104: The coarse tier is a coarsened alignment, not a CIGAR-less split

## Status

Accepted (2026-09). Amends the tier description in ADR-039, whose "the coarse
tier is gap-split, not row-reduced" observation described the format this
replaces; its conclusion (no read-time binning, the N→M lever is a further
tier) stands.

## Context

The coarse tier (ADR-033, `SYNTENY_LOD.md`) dropped the CIGAR and, wherever a
CIGAR indel was at least `--coarse` long, split the row into pieces so each
piece's straight ribbon stayed tight. Pixel-honest at the switch, and where the
whole-genome win is. But SYNTENY_LOD's own rule — nothing user-visible keys off
which tier is loaded — was broken four ways, and three of them were the format:

- At 10 kb/px a 1 Mb deletion in a 5 Mb block is a 100 px colored wedge in the
  fine tier and a legend chip. Past the threshold the same alignment arrived as
  two pieces and the wedge became unpainted background. That is the class of
  indel a zoomed-out reader looks for, and its disappearance is what reads as
  "this file has no CIGAR".
- A piece was a different feature: its own file offset, the piece's coordinates,
  and `num_matches`/`block_len` apportioned by aligned length. A coarse click
  showed a sub-span with invented counts.
- The band's move-panel item is gated on the fetch's `hasCigar`, so it vanished
  on the coarse tier and came back zoomed in. (Still true after this ADR; see
  Consequences.)
- A single-tier file refetches at the threshold
  (`ideas/single-tier-pif-refetches-at-the-threshold.md`; unrelated to the
  format, unchanged).

What made the fix small is that `visitCigarRenderedSegments` already emits
non-square match segments: it folds sub-pixel indels into a trapezoid that
advances each axis by its own length. The fine tier at threshold zoom is
therefore already "runs plus the indels that clear a pixel". The coarse tier
only had to store that.

## Decision

- **One coarse row per PAF row**, the coordinate and count columns and every
  non-alignment tag verbatim. No splitting, no apportioning.
- **The CIGAR is replaced by a `cr:Z:` coarse CIGAR** (`coarsenCigar` in
  `@jbrowse/cigar-utils`): a CIGAR whose grammar has one extra form. Indels longer than half of `--coarse` keep their letter and length
  (`I`/`D`/`N`). Everything
  between two kept indels is one run, written `<own>:<mate>M` when the two sides
  consumed different lengths and `<n>M` when square. The row's own axis is
  first; the Q row is re-oriented the way the fine `cg` is (`swapCoarseCigar` /
  `flipCoarseCigar`, the twins of `swapIndelCigar` / `flipCigar`).
- **A run also closes before its folded skew passes `--coarse / 2`**, and no
  folded indel is longer than that, so the straight line between a run's
  corners is within `--coarse` of the true path everywhere inside it. (The
  first cut kept only indels `>= --coarse` and folded the rest, which let one
  indel in the upper half open a run already leaning by it — a 1.5x bound; the
  review caught it.) Balanced small indels never trigger this; only a
  lopsided stretch costs a run. It is what makes interpolating inside a run a
  bounded operation rather than a guess.
- **The tag is omitted** when the row has no CIGAR, when the fold is a single
  run (the columns already describe it), and when the CIGAR does not close on
  the columns — the columns are what the fine tier draws. A fold of several
  runs with no kept indel IS written: a lopsided cluster of sub-gap indels
  bends the path by their sum, which a straight ribbon would miss.
- **In the packed CIGAR a run is `CIGAR_RUN`**, a two-word op (own length, then
  mate length) that `visitCigarRenderedSegments` walks and reports as `CIGAR_M`,
  and that `clipSyntenyFeature` trims with the mate in proportion. Both workers
  parse `coarseCigar` where they would parse `CIGAR`, under the same width gate.
  `hasCigar` counts the fold as well.
- **Old files keep working.** A coarse row without `cr` draws as a plain ribbon,
  which is what it did before.

## Alternatives rejected

- **A standard CIGAR with each run's residual skew as one `I`/`D` at the run's
  end.** Valid CIGAR, every existing walker understands it — and a residual of
  a few pixels draws as a fake wedge in a fake place. On a 50 Mb human-chimp
  run the net skew is tens of kb.
- **Spread the residual as sub-gap indels along the run.** Sub-pixel at the
  zoom it was built for, so the visitor folds it correctly; synthetic evenly
  spaced wedges the moment "Alignment blocks only" is pinned and zoomed in.
- **Keep the split rows and link the pieces with an id tag.** Two features and
  apportioned counts remain; only the wedge would be recoverable, and only with
  a second walker over sibling rows.
- **An absolute-coordinate piece list.** Perspective-free, but a third walker
  beside the visitor and the clipper; relative ops reuse both.

## Relation to tracepoints

A tracepoint representation (Myers; `lib_tracepoints`) is a list of
`(a_len, b_len)` pairs, each a segment realigned on demand, with long indels
kept as their own segments. A `cr` run is the same shape as one pair. The
differences are the segmenting rule — tracepoints bound a segment by its
difference count so it can be realigned; `cr` bounds it by the kept gaps and by
the skew rule above — and the purpose: `cr` is a rendering fold with no sequence
at hand, not a reconstruction. If a tracepoint-emitting aligner's PAF is ever
read directly, its pairs translate to `cr` runs one for one.

## Consequences

- A kept gap draws as the same wedge in both tiers; the legend's indel chips
  survive the switch; a coarse click shows the real alignment.
- **The walks follow the fold.** `getAlignmentOps` (`syntenyMate.ts`) hands
  every walker the packed CIGAR or, failing that, the packed fold, so
  `resolveAlignmentSpan` (move-panel, follow), `buildCigarMap` (the follow's
  per-frame map) and the launch's `resolveSpans` all answer on the coarse tier,
  within `--coarse` of the truth. `hasCigar` on a fetch means "an alignment
  string to walk", fold included. The follow reports its placement approximate
  only when a pinned coarse tier is zoomed finer than the tier's threshold
  (`coarseWalkIsApproximate`), which is the one zoom where the gap is wider
  than a pixel.
- Feature ids still differ across tiers (both are file offsets), so a selection
  does not survive the switch. A per-alignment id stamped on every row of one
  PAF row is the follow-up for that.
- `--coarse` is the tier's accuracy bound, not a "split gap": indels over half
  of it are kept and a run's line is within it. `coarseBpPerPxThreshold` must
  still be at least `--coarse`, for the same reason as before.
- A flipped row re-orients its fold (`flipSyntenyFeature`), the viewport clip
  (`clipLargeBlockToWindow`) takes the fold, `buildCigarMap` puts a point at
  both ends of a leaning run, and the LGV synteny track derives its indel
  mismatches from the fold along the row's own axis (`coarseCigarOwnAxis`) —
  four gaps a Fable review found in the first cut.
- The synthetic measurement in `measurements/pif-coarse-tier-bytes.json` was
  taken on the split format; a coarse row now costs the tag on rows with a kept
  gap and nothing on the rest.

## Related

- ADR-033 (the LOD taxonomy), ADR-039 (no read-time binning; amended above)
- `reference/SYNTENY_LOD.md`, `website/docs/developer_guides/pif_format.md`

# Dotplot auto-diagonalize — mummerplot-quality layout (handoff)

## Goal

Make the dotplot `autoDiagonalize` produce a **single clean diagonal** for a
fragmented-assembly-vs-reference plot, matching what `mummerplot --layout`
does. Driven by screenshot-review item **`sv_cgiab/dotplot_result`** (note:
_"the autodiagonalize is pretty good but there are some significant
off-diagonals. we may want to compare against mummerplot"_).

Spec: `website/scripts/specs/synteny.ts` → `sv_cgiab/dotplot_result`
(HG008T.hap1 assembly vs GRCh38_GIABv3, whole-genome PIF).

## TL;DR of what was learned (read before coding)

- **The scattered off-diagonal _dots_ are real data, not an algorithm bug.**
  91% of aligned bases already sit on each chromosome's single best contig. The
  residual 9% is genuine many-to-many structure: chr2 is split across hap1
  contigs 8+13, chr5 across 15+3, and contigs 3/13 each span two chromosomes.
  mummerplot would draw the exact same dots. **Do not try to remove them.**
- The thing worth improving is the **main diagonal**, i.e. the _ordering_ of the
  axes so the primary alignment blocks form one continuous line rather than a
  staircase.
- **The current `diagonalizeRegions` reorders ONE axis** (the vertical/query
  one), holding the other fixed. This yields a clean diagonal **only when the
  fixed axis is already a good seriation.** In the original figure the fixed
  x-axis was hap1 in _numeric contig order_, which happened to be a good order,
  so the diagonal was clean (but the reordered GRCh38 y-axis reads as a
  scrambled chr3, chr13, chr4… order).
- **Reordering the fragmented axis instead staircases** (see "Option C" below).
- **A naive both-axes reorder also staircases.** I implemented one
  (greedy-spanning + barycenter, trying both anchor directions and keeping the
  lower mean-off-diagonal metric). It _lowered the metric_ (0.104→0.057) but
  rendered as an offset **staircase**, i.e. **the mean-distance-to-diagonal
  metric is a bad proxy for "one clean line."** That attempt was reverted.

The real fix is to reorder **both** axes with a **faithful mummerplot
recursive-spanning seriation** (not barycenter, not best-partner-index).

## Current working-tree state (nothing committed)

- Core/RPC/`runDotplotDiagonalize` are **back to the original single-axis code**
  (my both-axes attempt was reverted — `git diff` on `plugins/dotplot-view` and
  `packages/core/src/util/diagonalizeRegions.ts` is empty).
- `website/scripts/specs/synteny.ts` is left on **"Option C"**: the two
  DotplotView `views` are swapped to `[GRCh38_GIABv3, HG008T.hap1]` so the
  existing single-axis diagonalize reorders the hap1 assembly (vertical) while
  GRCh38 stays in readable chr1→chrY order on the horizontal axis.
- `website/static/img/sv_cgiab/dotplot_result.png` was regenerated for Option C.
  It has a **readable chromosome x-axis but a descending _staircase_ diagonal**.
  This is an interim, not the target. Decide whether to keep it once the real
  fix lands.

Option C vs the original is a genuine tradeoff (readable axis + staircase, vs
clean diagonal + scrambled axis) — the mummerplot method is meant to give
**both** a clean diagonal AND (because it also reorders the reference) an axis
whose order at least follows the alignment; if a karyotype-ordered reference is
wanted too, that's an extra constraint to weigh.

## The mummerplot algorithm to implement

Reference: https://github.com/mummer4/mummer/blob/master/scripts/mummerplot.pl
(`--layout`, functions `LayoutIBraid` / `SpanReference` / `SpanQuery`).

Sketch of its `--layout`:

1. Reduce to best one-to-one mappings (show-coords best hits).
2. For each reference sequence build the chain of query sequences that span it
   (and vice-versa): slope (+1/−1), position ranges.
3. Sort reference sequences by length **descending**; recursively _span_ each
   (`SpanXwY`): place the query sequences connected to it **contiguously**,
   **reverse-complement (flip)** a query when its slope is −1, and recurse into
   larger query sequences before smaller ones.
4. Rebuild both axes' offset arrays from the spanning order; append unplaced
   sequences at the end.

The crucial property the naive attempts missed: **recursive contiguous
spanning** places a chromosome's multiple contigs adjacent _and_ orders the
reference by that same spanning, producing a single monotonic diagonal — not a
barycenter-averaged staircase.

## Architecture constraints (important)

- **`diagonalizeRegions` (`packages/core/src/util/diagonalizeRegions.ts`) is
  shared with LinearSyntenyView.** Synteny runs a _pinned-reference cascade_
  (each stacked level's top row is fixed by the level above — a downward
  Sugiyama layer-sweep). **Reordering both axes there would break it.** So the
  both-axes layout must be a **separate function / dotplot-only path**, leaving
  `diagonalizeRegions` untouched. (See `DiagonalizeSyntenyRpc.ts` +
  `runDiagonalize.ts`.)
- Worker has no `assemblyManager`. Reconcile refName aliases on the main thread.
  The clean pattern (already used by synteny, and by my reverted attempt): pass
  **canonical** regions for the ordering, a separately-renamed **`fetchRegions`**
  for the `getFeatures` query, and per-axis **`refRefNameMap`/`queryRefNameMap`**
  (adapter→canonical) so `extractAlignmentData` returns canonical refNames on
  both axes. `extractAlignmentData` (`packages/synteny-core`) **already accepts
  `refRefNameMap`** — synteny uses it; the dotplot RPC currently only passes
  `queryRefNameMap`.
- Applying both axes back: `renameRegionsForAdapter` preserves order/count, so a
  reference **permutation** maps 1:1 by index back to canonical
  `hview.displayedRegions`. My reverted attempt instead returned canonical
  `newReferenceRegions` + `newQueryRegions` and did
  `hview.setDisplayedRegions(...)` / `vview.setDisplayedRegions(...)` inside the
  existing `transaction`. That plumbing worked; only the ordering algorithm was
  wrong.

## Reusable scaffolding from the reverted attempt

The reverted both-axes plumbing is worth rebuilding (only swap in the real
seriation). It consisted of:

- `diagonalizeRegionsBothAxes(alignments, referenceRegions, currentRegions,
  onTick)` in `diagonalizeRegions.ts` returning
  `{ newReferenceRegions, newQueryRegions, stats }`.
- `DiagonalizeDotplotRpc`: added `fetchRegions` + `refRefNameMap` to the args,
  fetched with `fetchRegions`, `extractAlignmentData(feats, { refRefNameMap,
  queryRefNameMap })`, called the both-axes fn, returned both region arrays.
- `runDotplotDiagonalize`: passed canonical `hview.displayedRegions` +
  `renameRegionsForAdapter(...)` as `fetchRegions` + both `getAdapterToCanonical
  RefNameMap` calls; applied both results to `hview`/`vview`.

Recover the exact diff from this session's history if useful, or rebuild from
the pattern above. Keep the `cmpStr`-based deterministic pre-sort of alignments
(nondeterministic worker emit order + float accumulation otherwise reshuffles
results on near-ties).

## Verification harness

The `agent-docs/dotplot-diagonalize-analysis/` scripts reproduce everything
against the real data (download the PIF first):

```bash
curl -s -o hap1.pif.gz https://jbrowse.org/demos/cgiab/HG008T.hap1.pif.gz
```

The PIF stores each alignment **twice** (both directions); keep only rows whose
col-1 query starts with `q` (query = hap1 contig, target = GRCh38 chr).

- `analyze.py` — quantifies on/off-diagonal base fractions (the 91%/9% result)
  and the multi-contig chromosomes driving the off-diagonals.
- `render_lines.py` — the **definitive visual test**: renders original
  single-axis vs both-axis vs Option C as real line segments (with strand/flip),
  saved as `comparison-original-vs-bothaxis-vs-optionC.png`. Add a "mummerplot
  recursive-spanning" panel here and iterate until it's a single clean line
  **visually** — don't trust the scalar metric.
- `proto_final.py` / `proto_span.py` — the greedy-span + barycenter attempts
  (what NOT to ship; useful as a baseline to beat).

End-to-end regen (needs a jbrowse-web build — the generator renders the built
bundle, source is consumed via the dev `exports`→`src` condition, so no separate
core/plugin ESM build is needed):

```bash
cd products/jbrowse-web && pnpm build
cd ../../website && node --experimental-strip-types scripts/generate-screenshots.ts \
  --filter dotplot_result --force --localport 3391
convert static/img/sv_cgiab/dotplot_result.png -resize 1400x /tmp/shot.png  # then view
```

(The whole-genome capture downloads a 4.5 MB PIF and needs the spec's long
`settleMs`; ~1–2 min. Watch out for a stale server on the default port 3334 —
use `--localport`.)

## Suggested plan for next agent

- Add a `diagonalizeRegionsBothAxes` (separate from `diagonalizeRegions`) that
  implements mummerplot recursive spanning; prototype in `render_lines.py` first
  and confirm a single clean line _visually_.
- Rebuild the dotplot-only RPC/`runDotplotDiagonalize` plumbing (canonical-space
  pattern above); add a unit test for the split-chromosome chaining case.
- Regenerate `sv_cgiab/dotplot_result`; compare against the original and Option
  C renders; decide the final spec axis orientation.
- Leave `diagonalizeRegions` (single-axis) and the synteny path untouched.

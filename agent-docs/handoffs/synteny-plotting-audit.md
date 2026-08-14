# Synteny plotting audit — what was found, what is left

An integrity + speed pass over `plugins/linear-comparative-view`, 2026-08-14.
Two things landed; the rest of this file is the leftovers, each with enough to
pick it up cold. Baseline: all 619 pre-existing tests passed before and after,
`tsc` clean, `oxlint` clean.

## Landed

- **`fix(synteny): a clip op advances neither ribbon axis, and is not a block`**
  — `clipSyntenyFeature`'s two axis predicates were negative (`op !== CIGAR_I`),
  so H/S/P advanced both axes. Reachable through "Linear read vs ref", which
  passes a read's raw BAM CIGAR through while putting the mate in clip-exclusive
  read coordinates.
- **`perf(synteny): keep unpickable instances out of the pick index`** — hover on
  a 300k-instance whole-genome view went from 192ms per mousemove to under
  0.01ms, and the index build from 472ms to 67ms.

## Where the time actually goes

Measured with a throwaway jest probe (deleted; the fixture is easy to rebuild —
300k blocks, lengths `200 * exp(rnd * 9)`, random query/target pairing across
3.1Gbp, 1400px, whole-genome bpPerPx). **Min of 5, one arm each, so these locate
a mechanism and are not speedups** — see `reference/BENCHMARKING.md`.

| stage | before | after |
| --- | --- | --- |
| `buildSyntenyGeometry` (worker) | 105ms | 105ms |
| `computeSyntenyColors` (main) | 4.8ms | 4.8ms |
| `interleaveInstances` (main) | 3.4ms | 3.4ms |
| `buildPickIndex` (main, first hover per zoom) | 472ms | 67ms |
| `pickFeatureAtPoint` (main, per mousemove) | 192ms | <0.01ms |

The fixture is deliberately pessimistic about hull width — random pairing gives
almost every ribbon a canvas-spanning x-hull, which is an all-vs-all PAF rather
than two related genomes. It is not pessimistic about instance count; 300k is
ordinary.

**Both pick rows are whole-genome-zoom figures and do not generalize** — at that
zoom every ribbon is sub-pixel, so the tree is EMPTY and the hover is answering
"nothing here". One zoom step in it holds ~half the instances, and on wide-hull
data a hover costs ~64ms at zero skew. Re-measured across zooms and both hull
shapes in [reference/SYNTENY_PICKING.md](../reference/SYNTENY_PICKING.md); read
that before quoting either number.

**`buildSyntenyGeometry`'s 105ms is now the largest single item** and nobody has
looked at it. It is two O(n) passes plus a capacity pre-pass, all in the worker,
so it costs a fetch's latency rather than a frame — which is why it was left
alone here, not because it is known to be tight.

## Fetch completeness — moved out of this thread

A follow-up pass split the "the view silently omits alignments" problem in two
and filed both. Nothing here is left to decide:

- [ideas/offscreen-synteny-mates.md](../ideas/offscreen-synteny-mates.md) — the
  half that is already fetched and thrown away in the decorate loop, measured at
  73% of peach chr1's anchors on `demos/grape_peach_cacao`, plus the staging for
  drawing it as a stub/box.
- [ideas/two-axis-synteny-fetch.md](../ideas/two-axis-synteny-fetch.md) — the
  half that needs a second fetch. Its blocker is now **verified** rather than
  inferred, and it is two adapters (PIF, all-vs-all), with PIF's fix being a
  file-format change.

Both source comments in `executeSyntenyFeaturesAndPositions.ts` were narrowed to
match.

## Not done, with what is known

### The pick loop's remaining O(candidates) work

Still open, but re-read [reference/SYNTENY_PICKING.md](../reference/SYNTENY_PICKING.md)
first: on the data where this loop is actually slow, candidates are not arriving
through slop that a `filterFn` or a dropped sort could remove — they genuinely
cover the stab point. Both ideas below are worth what they were worth before;
neither is the answer to the 64–134ms case.

What survives the index is walked with `projectCorners` + `isRibbonCulled` +
`ribbonPerpWidth` (which takes a `sqrt`) per candidate, after an
`Int32Array(...).sort()`. Two things were considered and not done:

- **Push `minAlignmentLength` and `isInstanceInvisible` into `flatbush.search`'s
  `filterFn`** (the API takes one, and `_collectContained` honours it), so
  rejects never enter the array to be copied and sorted. Rejected for now because
  `minAlignmentLength` defaults to 0 and nothing in `computeSyntenyColors` ever
  produces alpha < 3, so by default the filter rejects nothing and the closure
  call per leaf is pure overhead. Worth revisiting **gated on
  `minAlignmentLength > 0`**, which is the case a whole-genome PAF is actually
  viewed in.
- **Drop the sort**, tracking `best = -1` and skipping any candidate with
  `i < best`, since the answer is the max-index candidate that passes. Correct
  (the predicates are per-candidate and order-independent) and removes an
  O(n log n), but it converts the descending walk's early exit into "test every
  candidate that could improve the answer", so the worst case (candidates
  arriving in ascending index order) builds many more paths. Do not attempt
  without measuring how many candidates reach `buildFeaturePath` on a real
  fragmented alignment, which the probe above could not answer — its fixture has
  none wide enough.

### `pickFeatureAtPoint` omits the `isMarker` arm of `isRibbonCulled`

The draw loop passes it (`Canvas2DSyntenyRenderer`), the pick loop does not.
**Currently harmless and now harmless by construction**: a marker's two edges are
single points, so both width deltas are 0 and it is excluded from the index
outright. Left as is deliberately — adding the argument would suggest markers
reach that line, and they cannot. Worth knowing if the exclusion is ever relaxed.

### Sub-bp drift in the trim path's window

`clipLargeBlockToWindow` floors/ceils its window to integer bp, with a comment
explaining that a fractional `winStart` shifts the whole re-anchored block off
the integer-bp grid ("indels landing mid-basepair"). The **other** caller of
`clipSyntenyFeature` — the `trim.trimmed` path in
`executeSyntenyFeaturesAndPositions` — passes `qLo`/`qHi` straight off
`clampBlockToRegions`, which is a proportional trim and so can be fractional. The
op lengths then truncate through `(cHi - cLo) << 4`. Bounded by 1bp, so invisible
except at base-level zoom, and not investigated further.

### Things checked and found correct — don't re-audit

- `buildSyntenyGeometry`'s capacity bounds are strict. The marker budget
  telescopes exactly over any partition of the query span, and the CIGAR budget
  holds because `visitCigarRenderedSegments` only emits once either axis has
  advanced past 1px.
- The CPU hull cull being tighter than the shader's (`HULL_CULL_PAD_PX` vs
  `overdrawPx`) is deliberate and safe; a hull off-canvas paints nothing on
  either path.
- `packClickedOutlineInstances` selects many instances per feature in
  transparent-indels mode, because a tiled feature's match quads are `KIND_BASE`.
  This matches `isClickedSilhouette` in the shader, so the two backends agree —
  only the "~1 instance" figure in its comment is a colored-indels-mode
  statement.
- The transfer list in `executeSyntenyFeaturesAndPositions` cannot double-list a
  buffer: `createAttributeChannels` is keyed by name, so a track declaring
  `identity` collapses onto the preset rather than adding a second array.

---
status: Accepted
summary: "The worker ships every isoform with a per-child ordinal and a stack table; the fit ladder gains an `isoforms` rung between `labels` and `decimated` that bisects the transcripts-per-gene the track can hold with its names intact, which takes track height out of the RPC cache key and supersedes ADR-075"
---

# ADR-092: Isoform trimming is a rung of the fit ladder

## Status

Accepted (2026-08). Amended by
[ADR-093](adr-093-level-of-detail-keys-off-what-is-on-screen.md) (badge
presentation, fixed-mode measurement). Supersedes
[ADR-075](adr-075-the-isoform-cap-runs-in-the-worker.md), which called for
exactly this the moment something needed per-isoform structure on the main
thread. The mechanism is `solveIsoformCount` in
`plugins/canvas/src/LinearBasicDisplay/fitLadder.ts`, `trimIsoformStack` and
`applyIsoformTrim` in `isoformTrim.ts`, and `IsoformStack` in
`RenderFeatureDataRPC/rpcTypes.ts`.

## Context

A 145px fitted gene track drew ten transcripts of LDB3 and no gene name.

Measured on session `share-oW8eg4-TTT` (NCBI RefSeq hg38,
chr10:86,656,837..86,755,086, `heightMode: 'fit'`, `height: 145`): the worker
handed LDB3 all ten of its transcripts, because LDB3 and OPN4 do not overlap in
bp — a 327bp gap, about 4.4px at that zoom — so the lane sweep gave LDB3 the
whole lane. The main-thread packer then put LDB3 **under** OPN4 anyway: a strand
arrow is 8px of layout width, which is 591bp there, and the worker never sees
bpPerPx. The labelled stack came out 204px in a 145px track, the label-free one
183px, and the ladder — `full → labels → decimated → bodies` — ran out of rungs
and landed on `bodies` at scale 0.79.

Every rung the ladder had gave up a **name**. The policy is the other way round:
a gene drawn with five of its ten transcripts and its name on it is a picture a
reader can use; one drawn with all ten and no name is not.

The root cause is placement, not arithmetic. The count was decided BEFORE the
fetch, from `isoformRowBudget` → `laneBudgetRows`, which cannot see the packing
it is a promise about. Commit `679d2563dd` had already named the shape of the
failure — "the budget fits a gene's own row in isolation, which is not the same
as fitting what is on screen beside it" — and answered it with a second
pre-fetch estimate (the lane sweep). This is the same failure one level up: no
pre-fetch estimate can price a strand arrow, a label overhang, or a neighbour's
row.

## Decision

**The worker ships every isoform. The fit ladder trims, where it can see the
pack.**

```
fit:    full → labels → isoforms(k solved, names kept) → decimated(k) → bodies(k) → squeeze
fixed:  full → isoforms(k solved against the slot)     → scroll
grow:   full
```

`k` is the largest transcripts-per-gene whose names-kept pack fits the target
height, found by integer bisection over `[1, maxIsoformCountOnScreen]` —
`bisectLargestFitting`, the twin of the whitespace solve's
`bisectSmallestFitting`, with the same two-ends-measured precondition. When even
k = 1 overflows the solve answers 1 and the rungs below inherit it: every
isoform goes before any name does. A gene the user expanded from its own badge
is never trimmed, in any mode.

**"All transcripts" withholds the rung** (`showsEveryIsoform`, a
`LinearCanvasBaseDisplay` hook the basic display answers off the RAW
`geneGlyphMode` — `auto` resolves to `all` under 100bp/px and that mode's whole
job is to fit the track). Withheld, not solved to `undefined`: it is the last
rung of the fixed-height ladder, which is always the one resolved, so a no-op
rung left in place would report `level: 'isoforms'` over a stack every
transcript survived. The two ladders lose it and nothing else:

```
all/fit:    full → labels → decimated → bodies → squeeze
all/fixed:  full → scroll
```

The menu makes that promise in those words, and the corner tooltip has been
telling readers "All transcripts shows more" since the rung shipped. So the
policy inverts for the one mode that asks it to: names go before transcripts do
under `auto`, and transcripts outlast names under `all`.

`k` rides on `FitStage`, so the corner chip, its tooltip and
`isoformPicks.byCap` read the solve rather than a flag the worker set.

### What crosses the boundary

Two additions, and they are the two ADR-075's amendment identified as missing:

- **Primitive attribution.** `rectChildOrdinals` / `lineChildOrdinals` /
  `arrowChildOrdinals` (Uint16, length-zero when the region stacks no gene, like
  `rectLabelRows`), plus `childOrdinal` on `SubfeatureInfo`,
  `AminoAcidOverlayItem` and `FeatureLabelData`. The ordinal is the index of the
  ROOT container's direct child — the isoform slot — at every nesting depth.
  `emitSubfeaturesGlyph` stamps it over the RANGE each root child emitted rather
  than threading it through every emitter, which is what makes it hold at depth
  for free: a polyprotein's cleavage products land inside their root child's
  range whatever `parentFeatureId` they registered under, and that linkage —
  aliased to the root at every depth by design — is precisely what could not
  answer "the direct children of gene X".

- **`IsoformStack`, per gene**, on its `FlatbushItem`: children in drawn order
  with `ordinal`, `rank`, `isoform` (false for a decoration), gene-local
  `yPx`/`heightPx`, `labelRows`, bp extent; plus `isoformCount`, `canonicalTag`,
  `gapPx` and `collapsedIsoformCount`. `layoutSubfeatures` has all of it in hand
  already.

`rank` is on the table because the drawn order is not the ranked order — the
stack sorts by (canonical, coding) while the ranking also weighs protein length,
so a trim that dropped a suffix would keep a different set than `longestCoding`
does at k = 1. `gapPx` ships rather than the ratio behind it, so the trim closes
the hole with the same number the layout opened it with. `isoformCount` is every
isoform the gene HAS, so a `longestCoding` gene — which ships one child —
reports its badge count the same way a trimmed one does.

### What the main thread does with it

`trimIsoformStack(stack, k)` answers one gene: which ordinals survive, how far
each rises in px and in whole label rows, and the gene's height, label rows and
bp extent afterwards. It is pure, and it is what `decideLabelReservations` calls
per gene per probed `k` — so one preparation serves the whole bisection, the way
one serves the whitespace solve.

`applyIsoformTrim` spends the answer on the region arrays: filter by ordinal,
shift the kept Ys and label rows, fix `subfeatureInfos`, `aminoAcidOverlay` and
`floatingLabelsData` (a dropped transcript's label goes; the gene's own entry is
re-anchored to the kept extent and given its `+N more` badge). It runs BEFORE
`applyHeightScale`, so px and label rows are each undone in the unit the worker
counted them in — after the scale the two are one number and the shift could not
be recovered.

The `isoforms` rung has its own `createIncrementalLayout` memo, unseeded like the
`decimated` rung's and for the same reason: the count is chosen by measuring
candidate packs, so the commit has to pack the way the probe did. A re-solve
landing on the count already committed hands back the same map by reference,
which every pan settle and every drag frame does.

### What stays in the worker

**`longestCoding` — the `auto` mode's zoom collapse, `coarseBpPerPx > 100` — and
the `expandedGeneIds` RPC argument it needs.** It is the user's own pick, and it
is also the payload gate at whole-chromosome zoom, where shipping every isoform
of every gene was never measured. The measurement that would move it: the
payload of an uncapped whole-chr1 gene track against the same track under
`longestCoding`. The deleted `isoformCapPayload.measure.test.ts` is the harness
shape to copy — it serialized a built region through `structuredClone` and
counted bytes.

The main thread honours it either way. A `longestCoding` gene arrives with one
child, `isoformCount > 1`, and `collapsedIsoformCount: 1`; the trim reads the
tighter of that and `k`, so the chip and the badge answer the same from both
sources, and a gene the user expanded out of `longestCoding` still carries the
"show fewer" badge that is its only way back.

## Consequences

- **Track height is not an RPC cache key.** `maxIsoforms`, `geneOwnRows`,
  `coarseTrackHeight`, `HEIGHT_SETTLE_MS`, `cappableTrackHeight` and the debounce
  autorun are gone. `fetchAutorun.test.ts` used to pin "a height change within a
  row budget does not refetch, one that buys a row does"; it now pins that
  height, `heightMode`, `maxHeight`, `growMaxHeight` and a compact `displayMode`
  refetch nothing at all.
- **The lane sweep is gone with the budget it divided.** `isoformLanes.ts`,
  `LaneShare`, `laneBudgetRows` and `laneShares` answered a question the packer
  now answers by packing. `isoformBudget.ts` — the mirror of
  `decideLabelReservations`' row arithmetic, and the test that existed only to
  pin the mirror against the packer — is gone for the same reason: there is one
  spender now.
- **The badge is main-thread.** `moreIsoformsLabel` is written by the trim, and
  its WIDTH is priced at the count being probed rather than baked into the
  payload — the badge shares the name's row, so the packer has to reserve it, and
  its text depends on the count.
- **A trim costs a re-pack, not a fetch.** Dragging a fitted track taller now
  re-solves and re-packs; it used to clear and refetch every visible region once
  the drag crossed a row boundary.
- **Every multi-isoform gene pays for `rankIsoforms` on every layout.** The
  worker's cap skipped the ranking for a gene comfortably under its budget; the
  stack table needs a rank per child either way. `rankIsoforms` walks each
  isoform's subtree for its coding length, and `auto` only resolves to `all` at
  ≤100bp/px, where tens of genes are on screen.
- **Global k trims a lone gene in a sparse column to the count the crowded one
  needs.** Per-gene refinement after the global solve is designed and parked —
  see `agent-docs/ideas/`.

---
name: synteny-lod
description: How does a synteny display fetch, tier, pick and mark? The two PIF tiers and read-time binning, the target-axis fetch, off-screen mate marks, and the hull pick index and its cost. Read before touching make-pif, the synteny fetch RPC, mate marks or picking.
kind: spec
---

# Synteny: tiers, fetch axes, off-screen mates and picking

How the linear-comparative-view and dotplot level-of-detail (LOD) system picks a PIF tier and where its scaling limit is, how the both-rows fetch finds alignments whose mate is off screen, how those alignments draw as marks, and what the hover pick index costs.

## PIF tiers and level of detail

### The two PIF tiers

`jbrowse make-pif` writes two tiers into one tabix-indexed PIF, told apart by a
one-letter prefix on the seqid:

- **fine** — `t<target>` / `q<query>`. Per-row CIGAR and every optional tag, one
  line per perspective per PAF row. Never split, because the fine tier draws a
  large indel as a coloured `KIND_CIGAR_D`/`_I` wedge. To split alignments, run
  `rb break-paf` upstream of `make-pif`, which keeps the tiers 1:1.
- **coarse** — `T<target>` / `Q<query>`. The same row with every non-CIGAR
  column and tag verbatim and the CIGAR replaced by its fold, a `cr:Z:` coarse
  CIGAR (`packages/cigar-utils/src/coarseCigar.ts`, ADR-104). Indels longer than
  half of `--coarse` (default 10 kb) survive as `I`/`D`/`N`; everything between
  folds into one run, written `<own>:<mate>M` when the sides differ. A run also
  closes before its folded skew passes `--coarse / 2`, so a straight line across
  a run stays within `--coarse` of the true path.

The `#pif` header (`version`, `writer`, `tiers`, `coarse`, `cigars`) lets a
reader treat a tagless coarse row as one run within the bound
(`coarseRowsAreBounded`, `PifFile.meta`), so `--coarse` must be positive. The
renderer walks `cr` where it would walk `cg` (`CIGAR_RUN`, understood by
`visitCigarRenderedSegments` and `clipSyntenyFeature`), so a kept gap draws as
the same wedge in both tiers. The alignment walks (`getAlignmentOps`) follow it
too: move-panel, follow and launch clip-to-region answer on the coarse tier, and
the follow says "approximate" only when a pinned coarse tier is zoomed finer than
its threshold. `--no-coarse` suppresses the tier. Files built before the `cr`
change split coarse rows at large indels instead and still load as plain
ribbons.

### One alignment string per row

A PIF row carries `cg:Z:` and never `cs:Z:`. `make-pif` folds a `cs` into the
CIGAR, preferring it over a co-present `cg` because `csToCigar` writes `=`/`X`
where minimap2's `cg` writes `M`.

This is an invariant: `SyntenyFeature.forEachMismatch` prefers `cs` over the
CIGAR, so a `cs` that rode through unflipped beside a flipped `cg` won and drew
every indel on the q perspective with reversed sense. Don't add a second
alignment string without a reorienter that reverses op order and
reverse-complements the spelled-out bases on the minus strand.

### Where `auto` resolves: main thread, once

`resolveLodTier` (`packages/synteny-core/src/lodTier.ts`) is the only place
`auto` becomes a tier. It must run in a display getter that feeds the fetch
cache key, and `BaseOptions.lodMode` is typed `'fine' | 'coarse'` so it cannot
drift back. A decision made adapter-side from `bpPerPx` is invisible to the key:
`bpPerPxBucketKey` is `floor(log2(bpPerPx))`, and the default 10000 threshold
sits inside bucket 13, so zooming across it changed no key and left the coarse
ribbons on screen while `dataCurrent` reported fresh.

The consumers are `LinearSyntenyDisplay.lodTier` (into `currentFetchKey`),
`DotplotDisplay.lodTier` (`dotplotFetchKey`), `LGVSyntenyDisplay.lodTier`
(`rpcProps`) and `MultiWaySyntenyDisplay`. All read the threshold with
`getCoarseBpPerPxThreshold`, which goes through the slot path, because
`adapterConfig` is a snapshot of explicitly-set keys and reads `undefined` for
tracks at the default. The slot's presence also gates the "Level of detail" menu
(`trackHasLodTiers`); `hasCoarseTier` withdraws the submenu once the file header
says there is no coarse tier (`lodMenuItems`).

The synteny and dotplot surfaces feed the min of both axes, because CIGAR detail
is worth drawing when the band is wide on either axis, so coarse is safe only
once both axes pass the threshold. The adapter side
(`plugins/comparative-adapters/src/util.ts`) is just `resolveCoarseTier`:
coarse on a file without the tier degrades to fine.

### The file has the last word

The slot cannot say whether the file has a coarse tier or the bound it was
folded at; both are facts of the file on the adapter side of the RPC. Each of
the four displays composes `LodTierInfoMixin`, and `installLodTierInfoFetch`
makes one `CoreGetInfo` call against the track's adapter, gated on
`trackHasLodTiers`. Both indexed PIF adapters answer `getHeader` with
`PifFile.info()` (the parsed `#pif` header plus `hasCoarseTier`, derived from the
`T`/`Q` seqids for a headerless file); `readLodTierInfo` narrows it into the
volatile `lodTierInfo`, which `resolveLodTier` reads beside the slot. The About
dialog shows the same object.

`effectiveCoarseThreshold` resolves as follows:

- **Info not yet landed:** trust the slot. A file built with defaults agrees
  with the slot at every zoom, so landing refetches nothing. Only a file whose
  header disagrees moves the key, once, and only if its first fetch issued
  before the info arrived.
- **`hasCoarseTier: false`:** `'fine'` under every mode, pinned `coarse`
  included. The key then never flips at a threshold the file cannot honour.
- **Header bound above the slot:** raise the threshold to the bound. Below
  `--coarse` bp/px a run's lean exceeds a pixel, so serving the fold there is
  wrong output. The clamp goes only up; a slot above the bound is a preference
  for detail.
- **Headerless two-tier file:** resolve off the slot alone.

`coarseWalkIsApproximate` compares zoom against the header's bound where there
is one and the slot otherwise, and a `--no-coarse` file never reports it.

`MultiPairwiseSyntenyAdapter` folds its children's headers: `hasCoarseTier` only
when every child has one, `coarseGap` the largest bound, plus
`anchorAssemblyName` and `assemblyNames`. One tierless child pins the whole star
to fine, since forwarding `coarse` to it would serve fine anyway and only move
the key. `MultiGenomeIndexedPAFAdapter` declares the slot too.

A failed info read is not terminal: the display resolves off the slot, and the
primary fetch raises the real error. The primary fetch is deliberately not gated
on the info, since gating costs one round trip before every first paint to avoid
one refetch for a disagreeing file.

### Identity continuity across the switch

**Nothing user-visible may key off which tier is loaded.** A menu entry gated on
`hasCigarData` appeared and vanished during zoom, which is the same failure.

A coarse row is its fine row with the CIGAR replaced, so `pafIdentity`
(`@jbrowse/cigar-utils`) reads the same bytes on both tiers and lands on the same
rung. `make-pif` must not restate the coarse row's `de:f:`; two restatements
shipped broken:

- A private copy of the chain that skipped the `id:f:` rung `pafIdentity`
  honours, so an odgi-untangle PAF coloured differently zoomed in and out.
- `blockLen === 0` wrote `de:f:0` (100% identity) where `pafIdentity` returns 0.

Never recompute divergence from the CIGAR: an M-style `cg` folds mismatches into
`M`, so a recompute reports ~0 divergence. Coordinates and `num_matches`/
`block_len` stay verbatim; nothing is apportioned.

### What the coarse tier solves

The coarse tier cuts per-alignment cost (no CIGAR bytes or parse, no indel
instances, tight bboxes), which suits few huge alignments such as liftOver
chains. It does not reduce alignment count, so for many short alignments (dense
all-vs-all pangenomes, human-vs-mouse) the bottleneck stays N.

Read-time binning is declined: reading and parsing N lines is ~66% of the fetch (construction and everything after is ~34%)
and is upstream of anything an adapter could bin, so binning is capped near 1.5x.
ADR-039 holds the profile and the decision. Don't reintroduce runtime collinear
chaining (a `maxGap` heuristic, removed as unreliable and zoom-dependent); a
precomputed merge would need LIS / target-monotonicity. A precomputed binned tier
in `make-pif` is the only option that cuts the dominant read cost, and it needs a
format change.

The `parsePAFLine` offset walk and the no-spread feature builders carry the
measured speedups below.

<!-- BEGIN GENERATED MEASUREMENT paf-line-read-path -->

_Generated by `pnpm autogen` — edit the source, not this block._

| one row parsed and built   |  rows | tab offsets | offsets + no spread |    control |
| -------------------------- | ----: | ----------: | ------------------: | ---------: |
| minimap2 PAF, 10 tags      | 1,000 |  1.10-1.20x |          1.62-1.78x | 0.98-1.02x |
| fine PIF tier, ~1.8kB rows | 4,000 |  1.15-1.41x |      **1.60-2.19x** | 0.99-1.05x |
| coarse PIF tier, no CIGAR  | 4,000 |  1.11-1.58x |      **1.55-2.34x** | 0.99-1.05x |

<!-- END GENERATED MEASUREMENT paf-line-read-path -->

### Coarse-by-default and what it costs

Coarse-by-default roughly doubles PIF record count. A coarse row keeps every
optional tag and drops only the CIGAR, so the tier's value is
`coarse_bytes / fine_bytes`, a function of CIGAR weight per row. The crossover is
around 30-50 kb blocks, where CIGAR bytes start to exceed the rest of the row.
At small blocks `auto` gives up the indel wedges to read ~11% fewer bytes, a bad
trade in fidelity.

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-tier-bytes -->

_Generated by `pnpm autogen` — edit the source, not this block._

| block len | CIGAR bytes/row | coarse/fine bytes | file vs `--no-coarse` |
| --------- | --------------- | ----------------- | --------------------- |
| 1.5 kb    | 12              | **0.89**          | 1.89x                 |
| 10 kb     | 72              | 0.66              | 1.66x                 |
| 50 kb     | 360             | 0.30              | 1.30x                 |
| 200 kb    | 1.4 K           | 0.10              | 1.10x                 |
| 5 Mb      | 36 K            | **0.005**         | 1.00x                 |

<!-- END GENERATED MEASUREMENT pif-coarse-tier-bytes -->

That table is about disk. What the tier saves a reader, on one hosted file at
whole-genome zoom, is the wire-bytes table. The coarse tier returns rows that are
far smaller, not far fewer; the difference is the CIGAR.

<!-- BEGIN GENERATED MEASUREMENT pif-tier-wire-bytes -->

_Generated by `pnpm autogen` — edit the source, not this block._

| one whole-genome pass, hs1 vs mm39 | bytes over the wire | rows returned | range requests | bytes/row |
| ---------------------------------- | ------------------: | ------------: | -------------: | --------: |
| coarse (no CIGAR)                  |         **1.31 MB** |        43,839 |              6 |        30 |
| fine (per-row CIGAR)               |            64.23 MB |        75,076 |             22 |       856 |

<!-- END GENERATED MEASUREMENT pif-tier-wire-bytes -->

hs1 vs mm39 is a liftOver chain converted with `chain2paf` and `make-pif`. The
chain is a source format, not the adapter: the resulting PIF loads through
`PairwiseIndexedPAFAdapter`, which declares `coarseBpPerPxThreshold`.

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-fold-bytes -->

_Generated by `pnpm autogen` — edit the source, not this block._

| coarse tier of hs1 vs mm39, one perspective |   rows | uncompressed |        gzip | rows with cr | fold share of bytes |
| ------------------------------------------- | -----: | -----------: | ----------: | -----------: | ------------------: |
| split pieces, no CIGAR (before 2026-09-02)  | 75,738 |      7.24 MB |     2.01 MB |            0 |                  0% |
| coarse CIGAR (cr:Z:)                        | 75,076 |      9.79 MB | **3.41 MB** |        5,047 |                 26% |

<!-- END GENERATED MEASUREMENT pif-coarse-fold-bytes -->

Two thirds of the fold's bytes are the 5-10 kb indels the half-gap rule keeps,
which are sub-pixel at the threshold and the price of the interpolation bound.

Two levers, neither built:

- **Slim the coarse row.** Most of a small-block coarse row is minimap2 chaining
  internals (`ms AS nn cm s1 s2 rl zd`) that no zoomed-out ribbon reads. The
  passthrough in `pif-generator.ts` is deliberate: it keeps coarse feature detail
  matching the fine tier.
- **Decline the switch when it doesn't pay.** `make-pif` would write the ratio
  into the `#pif` header and `resolveLodTier` would read one more field, through
  the existing `CoreGetInfo` channel.

Related: [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md), `agent-docs/ARCHITECTURE.md`
("Genome-size limits"). The open follow zoom-flip is in
[one-zoomed-row-forces-a-genome-wide-fine-fetch](../ideas/waiting-on-a-number/one-zoomed-row-forces-a-genome-wide-fine-fetch.md).

## The second synteny fetch, on the target axis

`executeSyntenyFeaturesAndPositions` queries the query axis (the top
`LinearGenomeView` row). With `showOffscreenMates` on, a second query runs on
the target axis, its ribbons flip into the query perspective and draw, and the
class with no second endpoint is marked on the target axis (class B in
[Four classes](#four-classes)).

The two fetches are disjoint by where the query end lands, so `f.id()` still
dedupes within each and no id or join key crosses between them. A wrong
predicate is the failure mode, tested against the same region set the first
fetch received; `bidirectionalFetch.test.ts`'s no-double-draw case guards the
doubled-alpha artifact. Feature ids are not comparable across a tiered PIF's
two tiers, and both fetches run at one `lodMode`, so none cross.

### `syntenyId`

`plugins/comparative-adapters/src/util.ts` gives each alignment a
perspective-specific `uniqueId` and a perspective-stable `syntenyId`
(`rowIndex ?? fileOffset`).

| adapter | `syntenyId` | stable across perspectives? |
| --- | --- | --- |
| MCScan, BLAST, in-memory PAF | row or record index | yes |
| PIF v2 | `pi:i:` input-row tag | yes |
| PIF before v2 | `fileOffset` | no |
| all-vs-all PAF | `record * 2 + (flip ? 0 : 1)` | no, deliberately |

- PIF writes both perspectives as separate lines per PAF record and sorts the
  whole file before bgzip, so `fileOffset` relates nothing. The `pi:i:` tag
  carries the input row when the header declares version 2.
- All-vs-all numbers the two sides apart because they are separate drawables,
  and `markReciprocalDuplicates` has already decided which restatements to
  collapse. A join key would fight that pass, so the two-axis dedupe must be a
  no-op there.

### Costs of the second fetch

- A whole-genome PAF pays two fetches per level. In-memory adapters share one
  `createSharedSetup` download, so the second is a walk over parsed records; an
  indexed adapter pays a real second query scoped to the target row's window.
  This cost is why the setting shipped off first.
- Justify changes to this fetch by completeness of the dropped alignments, not
  by refNames. The refName class has a cheaper fix (canonicalize two channels on
  receipt), and `SyntenyResolveMatchingRegion` still needs the inverse rename
  either way.
- How much the second query recovers depends on which genome is on top; measure
  the case in hand rather than reusing a number.

## Off-screen synteny mates, drawn as something other than a ribbon

A synteny band draws a ribbon only when both ends land on a displayed region.
Without this feature, a peach locus syntenic to a grape contig the facing row
does not show looks identical to a locus syntenic to nothing. The "Off-screen
mates" checkbox (`showOffscreenMates`, on by default) draws those alignments as
marks in a strip at the band edge, labelled with the contig they point at.

`OffscreenMateOverlay` is a second 2D canvas over the level's, with
`pointerEvents: none`. The level's own canvas belongs to the rendering backend
and may be WebGPU, and the ribbon shader spans the full gap between the two axes
by construction, so a part-height mark does not fit the instance format. Do not
approximate a mark with a degenerate ribbon: the full-height vertical band reads
as an alignment to the locus below it.

### Four classes

| class | anchor | mate | why no ribbon | decided | marked on |
| --- | --- | --- | --- | --- | --- |
| **A** | visible query window | no target region reaches it | no second endpoint | worker, per fetch | query axis |
| **B** | no query region reaches it | visible target window | never requested | worker, per fetch | target axis |
| **C** | visible query window | contig the target displays, scrolled off | `overdrawPx` cull | main thread, per repaint | query axis |
| **D** | contig the query displays, scrolled off | visible target window | `overdrawPx` cull | main thread, per repaint | target axis |

- **A** costs nothing to recover: the adapter returns every alignment anchored
  in the query window whatever its mate, and the decorate loop discards those
  whose mate fails `v2RefNames.has(mate.refName)`. The query axis is the top
  view, so which genome is on top decides how much is free. Never quote one
  percentage for the feature; it is a property of the stacking.
- **B** needs [the second query on the target axis](#the-second-synteny-fetch-on-the-target-axis).
- A and B are decided by locus, not contig: the worker marks at each projection
  drop site (`markUnplaced`), and the target fetch asks `findRegionEntry`
  against the displayed regions before flipping anything.
  `bidirectionalFetch.test.ts` holds all four classes.
- **C and D cannot be decided in the fetch.** The facing row pans a full
  `syntenyPanBufferPx` without refetching, so a mark decided at fetch time
  would sit beside a ribbon it claims does not exist. `culledRibbonMates`
  restates the `isRibbonCulled` band in the facing axis's cumBp, so one
  comparison decides both and a mark and its ribbon cannot both draw. It reads
  the instances, not the feature lanes: `starts`/`ends` are untrimmed, and
  transparent-CIGAR mode has no single instance per block. The extent on
  `mateAxis` skips a facing row whose band already spans every mate, which is
  the common zoomed-out state.
- **A row's strip is complete if and only if that row was queried.** The upper
  row always is, so A and C are whole. B is never requested and D is requested
  only within the pan buffer, so one fetch holds an arbitrary fraction of it,
  which the tooltip count would then misreport. `laneData` enforces the rule in
  the one place draw, hit test, tooltip count and SVG export all read.
- Marks are placed from `views[level]`, the level's upper row, because the
  lower row's ruler puts every mark at a wrong offset. The two strips sit on
  opposite band edges, which lets one hit test answer for both.

A chain clipped inside a CIGAR gap gets a one-base mate locus, so its click
frames 20kb around it. Marking the unclipped span would frame the whole chain.

### Drawing

- The band is the drawing unit: one call takes every lane. Label rule: a name
  may not share a baseline, or come within a row of one, with a name already
  placed. Between stretches at the same x, the call takes one from each lane
  before a second from either.
- What a strip draws and names is decided by aligned bp, see
  [ADR-138](../architecture-decision-records/adr-138-aligned-bp-ranks-and-gates-the-off-screen-mate-marks.md).
  The hover leads with that sequence off the per-contig `alignedBp` tally, so it
  stays O(contigs) per pointer move.
- The strip is one path, not a fill per mark. The mark colour carries alpha, so
  per-mark fills darken with density until the strip reads as a solid ideogram.
- Marks are the background and the label is the finding, so marks use
  `text.secondary` at 0.35 alpha and labels use it at full strength.
- Marks obey `minAlignmentLength`, and a sub-pixel mark is floored to a visible
  tick.
- Hover and click share `offscreenMateAt`. A mark can stand for a run of anchors
  (`MIN_OFFSCREEN_MATE_WIDTH_PX`), so the click navigates to the union of the
  mate spans under the pointer; picking one anchor arbitrarily sends the same
  mark to different places at different window widths. The span is floored to
  `OFFSCREEN_MATE_NAV_MIN_BP`.
- Hover is the only place the per-band count shows, via `OffscreenMateTooltip`
  through `ComparativeTooltip`. The hit test lives in the level's pointer
  handlers ahead of the ribbon pick and answers only within the strip height,
  tested before any alignment so hover cost is independent of mark count.
  Draw and hit test share `offscreenMateStrips`.
- `SVGOffscreenMates` is one layer per level after every display's ribbons,
  running the same `drawOffscreenMates` through `PaintLayer`, with a `side` per
  axis. The export carries marks whenever the setting is on.

### Click destination

`mateNavDestination` resolves the class, coordinate and locstring before the
click takes anything, so an unresolvable mark leaves the viewport capture and
follow anchor untouched and notifies. `offscreenMateDestination` is the one
resolver the tooltip and click share, and `coord0` becomes 1-based through
`assembleLocString` before display.

- A click never removes a region and raises a snackbar with an **Undo** that
  restores regions, zoom and scroll. With the follow on, the click takes the
  anchor, or the follow re-asserts the row's old position.
  `LinearSyntenyOffscreenMateFollow.test.tsx` holds it.
- A contig the row lacks is appended whole. For a contig the row shows slices
  of, the click adds a slice in the largest gap holding the locus, trimmed so
  two regions of one contig never overlap (`clipLargeBlockToWindow` assumes
  that), beside its neighbour and running its way. A locus no gap holds is shown
  in the slice holding its centre. The gap is chosen by the locus, not the
  framed window, because `navSpan` clamps the window to the contig.
- An aliased region is respelled to the canonical refName in place, keeping
  extent and orientation, because `navTo` compares `displayedRegions` refNames
  raw.
- The scroll class (C, D) navigates with the row's spelling off `pxToBp`, not
  the mark's canonical one, and its staleness test canonicalizes both sides;
  `===` silently did nothing for an alias. It centres the row on the drawn span
  (`mateCumBp`) at the row's zoom, or padded by `OFFSCREEN_MATE_NAV_GROW` where
  the span does not fit, capped at the widest window the row can show. A flight
  goes through `flyToFit`, which widens from the zoom the flight in the air is
  heading to.
- `LinearGenomeView.flyTo` (`flyTo.ts`) plays the Van Wijk arc for the scroll
  class and reads back what it wrote each frame, so Undo, a wheel zoom or a drag
  ends it. The show class is not flown: `showRegions` changes the row's regions,
  so no coordinate space holds both ends. `animationMode` turns it off.
- The arc crosses ~30 fetch buckets (`bucketBpPerPx`) but costs one extra synteny
  RPC, because the 500ms leading-edge debounce absorbs the excursion. Leave
  `RHO` and the `fetchInert` seam alone until a heavier file says otherwise.

<!-- BEGIN GENERATED MEASUREMENT synteny-mate-flight -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm                     | synteny RPCs, same 3.4s window | widest window reached | ms to land |
| ----------------------- | -----------------------------: | --------------------: | ---------: |
| instant jump (centerAt) |                              1 |          0.4Mb (none) |          0 |
| flight (flyToCenter)    |                              2 |               210.7Mb |        992 |

<!-- END GENERATED MEASUREMENT synteny-mate-flight -->

### Cost of the marks

<!-- BEGIN GENERATED MEASUREMENT offscreen-mate-overlay -->

_Generated by `pnpm autogen` — edit the source, not this block._

|   marks | hover over ribbons | hover, before | hover in the strip |  one repaint | SVG export layer |
| ------: | -----------------: | ------------: | -----------------: | -----------: | ---------------: |
|   2,767 |           <0.001ms |       0.043ms |            0.022ms |      0.433ms |            90 KB |
|  50,000 |           <0.001ms |        1.34ms |            0.848ms |      2.888ms |         1.303 MB |
| 250,000 |           <0.001ms |       9.061ms |            4.326ms | **17.435ms** |         6.624 MB |

<!-- END GENERATED MEASUREMENT offscreen-mate-overlay -->

Hover is independent of mark count. The repaint column is layout and path
building, not rasterization, and at 250k marks that alone is a frame. If it is
worth attacking, use a per-pixel-column occupancy pass rather than a rect per
alignment; label placement runs off the same rects, which makes that more than a
draw-loop change.

<!-- BEGIN GENERATED MEASUREMENT culled-ribbon-mates -->

_Generated by `pnpm autogen` — edit the source, not this block._

| features | instances | build, per fetch | one repaint | control (no mate lane) | repaint, band covers | hover over ribbons |
| -------: | --------: | ---------------: | ----------: | ---------------------: | -------------------: | -----------------: |
|   10,000 |    30,000 |           0.51ms |      1.03ms |                 0.93ms |                  0ms |                0ms |
|   50,000 |   150,000 |            2.9ms |      8.86ms |                 6.97ms |                  0ms |            0.001ms |
|  100,000 |   300,000 |           4.86ms |     15.04ms |                15.32ms |                  0ms |            0.001ms |
|  250,000 |   750,000 |          12.38ms |     42.07ms |                47.66ms |                  0ms |            0.001ms |
|  500,000 | 1,500,000 |          23.27ms | **166.1ms** |               168.39ms |                  0ms |            0.001ms |

<!-- END GENERATED MEASUREMENT culled-ribbon-mates -->

`build` is the only new work from classes C and D, once per fetch. `repaint` and
`control` track each other, so the per-entry band test costs nothing.

`website/scripts/probe-mate-density.ts` measures what a window keeps and drops
against the live demo.

## Synteny picking, measured

`syntenyPickEngine.ts` answers a hover by stabbing a `flatbush` index of
**x-hulls** (one per pickable instance, plus one per tiled feature, see
[below](#a-tiled-feature-is-picked-as-one-body)) and testing what comes back
exactly. Two facts about that shape drive everything:

- **The index is 1D.** A box is `[minX, 0, maxX, 1]`, because a ribbon always
  spans the whole track height. Only horizontal extent discriminates.
- **A hull is `[min, max]` over corners on BOTH axes.** A ribbon joining query
  1 Mb to target 900 Mb has a hull spanning that whole distance, however narrow
  the alignment is at either end.

The index therefore discriminates well when alignments are **collinear** and not
at all when they are not.

### The measurement

300k instances, lengths `200 * exp(rnd * 9)`, 1400px canvas, 3.1 Gbp axes,
viewport parked mid-genome, min of N. One arm each: these locate a mechanism and
are not speedups ([BENCHMARKING.md](BENCHMARKING.md)). Fixtures differ only in
pairing: **collinear** (target within 100 kb of query, two related genomes) and
**random pairing** (an all-vs-all PAF). `kept` counts entries that survive the
pickable-width exclusion (at least 1px on either axis).

Times come from Chrome via an esbuild bundle, cross-checked in node. Jest
inflates this code 6-30x non-uniformly, so jest numbers are wrong. Chrome clamps
`performance.now()` to ~0.1ms, so sub-0.1ms reads as 0.

**Collinear: the index works.**

<!-- BEGIN GENERATED MEASUREMENT synteny-pick-collinear -->

_Generated by `pnpm autogen` — edit the source, not this block._

| zoom         | kept (of 300k) | candidates @0 skew | warm pick | rebuild |
| ------------ | -------------: | -----------------: | --------: | ------: |
| whole-genome |          **0** |        — (no tree) |         — |     1ms |
| 1/100        |           143k |                 16 |    <0.1ms |    33ms |
| 1/10k        |           299k |                 19 |    <0.1ms |    58ms |

<!-- END GENERATED MEASUREMENT synteny-pick-collinear -->

Candidates stay in the tens at every zoom, because only a handful of hulls
cover any pixel.

**Random pairing: the index does not.**

<!-- BEGIN GENERATED MEASUREMENT synteny-pick-random -->

_Generated by `pnpm autogen` — edit the source, not this block._

| zoom         | kept (of 300k) | candidates @0 skew |  warm pick | rebuild |
| ------------ | -------------: | -----------------: | ---------: | ------: |
| whole-genome |          **0** |        — (no tree) |          — |   1.2ms |
| 1/100        |           143k |         **71,342** |  **5.8ms** |    42ms |
| 1/10k        |           299k |        **149,307** | **12.5ms** |    77ms |

<!-- END GENERATED MEASUREMENT synteny-pick-random -->

**At zero skew** about half the tree covers any given x, because half the hulls
span the canvas. Each candidate pays `projectCorners` + `isRibbonCulled` at
~80ns, so 12.5ms<!--m:synteny-pick-random.1-10k.warmPickMs--> fills a 16 ms frame and
an all-vs-all hover reads as sluggish.

### A tiled feature is picked as one body

`cigarMode: 'matches'` (Transparent indels) replaces a feature's full-span
`KIND_BASE` quad with one `KIND_BASE_TILE` per match segment
(`buildSyntenyGeometry.cigarSegmentKind`), so in that mode no instance covers a
feature. Tiles alone lose the feature twice: the see-through indels between
tiles answer no hover, and each tile is judged pickable on its own width while
the reader sees them overlap into one band. Colored mode keeps every quad under
the indel wedges and has neither problem.

`buildPickIndex` therefore enters a **synthetic feature body** per run of tiles
for one feature: the first tile's start edge joined to the last tile's end edge,
clipped to the emitted tiles. Nothing draws it, and it is the only tree entry
that is not an instance. `syntenyTiledPick.test.ts` pins three properties:

- **It sits in draw order**, inserted immediately before its own first tile, so
  the body loses to its own tiles and to later features, as the `KIND_BASE` quad
  did. `syntenyPickDrawOrder.test.ts`'s contiguity property makes the look-ahead
  from a run's first tile valid.
- **It obeys the pickable-width exclusion**, measured on the whole run, so a
  hairline feature stays out of the tree and `kept` stays 0 at whole-genome zoom.
- **Colored mode is unchanged**: no tiles, no runs, no bodies.

The pick-side derivation avoids a pick-only instance kind that both shaders and
all three draw paths would have to skip.

**Ribbon the geometry never emitted stays unpickable.**
`visitCigarRenderedSegments` labels a merged segment by its last op, so match
bases merged into a segment that a rendered indel closes drop whole in
transparent mode. Where match runs are sub-pixel and the indels between them are
not, nothing paints, so there are no tiles and no body. See
[ideas/ready/a-merged-cigar-segment-is-labelled-by-its-last-op.md](../ideas/ready/a-merged-cigar-segment-is-labelled-by-its-last-op.md).

### Two things the numbers correct

**A whole-genome-zoom hover is free only because nothing is pickable.** At that
zoom essentially every ribbon is sub-pixel, so `kept` is 0, there is no tree, and
a cached "nothing here" answers. One zoom step in, `kept` is about half the
instances and the wide-hull case applies. The exclusion made the sub-pixel case
free, not picking fast.

**Skew does not cost on the data where picking is slow.** In the wide-hull case
a 500,000px skew moves candidates only from 71k to 108k, so `MAX_PAN_SKEW_PX`
cannot be tuned against that arm. The collinear arm governs it, and there
candidates grow ~1 per px of skew (about 0.1ms at 1000px, 1.2ms at 20000px)
against a ~33ms rebuild paid once. 2000px is a conservative balance point, and
20000px would still amortize.

### Probing picking yourself

- **Park the viewport mid-genome.** Near cumBp 0 the widened stab runs off the
  left edge of the data and caps candidate growth for a reason unrelated to the
  index.
- **Do not measure under jest.** Bundle with `esbuild --bundle` and run under
  node or Chrome.
- **Do not take min-of-N over a loop that reuses the pick cache.** The first rep
  stores the index at the skewed pan and later reps answer warm, hiding a
  rebuild that happens on every real pan. Use a fresh cache per rep to measure
  rebuilds.
- **`kept` is not `instanceCount`.** The exclusion is scale-dependent, so any
  cost statement has to name the zoom.

### The per-candidate loop, and ideas parked against it

Survivors of the stab get `projectCorners`, `isRibbonCulled` and
`ribbonPerpWidth` (a `sqrt`) after an `Int32Array(...).sort()`. Two changes are
parked:

- **Push `minAlignmentLength` and `isInstanceInvisible` into `flatbush.search`'s
  `filterFn`.** By default `minAlignmentLength` is 0 and `computeSyntenyColors`
  never produces alpha < 3, so the filter rejects nothing and the per-leaf
  closure is pure overhead. Revisit gated on `minAlignmentLength > 0`, the
  whole-genome PAF case.
- **Drop the sort**, tracking the best index and skipping candidates below it.
  This removes an O(n log n) but loses the descending walk's early exit, so
  candidates arriving in ascending order build many more paths. Measure how many
  reach `buildFeaturePath` on a fragmented alignment first.

`pickFeatureAtPoint` omits the `isMarker` arm of `isRibbonCulled` that
`drawSyntenyTrack` passes. This is harmless: a marker's edges are single points,
so the pickable-width exclusion keeps it out of the index. Revisit if the
exclusion relaxes.

### Not worth trying against the wide-hull case

A tighter cap, a bigger `flatbush` node size or `filterFn` filtering does not
help, because the candidates genuinely cover the stab point. The hull is not a
selective key for a ribbon whose ends are far apart. A fix means indexing
something other than the hull (per-axis intervals tested pairwise), a design
change nobody has costed.

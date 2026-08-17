# LinearAlignmentsDisplay

Settings storage and fetch/render tiering: `agent-docs/ARCHITECTURE.md`. The arc
band: [reference/ARC_BAND.md](../../../../agent-docs/reference/ARC_BAND.md).
Layout stays main-thread per
[ADR-053](../../../../agent-docs/architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md).

## Which getter decides what a setting invalidates

`rpcProps()` refetches, `groupLayoutContext` relayouts, `readColorContext`
rebakes read colors, `arcsByGroup` rebuilds arcs, `renderState` repaints. Tiers
2-5 are auto-wired by MobX; **tier 1 is manual**, the worker boundary defeating
tracking.

The first three tiers are also three TYPES — `WorkerPileupData` →
`LaidOutPileupData` → `PileupDataResult` — so a pass that reads a row cannot be
handed unlaid data and the worker cannot state a field it has no answer for
(RenderAlignmentDataRPC/CLAUDE.md §"One value, three types").

- **Never put a fetch-result derivative in `rpcProps()`** — infinite loop.
  `colorTagMap` is the canonical trap.
- **A color input in `groupLayoutContext` costs a full relayout** and loses the
  recolor fast path, since layout allocates a fresh `readYs` the upload memo
  keys on. A value the layout only _sometimes_ spends goes in as a thunk.
- **Tier 4 repaints the whole canvas**, so per-mousemove state must not be
  there. Hover is a React overlay; selection stays in `renderState`.

## A split segment's colour is framed by the chains on screen

`readChainHasSupp`'s 1/2 is a chain-level **frame**. The worker's answer is
overwritten twice on the main thread — `reconcileChainSuppAcrossRegions` (one
molecule across regions) then `consensusChainStrandFrames` (molecules about each
other) — because the worker frames on `primaryStrand` and **on a foldback the
primary flag is arbitrary**. Alternatives measured 58/52/61% agreement where the
consensus reaches 100%.

- **Votes are purity-normalized, not length-weighted**, or one long arm — also
  the primary — outvotes everything and the pass flips nothing.
- **A chain seen at ONE locus is frozen**, since there its frame and its mapping
  strand are the same statement. Frozen chains still vote.
- The global sign is anchored separately, or the pileup swaps red for blue
  between renders of identical data.

Panning can change a frame, and that is accepted. **Don't re-derive a frame at a
call site** — read `readChainHasSupp`. `framesUnpairedChainStrand` is the single
statement of when framing is live.

## A lane, not a group key

**`lanes` is where a group key becomes data** — the raw map, the laid-out map,
the two arc feeds, the sashimi sides, and the collapse/override state, per lane,
in stacking order. A `renderSections` entry IS its lane plus band geometry, so a
consumer walking sections has every per-lane answer in hand and none of them are
optional. Don't reach back into a by-key collection from a call site that
already has a lane; don't add a twelfth keyed collection when a lane field will
do.

**Ungrouped is the one-lane case** (key `''`), and no-data is the one SYNTHETIC
lane (`drawnLanes`) — that is why `sections` has no ungrouped branch.

## Six grouping questions, and they are not one object

They read as near-duplicates and are not. Pick from this list rather than adding
a seventh, and note **which side of the fetch each answers on** — that is also
why they stay separate getters: bundling them into one computed would put every
reader of one on all the others' inputs, across three invalidation tiers.

Answerable from settings alone, before any data:

- **`prefersOffset`** — will the grouping be HONORED? Positions the track label,
  which is placed before data lands and must not jump afterwards. Chain mode
  degrades a per-read dimension (`groupByForMode`), so this is not "is `groupBy`
  set".
- **`canCollapseGroupRows`** / **`canSizeGroupHeights`** / **`canSortReads`** —
  may the control be OFFERED? Each is absent rather than disabled where it would
  write a slot no getter reads.
- **`collapseGroupRows`** — is the collapse in effect (and it puts depth in the
  overlap tint, so the collapsed path must **not** run `mergeSpans`).

Answerable only from the fetched lanes:

- **`showsGroupLabels`** — are the chips and dividers drawn? What anything
  dodging a chip must ask: one lane still draws a chip while
  `scalebarOverlapLeft` is 0.
- **`isGrouped`** (>1 lane) — the scroll model, and nothing else. Ungrouped
  keeps coverage sticky; grouped scrolls the whole stack.
- **`rpcDataMap.size === 0`** — has data arrived? **Never gate first paint on a
  laid-out map**, since a grouped fetch over an empty region partitions to zero
  lanes and the overlay never clears.

`hiddenGroupKeys` must be filtered out of the **cross-group** derivations too
(coverage stats, legend, sashimi, arcs) — for arcs, before `poolArcScale`.

## Four row caps, and only two are an affordance

**A layout pass is handed its cap WITH the policy that set it** (`RowCap`), and
records that label when the cap actually clips. So `groupClippedBy` is a field
read: `'budget'` (the lane's slice of the viewport), `'ceiling'` (display-wide
`maxHeight`), `'override'` (a cap the user set) or `'collapse'`
(`collapseGroupRows`).

- `'budget'` and `'collapse'` offer the chip's expand, which banks an override
  OF `maxHeight` — and an override opts the lane out of both.
- `'ceiling'` draws `PileupTruncationRule`, deliberately inert and not an alert
  — reads collapsing onto the bottom row is the cap working.
- `'override'` fires neither: what a user's own cap hides is their own doing.

**Don't reconstruct which cap it was.** That answer used to come from comparing
a lane's row count back against the ceiling, which is true whenever the two caps
merely differ — a single-section grouping sat wholly in that hole. `tighterCap`
is the one place the budget and the ceiling are compared, and a tie is the
ceiling, since expanding there hands back the identical cap.

## Read height vs track height

**`fit` is the sole `heightMode` that also drives the read-height axis**; every
special case follows, including the fit cap using the Normal height.
`self.featureHeight` is the fit-squeezed value — editors that mutate the size
read `configuredFeatureHeight` (`resolveConf`, promotable). `fittedHeightPx` is
a **pitch**, `featureHeight` a **body**; the volatile bridging them breaks a
MobX cycle, so don't collapse it.

## Hit-testing: every draw gate needs a matching hit gate

`PILEUP_LAYERS` settings are repaint-tier and the arrays are fetched either way,
so a layer switched off keeps its marks hoverable over blank pixels unless
`performHitTest` gates too. `HIT_GATES` (`hitTestGateParity.test.ts`) is
exhaustive over `PileupLayerId`, so a new layer is a compile error until it
states one of four stories: gated on a named `HitTestOptions` flag, empty of
data when its setting is off, unconditionally drawn, or a decoration
`hitTestFeature` already answers for.

**Zoom is the second gate axis, and `HIT_GATES` cannot see it.** That record
varies settings; `performHitTest` also drops the per-base tests above
`SNP_HIT_MAX_BP_PER_PX`. So a layer filed as `alwaysDrawn` can still go inert on
zoom alone — which `clip` did, drawing a fixed 1px bar at every zoom while
answering nothing past 25 bp/px. The whole CIGAR priority chain therefore lives
in `hitTestCigarItem`, which takes `bpPerPx` and decides the regime itself; the
zoomed-out steps used to be spelled a second time at the call site and clips
were missing from the copy.

The converse gap is a layer with no hit test: `readPositions` carries the read's
TRUE aligned extent, so `hitTestFeature` misses what `drawSoftclipBases` paints
past the alignment end — and a miss clears the selection and falls through to
the **browser's** context menu.

**Neither index-backed test may take `hits[0]`** — `Flatbush.search` returns
Hilbert order. `hitTestModification` picks by **distance**; `hitTestChain` boxes
whole extents so everything is at distance 0 and it picks the highest chain
index, matching `hitTestFeature`'s "last drawn wins".

## Context menu: build items from the id, not the feature

`contextMenuFeature` arrives a round trip after the click. Gate items on
`contextMenuFeatureId`; push items needing the read's own fields **after** the
id-built ones, so arriving late appends rather than shifting what is under the
cursor. Use `withContextMenuFeature` — reading `contextMenuFeature` live inside
an `onClick` gets nothing, `closeContextMenu` ran first.

## Layout and draw paths

- Chain layout is handed **neither `sortedBy` nor `largeFeaturesFirst`** — its
  rows are chains. Every ordering control curates itself out in chain mode; a
  new one that doesn't is a silent no-op, and a tag sort additionally refetches.
- `placeRect` cannot use a levels / right-edge-only array: features arrive out
  of start order in both layouts.
- On-screen and SVG export share `drawAlignmentBlocks`. Sashimi and linked-read
  bezier arcs stay interactive SVG overlays, each sharing one geometry source
  with the export; sashimi's is a model because the geometry depends on pan/zoom
  but **not** `scrollTop`.
- **No GPU pass can join two displayed regions** — one buffer per region.
  `bezierArcScope` is the one place deciding between `all`, `crossRegion` and
  `none`; read the getter, never `showBezierConnections`.
- A cross-region arc was never clipped away: each block projects bp through its
  OWN range, so the far foot is extrapolated. `CrossRegionArcsOverlay` draws the
  correct curve once in view space — geometry from `arcMarkFrom` rather than a
  lookalike, a separate z-layer above every canvas arc, and hover through
  `setHoverState` rather than a local key.
- **Which sub-band a sashimi arc draws in is decided once**, in genomic bp, by
  `sashimiDownKeysByGroup`, read by both the layout reserving the strip and the
  geometry filling it. Junction identity is `junctionKey`, refName included.
- **A band's height MINUS its reserved margin is floored at 0** where the
  expression is declared, not per consumer. If a shader computes it too, the
  `.slang` is the declaration and the CPU imports the generated twin (adr-051).
- `computeArcBand` is the single source of truth, decoupled from `showCoverage`.
  Arc and sashimi strips are reserved **per section**; `coverageDisplayHeight`
  and the fit-height row budget stay global, since re-deriving them from
  `sections` routes the fit volatile back through the layout it feeds.
- Screen-x is not start/end-ordered — keep new sashimi geometry on the
  normalized fields. In shaders use `bpToClipX`/`bpToLinear`, never
  `hpClipX(hpSplitUint(…))`.

## Reaching into the arc band

- **`hitTestArcBand` is the single entry point.**
- **Ask `hasArcBandInk`, not `numArcs`** — a lane with only off-region partners
  carries ticks and no arcs.
- **Across lanes, ask `computeArcsByGroup`**, not a walk of `arcsByGroup`, and
  after regionization.
- **`runHitTest` asks the arc band FIRST and returns
  `arc ?? performHitTest(…)`** — the one place "an arc outranks the band under
  it" is stated, and outranking it means `performHitTest` is skipped rather than
  computed and discarded.
- **`isFlatArcShape` answers "does this draw as a bar", never "does this have an
  insert size"** — only `ARC_SHAPE_FLAT` has a TLEN.

# In-track stacked Group-by for LinearAlignmentsDisplay — build plan

## Status

Proposal, targeted for build. Decision: invest in **in-track stacked grouping**
as the primary group-by experience. Thesis: a good grouped experience drives
demand, so we build it rather than waiting for demand to justify it.

Subtrack mode (`createGroupTracks`/`removeGroupTracks`) is **not removed** —
old sessions keep working and it remains the sensible fallback for very high
group counts — but it stops being the default and receives no new investment.

Explicitly **off the table until in-track ships**: any standalone effort to
streamline the *subtrack* flow (more dimensions wired onto `createGroupTracks`,
dialog polish on the split-into-tracks path). That work was previously floated as
a low-risk "Bet 1" to gauge demand; the decision is the opposite — build the
in-track experience first, on the thesis that the experience drives the demand.
The only subtrack code that changes during this work is leaving the legacy path
reachable for old sessions.

## Goal

Choosing "Group by <dimension>" renders the reads as N stacked sections inside a
single display: each section is coverage + pileup for one group, sections share
one coverage scale, the whole thing scrolls as one track. No new session tracks,
no track-list clutter.

## Why in-track (the value subtracks can't give)

- **Shared coverage scale** across groups → groups are visually comparable
  (a 2× haplotype looks 2× tall). Subtracks autoscale independently.
- **Single partitioned fetch** — one BAM query partitioned in the worker instead
  of N flag-filtered queries.
- **One track entity** — unified scroll, no `(grouped)` category clutter, no
  manual cleanup step.

## Staged build (each stage shippable)

### Stage 1 — Worker partitions one fetch into N groups (no visual change)

`RenderAlignmentDataArgs` gains `groupBy?: { type, tag? }`. Add it to `rpcProps()`
(tier-1 refetch) — per-group coverage **must** be computed in the worker; you
cannot cheaply main-thread-slice depth.

In `executeRenderAlignmentData.ts`:

- After fetch, `inputFeatures` is a plain `Feature[]`. Compute a group key per
  feature: flags (`readFlags`) for strand / first-of-pair / pair-orientation /
  supplementary / duplicate; the already-extracted tag value for HP/RG; `@RG`
  header lookup (`parseSamHeader`, `shared/util.ts`) for sample/library.
- Partition into ordered groups: stable sorted keys, untagged/unphased last.
- Refactor the spine into `buildGroupResult(features)` and call it per group —
  **but hoist genuinely-global steps out first**:
  - `detectSimplexModifications` (`extractFeatureArrays.ts`) resolves mod types
    across the full read set. Run once over all features, pass the resolved set
    into each group, or mod coloring differs per section.
  - Per-group coverage frequency normalization is **correct, not a bug** — each
    group's SNP/mismatch bars are relative to that group's own depth.
- Return `{ groups: [{ key, label, data: PileupDataResult }] }`. Ungrouped = one
  group with `key:''` so there is a single uniform code path.

Ship gate: `rpcDataMap` readers read `groups[0].data`. Zero visual change.

### Stage 2 — Model: sections, shared coverage domain, height/scroll

- `rpcDataMap: Map<number, GroupedAlignmentsResult>`. Every reader iterates
  groups (`laidOutPileupMap`, `coverageStats`, `arcsComputed`, `readIdIndexMap`,
  `hasPairedReads`, …).
- **`sections` getter is the single source of all vertical band geometry**,
  generalizing the existing per-display `belowCoverageBands` (`model.ts`) to
  per-section. Each section emits a stack of bands:
  `{ groupKey, label, coverageTop, coverageHeight, arcBandTop, arcBandHeight,
  sashimiBandTop, pileupTop, pileupHeight, laidOut, data }` + total content
  height. **Pin arc/sashimi heights to 0 for now** — this keeps the door open to
  restoring arcs later without re-architecture.
- `laidOutPileupMap` lays out per group; `maxHeight` caps **each group
  independently** so one dense group can't starve the rest.
- **Shared coverage scale (simpler than it looks):** the shader already does
  `normalizeDepth = relDepth * (regionMaxDepth / domainMax) = rawDepth / domainMax`
  (`alignmentsUniforms.slang`, `GpuAlignmentsRenderer.ts`). Treat each group as
  its own "region" carrying its own `regionMaxDepth` in `depthScale`, and compute
  `coverageDomain` across **all** groups (which `coverageStats` already does
  across blocks). The shared `domainMax` uniform makes groups comparable — no
  rebaking, no raw-depth-in-shader rewrite.
- **Scroll/height model change (not free):** today coverage is pinned at
  `covOffset` and only pileup scrolls. Stacked sections with content-scrolling
  coverage means the height getter and scroll math sum sections. Sticky coverage
  is deferred.

### Stage 3 — Renderers loop sections (GPU + Canvas2D)

The draw path is already offset-parametrized: `covOffset`/`pileupTopOffset` +
`covYOffset` uniforms (`alignmentsUniforms.slang`, `pileupRowTopPx`), the
Canvas2D `pileupRowY(yRow, state)` helper (`rendererTypes.ts`). Generalize to
loop sections: per section set its offsets + data slice, call the existing draw,
passing the shared `coverageMaxDepth`. No draw rewrite — same entry points N
times.

### Stage 4 — Hit-test / highlights / labels / SVG

- `hitTestPipeline`: add a front step mapping screen-y → section via section
  bounds, then pass that section's `topOffset` to the existing
  `canvasToGenomicCoords`. No rewrite.
- `computeHighlightBoxes`, `computeVisibleLabels`, `renderSvg` /
  `drawAlignmentsToCtx`: same sectioning loop; they already key off
  `topOffset` + `rowHeight`.

### Stage 5 — Dialog + in-track UX (the demand driver)

This is where the payoff lives, so it gets real attention:

- Replace `GroupByDialog`'s "create separate tracks" path with a `setGroupBy`
  setting on the display. Dialog offers a "stack in this track" (default) vs
  "split into tracks" (legacy subtrack) choice.
- Dimensions: strand, first-of-pair strand, tag (HP/RG), sample/read-group,
  pair orientation, supplementary, duplicate, MAPQ-binned, base-at-position
  (via context menu). Each is a group-key generator reused across both modes.
- **Inline group dividers + labels overlay** between sections, with per-group
  read counts.
- **Collapsible sections** and per-group height so a dense group can be shrunk;
  `maxHeight` per group from Stage 2.
- Keep "Remove grouped tracks" working for old sessions that already spawned
  subtracks.

## v1 scope cuts (call out, don't silently drop)

- **Read-connections (arcs/sashimi) off in grouped mode for v1.** Restorable
  later: arcs carry genomic `yBp` (not pixel/row) and `drawArcsPass` already
  takes a `band {top,height,down}` + its own viewport, so restoring them is
  adding a `drawArcsPass` call inside the Stage 3 section loop — *because* the
  Stage 2 `sections` getter owns arc band geometry (stubbed at 0). Cost: a
  per-section arc Y-domain isn't comparable unless a shared arc domain is added
  (same uniform trick as coverage), and N arc bands eat vertical space (default
  them collapsed in grouped mode).
- **Grouping × chain mode (`linkedReads:'normal'`) disallowed initially** —
  sidesteps `buildChainMetadata`'s global read-name grouping conflicting with
  arbitrary partitions.
- **Multi-region + grouping** inherits the existing `computeMultiRegionLayout`
  limitation (sort/softclip ignored across >1 region).

## Reuse inventory (group-key extraction)

- Exists, reusable: strand flag filtering (`filterReadFlag`), tag-value
  extraction (`extractFeatureTagValue`), pair orientation (`pairOrientation.ts`).
- New worker logic: first-of-pair (flags 0x40/0x80 — read-level extraction
  exists in `BamSlightlyLazyFeature`/`CramSlightlyLazyFeature`, no worker
  grouping yet), sample/library from `@RG` header (`parseSamHeader` exists, not
  wired to read level), duplicate (flag 0x400 — not extracted anywhere).
</content>

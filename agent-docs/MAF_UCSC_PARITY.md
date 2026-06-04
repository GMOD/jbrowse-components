# MAF UCSC parity + data-volume gating

Status of work on `plugins/maf` to better match UCSC MAF tracks. Two themes:
(1) render the `e`/`i` line information UCSC shows, (2) stop downloading the
pathological amount of data a multi-hundred-species alignment implies.

## Done

### 1. `e` / `i` line parsing + rendering ("double lines and good mouseovers")

- **`e` lines** (a species has no aligned bases in a block but its flanking
  blocks are chained) render as UCSC does: single line (`C`), double line
  (`I`/`n`), pale-yellow bar (`M`).
- **`i` lines** (left/right context of the preceding `s` row) feed hover
  tooltips (contiguous / intervening bases / new contig / missing / tandem dup).
- **`s` line** `strand` + `srcSize` are now captured (were discarded); used for
  the species location + reverse-strand coordinate in tooltips.

Pipeline:

| Layer | File | Role |
|---|---|---|
| Parse | `util/parseBigMaf.ts` (pure, tested) | `mafBlock` stanza → `{alignments, empties, referenceSeq}` |
| Status helper | `util/mafStatus.ts` | cast-free `toMafStatus` + `describeMafStatus` |
| Feature | `MafFeature.ts` | added `empties` map (defaulted → other adapters untouched) |
| Types | `types.ts` | `MafStatus`, `AlignmentContext`, `AlignmentRecord.{strand,srcSize,context}`, `EmptyRecord` |
| Worker | `LinearMafGetAlignmentData.ts` | threads empties + per-row tooltip metadata + block `endBp` |
| Render types | `LinearMafRenderer/mafRenderingBackendTypes.ts` | `MafBlock.{endBp,empties}`, `MafEmptyRow`, optional row coords |
| Layout | `LinearMafDisplay/components/computeVisibleEmptyLines.ts` | block extents → positioned segments |
| Draw | `LinearMafRenderer/rendering/emptyLines.ts` | single/double/pale primitives |
| Overlay | `LinearMafDisplay/components/EmptyLinesOverlay.tsx` | always-on Canvas2D layer (sibling of `VisibleLabelsOverlay`); also wired into `renderSvg.tsx` |
| Hover | `LinearMafDisplay/components/findRowHover.ts` | `RowHit = cell \| empty` discriminated union (replaced `findCellAtBp`) |
| Tooltip | `LinearMafDisplay/util.ts` + `MAFTooltip.tsx` | formats cell/empty hover |

**Key decision:** e-lines render in a Canvas2D overlay, NOT the GPU instance
buffer — they're sparse decorations, so adding a vertical-extent field +
regenerating shaders wasn't worth it. The overlay is backend-independent (works
for both GPU and Canvas2D-fallback) and mirrors how text labels already
composite.

### 2. Data-volume fetch gate (index-based)

MAF download scales as `region-bp × num-species`; the worst case is zoomed *out*
(huge region) where bases aren't even visible. The display now activates the
standard `RegionTooLargeMixin` force-load gate via a `getByteEstimateConfig()`
override (`LinearMafDisplay/stateModel.ts`). Above ~20 kb visible
(`AUTO_FORCE_LOAD_BP`) the estimated download is checked against `fetchSizeLimit`
(inherited config slot, default 1 MB) and blocked with a force-load prompt.

The byte estimate is **always from the index, never via `getFeatures`** — all
three adapters override `getMultiRegionFeatureDensityStats` (the method
`CoreGetFeatureDensityStats` calls) returning `{ bytes }`:

| Adapter | Source | Notes |
|---|---|---|
| MafTabix | tabix `bytesForRegions` via new `BedTabixAdapter.getRegionByteSize` (reached through generic `loadSubAdapter<T>`) | true compressed size incl. all species |
| BgzipTaffy | `.tai` virtual-offset span (`selectIndexEntries` blockPosition delta) | true compressed size |
| BigMaf | `span × configured-sample-count` arithmetic | `@gmod/bbi` exposes **no** per-region byte API; no gate when `samples` unconfigured |

## Not done (next steps)

### Stage 2 — `bigMafSummary` zoom-out render (the real volume fix)

UCSC ships `bigMafSummary.bb` alongside the bigMaf. It is a plain BigBed
(`bed3+4`, autoSql `mafSummary`):

```
string  chrom;       "Reference sequence chromosome or scaffold"
uint    chromStart;  "Start position in chromosome"
uint    chromEnd;    "End position in chromosome"
string  src;         "Sequence name or database of alignment"
float   score;       "Floating point score."
char[1] leftStatus;  "Gap/break annotation for preceding block"
char[1] rightStatus; "Gap/break annotation for following block"
```

One row per block×species, **size independent of block length** (no sequence),
and `bedToBigBed`'s zoom-level reduction makes zoom-out reads cheap for free.
Generated upstream by:

```
mafToBigMafSummary <db> in.maf stdout | sort -k1,1 -k2,2n > bigMafSummary.bed
bedToBigBed -type=bed3+4 -as=mafSummary.as -tab bigMafSummary.bed chrom.sizes bigMafSummary.bb
```

`leftStatus`/`rightStatus` are the same C/I/N/n/M/T chars already decoded by
`util/mafStatus.ts` — so the summary's bridge-line rendering reuses
`rendering/emptyLines.ts` and the tooltip phrasing verbatim.

**The summary is a swappable sub-adapter, NOT a bare file slot.** Declare it as
a `frozen` nested-adapter config (like `GCContentAdapter.sequenceAdapter`), not
a `summaryLocation` `fileLocation`. This is the genuinely-swappable pattern: a
BigBed today, but a tabix bed / TAF-derived / bespoke precomputed summary later
by changing the sub-adapter `type` only — the MAF adapter, display, and e/i
pipeline don't move.

> Three sub-adapter patterns exist in-tree; pick the right one:
> - **assembly-injected runtime** (CRAM/BAM `sequenceAdapter` via
>   `setSequenceAdapterConfig` from `CoreGetRefNames`) — wrong here, summary is
>   track-specific, not an assembly resource.
> - **frozen nested-adapter slot** (`GCContentAdapter.sequenceAdapter`,
>   `defaultValue:null`, built via `getSubAdapter(getConf('summaryAdapter'))`) —
>   **this one.**
> - **hardcoded type-swap** (MAF's own `util/loadSubAdapter.ts`, reuses the
>   parent snapshot + overrides `type`) — wrong: summary is a *different file*
>   with its own locations, needs its own full config, not a type-swap.

Scope:

| Piece | File | Change |
|---|---|---|
| Config slot | `BigMafAdapter/configSchema.ts` | add `summaryAdapter: { type: 'frozen', defaultValue: null }` (optional → no summary keeps Stage-1 gate) |
| Instantiate | `BigMafAdapter/BigMafAdapter.ts` | `getSummaryAdapter()` — lazy `getSubAdapter(getConf('summaryAdapter'))` memoized on `summaryAdapterP` with catch-clear, mirroring CRAM `getSequenceAdapter`. `getSummaryFeatures(region)` maps BigBed rows → `{src,score,leftStatus,rightStatus}` |
| Add-track | `MafAddTrackWorkflow` | summary cannot be auto-guessed from the data file (no standard suffix; `bigMafSummary.bb` is just UCSC's tutorial filename). Add an **optional explicit field** for the summary `.bb` location; leave `summaryAdapter` `null` when unset |
| Display gate | `LinearMafDisplay/stateModel.ts` | above `AUTO_FORCE_LOAD_BP` (the `getByteEstimateConfig` threshold), if a summary adapter is configured, fetch summary rows instead of full alignment data |
| Render | `LinearMafRenderer` + `LinearMafDisplay/components` | per-species presence bars (optionally `score`-shaded) reusing `emptyLines.ts` status primitives; coverage band = species-count depth (highest-value, most compact for 447-way) |

Removes the zoom-out download instead of just refusing it. See
https://genome.ucsc.edu/goldenpath/help/bigMaf.html.
- **q lines (quality)** — deferred; per-cell quality would break the color
  run-merge in `mafInstanceBuffer`. Best as pre-blended alpha later.
- **e/i for MafTabix / TAF** — their encodings drop e/i at conversion (MafTabix
  `field5` is s-line only, from an external maf2bed tool; TAF has no e/i concept).
  Needs encoding + tooling changes, not just viewer changes.
- **`full` vs `pack` (issue #5)** — JBrowse already renders one row per species
  (≈ UCSC "full"); low marginal value, skipped.
- **Browser verification of e-lines** — no e/i test fixture exists in the repo
  (volvox = MafTabix, evolverMammals = TAF; neither carries e/i). Parsing +
  rendering are covered by unit tests but NOT visually confirmed. To verify, point
  a track at a real UCSC multiz/cactus `.bb` (which contains e/i lines).

## Verify

```
pnpm test plugins/maf plugins/bed     # 30 suites / 268 tests
npx tsgo --noEmit -p tsconfig.json    # clean
npx eslint --cache plugins/maf/src    # clean
```

## Gotchas

- `MafAlignedRow` tooltip fields (`chr/start/strand/srcSize/context`) are
  optional on purpose so coverage/label/instance-buffer test builders don't need
  them; only the hover finder reads them.
- Reverse-strand base coordinate uses the standard MAF transform
  `srcSize - 1 - start - baseOffset` (`findRowHover.ts`).
- `getConf` isn't visible on `self` inside the relevant `.actions` block in
  `stateModel.ts`; use the free function `getConf(self, 'fetchSizeLimit')`.

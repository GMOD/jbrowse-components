# Ideas and future directions

Exploratory / fanciful concepts — not committed work. Concrete action items live
in [TODO.md](TODO.md).

## Configuration & spec layer

**ConfigurationLayer (fanciful).** A construct that acts as a "layer over" another
config schema: same slots/types, but every slot's default is whatever the parent
schema's *current value* happens to be. Use case: cascading config for subtracks
where a child overrides a handful of slots and inherits the rest dynamically. Never
built; the current `baseConfiguration` extension covers most of the practical need
(inherits the *schema*, not the live values).

**Declarative JBrowse spec.** Current config is internal MST serialization. Extend
`session-spec` to a simpler data → encoding → mark grammar (Vega-Lite style). Infer
adapter/display types, map encoding → colorBy/filterBy, fall back to raw config for
advanced features. End users write clean schemas; plugin authors keep MST power.
(`readConfObject`/`getConf` are hot-path MST traversals — caching would help.)

**R/ggplot2 export** (branch exists). Export session as an R script using
ggplot2/Bioconductor for publication figures and reproducibility:
alignments→geom_rect, coverage→geom_area, variants→geom_point, synteny→geom_segment,
with Gviz/ggbio where applicable.

**Jupyter/Quarto integration.** Embed JBrowse in notebooks via a simple API
(`jbrowse.view()`). The spec layer would simplify wiring;
`@jbrowse/react-linear-genome-view` exists but config is too complex.

## Alignments

**Curved read links.** Reuse breakpoint logic for a "link with curved lines" mode
(better orientation encoding than straight connectors).

**Long-range inter-region arcs.** UI toggle to draw arcs between distant regions.
Missing in the 1kg demo — may be a bug or unimplemented; needs reproduction.

**Auto-scale noise.** Per-track noise estimate (mean insertion rate) to auto-scale
`featureFrequencyThreshold` (noisy → strict, clean → lenient).

**Quality-aware feature fade.** Toggle to disable sub-pixel fade for high-quality
reads (Illumina/HiFi) where most mismatches are real variants, not errors.

**Legend.** Visual guide: strand colors, paired/unpaired styles, SNP colors.

**Typed-array refactor.** Worker return is flat parallel arrays — could regroup into
sub-objects (mods, sashimi, coverage). Flat is simple but long; just an idea.

**Color-by → coverage summarization.** The coverage track is already a decomposition
engine, not a flat depth bar: `snpCoverage` partitions a column's depth by base,
`modCoverage` by modification proportion, `interbaseCoverage` flags insertions/clips.
`runCoveragePipeline.ts` is a list of "compute layer → pack → draw" steps and
`modCoverage` (compute + packGpu + drawCanvas + `.slang`) is a complete template — so
new decomposition modes are new modes on an existing scaffold, not a new subsystem.
The input data (MAPQ, pair orientation/discordancy, tags, per-base quality) is mostly
already extracted in the worker for the existing color-by features.

Two distinct idioms — keep them separate:
- **Stacked partition** (like snp/modCoverage): partition the bar. Fits HP-tag, MAPQ
  bucket, strand, concordant/discordant.
- **Continuous signal lane**: mean base quality, mean insert size, fraction-clipped.
  These aren't partitions of depth — they belong in a thin signal lane (mean ± band),
  not a stacked bar (which would mislead).

Highest scientific value (ranked): MAPQ/MAPQ0-fraction decomposition (instantly flags
repetitive/CNV/segdup regions — bigly's spirit); discordancy (improper pairs — surfaces
SV breakpoints far better than per-read coloring, where signal is diluted); HP-tag
proportion (allelic balance, LOH, allele-specific patterns at a glance). Make
coverage-summary-mode a setting that *defaults to following* color-by where a mapping
exists, rather than welding them. Caveats: each mode is a compute+pack+draw+shader
quadruple (maintenance); coverage meaning different things per mode needs a clear
axis/legend that changes with it; per ADR-016 it belongs in the worker (mode changes
infrequently, per-base pass is cheap → rpcProps). Start with MAPQ/discordancy as the
proof point. Cross-ref [bigly](https://github.com/brentp/bigly).

## Methylation plotting

Modifications track: methylation line/matrix view (issue
[#5510](https://github.com/GMOD/jbrowse-components/issues/5510)). The key value of
methylartist locus is distinguishing haplotypes — per-HP aggregate lines reveal
allele-specific methylation (ASM). Options by ROI:

- **A — HP-stratified aggregate lines (recommended start).** One line per haplotype in
  the coverage area; at each CpG, y = methylation proportion among reads with that HP
  tag (HP:i:1 / HP:i:2 / unphased). Add `haplotype` to `ModificationEntry` (read HP in
  `extractModifications`/`processFeatureAlignments.ts`), stratify
  `computeModificationCoverage` by haplotype, add `drawModCovLine` (Canvas2D) + a
  `PASS_MOD_COV_LINE` GPU pass (reuse modCoverage geometry as a strip). Future:
  kernel-smoothed lines over a bandwidth of nearby CpGs.
- **B — simple aggregate line, no haplotype (~2h).** Single line per mod type; the
  worker already produces `modCovPositions`/`modCovHeights`, only the renderer + shader
  are new. Good fallback for non-phased / bisulfite data.
- **C — per-read matrix with haplotype sort.** Rows=reads, cols=CpG sites,
  color=per-read probability, sorted HP1-above-HP2 then by methylation fingerprint. May
  already be achievable via `colorBy: modifications` + `sortBy: HP tag` — verify before
  building; if UX suffices, C needs only docs.
- **Sequence:** B first (~2h), then A (~1d), C last or never.

## Synteny / comparative

**Linked dotplot + linear synteny.** Selections/zoom propagate between both views.

**Swap axes** (dotplot & linear synteny). Flip comparison perspective or reverse
query/reference.

**Better defaults for human vs mouse.** Tune color schemes and default display options
for common interspecies comparisons.

**CIGAR draw toggles via gpuProps.** Shader uniform bit flags to gate
`drawCIGAR`/`drawCIGARMatchesOnly`/`drawLocationMarkers`; worker always emits full
geometry, flags control visibility. Only worth it if users toggle frequently.

**Dotplot short-segment rendering (point sprites).** Short alignments (sub-pixel
`len < lineWidth`) render as thin slivers because the degenerate fallback expands the
quad only vertically. A square-cap displacement along the tangent was tried and
reverted (odd polygons on normal segments). Better: (a) emit `gl_PointSize` sprites for
sub-threshold segments in a separate draw call; (b) round caps via SDF in the fragment
shader (pass along-tangent distance as a varying, discard outside `lineWidth/2`).

**Connect to gene glyphs for MCScan-type results?** And add "synteny rects" to show
e.g. non-ribbon-based synteny (non-displayed-region translocations).

**Explicit SV-type classification — the biggest semantic gap.** JBrowse's synteny is
alignment-centric (strand is the only typing); plotsr's
`['SYN','INV','TRANS','INVTR','DUP','INVDP']` enum with fixed colors + z-ordering is
genuinely more expressive — a user can't tell an inversion from a translocation from a
duplication except by reading geometry. PIF already passes through arbitrary PAF tags
and `syntenyColors.ts` recolors on the main thread with no RPC, so a `colorBy: svType`
mode is cheap **if the upstream classification exists**. The missing piece is the data,
not the rendering: wire `BedpeAdapter` (already in the bed plugin) / a SyRI adapter into
the comparative view as a typed-SV source (ntSynt-viz's `convert_syri_to_ntsynt_blocks.py`
shows the conversion is trivial). Highest-leverage, lowest-risk addition. Copy plotsr's
explicit 6-type taxonomy, **not** ntSynt's strand-conflated model (which loses the
trans/dup distinction). Secondary: **phylogeny-aware row ordering** (NJ tree from synteny
distance, like ntSynt-viz) for >3-genome views — `diagonalize.ts` reorders chromosomes by
density but not rows by relatedness. Don't chase native N-way blocks as the primitive —
the pairwise N−1 model is the right call for a browser (independently fetchable/zoomable,
degrades gracefully when one alignment is missing).

**`syntenyGroupId` for cross-row block identity (not N-way geometry).** Synteny features are
strictly pairwise today: one `mate` (`{start,end,refName,assemblyName}`) per feature, and no
shared block/anchor id anywhere in `comparative-adapters` or `synteny-core` (PAFAdapter's
`uniqueId` is just the row index). Add an optional adapter-provided `syntenyGroupId`
(block/anchor id) *alongside* `mate` — not replacing it — and you get the real multi-way value
without touching the pairwise geometry the linear layout needs anyway: consistent color per
block across every row it touches (`colorBy: group`, hash the id in `syntenyColors.ts`,
main-thread recolor with no RPC), hover-one-highlight-the-block across rows, and "present in
all N" filtering. MCScan `.anchors` and MAF already carry block structure to populate it; PAF
(independent lines) leaves it undefined. This is the cheap 80% and is consistent with "don't
make N-way blocks the primitive" above — it's an identity *overlay*, not a new render unit.

What the id does **not** do on its own: draw a literal ribbon that skips a row (a block present
in A and C but rearranged out of B). Grouping links the identity, and the transitive A→B→C case
is already visible through the middle row, so this only matters when you have a genuine A–C
alignment record with no B intermediary. A real non-adjacent edge then needs two more pieces:
(a) the renderer connecting same-group segments by row order rather than via a fixed adjacent
`mate`, and (b) a level/connection that can reference two non-adjacent view indices.
Encouragingly the geometry is already generic over an arbitrary view *pair* —
`buildSyntenyGeometry`/`executeSyntenyFeaturesAndPositions` take two `SyntenyViewSnap`s
(`bpPerPx0/1`, `viewOff0/1`); adjacency is purely a wiring convention (`views[level]` /
`views[level+1]` in `LinearSyntenyDisplay/afterAttach.ts` and the `connectedViews` getter). So
non-adjacent ribbons are a level-model + z-ordering change, not a geometry rewrite — but a
separate, larger step. The id is the prerequisite, not the whole feature. Start with MCScan
(already block-structured) for populating the field. See `all-vs-all-paf-multiway-plan.md` and
`SYNTENY_BLOCK_IMPORT.md`.

**Cue-style read-pair + depth matrix.** [PopicLab/cue](https://github.com/PopicLab/cue)
builds an image showing read pairs, read depth, and L/R–R/L pairs as a matrix — could
this be shown as a triangular heatmap (like `plugins/hic`) or in dotplot?

## Ortholog / multi-genome navigation

Two synteny pains: no way to say "show me gene X across all these genomes" (search is
per-row), and building an N-genome view is a manual row-by-row slog. Today synteny
features are matched purely by coordinates (PAF/CIGAR), never by gene name; the one nav
primitive is `navToSynteny` (right-click → project one region across one alignment →
spawn a 2-way view).

**Pangene-backed gene locator (recommended first build).** Don't invent an ortholog
format — `miniprot --outs=0.97 … genomeX.fna proteins.faa` already gives
`gene → (contig,start,end,strand)` per genome; group across per-genome PAFs by gene name
(conventionally `GENE:ENSP…`). Minimal substrate is a tidy columnar table
(`gene/assembly/refName/start/end/strand`, TSV or JSON), generated by a ~20-line
converter or hand-authored / exported from Ensembl Compara / OrthoFinder (pangene's GFA
adds relationships but isn't needed for navigation). v1 slice: a "locate gene" box on
`LinearSyntenyView` → look up the gene's row(s) in an in-memory `Map<geneName,
Placement[]>` → build `views: [{assembly, loc}, …]` and call the existing
`addView('LinearSyntenyView', {init})`, auto-picking pairwise synteny tracks between
consecutive rows the way `AddRowDialog` already does. Reuses all multiway plumbing +
per-row search UI; no new renderer or adapter. The view is *derived from the gene*, so
setup difficulty disappears.

**PanSN + IMPG (complementary, for alignments-without-annotations).** When there are
alignments but no gene labels, project a locus transitively through an all-vs-all PanSN
PAF (PR #4985) — a JS port of IMPG's `query_transitive_dfs` bounded to loaded levels
(`findPosInCigar` is already the single-hop version). IMPG is a pure Rust CLI (no
JS/WASM); port the algorithm, or use it offline to precompute placement tables for the
tidy-table path. Same "snap all rows" UX, different backend (coordinates vs gene names).

**Anchor-assembly model (from NCBI MCGV).** MCGV uses one reference with every other
assembly aligned *to the anchor* (not chained adjacent-pairwise): "find a gene on the
anchor" searches once, all rows follow; switchable anchor. Simpler and more gene-centric
than our chained `appendRow`/N−1-levels layout, and an all-vs-anchor MAF *is*
anchor-shaped. Worth evaluating an anchor-mode for the view (or at least placing the
anchor at row 0 in the gene locator).

**Tiered MAF (LOD), reusing existing renderers.** Our MAF viewer is always per-base, so
a large UCSC bigMaf region is enormous/slow — no conservation/identity summary, no LOD
switch (cf. MCGV's chromosome-overview → identity-colored blocks → conservation graph →
per-nucleotide-below-~1Mbp). Rather than a new summarizing renderer, **preprocess** the
bigMaf into two coarse forms JBrowse already renders, switched by `bpPerPx`: (a) coarse —
each species' MAF blocks vs the anchor as per-pair synteny features with an identity
score (the `de:f:`/`pafIdentity` path exists), drawn by the GPU synteny renderer with no
per-base fetch; (b) conservation graph — a per-bin "fraction matching the anchor" wiggle
(or reuse a phastCons/phyloP bigWig); (c) fine — the current per-base `LinearMafDisplay`,
only below a bp/px threshold. New work is the preprocessing CLI; rendering reuses
synteny + wiggle + MAF. (Companion to the bigMafSummary work in TODO.md.)

References: `~/src/vendor/{pangene,impg}`; PR GMOD/jbrowse-components#4985;
[NCBI MCGV](https://www.ncbi.nlm.nih.gov/mcgv) (CGV paper
<https://doi.org/10.1371/journal.pbio.3002405>).

## Large track catalogs (100k+ tracks)

Motivating context: the genomes.jbrowse.org portal has 100k+ tracks for human if
everything is included; today we cope by *manually deleting* tracks from the config.
"Overload" is really two axes: **machine** (can't ship 100k full configs in
`config.json` or instantiate 100k MST nodes → discovery metadata must live *outside* the
config tree) and **human** (100k tracks can't be browsed; the hand-pruning is editorial
curation, and deletion is our only curation tool). Lazy loading (issue #4988) addresses
only the machine axis; alone it makes the human axis worse.

"Uniformly async track resolution" is the wrong frame: MST can't await (configs resolve
via synchronous `types.reference`), so the real shape is **async hydrate → sync forever
after**, not one uniform path; and a uniform `Promise<Config>` interface pushes
loading/partial-failure handling into hundreds of sync call sites that never needed it.
Hard constraint: every desktop user shouldn't have to care — this must be **opt-in
plumbing a deployment plugs in**.

The shape that fits: separate **discovery metadata** (id/name/assembly/category/facets —
lightweight, searchable across all 100k, never enters the MST tree; all the *selector*
needs) from **full config** (adapter/renderer/display — heavy, only for tracks turned
on). Today both are one object, which is why hand-pruning was the only relief. Proposed:
a self-contained **lazy catalog** abstraction (connection/adapter-shaped, opt-in per
deployment) that serves a searchable metadata index and materializes exactly one full
config on demand at activation (already an async UI action ending in a synchronous
`addTrackConf` — zero change to core reference resolution). Curation becomes a
`featured: true` flag (default tier surfaced, long tail search-only) instead of deletion.
The self-describing `conn-${connectionId}-…` trackId (#4988) is fragile in general
(instance-local IDs, rename breaks URLs, grammar leaks) but fine *in a curated portal*
that controls identity and versions its catalog. The 100k fork that decides the whole
shape: **static metadata blob + client-side faceting** (simple, no backend, breaks
~10–20k) vs **server-side query API** (selector sends facet+text queries, scales to
100k+, pairs naturally with server-marked curation). Next: read how the faceted track
selector sources data + how the connection model materializes tracks, to gauge whether
this is a contained new adapter/connection type or something deeper.

## Plugin extension points: widget/detail customization

`Core-replaceWidget` and its four siblings (`Core-replaceAbout`,
`Core-extraFeaturePanel`, `Core-extraAboutPanel`, `Core-customizeAbout`) are a
**bad abstraction** — the visible symptom ("applies to every trackId, you filter
by hand") is one of four defects:

- **Dispatch-by-key built as filter-in-a-fold.** Intent is "contribute/pick a
  component *for a track*"; implemented as an unkeyed `reduce` over all
  callbacks, so every consumer re-derives the key (`model.trackId !== 'x'`). The
  framework should own the matching.
- **Fold semantics are wrong for components.** Accumulator-chaining is right for
  *transforming data* (menu arrays, the `customizeAbout` snapshot) but for
  *contributing UI* it means last-loaded-plugin-clobbers-earlier with no
  conflict signal. Proof: `FeatureDetails.tsx` renders `Core-extraFeaturePanel`
  as a *single* `PluggableComponent` slot — two plugins both adding a panel,
  plugin B receives A's component as its `DefaultPanel`; if B forgets to render
  `<DefaultPanel/>`, A silently vanishes, and which wins depends on load order.
  The "add a panel" point can't reliably add two panels.
- **`trackId` is the most fragile key.** `copyTrackSnapshot` (`TrackMenu.ts:42`)
  rewrites it (`-<timestamp>-sessionTrack`), so the correct filter is a prefix
  regex, not the `===` the docs show first. You key on an id the system mutates.
- **Five points for one idea.** They're crossings of three axes — *surface*
  (feature widget / about dialog), *mode* (replace / augment), *selection*
  (which tracks) — hard-coded into five names instead of one parameterized
  mechanism.

**Reframe that dissolves it: augment and replace are different operations.**
Augment (add a panel) is a `collect` — N plugins each contribute, producer
gathers all matches, renders in order; composes by construction. Replace (be THE
widget) is a `dispatch` — exactly one wins; rare and heavyweight. And the
canonical `replaceWidget` example (`<div>custom</div><DefaultWidget/>`) is *not*
a replace — it's a panel rendered above the default. Nearly every real
`replaceWidget` use is augment-in-disguise; true full-replacement is better
served by registering a real `WidgetType` and selecting it.

**Ideal design — one selector-scoped detail-panel registry with collect
semantics.** Registration is declarative, no manual filtering, composes:

```ts
pluginManager.addDetailPanel({
  surface: 'feature',                  // 'feature' | 'about' (array for both)
  select: { trackType: 'VariantTrack' }, // selector below; omit = all tracks
  position: 'after',                   // 'before' | 'after' built-in sections
  priority: 100,                       // stable tiebreak
  Component: MyPanel,                  // renders own BaseCard chrome
})
```

Producer side (replaces the `PluggableComponent` slot in `FeatureDetails.tsx` /
`AboutDialogContents.tsx`):

```ts
const panels = pm.getDetailPanels({ surface: 'feature', model })
// already filtered by selector, sorted; render ALL
{panels.map(p => <p.Component key={p.id} {...props} />)}
```

Selector = declarative struct + escape hatch; `{ trackId }` runs through a
shared `matchesTrackId` helper (the `-sessionTrack`/timestamp normalization in
*one* place — `makeTrackId.ts` neighbor), so the copy-track footgun disappears
for everyone:

```ts
type TrackSelector =
  | { trackId: string }      // auto-matches session copies
  | { trackType: string }    // the key people actually mean
  | { adapterType: string }
  | { metadata: Record<string, unknown> }
  | ((model) => boolean)     // 1%-case escape hatch
```

This fixes all four defects: matching moves into the framework; collect
semantics so panels coexist with explicit (not load-order) ordering;
`trackType`/declarative selectors rarely touch the fragile id; one registry not
five points. **True replace** demoted to honest cost — register a `WidgetType`,
`select` it, `DrawerWidget.tsx` resolves before the default fallback (reuses the
widget-type registry, not a bespoke wrap chain). **`customizeAbout` stays
separate** — it's a genuine data transform; folding it in would be the same
conflation in reverse.

**Compat is mandatory** (5 public points, plugins in the wild): keep them
evaluating exactly as today and have `getDetailPanels` fold the legacy chain
result in as one more panel — old plugins unchanged, new ones get the registry.
Doable precisely because old behavior is "render one slot."

Downsides: bigger than sugar (new registry + 3 producer rewrites); selector
scope-creep risk (ship `trackId`/`trackType`/predicate only, log+skip unknown
keys). 80/20 fallback if appetite is low: just add `matchesTrackId` + a
`select`-based wrapper over the *existing* points + fix docs — removes the
footguns but keeps the clobber bug for replace-style uses.

**Sample drift bug (fix regardless):** `extension_points.md:514` tells readers
to open `test_data/volvox/umd_plugin.js` and "search for
`TrackSelector-folderDialog`" for a worked example — that file is two empty
no-op plugin classes; the example isn't there (`public/` copy is identical).
`umd_plugin.js` is the natural home for live hand-written examples of these
points.

## Data formats

**Partial-feature truncation cue.** NCBI eukaryote GFFs pervasively mark
incomplete annotations with `partial=true` plus `start_range=.,N` / `end_range=N,.`
(a `.` on the open side) — a gene/mRNA/CDS whose true boundary runs off the
assembled sequence or past an assembly gap. Today these render with an ordinary
square cap, so a biologically truncated feature looks identical to a complete one
and the "this is partial" signal is silently dropped. Cue: draw a ragged/open
(zig-zag or feathered) cap on the open end(s) — only the end flagged `.` gets it,
so a 5'-partial gene is ragged on the left only. Cost is a full vertical slice, not
a tweak: the **worker** reads the attrs in `RenderFeatureDataRPC` and derives a
per-feature 2-bit open-end flag (5'/3', strand-corrected); that flag is threaded
through the **packed render arrays** as a new per-feature byte (mind the
byte-offset/UBO layout invariants called out in CLAUDE.md and
`GpuCanvasFeatureRenderer.ts`); and the **glyph** draws the open cap in a new
`.slang` source (run `pnpm gen:shaders`, never hand-edit `*.generated.ts`) with a
matching Canvas2D fallback path. Worth a dedicated task with browser verification
on a real NCBI eukaryote GFF (e.g. a partial gene near a contig edge) before
sweeping the shader/packing layers. Companion to the gff-nostream parser fix that
stopped dropping top-level discontinuous features (cDNA_match/EST_match).

**Circular genomes / origin-spanning features.** NCBI GFF3 encodes a feature that
crosses the origin of a circular replicon as a single line whose `end` runs past
the sequence length into "virtual space" (and flags the landmark with
`Is_circular=true`) — common in the bacterial/organellar/viral genomes we serve
from jb2hubs. Today this misrenders three ways: the feature draws into virtual
space past the contig end (best case clipped at the displayed-region edge); the
wrapped portion is unreachable at the origin (its tabix-indexed start sits near
the contig end, so a `0..N` query never returns it — and redispatch only expands
to bounds of features *already found*); and there's no topology flag anywhere in
core (`Region` is `refName/start/end/reversed` only; assembly/refseq have no
`isCircular`; the parsed `Is_circular` is inert; the circular-view plugin is a
chord diagram, not a feature viewer). Two architectures: **(B) a true circular
(polar) viewer** — biologically honest but a whole new rendering + GPU-layout
stack; the chords-only circular-view is not a starting point. **(A)
repeated-linear concatenation (recommended)** — the key unlock is that
`displayedRegions` *already is* linear concatenation (LGV space sums `Region[]`
end-to-end, each region carrying true coords), so listing the contig twice gives
the `2L` space, scroll-through-origin, and true-coordinate location box/search
*for free*. Seam-abutment: region1 `chr:0-L` + region2 `chr:0-L` with zero
`interRegionPadding` makes a `[L-1200, L+1200]` gene draw as `[L-1200,L]` +
`[0,1200]` halves that *touch* at the seam and read continuous (the one
unsolvable bit is a connector line crossing the seam — JBrowse never lays out one
glyph across a region boundary). The only real new code is a **circular adapter
decorator** (parameterized by `L`): re-emit any feature with `end > L` as two
halves, issue a modular wrap-fetch of `[L-margin, L]` when querying near the
origin (same muscle as `Gff3TabixAdapter.ts:84` redispatch), and key both halves
by canonical `pos mod L` so copies/halves reconcile. De-risk cheaply: **Step 0 is
zero code** — hand-set displayedRegions to the contig twice with seam padding
zeroed on pneumobrowse to eyeball the UX before building the decorator. Confirm
first whether jb2hubs has origin-*spanning features* or just `Is_circular`
contigs with no crossing genes (if the latter, this is purely a cosmetic origin
marker). Full design + tables: [CIRCULAR_GENOME_SUPPORT.md](CIRCULAR_GENOME_SUPPORT.md).

**Multi-feature files.** Multiple types per row (e.g. chromatin BED with repeat types).

**Zarr VCF.** Variant rendering from Zarr (more efficient than tabix for large cohorts).

**Rolling average.** Smoothing option for wiggle/coverage (rolling mean, rendered as a
line).

**Migrate compute shaders to Slang.** `plugins/variants/src/VariantRPC/{ldComputeShader,
ldPhasedComputeShader}.ts` are hand-written WGSL (WebGPU-only); migrate to Slang with
`//! targets: wgsl`. Not urgent — they work.

## UI / UX

**CSS Custom Highlight API for search text.** `HighlightText` in `FacetedSelector`
manually splits strings and wraps matches in `<mark>` tags. The
[CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/Highlight)
highlights `Range` objects without touching the DOM (no extra elements, no re-render on
query change); jbrowse-desktop already uses it. Complication in the faceted selector:
virtual rows mount/unmount on scroll, so ranges must be re-registered in a scroll-aware
effect. Firefox ≥117, Chrome ≥105, Safari ≥17.2.

**Height resize.** Double-click resize handle, drag to resize, prevent shrinking,
auto-shrink toggle.

**Canvas offscreen buffer.** Margin rendering to avoid feature re-juggling on small
pans/zooms (like `plugins/sequence`).

**Super-compact mode** for very dense gene annotations (pack features even tighter).

**Side labels for genes.** Gene-name labels in the left/right margin instead of inline.

**Global scrollZoom.** Per-view → global setting.

**Isoform expansion.** Click a collapsed isoform to expand all for that gene.

**Init/loading feedback.** Distinguish initialized vs loading state in LinearGenomeView.

## Hi-C

**User-adjustable color threshold.** A draggable slider on the HiC color legend (like
Juicebox) so users set the saturation threshold manually; store as a
`colorThresholdMultiplier` override. The 95th-percentile auto-scale is a good default
but some datasets benefit from manual tuning.

**Normalization availability check.** Before calling hic-straw with a normalization (e.g.
KR), check whether a normalization vector exists for the current resolution/chromosome;
if not, warn and fall back to NONE (mirrors Juicebox `contactMatrixView.js:checkColorScale`).
hic-straw doesn't expose `hasNormalizationVector` directly — detect by catching empty
results or inspecting masterIndex keys.

**A/B compartment ratio mode.** A÷B log-ratio display (diverging red/blue) when a
control/background map is loaded — needs a second `hicLocation` and `RatioColorScale`
logic.

**Inter-chromosomal UI.** `getHeader` already computes `hasInterChromosomalData` but
never surfaces it; when true, show a chromosome-pair selector (chr1 × chr2) to navigate
inter-chromosomal contact blocks without a manual multi-region view.

## Config & sessions

**Global config overrides.** Admin-level defaults (e.g. show paired arcs by default)
across all tracks.

**Hash password in share links.** Password only needed at startup (read then deleted) —
store in URL hash, clear on first navigation.

**LGVSyntenyDisplay "Query name" coloring.** Re-implement the removed color-by-query-name
(hash to color).

**Breakpoint connectors.** Smooth out the awkward blue/green curves (currently arbitrary
Y increase/loop).

**BSV overlay: fix model-derived track Y positions.** `getTrackYOffset` sums
`headerHeight + scalebarHeight + Σ(track.height + RESIZE_HANDLE_HEIGHT)` but diverges from
the actual CSS layout (likely a gap/border/constant mismatch). The current workaround is a
`getBoundingClientRect` rAF loop in `useDomTrackYOffsets` (~60fps re-renders). Finding the
discrepancy — `console.log(view.getTrackYOffset(id), trackRef.top − svgRef.top)` on a
loaded view — would let us delete the DOM measurement and rely on MobX reactivity alone.

## Build & dependencies

**Delete the jbrowse-img react-transition-group ESM workaround at MUI v10.** MUI v9's
"true ESM" build deep-imports the bare subpath `react-transition-group/TransitionGroupContext`;
that package has no `exports` map (unmaintained ~4y), so raw Node ESM rejects it with
`ERR_UNSUPPORTED_DIR_IMPORT` while bundlers resolve it fine. `@jbrowse/img` ships raw ESM,
so `jb2export` (and published end users) are exposed. Current workaround is a resolve hook
duplicated across `products/jbrowse-img/src/resolve.ts` (shipped, installed by `bin.ts`
before `await import('./main.ts')`), the packed-tarball component test
(`component_tests/jbrowse-img/resolve.mjs`), and the pre-build integration test
(`integrationResolve.mjs`, must stay hand-authored `.mjs` for tsx's loader thread).
MUI is **removing react-transition-group entirely** (migrated to an in-house transition in
PR mui/material-ui#48325), targeted for **Material UI v10** — see
[mui/material-ui#48644](https://github.com/mui/material-ui/issues/48644). When we bump to
MUI v10 the offending deep-import vanishes and the *entire* workaround (resolve.ts, the
`register` export if added, both test `.mjs`) can be deleted. Until then the runtime hook
is load-bearing and won't be backported to v9. Near-term cleanup (optional, doesn't need
v10): collapse the duplicated copies into one shipped `@jbrowse/img/register` subpath that
the CLI, the component test (`node --import @jbrowse/img/register run.mjs` against the
packed tarball), and programmatic consumers all use — which also closes the
`import { renderRegion }`-under-raw-Node exposure gap and makes CI exercise the real shipped
hook instead of its own copy. Don't bundle `@jbrowse/img` for this — it freezes the
semver flow-through for one narrow consumer path.

## Search / misc

- Sophisticated abort system.
- Search advanced panel; may need a pagefind inverted index.
- Check [LDZip](https://github.com/23andMe/LDZip).

## Website: copy-as-markdown / LLM-readiness

`entry.id` from the content collection is the repo-relative path (`config_guide` →
`website/docs/config_guide.md`), so per-page Markdown export needs zero new
infrastructure. "View as Markdown" → an `<a href>` to the GitHub raw URL; "Copy as
Markdown" → `fetch(rawUrl).then(r => r.text()).then(navigator.clipboard.writeText)`
(raw.githubusercontent.com sends `access-control-allow-origin: *`). Trade-offs: **version
drift** (the deployed site is built from a specific commit — pin the URL to the
build-time SHA to stay faithful, or accept `main`'s minor drift); frontmatter noise (LLMs
handle it; non-issue); combined index files (`llms.txt` / `llms-full.txt`) can't come
from GitHub — generate at build from frontmatter + `sidebars.json` and commit them.
Recommendation: hybrid weighted toward GitHub — per-page button → GitHub raw pinned to
build SHA; `llms.txt` curated index → generated at build with links pointing at GitHub
raw URLs; `llms-full.txt` optional generate-and-commit. The only thing hosted is a tiny
index file.

## expressive SV search language for the SV inspector import form
Current import-form filtering matches query strings like `CHR2=17` against the
spreadsheet columns — narrow (won't catch variants *originating* from chr17, only
those naming it in a column). A richer SV query language (by breakend chrom/pos,
type, length range, INFO fields, AND/OR) would be more useful. Net-new feature,
not a screenshot defect. (Was: sv_inspector_importform_filtered review item.)



## Offline genome packages for jbrowse-desktop

Goal: let users download an offline "package" for key genomes (human hg38/hg19,
mouse, etc.) so jbrowse-desktop works well with no internet.

### Existing hooks
- **Quickstart system** (`electron/ipc/quickstartHandlers.ts`, `paths.ts`):
  pre-baked sessions in `userData/quickstart/*.json`. Legacy hg19/hg38/mm10
  quickstarts exist. Natural hook for "install a genome".
- **Path resolution** (`packages/core/src/util/io/index.ts:40`
  `resolveUriLocation`): URIs resolve relative to `baseUri` via
  `new URL(uri, baseUri)`. But `LocalPathLocation` is stored as an **absolute
  path** — the main blocker for a relocatable bundle.
- **faiDir** (`userData/fai`): indexes already cached separately.

Fundamental gap: offline = local data files + config with **portable paths**.
Nothing currently makes a genome's data relocatable.

### Approaches

**A. Relocatable "genome pack" (foundation).** Self-contained folder shipped as
a `.zip`:
```
hg38-minimal/
  config.json          # assembly + gene track, relative paths
  data/hg38.fa.gz + .fai + .gzi
  data/ncbiRefSeq.gff.gz + .tbi
```
Unlock: teach desktop's `LocalPathLocation` to resolve relative to the config
file's dir (mirror existing `baseUri` logic). Works wherever extracted; also
shareable peer-to-peer (USB / lab share) — big for air-gapped users.

**B. In-app download manager + registry.** Curated `genomes.json` catalog on
jbrowse.org (name, size, URL, checksum). App lists packs → user picks → download
into `userData/genomes/hg38/` → register a quickstart. Net once, then fully
offline. Reuse cross-repo download-progress plumbing (genfh2/tabix/bam
onProgress) for resumable progress UI. Natural home for config-minimal vs
config-full variants.

**C. Bundle-at-install (config-minimal seed).** Ship tiny assembly config + gene
model in the installer; FASTA fetched-and-cached on first use. Small installer
but not truly offline until browsed. Weakest fit.

**D. Persistent HTTP range cache.** Cache fetched byte-ranges to disk so
revisited regions work offline. Complementary, never gives a whole genome.

### Size reality
hg38 FASTA bgzip ~900MB-1GB; gene models tiny. config-minimal ~= FASTA + faidx +
one gene track ~1GB. Offer two SKUs per genome: *minimal* (ref + genes) and
*full* (adds GC, repeats, clinvar, etc.).

### Recommendation
Build **A as the format, B as the delivery**: relocatable genome-pack format +
download-manager UI backed by a registry, each install registered as a
quickstart. A also gives free offline sharing without a server.

### Make the app generally offline-friendly
Audit startup/runtime net calls that degrade offline: plugin-store fetch,
autoUpdater check (`electron/autoUpdater.ts`), internet-account probing. These
should fail fast/silent offline instead of hanging or erroring noisily.

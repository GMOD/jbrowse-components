# Pangenome Synteny: Next Steps

> Move completed items to `PANGENOME_COMPLETED.md` and remove from this document
>
> Note: do not use numbering or ID prefixes (R1, F2, etc.) for tasks in this
> document. Use descriptive section headers instead.

## Priority

| Task                                                 | Effort | Impact                                                                        |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Lazy assembly creation for large pangenomes          | Small  | Avoid creating 90+ assemblies eagerly on first load                           |
| ~~Warning logs for missing GFA-tabix headers~~       | Small  | ~~Done — warns on missing #genomes= and #sizes=~~                             |
| GFA W-line test coverage                             | Small  | W-lines are the primary HPRC format, untested                                 |
| ~~Wire stopToken through GfaTabixAdapter~~           | Small  | ~~Done — checkStopToken in lineCallbacks + async boundaries~~                 |
| SVG overlay for MultiSynteny text labels             | Small  | SVG text layer for deletion lengths, base letters                             |
| GPU feature picking for MultiSynteny                 | Small  | Color-encoded picking FBO (currently JS fallback)                             |
| Automated performance tracing                        | Small  | Measurable regressions, data-driven optimization                              |
| Virtual scrolling for large genome counts            | Medium | Smooth scrolling through 90+ assemblies                                       |
| Canvas click-to-select and context menu              | Small  | Feature selection + detail widget from canvas                                 |
| renderSvg for MultiLGVSyntenyDisplay                 | Medium | Image/SVG export for multi-genome views                                       |
| Graph ↔ Synteny navigation                           | Medium | Click bubble in graph → synteny context                                       |
| Shared GFA data layer (graph + synteny)              | Large  | Single GFA load for both views                                                |
| Test LOD-aware aln.bed.gz switching                  | Small  | Verify segment↔aln transition at bpPerPx threshold                            |
| Multi-resolution segment index (LOD)                 | Medium | Whole-chromosome views for large pangenomes                                   |
| MultiLGV scrolling for manual row height mode        | Small  | Scroll through assemblies when rows exceed display                            |
| MultiLGV sorting/grouping by assembly properties     | Small  | Organize 90+ assemblies by clade, identity, etc.                              |
| ~~Alignments WebGL renderer: use shared webglUtils~~ | Small  | ~~Done — uses createProgram, cacheUniforms, enableStandardBlend from core~~   |
| ~~Canvas plugin: use shared HP shader functions~~    | Small  | ~~Done — imports HP_GLSL_WITH_UNIFORM and HP_WGSL_CORE from alignments-core~~ |
| Wiggle/variants: adopt shared GPU utilities          | Small  | These plugins have their own color/GPU wrappers                               |

---

## Further GPU Code Sharing

### ~~Alignments WebGLRenderer: Adopt Shared Utilities~~ (Done)

`WebGLRenderer.ts` now uses `createProgram()`, `cacheUniforms()`, and
`enableStandardBlend()` from `@jbrowse/core/gpu/webglUtils`, removing ~45 lines
of duplicated code. The color wrappers (`toRgb()` etc.) are kept as-is since
they're thin context-specific helpers.

### Wiggle/Variants GPU Renderers

`plugins/wiggle/src/shared/webglUtils.ts` has `parseColor()` with caching that
wraps `cssColorToNormalizedRgb()`.
`plugins/variants/src/shared/ variantWebglUtils.ts` has `colorToRGBA()` +
`createCachedRGBA()`. Both could use a shared cached color utility from
`@jbrowse/core/util/colorBits`.

### Canvas2D DPR Transform

Both Canvas2D renderers do `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` +
`ctx.clearRect()`. Could add a `prepareCanvas2D(ctx, width, height)` helper to
`@jbrowse/alignments-core/rendererUtils` for consistency.

---

## Review Issues (pre-merge)

### Lazy Assembly Creation

In `afterAttach.ts`, all assemblies are created eagerly on first RPC response —
even for 90+ haplotype pangenomes. Should only create assemblies for genomes the
user actually selects via the genome subset selector, and lazily create the rest
on demand.

### ~~Warning Logs for Missing GFA-Tabix Headers~~ (Done)

`console.warn()` added in `setupPre()` when `#genomes=` or `#sizes=` headers are
missing from pos.bed.gz.

### GFA W-Line Test Coverage

`GfaAdapter` supports both P-lines (GFA1) and W-lines (GFA1.1+), but only
P-lines are tested. W-lines are the format used by HPRC and other major
pangenome projects. Need tests for:

- W-line parsing correctness (segment walk syntax `>s1<s2>s3`)
- Mixed P-line + W-line GFA files
- W-line with wildcard haplotype (`*`)

### ~~Wire stopToken Through GfaTabixAdapter~~ (Done)

`checkStopToken()` calls added in `getMultiPairFeaturesFromAln` and
`getMultiPairFeaturesFromSegments` lineCallbacks, plus at async boundaries
before `getSegsForOrdinals`. Uses `opts: { stopToken? }` pattern.

### Regenerate Arabidopsis PIF as All-vs-All

The arabidopsis 4-way PIF has chained pairs (Col-0→Ler, Ler→Cvi, Cvi→Eri). Only
pair0 (Col-0→Ler) is directly queryable from Col-0's coordinate space. Cvi and
Eri are not shown in the MultiLGVSyntenyDisplay because the adapter correctly
skips pairs that don't contain the reference genome.

To show all 4 genomes in the multi-LGV display, regenerate with
`make-pif --all-vs-all` so all pairs are anchored to Col-0 (or re-align each
genome directly to Col-0 with minimap2).

The chained PIF still works correctly in the N-way LinearSyntenyView, where each
genome has its own coordinate axis.

---

## Feature: Add clustering

Add ability to cluter pangenome rows similar to MultiSampleVariant and
MultiWiggle display types

## Performance & Scale

### SVG Overlay for MultiSynteny Text Labels

The GPU renderers don't render text (deletion lengths, mismatch base letters).
Use an SVG overlay layer (same approach as the alignments track) positioned
above the WebGL/WebGPU canvas for text that needs to be rendered at specific
feature positions.

### GPU Feature Picking for MultiSynteny

The WebGL/WebGPU renderers have picking shader plumbing (fragment shader encodes
featureId as RGB) but picking is not yet wired up. Currently the tooltip falls
back to JS `bpToPx`. Wire up the picking FBO/texture readback following the
`LinearSyntenyDisplay` pattern.

### Automated Performance Tracing

Set up Chrome DevTools performance tracing in browser tests to catch
regressions:

- Use `mcp__chrome-devtools__performance_start_trace` / `performance_stop_trace`
  in browser tests
- Capture traces for key scenarios: HPRC chrM load, chr20 scroll, zoom in/out
- Extract metrics: time to first render, scroll frame rate, memory usage
- Store baselines in `__perf__/` directory alongside snapshots
- CI: fail on >20% regression in key metrics
- Key areas to trace:
  - `GfaTabixAdapter.getMultiPairFeatures()` — tabix query + segment merging +
    CIGAR derivation
  - `WebGLMultiSyntenyRenderer.render()` / `WebGPUMultiSyntenyRenderer.render()`
    — GPU render time per frame
  - `prepareMultiSyntenyGpuData()` — CIGAR/CS expansion + sort at upload time
  - React effect scheduling — debounce effectiveness during scroll

### Virtual Scrolling for Large Genome Counts

For 90+ haplotypes, rendering all rows to canvas is wasteful when most are
off-screen:

- Track visible row range based on scroll position
- Only render rows in the visible viewport + small overscan buffer
- Reuse canvas area by translating/redrawing only changed rows on scroll
- Binary search for feature hit-testing instead of linear scan in `onMouseMove`
- Consider OffscreenCanvas for off-main-thread rendering

### Test LOD-Aware aln.bed.gz Switching

LOD switching is implemented (`bpPerPx < 10` → aln, otherwise segments). Needs
tests to verify:

- Zoomed-out queries use segment path (no cs tags in returned features)
- Zoomed-in queries use aln path (cs tags present)
- Transition is seamless when scrolling across the threshold
- Features at the boundary don't duplicate or disappear

### Multi-Resolution Segment Index (Level of Detail)

When zoomed out to an entire chromosome, the GfaTabixAdapter fetches all
segments for the visible region across all genomes. For HPRC chr20 (~1.86M
segments × 44+ genomes), this means millions of rows to parse and merge in the
browser — too slow for interactive use.

A multi-resolution approach, similar to PIF's 3-tier system, would help:

- **Structural tier** (zoomed out): pre-merged large synteny blocks with mean
  identity, no CIGAR — one block per contiguous syntenic region per genome.
  Could be stored as a separate small file or as a header-level summary.
- **Segment tier** (mid zoom): current segment-level data with runtime CIGAR
  merging. Adequate for regions up to ~1Mbp.
- **Base tier** (zoomed in): aln.bed.gz cs tags for per-base detail (already
  handled by LOD-aware aln.bed.gz loading above).

The structural tier could be precomputed by `make-gfa-tabix` as an additional
output file, or derived at index time by merging segments into blocks above a
configurable size threshold (e.g. 10kb). This would make whole-chromosome views
responsive even for large pangenomes.

### Reduce Redundant Renders

With GPU backends, rendering is faster but still re-runs on every scroll pixel.
The GPU path only updates uniforms per frame (geometry is pre-uploaded), which
is already much cheaper than Canvas2D. Remaining optimizations:

- Use `requestAnimationFrame` batching to coalesce rapid scroll events
- Profile with Chrome DevTools to identify hot paths
- Consider double-buffering for WebGPU to avoid stalls

### Precompute aln.bed.gz in Rust Tool

The Rust `gfa-to-tabix` does not yet produce aln.bed.gz (base-level pairwise
alignments with cs tags). The adapter supports reading aln.bed.gz when
available, falling back to segment-based runtime CIGAR.

To add aln support to the Rust tool:

- Pass 1 already reads S-lines — store sequences for GFAs that have them
- Pass 3 (new): compute pairwise alignments using shared segment anchors
- Emit bidirectional rows (A→B and B→A via cs flip) so any genome works as ref
- Memory: O(segments × avg_seq_len) for sequences — skip for all-N sequences
  (minigraph-cactus) or very large genomes
- For GFAs without sequences (most HPRC data), this step is skipped entirely

---

## Graph Viewer ↔ Synteny Integration

### Bidirectional Navigation

- **Graph → Synteny**: User views a bubble/variant in the graph viewer, clicks
  "Show synteny context" → opens MultiLGVSyntenyDisplay centered on that
  variant's reference coordinates
- **Synteny → Graph**: User clicks a mismatch/deletion/insertion in the
  multi-synteny display → opens graph viewer showing the underlying bubble
  structure at that position
- Implementation: shared coordinate resolver using segment ordinals as the
  linking key
  - Both views already use segment ordinals (GfaTabixAdapter for synteny,
    GfaAdapter for graph)
  - Need a `navigateToGraphBubble(segOrd)` action on graph view model
  - Need a `navigateToSyntenyRegion(refName, start, end)` action on LGV

### Path Highlighting in Graph View

When the multi-synteny display has specific genomes selected (via genome subset
selector), highlight those paths in the graph view and show which bubbles
differentiate the selected genomes.

### Synchronized Selection State

Share genome selection state between MultiLGVSyntenyDisplay and GraphGenomeView:

- Use session-level shared state or MobX observable
- When user selects/deselects genomes in one view, reflect in the other
- Color consistency: same genome → same color across both views

### Shared GFA Data Layer

Both the graph viewer (`GfaAdapter`) and synteny projection (`GfaTabixAdapter`)
should share data:

- Single GFA load opened once, graph viewer queries segments + links, synteny
  adapter queries paths
- For tabix-indexed data: graph viewer uses segments.gz for node sequences and
  layout, synteny uses pos+segments+aln
- For non-indexed GFA: `GfaAdapter` already loads full GFA; `GfaTabixAdapter`
  needs pre-indexed files
- Consider a unified `PangenomeAdapter` that serves both views from the same
  data source

### Variant Annotation from Graph Structure

Use the graph bubble structure to annotate variants in the multi-synteny
display:

- Classify bubbles: SNP (1bp), small indel (<50bp), SV (>50bp), complex
- Show bubble type in tooltips and optionally as a color mode
- Count genomes per bubble allele (allele frequency from graph)
- Export variant calls (VCF-like) from graph bubbles

---

## MultiLGV Enhancements

### Canvas Click-to-Select and Context Menu

The MultiSyntenyRendering component has mouseover tooltips but no click handling
for individual features. The model already has `selectFeature()` but it's not
wired to the canvas:

- Add click handler to canvas that selects the hovered feature
- Open feature detail widget on click (like LinearSyntenyDisplay)
- Right-click context menu on individual features (copy info, launch pairwise
  view for that pair)

### renderSvg for MultiLGVSyntenyDisplay

LinearSyntenyDisplay has SVG export via `renderSvg.tsx`, but
MultiLGVSyntenyDisplay is canvas-only. Need a `renderSvg` method for server-side
rendering and image export (used by jbrowse-img and screenshot functionality).

### Scrolling for Manual Row Height Mode

When manual row height is set and total rows exceed display height:

- Add vertical scrollbar or scroll container
- Canvas height = numGenomes × rowHeight (can exceed display)
- Clip rendering to visible viewport
- Pairs with virtual scrolling (above)

### Sorting/Grouping by Assembly Properties

Organize 90+ assemblies in the multi-synteny display:

- Sort by: identity to reference, name, clade, superpopulation
- Group by: continent/population (for HPRC), haplotype
- Drag-and-drop reordering
- Hierarchical collapse: group header with expand/collapse

---

## Improved N-Way LinearSyntenyView

### Cross-Level Linking (deprioritized)

Show relationships that skip levels (A↔C, A↔D) as dotted/faded lines. Segment-ID
based linking for GFA, coordinate chaining for PAF.

---

## Data & Formats

### DuckDB/Parquet Investigation

For future scale beyond tabix (hundreds of genomes, complex graph queries).

### S3 Data Upload

HPRC chrM and chr20 data has been regenerated using the Rust converter with
per-chromosome .vg files from HPRC (converted to GFA via `vg convert`).

Build script: `test/data/synteny-demo/scripts/build-gfa-tabix.sh`

Upload:

```bash
aws s3 sync test/data/synteny-demo/gfa-tabix-output/ \
  s3://jbrowse.org/demos/gfadata/ --exclude 'downloads/*'
```

### MAF/TAF Integration

For base-level multiple alignment at zoomed-in views:

- MAF → multi-pair PIF converter (extract pairwise alignments from MAF blocks)
- TAF (transposed alignment format) as compressed alternative to MAF
- LOD: GFA-derived CIGAR at overview, MAF/TAF at base level
- Reference: jbrowse-plugin-mafviewer for prior art

---

## Test Data & Demo Datasets

### Available Now

- Volvox pangenome GFA (4 genomes, with cs tags, local)
- Volvox SNP PAF/PIF (minimap2 --cs, local)
- HPRC chrM (44 haplotypes, remote)
- HPRC chr20 (90 haplotypes, remote)

### To Generate

- **1001 Genomes Arabidopsis 27-strain pangenome**:
  https://1001genomes.org/data/1001Gp/27genomes/releases/2026_03_14/
  - 27 corrected scaffold assemblies available as FASTA (~35MB each)
  - No pre-built GFA — would need to build with minigraph-cactus or PGGB
  - Small genomes (~135MB each) — tractable for pangenome graph construction
  - Excellent demo: real plant data, 27 strains, 5 chromosomes
  - Pipeline: assemblies → minigraph-cactus → GFA → `make-gfa-tabix` →
    pos/segments/aln.bed.gz
  - Would demonstrate full pipeline from raw assemblies to interactive pangenome
    browser

- **Multi-pair PIF with cs tags**: Generate from minimap2 `--cs` for
  multi-genome comparison (currently have single-pair only)

- **HPRC chrM and chr20**: Regenerated from v1.1-mc per-chromosome .vg files via
  `vg convert` → Rust `gfa-to-tabix`. Available locally and for S3 upload.

- **C. elegans multi-species PAF**: Small genomes, good for integration testing

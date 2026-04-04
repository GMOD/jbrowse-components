# Next Steps — JBrowse Components 2

Organized by feature area and priority. For completed work, see `COMPLETED.md`.

---

## GPU/WebGL Rendering

### High Priority

**Snapshot parity tests** — Use node-canvas to render coverage through both Canvas2D and a reference path, serialize to PNG, and compare. This would catch visual regressions that unit tests miss (color differences, off-by-one positioning, clipping bugs).

### Medium Priority

**GLSL codegen from WGSL** — Mechanically generate GLSL vertex shaders from WGSL using glAttributes metadata, eliminating manual GLSL maintenance.

**Sequence and Graph renderers** — Still use direct WebGPU device access rather than the HAL. Could be migrated for consistency.

### Lower Priority

**Browser-based snapshot tests** — Puppeteer tests comparing actual GPU rendering output against Canvas2D for specific test datasets. Would require test fixtures with BAM/VCF data.

**Uniform layout unification** — Share coverage uniform slots between alignments and multi-synteny GPU shaders (currently ~20 overlapping slots with slightly different layouts).

---

## Alignments Display

### Feature Interaction (Click/Hover)

Options:
- **Color picking** — Render feature IDs to offscreen buffer, read pixel on click
- **CPU hit testing** — Store feature bounds, test mouse position against them

### Vertical Scrollbar

Add scrollbar component or integrate with existing JBrowse scrollbar. Currently only shift+wheel scrolls vertically.

### Performance

- Current approach uploads all features in region to GPU
- For very high coverage (>50k reads), consider:
  - Downsampling at zoomed-out levels
  - Showing coverage instead of individual reads
  - Chunked uploading
- GPU memory usage: ~60 bytes per read

### Code Sharing Opportunities

- **GPU coverage shaders**: GLSL/WGSL coverage bar and SNP segment shaders in both LinearAlignmentsDisplay and MultiLGVSyntenyDisplay are structurally identical. Could extract shared shader fragments. Blocked by different coordinate spaces and uniform buffer layouts.
- **Canvas2D coverage rendering**: renderSvg.tsx has coverage bar rendering loop that duplicates effectiveHeight/coverageBottom/depthScale math. Could extract shared `renderCoverageBarsToCtx` utility.

---

## MultiLGV Synteny Display

### Subgraph Extraction

**GfaTabixAdapter buildGfaFromPathInference** has the terminal segment fix but uses refOrdSet as heuristic for "is this a ref segment." If non-viewport ref ordinals happen to be fetched, they could stop the span extension prematurely. Low risk in practice but worth documenting.

**Add topology tests for GfaTabixAdapter** similar to the GfaAdapter tests. Blocked on synthetic test data that exercises the path inference code path with terminal variants.

### Canvas Interaction

**Canvas click-to-select and context menu:**
- Add click handler to canvas that selects the hovered feature
- Open feature detail widget on click (like LinearSyntenyDisplay)
- Right-click context menu on individual features (copy info, launch pairwise view for that pair)

### Scrolling & Layout

**Scrolling for manual row height mode:** When manual row height is set and total rows exceed display height:
- Add vertical scrollbar or scroll container
- Canvas height = numGenomes × rowHeight (can exceed display)
- Clip rendering to visible viewport

**Virtual scrolling for large genome counts:** For 90+ haplotypes, rendering all rows to canvas is wasteful when most are off-screen:
- Track visible row range based on scroll position
- Only render rows in viewport + small overscan buffer
- Reuse canvas area by translating/redrawing only changed rows on scroll
- Binary search for feature hit-testing instead of linear scan

**Sorting/grouping by assembly properties:**
- Sort by: identity to reference, name, clade, superpopulation
- Group by: continent/population, haplotype
- Drag-and-drop reordering
- Hierarchical collapse with expand/collapse

### Lazy Assembly Creation

In `afterAttach.ts`, all assemblies are created eagerly on first RPC response — even for 90+ haplotype pangenomes. Should only create assemblies for genomes the user actually selects via the genome subset selector, and lazily create the rest on demand.

### Feature Clustering

Add ability to cluster pangenome rows similar to MultiSampleVariant and MultiWiggle display types.

---

## Pangenome Data & Performance

### GFA Processing

**GFA W-line test coverage:** `GfaAdapter` supports both P-lines (GFA1) and W-lines (GFA1.1+), but only P-lines are tested. W-lines are the format used by HPRC and other major pangenome projects. Need tests for:
- W-line parsing correctness (segment walk syntax `>s1<s2>s3`)
- Mixed P-line + W-line GFA files
- W-line with wildcard haplotype (`*`)

**Regenerate Arabidopsis PIF as All-vs-All:** The arabidopsis 4-way PIF has chained pairs (Col-0→Ler, Ler→Cvi, Cvi→Eri). Only pair0 (Col-0→Ler) is directly queryable from Col-0's coordinate space. Cvi and Eri are not shown in the MultiLGVSyntenyDisplay. To show all 4 genomes, regenerate with `make-pif --all-vs-all` or re-align each genome directly to Col-0 with minimap2.

### SVG Overlay & Text

**SVG overlay for MultiSynteny text labels:** The GPU renderers don't render text (deletion lengths, mismatch base letters). Use an SVG overlay layer (same approach as the alignments track) positioned above the WebGL/WebGPU canvas.

### GPU Feature Picking

**GPU feature picking for MultiSynteny:** Wire up the picking FBO/texture readback following the `LinearSyntenyDisplay` pattern.

### Performance & Scale

**Automated performance tracing:** Set up Chrome DevTools performance tracing in browser tests:
- Use Chrome DevTools performance API in browser tests
- Capture traces for key scenarios: HPRC chrM load, chr20 scroll, zoom in/out
- Extract metrics: time to first render, scroll frame rate, memory usage
- Store baselines alongside snapshots
- CI: fail on >20% regression in key metrics

**Test LOD-Aware aln.bed.gz switching:** LOD switching is implemented (`bpPerPx < 10` → aln, otherwise segments). Needs tests:
- Zoomed-out queries use segment path (no cs tags)
- Zoomed-in queries use aln path (cs tags present)
- Transition is seamless when scrolling across threshold
- Features at boundary don't duplicate or disappear

**Multi-resolution segment index (LOD):** When zoomed out to an entire chromosome, the GfaTabixAdapter fetches all segments for the visible region across all genomes. For HPRC chr20, this means millions of rows to parse — too slow for interactive use.

A multi-resolution approach would help:
- **Structural tier** (zoomed out): pre-merged large synteny blocks with mean identity, no CIGAR — one block per contiguous region per genome
- **Segment tier** (mid zoom): current segment-level data with runtime CIGAR merging
- **Base tier** (zoomed in): aln.bed.gz cs tags for per-base detail

The structural tier could be precomputed by `make-gfa-tabix` as an additional output file, or derived at index time by merging segments into blocks above a configurable size threshold.

**Reduce redundant renders:** GPU rendering is faster but still re-runs on every scroll pixel:
- Use `requestAnimationFrame` batching to coalesce rapid scroll events
- Profile with Chrome DevTools to identify hot paths
- Consider double-buffering for WebGPU to avoid stalls

**Precompute aln.bed.gz in Rust tool:** The Rust `gfa-to-tabix` does not yet produce aln.bed.gz (base-level pairwise alignments with cs tags). To add aln support:
- Pass 1 already reads S-lines — store sequences for GFAs that have them
- Pass 3 (new): compute pairwise alignments using shared segment anchors
- Emit bidirectional rows (A→B and B→A via cs flip)
- Memory: O(segments × avg_seq_len) — skip for all-N sequences or very large genomes

---

## Graph ↔ Synteny Integration

### Bidirectional Navigation

- **Graph → Synteny**: User views a bubble in the graph viewer, clicks "Show synteny context" → opens MultiLGVSyntenyDisplay centered on that variant's reference coordinates
- **Synteny → Graph**: User clicks a mismatch/deletion/insertion in multi-synteny → opens graph viewer showing the underlying bubble
- Implementation: shared coordinate resolver using segment ordinals as the linking key
- Need `navigateToGraphBubble(segOrd)` action on graph view model
- Need `navigateToSyntenyRegion(refName, start, end)` action on LGV

### Path Highlighting & Selection

**Path highlighting in graph view:** When multi-synteny display has specific genomes selected, highlight those paths in the graph and show which bubbles differentiate the selected genomes.

**Synchronized selection state:** Share genome selection state between MultiLGVSyntenyDisplay and GraphGenomeView:
- Use session-level shared state or MobX observable
- When user selects/deselects genomes in one view, reflect in the other
- Color consistency: same genome → same color across views

### Shared Data Layer

**Shared GFA data layer:** Both graph viewer (`GfaAdapter`) and synteny projection (`GfaTabixAdapter`) should share data:
- Single GFA load opened once; graph viewer queries segments + links, synteny adapter queries paths
- For tabix-indexed data: graph viewer uses segments.gz for node sequences and layout, synteny uses pos+segments+aln
- For non-indexed GFA: consider a unified `PangenomeAdapter` serving both views

**Variant annotation from graph structure:**
- Classify bubbles: SNP (1bp), small indel (<50bp), SV (>50bp), complex
- Show bubble type in tooltips and optionally as a color mode
- Count genomes per bubble allele (allele frequency from graph)
- Export variant calls (VCF-like) from graph bubbles

---

## Graph Genome Viewer

### Review Issues (pre-merge)

**Hardcoded WASM URL fallback** — `GraphComputeLayout.ts` loads from `https://jbrowse.org/demos/bandage/` with no fallback. If URL is unavailable, layout silently fails. Consider adding error messaging or a retry with alternate URL.

### Scalability

**LOD — reduce Bezier tessellation detail at low zoom levels:** `flatness = Math.max(0.5, 2.0 / scale)`, skip nodes whose screen-space length < 2px.

**Adaptive multi-path edge offset:** Currently fixed at 3 graph units, should scale with zoom for consistent screen-space separation.

### GFA Adapter Integration

**Wire graph view's ImportForm to load from GfaAdapter/GfaTabixAdapter tracks:** Currently standalone, not integrated with the track/adapter system. Need to:
- Add GfaAdapter to `GuessAdapter` for `.gfa` file extension detection
- Wire ImportForm to load from track list (open from track list)

**GfaTabixAdapter subgraph loading:** Fetch segments for a configurable region, convert to Graph format, compute layout on subgraph only. Enables BandageNG-style scope-based viewing for huge files.

### Rendering Enhancements

**Depth-based node width:** Per-vertex thickness attribute computed from coverage depth using power function (matches BandageNG's `getNodeWidth()`).

**Anti-aliased edges:** MSAA or alpha blending for smoother line rendering.

### Interaction Improvements

**Right-click context menu on nodes/edges:** Show name, length, depth, path membership.

**Node search:** Text input to find and zoom to a node by name.

**Selection info panel:** Show details of selected node in a sidebar/widget.

### GFA Format Support

**Support GFA2 fragment (F) and gap (G) lines.**

**Handle large GFA files:** Streaming parse, or load via tabix-indexed GFA adapter.

**Connect graph view to GfaTabixAdapter:** Use the indexed GFA interface for server-side queries.

### View Features

**Contig/connector thickness sliders:** Volatiles exist, no UI.

**Dark mode UI toggle:** State exists, no toggle button.

**Export graph view as SVG or PNG.**

### Testing

**Unit tests for `GfaAdapter`:** Sample GFA files.

**Performance benchmarks:** 10K+ node GFA with console.time guards around buildGeometry to verify hover/zoom don't trigger rebuilds.

**Browser e2e test for hover highlighting:** Verify color changes without geometry rebuild.

---

## Bubbles & Variant Density

### Intermediate Zoom Heatmap

At intermediate zoom levels (too far for individual SNPs, too close for pure structural view), there's a visual gap. A density heatmap of variant sites per window would bridge this — showing "this region is highly variable" before you zoom in enough to see individual SNPs.

**Needs investigation:** What's the right rendering approach (per-pixel binning vs precomputed windows), and does the bubbles data already support this or would we need a separate summary track?

### SNP Budget / Max Feature Limit

If a user enables SNP rendering with a very large region, `expandCsOps` will expand every feature's SNPs into GPU instances. With millions of SNPs this could overflow GPU memory. A per-region budget or progressive LOD could help.

**Needs verification:** Does this actually happen in practice with current zoom thresholds, or does the `bpPerPx < 50` gate already prevent it?

### Cross-Linking Between Views

**Cross-linking between synteny and VCF views:** Click a colored mark in the synteny view to highlight the corresponding variant in the VCF track, and vice versa. Both views now use the same source data so the coordinate mapping is straightforward.

### Phasing Visualization

The bubbles now carry per-haplotype allele assignments for diploid data. Haplotype 1 vs 2 could be colored differently to show phasing patterns across samples — e.g., distinguishing which parental chromosome carries a variant.

**Needs investigation:** What color scheme avoids confusion with existing base colors (A/C/G/T)?

---

## vg Server Integration

### Option A: VgServerAdapter

Create an adapter that calls a vg server (like sequenceTubeMap's Express server) over REST. The server runs `vg chunk` to extract subgraphs.

**Steps:**
- Define adapter config schema (serverUrl, graphFile, optional gamFiles)
- Implement getSubgraph: POST to /api/v0/getChunkedData, receive vg JSON, convert to GFA text
- Implement getMultiPairFeatures: parse vg JSON paths into synteny features
- Add to comparative-adapters plugin or a new plugin
- Test with sequenceTubeMap's server

**Benefits:** Topology-aware extraction via `vg chunk -c N` (context steps), native .xg/.gbz support, read alignment integration.

### Option B: GbzWasmAdapter

Use gbz-base WASM library to query GBZ files client-side in a Web Worker.

**Steps:**
- Add gbz-base as dependency
- Create adapter that loads GBZ file and queries via WASM
- Run in JBrowse's RPC worker for off-main-thread execution
- Implement getSubgraph and getMultiPairFeatures

**Benefits:** No server needed, works with static file hosting, same tech as sequenceTubeMap's local mode.

**Priority:** Option A is simpler and immediately useful. Option B is more interesting long-term. Both can coexist as separate adapter types.

### Launch Workflow Improvements

- Hide graph view menu items when adapter doesn't support getSubgraph
- Consider passing GFA during view creation instead of after (avoids flash of empty view)

---

## Test Data & Demo Datasets

### Available Now

- Volvox pangenome GFA (4 genomes, with cs tags, local)
- Volvox SNP PAF/PIF (minimap2 --cs, local)
- HPRC chrM (44 haplotypes, remote)
- HPRC chr20 (90 haplotypes, remote)

### To Generate

**1001 Genomes Arabidopsis 27-strain pangenome:**
- 27 corrected scaffold assemblies available as FASTA (~35MB each)
- No pre-built GFA — would need minigraph-cactus or PGGB
- Small genomes (~135MB each) — tractable for pangenome construction
- Excellent demo: real plant data, 27 strains, 5 chromosomes
- Pipeline: assemblies → minigraph-cactus → GFA → `make-gfa-tabix` → pos/segments/aln.bed.gz
- Would demonstrate full pipeline from raw assemblies to interactive pangenome browser

**Multi-pair PIF with cs tags:** Generate from minimap2 `--cs` for multi-genome comparison (currently have single-pair only).

**C. elegans multi-species PAF:** Small genomes, good for integration testing.

---

## Data & Formats (Future)

### DuckDB/Parquet Investigation

For future scale beyond tabix (hundreds of genomes, complex graph queries).

### MAF/TAF Integration

For base-level multiple alignment at zoomed-in views:
- MAF → multi-pair PIF converter (extract pairwise alignments from MAF blocks)
- TAF (transposed alignment format) as compressed alternative to MAF
- LOD: GFA-derived CIGAR at overview, MAF/TAF at base level
- Reference: jbrowse-plugin-mafviewer for prior art

### S3 Data Upload

HPRC chrM and chr20 data has been regenerated using the Rust converter. Upload:
```bash
aws s3 sync test/data/synteny-demo/gfa-tabix-output/ \
  s3://jbrowse.org/demos/gfadata/ --exclude 'downloads/*'
```

---

## Further Code Sharing

### Wiggle/Variants GPU Renderers

`plugins/wiggle/src/shared/webglUtils.ts` has `parseColor()` with caching that wraps `cssColorToNormalizedRgb()`.
`plugins/variants/src/shared/variantWebglUtils.ts` has `colorToRGBA()` + `createCachedRGBA()`.
Both could use a shared cached color utility from `@jbrowse/core/util/colorBits`.

### Canvas2D DPR Transform

Both Canvas2D renderers do `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` + `ctx.clearRect()`. Could add a `prepareCanvas2D(ctx, width, height)` helper to `@jbrowse/alignments-core/rendererUtils`.

---

## N-Way LinearSyntenyView

### Cross-Level Linking (deprioritized)

Show relationships that skip levels (A↔C, A↔D) as dotted/faded lines. Segment-ID based linking for GFA, coordinate chaining for PAF.

# Pangenome Synteny: Next Steps

> Completed items moved to `PANGENOME_COMPLETED.md`.

## Priority

| Priority | Phase | Task                                             | Effort | Impact                                           |
| -------- | ----- | ------------------------------------------------ | ------ | ------------------------------------------------ |
| 1        | F1    | WebGL/WebGPU backend for MultiSyntenyRenderer    | Medium | GPU-accelerated rendering for 90+ haplotypes     |
| 2        | F2    | Automated performance tracing                    | Small  | Measurable regressions, data-driven optimization |
| 3        | F3    | Virtual scrolling for large genome counts        | Medium | Smooth scrolling through 90+ assemblies          |
| 4        | D1    | Graph ↔ Synteny navigation                       | Medium | Click bubble in graph → synteny context          |
| 5        | D4    | Shared GFA data layer (graph + synteny)          | Large  | Single GFA load for both views                   |
| 6        | F4    | LOD-aware aln.bed.gz loading                     | Small  | Load base-level detail only when zoomed in       |
| 7        | B5    | MultiLGV scrolling for manual row height mode    | Small  | Scroll through assemblies when rows exceed display |
| 8        | B6    | MultiLGV sorting/grouping by assembly properties | Small  | Organize 90+ assemblies by clade, identity, etc. |

---

## Phase F: Performance & Scale

### F1. WebGL/WebGPU Backend for MultiSyntenyRenderer

The `MultiSyntenyRenderer` facade is already in place with `Canvas2DMultiSyntenyRenderer`. Add WebGL2 and WebGPU backends following the same pattern as `AlignmentsRenderer` and `SyntenyRenderer`:

- Batch feature rectangles into instanced draw calls (position + color per instance)
- CIGAR/cs overlays: separate draw pass for mismatch/deletion/insertion marks
- Insertion triangles: geometry shader or pre-built triangle strip
- Text rendering: bitmap font atlas for deletion lengths and mismatch base letters
- Expected impact: 5-10x for chr20 (90 haplotypes, thousands of features per viewport)

### F2. Automated Performance Tracing

Set up Chrome DevTools performance tracing in browser tests to catch regressions:

- Use `mcp__chrome-devtools__performance_start_trace` / `performance_stop_trace` in browser tests
- Capture traces for key scenarios: HPRC chrM load, chr20 scroll, zoom in/out
- Extract metrics: time to first render, scroll frame rate, memory usage
- Store baselines in `__perf__/` directory alongside snapshots
- CI: fail on >20% regression in key metrics
- Key areas to trace:
  - `GfaTabixAdapter.getMultiPairFeatures()` — tabix query + segment merging + CIGAR derivation
  - `Canvas2DMultiSyntenyRenderer.render()` — canvas drawing time per frame
  - `drawCsOps()` / `drawCigarOps()` — per-feature overlay cost
  - React effect scheduling — debounce effectiveness during scroll

### F3. Virtual Scrolling for Large Genome Counts

For 90+ haplotypes, rendering all rows to canvas is wasteful when most are off-screen:

- Track visible row range based on scroll position
- Only render rows in the visible viewport + small overscan buffer
- Reuse canvas area by translating/redrawing only changed rows on scroll
- Binary search for feature hit-testing instead of linear scan in `onMouseMove`
- Consider OffscreenCanvas for off-main-thread rendering

### F4. LOD-Aware aln.bed.gz Loading

The aln.bed.gz file has base-level detail (cs tags) which is expensive to load and render at overview zoom:

- When `bpPerPx > threshold`: use segment-based runtime CIGAR (lightweight, structural only)
- When `bpPerPx < threshold`: load aln.bed.gz for base-level cs rendering
- Threshold should be configurable, default ~50 bp/px (one screen width ≈ 50kb)
- The two code paths already exist (`getMultiPairFeaturesFromAln` vs `getMultiPairFeaturesFromSegments`), just need zoom-level switching

### F5. Reduce Redundant Renders

Current rendering re-runs full canvas clear + redraw on every scroll pixel:

- Implement dirty-rect tracking: only redraw rows/regions that changed
- Cache genome labels (they don't change on scroll, only on zoom)
- Use `requestAnimationFrame` batching to coalesce rapid scroll events
- Profile with Chrome DevTools to identify hot paths

### F6. Precompute aln.bed.gz in Rust Tool

The Node.js `make-gfa-tabix` stores all segment sequences in memory. For large genomes:

- Add aln.bed.gz generation to the Rust `tools/gfa-to-tabix`
- Stream segment sequences during pass 1 (already reads S-lines)
- Compute pairwise alignments during pass 2 (walking paths)
- Memory: O(segments * avg_seq_len) for sequence storage — needs careful management
- For very large genomes, consider disk-backed sequence storage

---

## Phase D: Graph Viewer ↔ Synteny Integration

### D1. Bidirectional Navigation

1. **Graph → Synteny**: User views a bubble/variant in the graph viewer, clicks "Show
   synteny context" → opens MultiLGVSyntenyDisplay centered on that variant's reference coordinates
2. **Synteny → Graph**: User clicks a mismatch/deletion/insertion in the multi-synteny
   display → opens graph viewer showing the underlying bubble structure at that position
3. Implementation: shared coordinate resolver using segment ordinals as the linking key
   - Both views already use segment ordinals (GfaTabixAdapter for synteny, GfaAdapter for graph)
   - Need a `navigateToGraphBubble(segOrd)` action on graph view model
   - Need a `navigateToSyntenyRegion(refName, start, end)` action on LGV

### D2. Path Highlighting in Graph View

When the multi-synteny display has specific genomes selected (via genome subset selector),
highlight those paths in the graph view and show which bubbles differentiate the selected genomes.

### D3. Synchronized Selection State

Share genome selection state between MultiLGVSyntenyDisplay and GraphGenomeView:

- Use session-level shared state or MobX observable
- When user selects/deselects genomes in one view, reflect in the other
- Color consistency: same genome → same color across both views

### D4. Shared GFA Data Layer

Both the graph viewer (`GfaAdapter`) and synteny projection (`GfaTabixAdapter`) should share data:

- Single GFA load opened once, graph viewer queries segments + links, synteny adapter queries paths
- For tabix-indexed data: graph viewer uses segs.bed.gz for node sequences and layout, synteny uses pos+segs+aln
- For non-indexed GFA: `GfaAdapter` already loads full GFA; `GfaTabixAdapter` needs pre-indexed files
- Consider a unified `PangenomeAdapter` that serves both views from the same data source

### D5. Variant Annotation from Graph Structure

Use the graph bubble structure to annotate variants in the multi-synteny display:

- Classify bubbles: SNP (1bp), small indel (<50bp), SV (>50bp), complex
- Show bubble type in tooltips and optionally as a color mode
- Count genomes per bubble allele (allele frequency from graph)
- Export variant calls (VCF-like) from graph bubbles

---

## Phase B: MultiLGV Enhancements

### B5. Scrolling for Manual Row Height Mode

When manual row height is set and total rows exceed display height:

- Add vertical scrollbar or scroll container
- Canvas height = numGenomes × rowHeight (can exceed display)
- Clip rendering to visible viewport
- Pairs with F3 (virtual scrolling)

### B6. Sorting/Grouping by Assembly Properties

Organize 90+ assemblies in the multi-synteny display:

- Sort by: identity to reference, name, clade, superpopulation
- Group by: continent/population (for HPRC), haplotype
- Drag-and-drop reordering
- Hierarchical collapse: group header with expand/collapse

---

## Phase C: Improved N-Way LinearSyntenyView

### C2. Cross-Level Linking (deprioritized)

Show relationships that skip levels (A↔C, A↔D) as dotted/faded lines.
Segment-ID based linking for GFA, coordinate chaining for PAF.

---

## Phase E: Data & Formats

### E3. DuckDB/Parquet Investigation

For future scale beyond tabix (hundreds of genomes, complex graph queries).

### E4. S3 Data Regeneration

Regenerate HPRC chrM data with aln.bed.gz using the v1.1-mc chrM GFA source:

1. Download HPRC v1.1 minigraph-cactus chrM GFA (contains segment sequences)
2. Run `make-gfa-tabix` to generate pos.bed.gz + segs.bed.gz + aln.bed.gz
3. Upload to `s3://jbrowse.org/demos/gfadata/hprc-v1.1-mc-grch38/`
4. Update config_hprc_chrM.json to reference aln files

### E5. MAF/TAF Integration

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
1. **1001 Genomes Arabidopsis 27-strain pangenome**: https://1001genomes.org/data/1001Gp/27genomes/releases/2026_03_14/
   - 27 corrected scaffold assemblies available as FASTA (~35MB each)
   - No pre-built GFA — would need to build with minigraph-cactus or PGGB
   - Small genomes (~135MB each) — tractable for pangenome graph construction
   - Excellent demo: real plant data, 27 strains, 5 chromosomes
   - Pipeline: assemblies → minigraph-cactus → GFA → `make-gfa-tabix` → pos/segs/aln.bed.gz
   - Would demonstrate full pipeline from raw assemblies to interactive pangenome browser

2. **Multi-pair PIF with cs tags**: Generate from minimap2 `--cs` for multi-genome comparison (currently have single-pair only)

3. **HPRC chrM with aln.bed.gz**: Regenerate from v1.1-mc GFA source to get precomputed base-level cs tags (see E4)

4. **C. elegans multi-species PAF**: Small genomes, good for integration testing

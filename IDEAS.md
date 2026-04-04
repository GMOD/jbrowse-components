# Ideas & Future Directions — JBrowse Components 2

Exploratory features, architectural experiments, and longer-term vision items that require further investigation or architectural decisions. These are not immediate priorities but represent exciting possibilities for the pangenome browser.

For immediate next steps, see `NEXT_STEPS.md`. For completed work, see `COMPLETED.md`.

---

## Pangene Integration: Gene-Level Pangenome Views

Full plan for integrating pangene concepts (gene graphs, pangenome matrices, haplotype-aware gene presence/absence) into JBrowse. Breaks down into five phased workstreams.

### Workstream A: Enhanced GFA Infrastructure

**A1. W-line (Walk) Parsing**

Add support for GFA 1.1+ W-lines (currently only P-lines are tested). W-lines carry richer metadata: sample name, haplotype number, contig, coordinates.

- **File:** `plugins/graph/src/gfa/gfaParser.ts`
- Parse W-lines: `W sample hap contig start end >seg1<seg2>seg3 [tags]`
- Add `GFAWalk` interface and `walks: GFAWalk[]` to `GFAGraph`
- Update `gfaConverter.ts` to convert walks to `GraphPath` objects
- Add unit tests with real pangene GFA snippets

**A2. Port Pangene Bubble Detection**

Port pangene's bubble finder (~300 lines) as a standalone utility.

- **File:** new `plugins/graph/src/gfa/bubbleFinder.ts`
- Port `NetGraph` class (cycle marking via Johnson's algorithm)
- Port `get_bubble_all()` and `get_bubble_id()` for exhaustive discovery
- Port `walk_ht()` + `count_allele()` for allele path extraction and frequencies
- Output: `Bubble { startVertex, endVertex, intermediateSegments[], alleles[] }`
- Add unit tests using pangene paper examples

**A3. Bubble Overlay in GraphGenomeView**

Visualize bubbles in the existing graph visualization.

- **Files:** `plugins/graph/src/GraphGenomeView/model.ts`, `plugins/graph/src/renderer/GeometryBuilder.ts`
- Run bubble detection in worker via RPC (non-blocking)
- Store bubbles as volatile state
- Add `colorScheme: 'bubble'` that colors nodes by bubble membership
- Tooltip on hover showing allele counts and sample lists
- Bubble list panel showing frequencies (like GraphStats)

### Workstream B: Gene Pangenome View

A new linear display showing gene-level pangenome structure — presence/absence, order, copy-number across haplotypes.

**B1. Gene Pangenome Data Model**

Define types for gene-level graph structure.

- **File:** new `plugins/graph/src/GenePangenome/types.ts`
- `Gene { id, name, length, chromosome, offset, rank }`
- `GeneArc { from: OrientedGene, to: OrientedGene, genomeCount, avgDistance }`
- `GeneWalk { sample, haplotype, contig, genes: OrientedGene[] }`
- `GeneBubble { start, end, genes: Gene[], alleles: GeneAllele[] }`
- `GenePangenome { genes, arcs, walks, bubbles }`

**B2. Pangene GFA Adapter**

Adapter that reads pangene-format GFA and serves it to gene pangenome display.

- **File:** new `plugins/graph/src/GenePangenome/PangeneGfaAdapter.ts`
- Accept pangene GFA file (local or URL)
- Distinguish pangene GFA from sequence GFA via segment tags (SN, SO, pp)
- Build adjacency index and run bubble detection (A2)
- Expose methods:
  - `getGenesInRegion(chr, start, end)`
  - `getWalksForGenes(geneIds)`
  - `getBubblesInRegion(chr, start, end)`
  - `getGenePresenceMatrix(geneIds)`

**B3. Gene Presence/Absence Matrix Display**

Heatmap-style display showing gene content across samples (like multi-LGV but at gene granularity).

- **File:** new display type in `plugins/graph/src/GenePangenome/`
- X-axis: reference genome coordinate
- Y-axis: samples
- Each cell: filled (present), empty (absent), colored by copy number
- Gene orientation shown as arrow direction
- Highlight inversions and accessory genes (<95% of samples)
- On click: navigate to sequence-level view at that gene's coordinates

**B4. Gene-Centric Navigation**

Navigate by gene name (pangene's primary interaction model).

- **File:** `plugins/graph/src/GenePangenome/ImportForm.tsx`
- Text input with autocomplete from pangene GFA segment names
- On gene selection, extract local subgraph (gene + N neighbors)
- "Expand neighborhood" button to grow visible subgraph
- Complements coordinate-based navigation

**B5. Gene Bubble Variant Track**

Gene-level structural variants (from pangene bubbles) as features on linear genome view.

- Each bubble spans from start-gene to end-gene coordinates
- Feature height/color encodes allele count or non-reference frequency
- Represent: gene copy-number changes, gene order changes, inversions, gain/loss
- Click bubble to show allele paths as mini gene-order diagram

### Workstream C: Integration with Sequence-Level Pangenomes

**C1. Bridge Pangene Bubbles to Existing Bubble CS System**

Map pangene gene-level bubbles to genomic coordinates using SN/SO tags.

- Allow loading pangene bubbles alongside sequence-level bubbles
- Gene-level bubbles appear as separate annotation tier in multi-LGV display
- Color-code: sequence-level (SNPs, indels) vs gene-level (CNVs, inversions, order changes)

**C2. Derive Gene Pangenome from Sequence-Level GFA + Gene Annotation**

For users without a pre-built pangene GFA.

- Given: sequence-level GFA + GFF3 gene annotations
- For each gene, find which GFA segments it overlaps in each haplotype walk
- Construct derived gene graph (genes as nodes, adjacency from walks)
- Output same `GenePangenome` data model so displays work seamlessly

### Implementation Phases

1. **Phase 1** (foundation): A1 (W-line parsing) → A2 (bubble detection port)
2. **Phase 2** (graph enhancement): A3 (bubble overlay)
3. **Phase 3** (gene pangenome MVP): B1 (types) → B2 (adapter) → B3 (matrix display)
4. **Phase 4** (polish): B4 (gene navigation) → B5 (bubble variant track)
5. **Phase 5** (integration): C1 (bridge to existing bubbles) → C2 (derive from sequence GFA)

Phase 1 is independent and can start immediately. Phase 3 can start in parallel with Phase 2 since they share only the bubble detection code.

---

## vg Server Integration

Longer-term architectural exploration: multiple approaches to integrate vg ecosystem (vg graph files, .xg/.gbz formats, topology-aware subgraph extraction).

### Option A: VgServerAdapter

Create an adapter that calls a vg server (like sequenceTubeMap's Express server) over REST.

**Steps:**
- Define adapter config schema (serverUrl, graphFile, optional gamFiles)
- Implement getSubgraph: POST to /api/v0/getChunkedData, receive vg JSON, convert to GFA text
- Implement getMultiPairFeatures: parse vg JSON paths into synteny features
- Add to comparative-adapters plugin or new plugin
- Test with sequenceTubeMap's server

**Benefits:** Topology-aware extraction via `vg chunk -c N` (context steps), native .xg/.gbz support, read alignment integration.

**Drawbacks:** Requires server deployment, adds per-query latency, not suitable for offline use.

### Option B: GbzWasmAdapter

Use gbz-base WASM library to query GBZ files client-side in a Web Worker.

**Steps:**
- Add gbz-base as dependency
- Create adapter that loads GBZ file and queries via WASM
- Run in JBrowse's RPC worker for off-main-thread execution
- Implement getSubgraph and getMultiPairFeatures

**Benefits:** No server needed, works with static file hosting, same tech as sequenceTubeMap's local mode.

**Drawbacks:** WASM library licensing/maintenance, client-side memory footprint.

**Decision:** Option A is simpler and immediately useful for vg-enabled deployments. Option B is more interesting long-term for zero-server deployments. Both can coexist.

---

## Future Data Formats & Scale

### DuckDB/Parquet Investigation

For future scale beyond tabix (hundreds of genomes, complex graph queries). Investigate whether columnar storage with server-side queries could outperform tabix-indexed text files for:
- Very large pangenomes (1000+ haplotypes)
- Complex multi-filter queries (by sample phenotype, allele frequency, etc.)
- Interactive statistics queries (allele frequency, LD patterns)

**Research questions:**
- What query patterns would benefit? (typical use case: "show SNPs in gene X with frequency < 5% in any population")
- Can HTTP range reads on parquet be as efficient as tabix?
- What's the API complexity cost vs. tabix simplicity?
- Would a server-side aggregation layer be necessary?

### MAF/TAF Integration

Base-level multiple sequence alignment at zoomed-in views (for comparison beyond pairwise).

- MAF → multi-pair PIF converter (extract pairwise alignments from MAF blocks)
- TAF (transposed alignment format) as compressed alternative to MAF
- LOD: GFA-derived CIGAR at overview, MAF/TAF at base level
- Reference: jbrowse-plugin-mafviewer for prior art

This would enable true N-way alignments (beyond the current pairwise projections).

---

## Exploratory Visualization & Analysis

### Variant Density Heatmap at Intermediate Zoom

At intermediate zoom levels (too far for individual SNPs, too close for pure structural view), there's a visual gap. A density heatmap of variant sites per window would bridge this — showing "this region is highly variable" before you zoom in to see individual SNPs.

**Needs investigation:**
- What's the right rendering approach? (per-pixel binning vs. precomputed windows)
- Does the bubbles data already support this, or would we need a separate summary track?
- What window size feels natural to users?

### SNP Budget / GPU Memory Limits

If a user enables SNP rendering in a very large region, `expandCsOps` will expand every feature's SNPs into GPU instances. With millions of SNPs, this could overflow GPU memory. A per-region budget or progressive LOD could help.

**Needs verification:**
- Does this actually happen in practice with current zoom thresholds?
- Does the `bpPerPx < 50` gate already prevent it?
- What's the practical memory limit on typical GPUs?

### Phasing Visualization

The bubbles now carry per-haplotype allele assignments for diploid data. Haplotype 1 vs 2 could be colored differently to show phasing patterns across samples — e.g., distinguishing which parental chromosome carries a variant.

**Needs investigation:**
- What color scheme avoids confusion with existing base colors (A/C/G/T)?
- How to distinguish phasing patterns visually without adding too much clutter?
- What's the use case? (population genetics, pedigree analysis?)

### Cross-Linking Between Synteny and VCF Views

Click a colored mark in the synteny view to highlight the corresponding variant in the VCF track, and vice versa. Both views now use the same source data so the coordinate mapping is straightforward.

Would require:
- Unified feature ID/coordinate system
- Bidirectional selection callbacks between displays
- Shared hover/selection state in the session

### Graph-Derived Variant Classification

Use the graph bubble structure to annotate variants in the multi-synteny display:

- Classify bubbles: SNP (1bp), small indel (<50bp), SV (>50bp), complex
- Show bubble type in tooltips and optionally as a color mode
- Count genomes per bubble allele (allele frequency from graph)
- Export variant calls (VCF-like) from graph bubbles

---

## Dynamic Vg Microservice Adapter

A longer-term exploration: a server-side adapter that queries a running `vg` process for subgraph extraction. Would skip preprocessing entirely but adds deployment complexity and per-query latency. Only makes sense if there's a use case where the preprocessing pipeline is unacceptable (e.g., interactive exploration of graphs that change frequently).

**Comparison with Option A/B above:**
- Option A (VgServerAdapter) is a REST wrapper around vg
- This would be a tighter integration (reuse jbrowse's RPC system + worker pool)
- Still requires a running vg process, not suitable for static hosting

---

## Advanced Rendering Experiments

### GLSL Codegen from WGSL

Mechanically generate GLSL vertex shaders from WGSL using glAttributes metadata, eliminating manual GLSL maintenance. Currently both are written and maintained independently.

**Feasibility:** Medium-high. The glAttributes metadata is already structured for this.

**Benefits:** Single source of truth, reduced maintenance burden, fewer shader bugs.

**Drawbacks:** May not handle all GLSL-specific optimizations, requires careful testing.

### Uniform Layout Unification

Share coverage uniform slots between alignments and multi-synteny GPU shaders (currently ~20 overlapping slots with slightly different layouts).

**Current blocker:** Different coordinate spaces (clip-space vs pixel-space) and uniform buffer layouts make direct sharing difficult.

**Possible approach:**
- Normalize both shaders to use same coordinate space (e.g., pixel-space)
- Create a shared UBO struct in alignments-core
- Require all consumers to adopt this struct

**Risk:** Could introduce subtle rendering differences if not done carefully.

### Browser-Based Snapshot Tests

Puppeteer tests comparing actual GPU rendering output against Canvas2D for specific test datasets. Would require test fixtures with real BAM/VCF data (not just synthetic).

**Benefits:** Catches visual regressions that unit tests miss.

**Drawbacks:** Slow, flaky (GPU output varies by driver/OS), requires headless GPU or software renderer.

**Alternative:** Use node-canvas for offline snapshot parity tests instead.

### LOD for Graph Rendering

Reduce Bezier tessellation detail at low zoom levels (`flatness = Math.max(0.5, 2.0 / scale)`), skip nodes whose screen-space length < 2px.

Would improve performance for large graphs at zoomed-out levels.

---

## Future Code Consolidation

### Shared Multi-Format Color Caching

`plugins/wiggle/src/shared/webglUtils.ts` has `parseColor()` with caching. `plugins/variants/src/shared/variantWebglUtils.ts` has `colorToRGBA()` + `createCachedRGBA()`. 

Both could use a shared cached color utility from `@jbrowse/core/util/colorBits`.

**Effort:** Low. Would reduce duplication.

**Benefit:** Consistency, easier to optimize color conversion in one place.

### Multi-Resolution Segment Index (LOD) for Pangenomes

When zoomed out to an entire chromosome, the GfaTabixAdapter fetches all segments for the visible region across all genomes. For HPRC chr20, this means millions of rows to parse — too slow for interactive use.

A multi-resolution approach would help:
- **Structural tier** (zoomed out): pre-merged large synteny blocks with mean identity, no CIGAR — one block per contiguous region per genome
- **Segment tier** (mid zoom): current segment-level data with runtime CIGAR merging
- **Base tier** (zoomed in): aln.bed.gz cs tags for per-base detail

The structural tier could be precomputed by `make-gfa-tabix` as an additional output file, or derived at index time by merging segments into blocks above a configurable size threshold.

**Feasibility:** Medium. Requires new tier in gfa-to-tabix tool, adapter changes, and testing.

**Benefit:** Would make whole-chromosome views responsive even for large pangenomes.

---

## Enhancement Ideas from Working Docs

### Alignments: Curvy Breakpoint Split View Lines

Make curvy breakpoint split view lines in the alignments track for linked paired/supplementary reads (similar to the logic in breakpoint split view but in the normal alignments track).

Would require a separate mode from "Link supplementary reads" — something like "Link paired/supp reads with curved lines."

**Current:** Links use single straight lines.

**Proposed:** Use curved lines to show read orientation matching, making it easier to visualize proper pairs vs. unproper pairs.

### Multi-Bed Track Type

Create the concept of a Multi-bed track type (similar to multi-wiggle).

Use case examples:
- Chromatin state BED files (one per state on different rows)
- RepeatMasker with different repeat types on different rows (one BED per repeat type, or split single BED on attribute)

Would mirror the multi-wiggle pattern but for discrete feature tracks.

### Feature Selection & Clustering

- Canvas click-to-select for MultiLGV (selecting features on canvas)
- Feature clustering for pangenome rows (similar to MultiSampleVariant and MultiWiggle)
- Z-index fighting fix: multi-rubberband synteny where mouseover is under tooltips

---

## Investigation Areas

These need deeper exploration before committing to implementation.

**Variant frequency distributions:** Can we derive allele frequency and LD patterns directly from graph bubbles without full VCF parsing?

**Haplotype block detection:** Use graph structure to identify natural haplotype blocks, enabling more efficient representation of regional structure.

**Pangenome-aware GWAS visualization:** Extend the existing variant displays to show phenotype associations, but accounting for the LD structure of the pangenome.

**Interactive pangenome assembly:** Can we stream assembly/sequencing reads onto the pangenome view for in-place QC?

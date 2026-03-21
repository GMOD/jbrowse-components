# Multi-Genome Synteny, Graph Genome Viewer, and Pangenome Adapters

## Summary

This branch adds large-scale multi-genome synteny visualization and a graph
genome viewer to JBrowse 2. It introduces new data formats, adapters, CLI
tools, and view types designed to handle pangenome-scale data (100+
haplotypes), building on the WebGL/WebGPU rendering foundation from the
`webgl-poc` branch.

---

## New Components

### View Types

- **Graph Genome View** — GPU-accelerated graph visualization for GFA
  pangenome files with WebGPU → WebGL2 → Canvas2D fallback rendering.
  Supports pan/zoom, hover tooltips, node selection, multiple color schemes
  (uniform, random, depth, GC-content), bandage-layout WASM for graph
  layout, spatial indexing for O(1) hit detection, and viewport culling.

### Display Types

- **MultiLGVSyntenyDisplay** — Renders N-way multi-genome synteny comparisons
  as stacked genome rows within a single linear genome view track. Supports
  color-by modes (strand, SyRI classification, identity), CIGAR/cs-tag
  base-level visualization when zoomed in, adjustable row heights, genome
  subset selection, and context menu actions to launch pairwise or N-way
  synteny views.

### Track Types

- **MultiSyntenyTrack** — Track type for multi-pair synteny adapters, paired
  with MultiLGVSyntenyDisplay.

### Adapters

- **GfaTabixAdapter** — Indexed adapter for pangenome-scale GFA data using a
  3-file tabix format. Supports HTTP range requests, handles 1000+
  haplotypes, and auto-creates assemblies from header metadata.
- **GfaAdapter** — In-memory GFA adapter for smaller graphs, parsing
  S/L/P/W lines and generating synteny blocks from shared segment chains.

### CLI Commands

- **`jbrowse make-gfa-tabix`** — Converts GFA files to the 3-file
  tabix-indexed format.
- **`jbrowse make-gfa-db`** — Converts GFA files to SQLite databases.
- **`jbrowse make-pif`** (enhanced) — Now supports 6 input formats: PAF,
  SyRI output, BEDPE, GFA/rGFA, MAF, and ntSynt. Generates 3-tier PIF files.

### Rust Tool

- **`gfa-to-tabix`** — High-performance Rust converter for multi-GB GFA files
  (HPRC chr20: 1GB GFA, 90 haplotypes, ~4.5 min).

---

## Data Formats

### PIF (Pairwise Indexed Format)

JBrowse's native format for storing synteny alignments. A bgzipped,
tabix-indexed, tab-delimited file with a 3-tier resolution system and
multi-pair support.

**3-Tier Structure:**

| Tier       | Prefix (ref/query) | Content                                         | Use Case               |
| ---------- | ------------------ | ----------------------------------------------- | ---------------------- |
| Full       | `t`/`q`            | Complete alignments with CIGAR/cs tags           | Zoomed-in base-level   |
| Summary    | `st`/`sq`          | Large structural blocks with indel positions     | Mid-zoom overview      |
| Structural | `xt`/`xq`          | Merged blocks with SyRI classification + mean id | Zoomed-out overview    |

Each tier stores 9 core PAF-like columns (refName, refLen, refStart, refEnd,
strand, queryName, queryLen, queryStart, queryEnd) plus optional tags
(`cg:Z:` CIGAR, `cs:Z:` difference string, `sy:Z:` SyRI type, `sg:Z:`
segment ID).

**Multi-pair indexing:** For N-genome comparisons, pairs are numbered
(`t0`/`q0`, `t1`/`q1`, ...) with headers declaring `#pairs=N` and
`#pair0=genomeA,genomeB`. All pairs live in one file, queryable by tabix
from either genome's coordinate space.

### GFA Tabix Format (3-file)

A decomposition of GFA pangenome graphs into three tabix-indexed BED files
optimized for runtime range queries:

| File           | Purpose                                        | Key Columns                                    |
| -------------- | ---------------------------------------------- | ---------------------------------------------- |
| `pos.bed.gz`   | Genomic position → segment ordinals            | pathName, chunkStart, chunkEnd, minOrd, maxOrd |
| `segs.bed.gz`  | Segment → all genome positions (reverse index)  | segOrd, pathName, offset, segLen, strand, segId|
| `aln.bed.gz`   | Precomputed pairwise alignments with cs tags   | refPath, start, end, qGenome, qChrom, qStart, qEnd, strand, cs |

Headers encode genome metadata: `#genomes=genome1,genome2,...` and
`#sizes=genome1#chr1:length,...` enabling assembly auto-creation without
external files.

**Chunk-based indexing:** Segments are grouped into configurable chunks
(default 100 segments) in `pos.bed.gz`. A region query finds the relevant
chunks, then `segs.bed.gz` provides the reverse lookup to all genomes sharing
those segments.

### Other Supported Input Formats

| Format      | Parser          | Notes                                                    |
| ----------- | --------------- | -------------------------------------------------------- |
| **PAF**     | Native input    | Standard minimap2 pairwise alignment format              |
| **GFA**     | GfaAdapter, rgfa-parser | Graph Fragment Assembly; S/L/P/W/E lines, `genome#haplotype#refName` path convention |
| **SyRI**    | syri-parser     | 12-column format with structural classification (SYNAL, INVAL, TRANSAL, DUPAL) |
| **BEDPE**   | bedpe-parser    | Paired-end BED with optional SYN/INV/TRA/DUP type column |
| **MAF**     | maf-parser      | Multiple Alignment Format; converted to pairwise PAF     |
| **ntSynt**  | Via PAF conversion | Synteny blocks TSV with blockID grouping across genomes |

All parsers convert to a common `PAFLikeRecord` intermediate, then flow
through `pif-generator.ts` to produce indexed PIF.

---

## Scalability

### The Core Problem

Pangenome data is inherently large: HPRC chr20 alone has 90 haplotypes and
1.86M graph segments in a 1GB GFA file. Naive approaches (loading entire
files, computing all-pairs at runtime) don't scale.

### How These Formats Address It

**Tabix indexing (O(log N) lookups):** Both PIF and GFA-tabix use bgzip
block compression + tabix indices, enabling HTTP range requests. Only the
relevant genomic region is fetched — not the whole file. This is the same
proven strategy used for VCF, BED, and other genomic formats.

**Segment-based reverse index (GFA-tabix):** The `segs.bed.gz` reverse
index maps segment ordinals → all genome positions. A query for 100bp of
reference genome finds ~K segments, then looks up each segment across all
genomes. Complexity is **O(log N + M)** where M is the result set size —
independent of total genome count.

**Multi-tier resolution (PIF):** The 3-tier structure avoids transmitting
CIGAR strings when zoomed out. At chromosome scale, only structural-tier
blocks are fetched. Zooming in progressively loads summary then full-tier
data. This reduces bandwidth by orders of magnitude for overview displays.

**Chunked segment grouping:** `pos.bed.gz` groups segments into chunks
(default 100), reducing the number of tabix queries from one-per-segment
to one-per-chunk.

**Pre-computed alignments (aln.bed.gz):** Optional cs-tag alignments are
computed once at index time rather than reconstructed at runtime from
segment walks, trading disk space for query speed.

| Operation                     | Complexity    | Notes                                    |
| ----------------------------- | ------------- | ---------------------------------------- |
| Region query (GFA-tabix)      | O(log N + M)  | N = total segments, M = result size      |
| Region query (PIF)            | O(log N + M)  | Standard tabix lookup                    |
| Genome subset filtering       | O(1)          | Client-side, no re-query                 |
| Assembly discovery            | O(G) one-time | G = genome count, from header parsing    |
| Index creation (Rust)         | O(file size)  | Streaming, ~4.5 min for 1GB GFA         |

---

## Reference Anchoring

**The system is reference-anchored.** All queries originate from a single
reference genome's coordinate space. The MultiLGVSyntenyDisplay shows other
genomes' synteny _relative to_ whatever genome is loaded in the current
linear genome view.

**Switching reference genome:** Users can launch a new pairwise or N-way
synteny view from the context menu, which creates a LinearSyntenyView with
the current genome as reference and selected genomes as queries. To view from
a different genome's perspective, the user navigates to that genome.

**GFA-tabix supports querying from any genome:** The `pos.bed.gz` index
contains entries for every path (genome) in the graph. If genome B is loaded
in the LGV, queries automatically use genome B's coordinates to find
segments, then map to all other genomes via `segs.bed.gz`. No separate index
file is needed per reference.

**PIF multi-pair is more constrained:** A PIF file with pairs (A,B) and
(A,C) has A as the implicit hub. You can query from A's coordinates to see
B and C, or from B/C to see A, but not directly from B to C without a
separate pair entry.

---

## Relationship to Other Formats

### vs. GFA (raw)

GFA is a graph format — nodes (segments) and edges (links) with paths
through the graph. It's designed for assembly representation, not
interactive browsing. The GFA-tabix format is a **decomposition** of GFA
into range-queryable BED files. The graph structure (which segment connects
to which) is preserved implicitly through shared segment ordinals. The
`GfaAdapter` loads GFA directly into memory for small files;
`GfaTabixAdapter` uses the indexed decomposition for large pangenomes.

### vs. MAF

MAF stores multiple sequence alignments in blocks — all species aligned
together. It's reference-free within each block but doesn't scale for
interactive browsing (no index, no random access). The `maf-parser`
converts MAF blocks into pairwise PAF records (all i<j pairs), which then
flow into PIF. This trades the multi-way alignment structure for indexed
queryability. The conversion from multi-alignment to pairwise loses the
information that all species were co-aligned in the same block.

### vs. Multi-Sample VCF

Multi-sample VCF represents variation as SNPs/indels/SVs relative to a
single reference, with per-sample genotypes. It's fundamentally a
variant-centric format. The synteny formats here are **alignment-centric** —
they represent where large blocks of genome A map to genome B, with optional
base-level detail.

- **VCF excels at:** small variants, genotype matrices, population
  frequencies, variant annotation
- **PIF/GFA-tabix excels at:** large-scale structural rearrangements
  (inversions, translocations), synteny visualization, pangenome topology

Multi-sample VCF scales well for SNPs across thousands of samples but
struggles with complex structural variants. VCF's breakpoint/event model
is strict — it can miss nested inversions, complex rearrangements, and
multi-sample structural variation that doesn't fit cleanly into REF/ALT
representation. The alignment-based approach here sidesteps that by
preserving raw alignment blocks rather than forcing them into discrete
variant calls.

PIF/GFA-tabix handles structural comparisons across dozens to hundreds of
genomes but doesn't attempt to represent individual SNP genotypes in a
matrix. The two approaches are complementary.

---

## Known Limitations and Cons

### Data Format Constraints

- **PIF requires all pairs to include the reference genome.** The
  MultiLGVSyntenyDisplay plots all genomes in the reference genome's
  coordinate space. PIF pairs that don't contain the reference genome
  (chained pairs like A→B, B→C) are silently skipped — only pairs
  directly containing the reference are displayed. Use `make-pif
  --all-vs-all` to generate direct pairs for all genomes, or use
  GFA-tabix which handles this natively via segment indexing.

- **GFA-tabix supports any-genome-as-reference natively.** The segment-
  based reverse index (`segs.bed.gz`) maps each segment to all genomes
  simultaneously. Querying from any genome produces features in that
  genome's coordinate space without transitive projection. This is the
  recommended format for multi-genome comparisons.

- **Chained PIF data works in N-way LinearSyntenyView.** For plotsr-style
  chained data (A→B, B→C, C→D), use the N-way LinearSyntenyView where
  each genome has its own independent coordinate axis. No projection
  needed — each synteny level uses its own pair's coordinate space.

### Architectural

- **Fixed reference perspective.** Cannot dynamically flip which genome is
  the reference without launching a new view. The display always shows
  "other genomes relative to the genome in the current LGV."

- **PIF pair explosion.** For N genomes with all-vs-all pairs, PIF stores
  N×(N-1)/2 pairs. The file size grows quadratically. GFA-tabix avoids
  this by using segment-based reverse indexing, but PIF (used for
  PAF/SyRI/BEDPE sources) has this inherent cost.

- **Pre-computation required.** Both PIF and GFA-tabix require offline
  indexing (`make-pif`, `make-gfa-tabix`, or the Rust tool). Raw
  GFA/PAF/SyRI files cannot be used directly at pangenome scale.

- **Graph view is standalone.** The graph genome viewer doesn't integrate
  with the track/adapter system — it's a self-contained view with its own
  GFA loading. This limits composability (can't overlay other tracks on
  the graph). Graph ↔ synteny navigation is planned but not yet
  implemented.

- **MAF multi-alignment loss.** Converting MAF to pairwise PIF loses
  co-alignment information (that species A, B, C were all aligned in the
  same column). Inherent to the pairwise representation.

### Pre-Merge Issues (tracked in PANGENOME_NEXT_STEPS.md R1-R5)

- **Eager assembly creation.** For pangenomes with 90+ haplotypes, all
  assemblies are created on first data fetch regardless of user selection.
  Should be lazy — only create assemblies for genomes the user selects.

- **Silent failures on malformed GFA-tabix headers.** Missing `#sizes` or
  `#genomes` headers produce empty results with no warning logs, making
  misconfigured files hard to debug.

- **GFA W-line parsing untested.** W-lines are the primary format for HPRC
  and other major pangenome projects, but only P-line parsing has test
  coverage.

- **stopToken not wired through GfaTabixAdapter.** Long-running pangenome
  queries cannot be cancelled when the user scrolls away.

- **Arabidopsis PIF needs regeneration.** Current chained pairs only show
  Col-0 vs Ler in multi-LGV. Needs all-vs-all regeneration for full
  4-way display.

### Feature Gaps (deferred)

- **No renderSvg for MultiLGVSyntenyDisplay.** Canvas-only rendering;
  no image/SVG export. The 2-way LinearSyntenyDisplay has this.

- **Partial canvas interactivity.** Mouseover tooltips work, but no
  click-to-select or right-click context menu for individual features on
  the canvas. The model has `selectFeature()` but it's not wired to the
  rendering component.

- **N-way view has no practical limit.** Users can launch an N-way
  synteny view with dozens of genomes. No warning or cap — just
  progressively worse performance.

- **cs tags optional.** Base-level visualization quality depends on
  whether cs tags were computed during indexing. Without them, only
  CIGAR-level detail is available, not per-base substitution colors.

- **Hardcoded WASM URL for graph layout.** `GraphComputeLayout.ts`
  loads WASM from `https://jbrowse.org/demos/bandage/` with no fallback
  if unavailable.

---

## Test plan

- [ ] Browser tests: multi-LGV synteny, graph genome, GFA pangenome, HPRC
      pangenome suites
- [ ] Unit tests: GfaTabixAdapter, PairwiseIndexedPAFAdapter, GFA parsers,
      cs/syri utils, autoOrder, renderSvg colors, GeometryBuilder,
      SpatialIndex, hit detection
- [ ] CLI tests: make-gfa-db, make-gfa-tabix, make-pif parsers
- [ ] Manual: graph genome view with sample GFA
- [ ] Manual: MultiLGVSyntenyDisplay with arabidopsis 4-way and HPRC chrM

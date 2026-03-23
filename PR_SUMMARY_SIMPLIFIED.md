# GFA Tabix: Indexed Pangenome Synteny for JBrowse 2

## Background

JBrowse 2 supports pairwise synteny views, but scaling to many genomes is
painful:

- Each comparison requires manually stepping through the import form
- Each pair needs its own file (e.g. human-vs-mouse PAF, mouse-vs-rat PAF)
- Each row is a full linear genome view — no way to show a compact summary

## The Pangenome Ecosystem

Graph-based pangenome methods have matured around the GFA format, with tools
like **pggb**, **minigraph-cactus**, and **vg** for construction and analysis.
The human pangenome reference was built with these tools
(https://github.com/human-pangenomics/hpp_pangenome_resources).

Graph pangenomes are typically used for within-species comparisons (e.g. human
haplotypes), not cross-species (e.g. human vs mouse).

## This PR

This PR introduces an indexed data format and new visualizations that bring
pangenome graphs into JBrowse 2:

- **GfaTabixAdapter** — queries from any genome to any other efficiently (graphs
  are inherently all-vs-all, and our format preserves this)
- **MultiSyntenyTrack** with **MultiLGVSyntenyDisplay** — shows each genome as a
  compact row aligned to the reference, within a single linear genome view
  (analogous to LGVSyntenyDisplay for pairwise)
- From a region of interest, users can launch a full linear synteny view or a
  graph genome view (a JS bandage-style plot)

## The Idea

A pangenome graph represents multiple genomes as shared DNA segments. Each
genome is a **path** — an ordered walk through segments. Identical regions share
the same segment; divergent regions use different ones.

```
ref:         s1 ── s2 ── s3 ── s4 ── s5
sampleA:     s1 ── s2 ── s6 ── s4 ── s5
sampleB:     s1 ── s7 ── s8 ── s4 ── s5
```

All three share s1, s4, s5. SampleA diverges in the middle (s6 replaces s3);
sampleB diverges more (s7 and s8 replace s2 and s3).

The problem: GFA files can be huge (1GB+ for 90 haplotypes) and have **no
index** — querying a region means loading the entire file.

## The Format: A Tabix-Based Encoding for GFA

We decompose the GFA into two indexed files. The `jbrowse make-gfa-tabix` CLI
command walks every path in the GFA, accumulating segment lengths to compute
genomic coordinates. These coordinates are derived from the GFA paths and are
accurate to what the graph contains, but may not exactly match the original
assembly FASTA if the graph builder clipped or omitted regions (e.g. unresolved
repeats, contig ends). The command writes:

**`pos.bed.gz`** — tabix-indexed BED. The first column uses full PanSN path
names from the GFA (e.g. `ref#1#chr1` = `sample#haplotype#sequence`), so every
genome's coordinates are in the same index. This is what makes "any genome as
reference" work — querying `tabix pos.bed.gz ref#1#chr1:100-500` and
`tabix pos.bed.gz sampleA#1#chr1:0-200` both work on the same file.

**`segments.gz`** — bgzip with a companion offset index. Maps each segment back
to every genome that contains it and its position there (segment → all genomes).
This reverse lookup is what makes cross-genome queries possible.

```
THE GRAPH                         pos.bed.gz                segments.gz
                                  (coords → ordinals)       (ordinal → all genomes)

ref:     s1──s2──s3──s4──s5       ref:0-100    → 0          0 → ref:0,     samA:0,   samB:0
samA:    s1──s2──s6──s4──s5       ref:100-300  → 1          1 → ref:100,   samA:100
samB:    s1──s7──s8──s4──s5       ref:300-450  → 2          2 → ref:300
                                  ref:450-530  → 3          3 → ref:450,   samA:390, samB:450
                                  ref:530-650  → 4          4 → ref:530,   samA:470, samB:530
                                  samA:0-100   → 0          5 → samA:300
                                  samA:100-300 → 1          6 → samB:100
                                  samA:300-390 → 5          7 → samB:400
                                  samB:0-100   → 0
                                  samB:100-400 → 6
                                  ...                       ...
```

Segments (graph nodes) are assigned sequential numeric ordinals. These are internal IDs used as array indices into the companion byte-offset index — they have no meaning outside a given file set.

## How a Query Works

User browses `ref`, region 100–450bp:

```
1. pos.bed.gz: ref:100-450 → segments s2, s3, s4

2. segments.gz: look up s2, s3, s4 →
   s2 also in sampleA at 100-300
   s3 only in ref
   s4 also in sampleA at 390-470, sampleB at 450-530

3. GfaTabixAdapter merges shared segments into synteny blocks:
   ref:100-300 ↔ sampleA:100-300  (s2)
   ref:450-530 ↔ sampleA:390-470  (s4)
   ref:450-530 ↔ sampleB:450-530  (s4)
```

One tabix query + one byte-range read. The adapter returns these blocks as
JBrowse features, grouped by query genome. The **MultiLGVSyntenyDisplay**
renders each genome as a horizontal row within the track, drawing each synteny
block as a rectangle positioned in the reference's coordinate space. Blocks are
colored by strand, identity, or structural type. Gaps between blocks (where
genomes have different segments) appear as empty space — the visual equivalent
of an insertion or deletion relative to the reference.

## Any Genome Can Be the Reference

`pos.bed.gz` has entries for **every** genome. Switch reference by navigating to
a different genome — same files, same process, different starting coordinates.
No per-reference indexes, no N^2 pairwise precomputation.

## Optional: Base-Level Detail (`aln.bed.gz`)

Segments show **where** genomes align but not **how** — without sequences, the
adapter can only report that two genomes share a segment, not whether they
differ at individual bases within a bubble. The optional `aln.bed.gz` file adds
base-level resolution by precomputing pairwise alignments at index time.

### When is it generated?

`aln.bed.gz` is only generated when the GFA file contains actual segment
sequences (not `*` placeholders). The converter checks
`segmentSequences.size > 0` — if all S-lines have `*` for their sequence field
(common in large pangenome GFAs distributed without sequences), the aln step is
skipped. GFA files from pggb typically include sequences; minigraph-cactus
output often omits them.

### How it works

The converter walks every pair of paths (first genome as reference vs each
other genome) and uses **shared segments as alignment anchors**:

```
ref path:     s1 ── s2 ── s3 ── s4 ── s5
query path:   s1 ── s2 ── s6 ── s4 ── s5
                          ↑
                    "bubble" — ref has s3, query has s6
```

1. **Find shared segments** between the ref path and query path (s1, s2, s4, s5
   above). These are anchors where both genomes traverse the same graph node.

2. **Walk between anchors** to find "bubbles" — regions where each path takes
   different segments. Between s2 and s4, the ref has s3 and the query has s6.

3. **Compare bubble sequences** base-by-base using the actual segment DNA
   sequences from the GFA:
   - Same length → base-by-base comparison producing `:N` (match) and `*xy`
     (substitution) cs operations
   - Ref-only sequence → `-seq` (deletion in query)
   - Query-only sequence → `+seq` (insertion in query)
   - Different lengths → emit as deletion + insertion

4. **Merge into alignment blocks.** Consecutive same-strand shared segments and
   their intervening bubbles are merged into a single alignment block with a
   composite cs tag. Strand changes (inversions) break the block.

### Example

```
ref:     s1(100bp) ── s2(200bp) ── s3(150bp, ref-only) ── s4(80bp)
query:   s1(100bp) ── s2(200bp) ── s6(90bp, query-only) ── s4(80bp)

Shared anchors: s1, s2, s4
Bubble between s2 and s4: ref has s3 (150bp), query has s6 (90bp)

cs tag: :100:200-<s3 seq lowercase>+<s6 seq lowercase>:80
        ^^^  ^^^                                       ^^
        s1   s2   deletion(150bp)  insertion(90bp)     s4

aln.bed.gz row:
ref#1#chr1  0  530  query#1  chr1  0  470  +  :100:200-aaccgg...+ttggcc...:80
```

### How it's used at runtime

When `aln.bed.gz` is configured and available, the GfaTabixAdapter
**skips segment-based merging entirely** and reads precomputed alignment blocks
directly. This is the `isAlnAvailable()` check — if it returns true,
`getMultiPairFeaturesFromAln()` is used instead of
`getMultiPairFeaturesFromSegments()`.

The cs tag is converted to CIGAR for rendering and used to compute per-feature
identity (match bases / total aligned bases). This enables:
- **SNP coloring** when zoomed to base level
- **Insertion/deletion visualization** in the synteny display
- **Identity shading** based on actual sequence similarity, not just segment
  sharing

### Without `aln.bed.gz`

When the aln file is absent, the adapter falls back to segment-based merging.
This produces synteny blocks with approximate CIGAR strings derived from segment
length gaps (e.g., "150bp ref gap + 90bp query gap → 90X60D") but without
base-level accuracy. Identity is estimated from segment sharing patterns rather
than sequence comparison. This mode is faster to generate and sufficient for
structural overview.

### Bidirectional: any genome as reference

The converter computes alignments for **all genome pairs**, not just from a
single reference. For each pair (A, B), it computes A→B using shared segment
anchors, then derives B→A by swapping coordinates and flipping the cs tag
(`+seq` ↔ `-seq`, `*xy` → `*yx`). This means `aln.bed.gz` is queryable from
any genome as reference — the same "any genome as reference" property as the
segment index.

The cost is ~2× the rows compared to single-reference (each pair produces two
rows instead of one), but the computation is only done once per pair — the
reverse direction is derived algebraically, not recomputed.

## GFA Compatibility

The converter targets **path-based pangenome graphs** — the output of tools like
pggb, minigraph-cactus, and vg. These tools all produce GFA1 with S-lines,
L-lines, and either P-lines or W-lines for paths, with `0M` (blunt-ended)
overlaps throughout.

**Supported record types:**

- **S-lines** (segments/nodes): the DNA sequences that form graph vertices
- **P-lines** (GFA v1.0 paths): `P ref#1#chr1 s1+,s2+,s3+ *` — typical pggb
  output
- **W-lines** (GFA v1.1 walks): `W sample 1 chr1 0 1000 >s1>s2>s3` — HPRC
  minigraph-cactus format

**Not supported (and why):**

- **L-lines** (links/edges): parsed by the graph viewer but not needed for the
  tabix conversion — path walks implicitly encode adjacency, and all pangenome
  tools produce `0M` overlaps so link CIGARs don't affect coordinate computation
- **GFA2** (E, O, F, G, U lines): not adopted by the pangenome community — no
  major tool (pggb, minigraph-cactus, vg, odgi) outputs GFA2
- **C-lines** (containments), **J-lines** (jumps): not produced by pangenome
  graph builders
- **rGFA** (minigraph): uses SN/SO/SR tags on segments instead of paths —
  requires a different conversion approach (see `RGFA_PLAN.md`)

**Tool compatibility:**

| Tool               | GFA version | Path type | Supported |
| ------------------ | ----------- | --------- | --------- |
| pggb               | GFA 1.0     | P-lines   | Yes       |
| minigraph-cactus   | GFA 1.1     | W-lines   | Yes       |
| vg (export)        | GFA 1.0/1.1 | P or W    | Yes       |
| odgi (export)      | GFA 1.0     | P-lines   | Yes       |
| minigraph (rGFA)   | rGFA        | None      | No (see `RGFA_PLAN.md`) |

## Usage

```bash
jbrowse make-gfa-tabix input.gfa --out mydata
# mydata.pos.bed.gz       + .tbi              (forward index: coords → ordinals)
# mydata.segments.gz      + .gzi + .idx       (reverse index: ordinals → all genomes)
# mydata.aln.bed.gz       + .tbi              (optional, base-level cs tags)
```

Genome names and sizes come from file headers — the GfaTabixAdapter auto-creates
assemblies for query genomes on first load.

## Scalability

- HPRC chr20 (90 haplotypes, 1GB GFA): ~4.5 min conversion
- HTTP range requests fetch only the relevant region
- A Rust implementation of `make-gfa-tabix` is available for multi-GB files

**Current scaling characteristics:**

`segments.gz` has one row per (segment, path) pair. For a graph with _S_
segments and _P_ paths where each segment appears in _k_ paths on average, the
file has _S × k_ rows. In pangenome graphs, conserved segments are shared by
nearly all paths, so _k_ approaches _P_ for those segments.

| Scale | Segments | Paths | Est. segments.gz rows | segments.idx |
| ----- | -------- | ----- | --------------------- | ------------ |
| HPRC chr20 | 1.86M | 90 | ~100M | ~15MB |
| HPRC whole genome | ~30M | 90 | ~1.6B | ~240MB |
| 1000 haplotypes | ~2M | 1000 | ~1B+ | ~16MB |

At query time, the adapter fetches **all paths** for the queried segment ordinals. With 90 paths this is fast; with 1000+ paths,
a small genomic region pulls megabytes of segment rows even if the user only
has a few genomes visible. The adapter parses and filters client-side, but the
network cost is paid regardless.

**Conversion memory:** The TypeScript converter accumulates all segment rows
in memory before sorting (`segsRows` array). At 1B+ rows this exceeds
available memory. The Rust implementation streams to an external sort, so it
handles larger inputs but still produces the same large output file.

See the Caveats section for planned mitigations.

## Caveats

- **Reference-anchored.** Other genomes shown relative to the current view
  genome.
- **Graph topology, not sequence alignment.** No base-level detail without
  `aln.bed.gz`.
- **Companion index is a flat array.** ~15MB for 1.86M segments (HPRC chr20);
  only needed offsets are fetched via range requests.
- **Segment ordinals are internal.** Assigned in GFA path-traversal order; only valid within one file set.
- **No path filtering in segments.gz.** Querying a segment range fetches all
  paths' data for those segments. With 90 haplotypes this is fine; at 1000+
  paths, queries fetch far more data than displayed. Possible mitigations:
  - **Path-sharded segments files** — one `segments.{genome}.gz` per genome (or
    per group). The adapter opens only the files for visible genomes. Simple to
    implement, trades one large file for many small ones.
  - **Sub-index per segment** — within each segment's block in segments.gz,
    store a small directory of which paths are present and their byte offsets.
    Allows skipping unwanted paths without sharding files.
  - **Server-side filtering** — a thin proxy or cloud function that filters
    segments.gz by requested genomes before returning bytes. Keeps the file
    format simple.
- **No level-of-detail yet.** At whole-chromosome zoom, the adapter fetches all
  segments for the region — potentially millions of rows for large pangenomes. A
  precomputed structural summary tier (like PIF's 3-tier system) would make
  whole-genome views responsive. Planned as a future enhancement.
- **Pre-computation required.** Raw GFA can't be browsed at scale.
- **No incremental updates.** Adding a genome means regenerating all files.
- **Conversion memory.** The TypeScript converter holds all segment rows in
  memory. For graphs with >100M segment×path pairs, use the Rust implementation
  which streams to an external sort.

## Related Formats

**rGFA**
([reference GFA](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md)) is
minigraph's output format. It tags each segment with `SN` (reference contig),
`SO` (offset), and `SR` (rank), so you can map segments back to a single
reference without walking paths. Crucially, rGFA **does not embed paths** for
non-reference genomes — to get those, you must re-map assemblies with
`minigraph --call`, which produces GAF alignments. Our converter requires paths
(P or W lines) so rGFA is not directly supported; see `RGFA_PLAN.md` for a
proposed approach. rGFA answers "where is this segment on the reference?"; GFA
Tabix answers "where is this segment on every genome?"

**GAF**
([Graph Alignment Format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md#the-graph-alignment-format-gaf))
is to graphs what PAF/SAM is to linear references: a tab-delimited format for
alignments against a graph. Each record describes a path through nodes (e.g.
`>s1>s2<s3`) with coordinates and optional CIGAR. Used by vg, GraphAligner, and
minigraph.

**vg gafannot** ([Montlong et al.](https://jmonlong.github.io/manu-vggafannot/))
was a helpful motivator — it shares the same core indexing trick (node-ID-based
tabix lookup). But gafannot solves a different problem. Its indexed GAF files
store things like "gene BRCA1 traverses nodes >s50>s51>s52" or "read HWI-12345
aligns to nodes >s100>s101" — external data that has been _projected onto_ the
graph. The question it answers is "what annotations overlap this part of the
graph?"

Our format doesn't store external annotations. It stores the graph's own
structure: "segment s2 appears in ref at position 100 and in sampleA at position
100." The question we answer is "given a region in one genome, where do all the
other genomes align?" The graph paths themselves _are_ the data — we just need
to make them queryable by coordinate.

|                | GFA Tabix (this PR)                                        | vg gafannot                                                    |
| -------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| What's indexed | The graph's own paths (which genomes share which segments) | External data projected onto the graph (genes, reads, repeats) |
| Question       | "Where do other genomes align here?"                       | "What annotations overlap this subgraph?"                      |
| Indexed data   | Segment → genome positions                                 | GAF records (e.g. gene coordinates on graph nodes)             |
| Indexing       | bgzip + companion offset index                             | tabix with custom GAF preset                                   |
| Toolchain      | Standalone (`jbrowse make-gfa-tabix`)                      | Requires vg toolkit                                            |

The two are complementary and could coexist — gafannot to show gene annotations
on the pangenome, GFA Tabix to navigate between genomes.

**PIF** (Pairwise Indexed Format) is JBrowse's format for pairwise synteny from
tools like minimap2, SyRI, and ntSynt. It stores tabix-indexed alignments with a
3-tier resolution system (full CIGAR, summary blocks, structural overview) and
supports multiple pairs per file.

|              | GFA Tabix                                 | PIF                                |
| ------------ | ----------------------------------------- | ---------------------------------- |
| Input        | GFA pangenome graph                       | PAF, SyRI, BEDPE, MAF, etc.        |
| Cross-genome | Any-to-any via reverse index              | Explicit pairs only                |
| Scaling      | O(segments), independent of genome count  | O(N^2) for all-vs-all              |
| Best for     | Same-species pangenomes (many haplotypes) | Pairwise/cross-species comparisons |

**MAF** (Multiple Alignment Format) stores multi-way alignments but has no index
— JBrowse converts it to PIF for random access.

**Multi-sample VCF** is variant-centric (SNPs, indels, SVs with per-sample
genotypes), not alignment-centric. VCF excels at small variants and population
frequencies; GFA Tabix at large-scale structural synteny. Complementary.

---

<details>
<summary>Technical details</summary>

### pos.bed.gz (tabix)

| Column     | Description                              |
| ---------- | ---------------------------------------- |
| pathName   | Genome path (e.g. `ref#1#chr1`)          |
| chunkStart | Start coordinate                         |
| chunkEnd   | End coordinate                           |
| ordinals   | Range-encoded ordinals for this chunk    |

The ordinal column uses range notation to compactly express lists of segment
ordinals. Consecutive ordinals are collapsed into `start-end` ranges;
non-consecutive ordinals are comma-separated:

```
# old format (one number per ordinal, each comma-separated):
ref#1#chr1  0  76082  787815,787816,...,787914

# new format (range notation):
ref#1#chr1  0  76082  787815-787914
ref#1#chr1  0  76082  0-23,58-80,121-170,1119592-1119596
```

The second example shows a region where the reference path traverses two
groups of consecutive shared segments (0–23, 58–80, 121–170) and a cluster of
assembly-private segments (1119592–1119596) — a typical pattern in pangenome
graphs where conserved regions have dense consecutive ordinals and divergent
regions have sparse ones.

Segments chunked (default 100) to reduce queries. Headers encode `#genomes=...`
and `#sizes=path:length,...`.

### segments.gz (bgzip + companion index)

Bgzip produces a `.gzi` block-boundary index. The companion `.segments.idx` is a
flat uint64 LE array where `idx[N]` is the byte offset where segment N starts.
To query segments N–M: read `idx[N]` and `idx[M+1]`, then fetch that byte range
via the GZI index.

Path names appear once in the file header (`#paths=...`) and are referenced by
numeric index in each row — the same approach BAM uses for reference sequence
names. This avoids repeating 30-character path names millions of times.

```
# header lines (written once):
#genomes=ref#1,samA#1,samB#1
#sizes=ref#1#chr1:650,samA#1#chr1:470,samB#1#chr1:530
#paths=ref#1#chr1,samA#1#chr1,samB#1#chr1

# data rows: ordinal, pathIdx, offset, length, strand
0  0  0    100  +        ← ordinal 0, path 0 (ref#1#chr1),  offset 0,   len 100
0  1  0    100  +        ← ordinal 0, path 1 (samA#1#chr1), offset 0,   len 100
0  2  0    100  +        ← ordinal 0, path 2 (samB#1#chr1), offset 0,   len 100
1  0  100  200  +        ← ordinal 1, path 0 (ref),         offset 100, len 200
1  1  100  200  +        ← ordinal 1, path 1 (samA),        offset 100, len 200
2  0  300  150  +        ← ordinal 2, path 0 (ref only)
3  0  450  80   +
3  1  390  80   +
3  2  450  80   +
```

| Column   | Description                                  |
| -------- | -------------------------------------------- |
| ordinal  | Numeric segment ID (0, 1, 2, ...)            |
| pathIdx  | Index into `#paths=` header                  |
| offset   | Position within that genome's path           |
| segLen   | Length in bases                              |
| strand   | `+` or `-`                                   |

One row per (segment, genome) pair.

### aln.bed.gz (tabix)

| Column       | Description                                            |
| ------------ | ------------------------------------------------------ |
| refPath      | Reference path                                         |
| start, end   | Reference coordinates                                  |
| qGenome      | Query genome                                           |
| qChrom       | Query chromosome                                       |
| qStart, qEnd | Query coordinates                                      |
| strand       | `+` or `-`                                             |
| cs           | cs tag (`:N` match, `*XY` sub, `+seq` ins, `-seq` del) |

### Segment merging (done at runtime by GfaTabixAdapter)

Pangenome graphs can have thousands of tiny segments (HPRC chrM: ~1400 for
~16kb). At query time, the GfaTabixAdapter merges adjacent same-strand shared
segments into larger synteny blocks. The gaps between shared segments — where
each genome has different segments — become insertions, deletions, and
substitutions in the generated CIGAR string:

```
       ref pos    segment         sampleA pos
       0-100      s1 (100bp)      0-100
       100-300    s2 (200bp)      100-300
       ── gap ──  ref: s3 (150bp), sampleA: s6 (90bp)
       450-530    s4 (80bp)       390-470

Result: ref:0-530 ↔ sampleA:0-470
CIGAR:  300= 90X 60D 80=
```

| Ref gap | Query gap | CIGAR                           |
| ------- | --------- | ------------------------------- |
| 0       | 0         | extend match                    |
| >0      | 0         | `ND` (deletion)                 |
| 0       | >0        | `NI` (insertion)                |
| >0      | >0        | `min(R,Q)X` + remainder `D`/`I` |

Strand changes break the block (inversion boundary). When `aln.bed.gz` is
available, runtime merging is skipped in favor of precomputed cs tags.

### Why bgzip, not tabix, for segments?

Tabix uses a hierarchical binning scheme designed for overlapping genomic
intervals on named chromosomes. Segment IDs are sequential integers — the
binning adds overhead for no benefit. Bgzip + a companion offset index maps IDs
directly to byte positions with no wasted structure.

</details>

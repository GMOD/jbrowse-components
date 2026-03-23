# rGFA / GAF Support Plan

## Background

Minigraph produces **rGFA** (reference GFA), a GFA1 subset where each segment is
tagged with its position on the reference genome:

```
S  s1  ACGT  LN:i:4  SN:Z:chr1  SO:i:0     SR:i:0
S  s2  TTCC  LN:i:4  SN:Z:chr1  SO:i:4     SR:i:0
S  s3  GGAA  LN:i:4  SN:Z:chr1  SO:i:4     SR:i:1
L  s1  +  s2  +  0M
L  s1  +  s3  +  0M
```

- `SN:Z:chr1` — reference contig
- `SO:i:0` — offset on that contig
- `SR:i:0` — rank (0 = reference backbone, higher = variant)

Unlike pggb and minigraph-cactus output, rGFA has **no P-lines or W-lines**. The
reference path is implicit (rank-0 segments in SN/SO order), and non-reference
genomes are not embedded in the graph at all.

## How Non-Reference Paths Are Obtained

To get per-sample paths through a minigraph graph, assemblies must be re-mapped:

```bash
minigraph --asm graph.rgfa sample.fa > sample.gaf
```

This produces **GAF** (Graph Alignment Format), where each record describes a
walk through graph nodes:

```
sampleA#1#chr1  50000  0  50000  +  >s1>s2>s3>s5  52000  0  52000  48000  50000  60
```

The `path` field (`>s1>s2>s3>s5`) is structurally identical to a GFA W-line walk
string — it's an ordered traversal of oriented segments. The GAF record also
carries query name, coordinates, strand, and alignment quality.

## The GAF Connection

GAF is the graph equivalent of PAF — it's how tools communicate "this sequence
walks through these graph nodes." Both rGFA support and vg gafannot rely on GAF
as the bridge between linear sequences and graph topology:

| | rGFA + GAF (this plan) | vg gafannot |
|-|------------------------|-------------|
| GFA provides | Segments (nodes) | Segments (nodes) |
| GAF provides | Per-sample genome paths | Annotation projections (genes, reads) |
| Question answered | "Where does sampleA align?" | "What annotations overlap this subgraph?" |

The difference is *what* the GAF records represent (genome paths vs annotations),
not *how* they're parsed. A single GAF parser serves both.

## Proposed Approach: `--gaf` flag on `make-gfa-tabix`

Rather than a separate rGFA-specific command, extend the existing converter:

```bash
jbrowse make-gfa-tabix graph.rgfa --gaf sampleA.gaf --gaf sampleB.gaf --out mydata
jbrowse make-gfa-tabix graph.rgfa --gaf sampleA.gaf --gaf sampleB.gaf --out mydata --sharded
```

The `--sharded` flag produces per-genome segments files and a
`ShardedGfaTabixAdapter` manifest instead of a single combined segments file
(`GfaTabixAdapter`). For rGFA with many re-mapped genomes, sharded mode is
recommended since each GAF adds a genome and the combined segments file grows
as O(segments × genomes).

### How it works

1. **Parse S-lines** as today (segment names, lengths, sequences, ordinals)
2. **Reconstruct the reference path** from SN/SO/SR tags: collect rank-0
   segments, group by `SN` (contig), sort by `SO` (offset) within each group
3. **Parse GAF files** to extract non-reference paths: the `path` field gives the
   walk string, the `query_name` gives the path name (in PanSN format)
4. **Feed all paths** into the existing `gfaToTabix` pipeline — from this point
   on, the code doesn't know or care that the paths came from GAF instead of
   P/W lines

### GAF path extraction

A GAF record has 12+ tab-separated fields:

```
qName  qLen  qStart  qEnd  strand  path  pLen  pStart  pEnd  matches  blockLen  mapQ  [tags]
```

The walk string in column 6 (`>s1>s2<s3>s5`) uses the same `>` / `<` orientation
syntax as GFA W-lines. Parsing is identical to the existing W-line walk parser.

One difference: a single GAF file may have multiple records per query sequence
(partial alignments), unlike W-lines which give one complete path per sequence.
These partial alignments would become separate paths or need merging — details
TBD, but the simplest approach is to treat each GAF record as a path fragment
and let the existing segment-merging logic in GfaTabixAdapter handle
consolidation at query time.

### Reference path from SN/SO/SR

```typescript
// Collect rank-0 segments, group by contig, sort by offset
const refSegments = [...segments.values()]
  .filter(s => s.tags.get('SR') === 0)
  .sort((a, b) => {
    const snCmp = a.tags.get('SN').localeCompare(b.tags.get('SN'))
    return snCmp !== 0 ? snCmp : a.tags.get('SO') - b.tags.get('SO')
  })
```

This reconstructs the implicit reference path that rGFA encodes via tags.

## Generality

This approach is not rGFA-specific. It works for **any GFA that lacks embedded
paths**, as long as paths are supplied as GAF:

- rGFA from minigraph + `minigraph --asm` GAF
- Any GFA + GraphAligner GAF
- Any GFA + vg map/giraffe GAF

The `--gaf` flag is optional — if the GFA already has P/W lines, it's ignored.
If the GFA has no paths and no `--gaf` is provided, the existing warning fires.

## Scalability with Many GAF Inputs

GAF-based input makes it easy to add hundreds or thousands of paths. This
amplifies the scaling concerns already present in the tabix format:

**segments.gz is O(segments × paths).** Each segment gets one row per path that
contains it. In a conserved region, a segment shared by 1000 genomes produces
1000 rows. A query for a small genomic region fetches ALL of those rows — the
current format has no way to filter by genome at the file level.

**Partial alignments multiply the problem.** Unlike W-lines (one complete path
per genome), GAF records from `minigraph --asm` can produce multiple partial
alignments per query sequence. Each partial alignment is a separate path
fragment, further increasing the row count in segments.gz.

**Mitigations to consider before implementing GAF support:**

1. **Path-sharded segments files.** Instead of one monolithic segments.gz,
   produce one per genome: `segments.sampleA.gz`, `segments.sampleB.gz`, etc.
   The adapter opens only the files for visible genomes. This turns O(segments ×
   all_paths) network I/O into O(segments × visible_paths). File count grows
   linearly with genomes, but each file is small and independently indexed.

2. **GAF deduplication.** Multiple GAF records for the same query sequence on the
   same contig should be merged into a single path before conversion. This
   prevents partial alignments from inflating the output.

3. **Lazy genome loading.** The adapter should support a mode where genomes are
   loaded on demand (user enables them in the UI) rather than fetching all
   genomes for every query.

4. **Summary tier.** At zoomed-out views, show aggregate statistics ("95% of
   genomes share this region") instead of per-genome segment data. This is
   independent of path count.

For the initial implementation, targeting up to ~100 genomes (HPRC scale) is
reasonable with the current format. Scaling beyond that should be gated on
implementing path-sharded segments files.

## Scope

- **SV-level resolution** when using minigraph (>50bp). Base-level resolution
  when using tools that produce finer-grained graphs.
- **No base-level alignment from GAF CIGARs** initially. GAF records can carry
  `cg:Z:` (CIGAR) and `cs:Z:` (cs tag) optional fields — these could feed into
  `aln.bed.gz` generation in a future enhancement.
- **Partial alignments** from GAF need deduplication/merging before conversion.
- **Reference path reconstruction** only needed for rGFA. For regular GFA + GAF,
  the GFA's own P/W lines provide the reference.
- **Target scale:** up to ~100 genomes with current format, 1000+ with
  path-sharded segments files.

## Future: GAF as annotation source

Once we have a GAF parser, the same infrastructure could support vg gafannot-
style annotation display — showing gene projections, read alignments, or repeat
annotations on the pangenome graph. This would be a separate adapter
(GafAnnotAdapter) that reuses the GAF parser but produces annotation features
instead of synteny features.

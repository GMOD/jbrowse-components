# GFA Tabix Index — File Format Specification

This is the canonical spec for the static-file index emitted by
`tools/gfa-to-tabix` and consumed by
`plugins/comparative-adapters/src/GfaTabixAdapter`. Every file format
documented here is referenced by `agent-docs/GRAPH_PLAN.md` and used to
prove the publication's claims (see GRAPH_PLAN.md "Claims" section).

This document is a living artifact. It is updated *as part of* each
phase that introduces or modifies a file format. The paper's methods
section references this spec; one-paragraph summaries in the methods
text are derived from sections here, not the other way around.

## Versioning convention

- All binary files (`.bin`, `.idx`) carry an 8-byte header at offset 0:
  - Bytes 0-3: 4-byte ASCII magic, file-type-specific (e.g. `SEGB`,
    `SEGI`, `EDGB`, `EDGI`, `SEQB`, `SEQI`, `SNRB`).
  - Bytes 4-7: little-endian `u32` version. Version 1 is the current
    layout; future incompatible layouts increment.
- Tabix-indexed BGZF files (`.bed.gz`, `.vcf.gz`) carry the schema in
  their `#`-prefixed header lines. Schema versioning is by header keys
  (e.g. `#schema=bubbles/v1`).
- Readers MUST validate magic + version on open and fail loudly on
  mismatch with a clear error indicating expected vs found.
- Endianness: little-endian throughout, on both Rust emit and JS read
  sides. Documented here so future authors don't guess.

### Compatibility policy

- **Pre-publication.** v1 is mutable. Retro-edits to layout, magic
  bytes, or header format are allowed; `prepare-fixtures.sh` is
  expected to be re-run. Old v1 files may be deleted.
- **Post-publication (frozen).** v1 readers must keep working
  forever. Incompatible layout changes increment the version (v2,
  v3, …) and use a new magic if the byte layout shifts. Readers
  dispatch on (magic, version). Removing v1 support requires a
  deprecation cycle and a release-notes warning. Adding new files or
  new fields *appended* after the existing layout is allowed within
  the same version, provided readers tolerate trailing bytes
  (existing readers in `gfaBinaryIO.ts` already do — they iterate by
  fixed record size and stop at file end).

## Pinned vg version

`vg <pinned-version>` (TBD as of the writing of this spec; pin in
`tools/gfa-to-tabix/README.md` and in the Phase 0 audit harness). The
preprocessor checks the local vg version and warns if mismatched.

## File catalog

### `prefix.pos.bed.gz` + `prefix.pos.bed.gz.tbi`

Tabix-indexed segment positions per path. One BED row per segment per
path it visits.

- BED schema (per row): `path | start | end | ordinalRange | …`
  - `path`: PanSN-formatted path name (`assembly#hap#contig`) or
    legacy single-token form.
  - `start`, `end`: 0-based half-open path coordinates.
  - `ordinalRange`: `<lo>` or `<lo>-<hi>` or comma-separated list,
    parsed by `parsePosLineOrdinals` in `gfaBinaryIO.ts:174`.
- Header (`#`-prefixed lines, before BED rows):
  - `#genomes=<comma-separated assembly names in encounter order>`
  - `#sizes=<comma-separated PathName:Length entries>`
  - `#paths=<comma-separated path names in canonical order>`

### `prefix.segments.bin` + `prefix.segments.idx`

Fixed-size segment records, ordinal-keyed.

- `segments.bin` (post-Phase 1):
  - 8-byte header: magic `SEGB` + version `u32`.
  - Followed by N records of 15 bytes each:
    `segOrd:u32 | pathNameIdx:u16 | offset:u32 | segLen:u32 | orient:u8`.
  - Multiple records per ordinal allowed (one per path that visits it).
- `segments.idx`:
  - 8-byte header: magic `SEGI` + version `u32`.
  - Followed by `BigUint64Array` (numSegments + 1 entries) of byte
    offsets into `segments.bin`. Entry `[ord]` = byte offset of
    ordinal `ord`'s first record; entry `[numSegments]` = total file
    size (sentinel for slicing the last record).

**Eager-load note.** The current `loadBinaryIndex` in
`gfaBinaryIO.ts:79` reads the entire `.idx` into memory at first
access. This is acceptable up to HPRC-chr20 scale (~tens of MB) but is
the bound on indexing the whole HPRC pangenome at once. Documented
here so future agents know it's a known constraint, not an oversight.

### `prefix.edges.bin` + `prefix.edges.idx`

Ordinal-keyed adjacency records. Optional — present only when the
input GFA had L-lines and `--emit-edges` is set.

- `edges.bin` (post-Phase 1):
  - 8-byte header: magic `EDGB` + version `u32`.
  - Followed by 10-byte records:
    `targetOrd:u32 | srcOrient:u8 | tgtOrient:u8 | tgtLen:u32`.
- `edges.idx`:
  - 8-byte header: magic `EDGI` + version `u32`.
  - `BigUint64Array` byte-offset table (numSegments + 1 entries).

### `prefix.segments.seq.bin` + `prefix.segments.seq.idx` (Phase 1, binary tier)

2-bit-packed sequence data, ordinal-keyed. The "BAM" tier in the
SAM/BAM/CRAM analogy.

**Spike result on HPRC chr20** (2026-04-30): 67.66 Mbp total in
S-line sequences. Char distribution: A 27.73%, T 28.06%, G 21.86%,
C 21.61%, N 0.74%. No IUPAC ambiguity codes, no soft-masked
lowercase. The clean alphabet drives the format choice below.

**Decision: Option A (parallel N-bitmap).** 2-bit-pack ACGT, plus a
1-bit-per-base bitmap flagging N positions. The 0.74% N rate is too
sparse to justify a sentinel-byte layout (Option B). At chr20 scale:

- 2-bit sequence: 67.66 Mbp / 4 = ~16.9 MB
- N-bitmap: 67.66 Mbp / 8 = ~8.45 MB
- Total binary tier: ~25 MB (vs 91 MB plaintext FASTA → 73% reduction)

- `segments.seq.bin`:
  - 8-byte header: magic `SEQB` + version `u32`.
  - Per-segment record:
    - 2-bit packed bases (00=A, 01=C, 10=G, 11=T), concatenated.
    - Per-segment N-bitmap, 1 bit per base (1 = N, 0 = ACGT). Decoder
      substitutes `N` at flagged positions regardless of 2-bit value.
    - Both layouts are byte-aligned at segment boundaries; the
      `.seq.idx` records the byte-offset to the start of each record.
  - Future ambiguity codes (R/Y/K/etc.): defer until a spike on a
    fixture that contains them; magic-byte dispatcher allows a
    `SEQB` v2 with a different layout at that point.
- `segments.seq.idx`:
  - 8-byte header: magic `SEQI` + version `u32`.
  - `BigUint64Array` byte-offset table (numSegments + 1 entries).

### `prefix.segments.seq.fa[.gz]` + `.fai` (Phase 1, plaintext tier)

FASTA-formatted sequence file. The "SAM" tier — debuggable, greppable,
larger. One record per ordinal: `>seg<ord>\n<sequence>\n`. Sidecar
`.fai` (samtools-style) for ordinal lookup, or alternatively a
`.seq.idx` BigUint64Array byte-offset table sharing the format above.
Decision pinned during Phase 1.

### `prefix.bubbles.bed.gz` + `prefix.bubbles.bed.gz.tbi`

Per-pair bubble CS rows from `vg deconstruct` VCF, post-PanSN strip.

- BED schema (per row):
  `path | start | end | alleleA | alleleB | identity | cs | genomesA | genomesB`
- `alleleA`, `alleleB`: 0-based allele indices (0 = REF) within the
  VCF site at this locus.
- `identity`: float in `[0, 1]`, ratio of matching bases between
  alleles A and B.
- `cs`: minimap2-style CS string describing alleleA → alleleB edits.
- `genomesA`, `genomesB`: comma-separated 0-based genome indices (into
  the file's `#genomes=` header) carrying each allele.
- Header: `#genomes=<comma-separated bubble-genome names>` (note: this
  list may differ from the `pos.bed.gz` `#genomes=` because VCF
  samples flatten per-haplotype).

This file is supporting infra for Phase 7 bubble-CS rendering, not
part of the headline subgraph contribution.

### `prefix.snarls.bed.gz` + `.tbi` (Phase 4)

Tabix-indexed snarl decomposition rows from `vg snarls -T`.

- BED schema:
  `refPath | refStart | refEnd | snarlId | parentSnarlId | LV | type | startNode | endNode | netGraphNodes | netGraphEdges`
  - `snarlId`, `parentSnarlId`: stable IDs assignable from `vg snarls`
    output. Root snarls have `parentSnarlId = -1` (or `.`).
  - `LV`: nesting depth (root = 0).
  - `type`: `ultrabubble | bubble | chain | other`. Ultrabubbles are
    rendering-relevant: they collapse to a SNP-like view at low zoom.
  - `startNode`, `endNode`: boundary segment ordinals.
  - `netGraphNodes`: count of unique segment ordinals in the snarl's
    net graph, **excluding** boundary nodes.
  - `netGraphEdges`: edge count on those internal segments.
- Header: `#schema=snarls/v1`, `#vgVersion=<pin>`.

### `prefix.vcf.gz` + `prefix.vcf.gz.tbi`

Rewritten `vg deconstruct` VCF with PanSN-stripped CHROM column.
Tabix-indexed for region lookup. Used as input to bubble CS generation
in the Rust tool; secondary as a queryable artifact.

## Magic-byte registry

To prevent collisions:

| Magic  | File                       | Type   |
|--------|----------------------------|--------|
| `SEGB` | `segments.bin`             | binary |
| `SEGI` | `segments.idx`             | binary |
| `EDGB` | `edges.bin`                | binary |
| `EDGI` | `edges.idx`                | binary |
| `SEQB` | `segments.seq.bin`         | binary |
| `SEQI` | `segments.seq.idx`         | binary |
| `SNRB` | (reserved, future snarls binary if needed) | binary |

Any new binary file MUST register its magic here. Magic must be 4
bytes ASCII, distinguishable on a byte dump.

## Future tiers (reserved)

- **CRAM-equivalent reference-compressed sequence tier.** Encode each
  segment as edits relative to a chosen anchor sequence (e.g., the
  segment's longest path neighbor). Out of scope for the publication;
  reserved here so the magic-byte registry leaves a slot and the
  adapter's dispatch logic is forward-compatible.
- **Sharded variants** for very large graphs:
  `prefix.segments.<assembly>.bin`, `prefix.segments.seq.<assembly>.bin`,
  etc. The existing `--sharded` flag already produces sharded
  `segments.bin`. Spec is identical per-shard; the manifest in the
  output describes which shards exist.

## Prior art (reference, not competition)

Jean Monlong's sequencetubemap on the `tabix` branch
(`~/src/sequencetubemap`, `scripts/pgtabix.py` build,
`scripts/chunkix.py` extract) defines an analogous index for the same
purpose. Names align partially:

| Concept                      | Ours                       | sequencetubemap-tabix  |
|------------------------------|----------------------------|------------------------|
| Per-haplotype positions      | `prefix.pos.bed.gz`        | `pos.bed.gz`           |
| Node sequences               | `prefix.segments.seq.bin` (binary) / `.fa.gz` (plaintext) | `nodes.tsv.gz` (TSV) |
| Haplotype walks              | derived from `segments.bin` records (binary, ordinal-keyed) | `haps.gaf.gz` (GAF, node-range-indexed) |
| Edges                        | `prefix.edges.bin`         | implicit (derived from path co-traversal) |
| Bubble CS                    | `prefix.bubbles.bed.gz`    | not present            |
| Snarls (Phase 4)             | `prefix.snarls.bed.gz`     | not present            |

We diverge by storing segments + walks in binary records (smaller
working set per range fetch) and by adding edges, bubble CS, and
snarls as separate tabix-indexed files. Use `chunkix.py` as a
correctness oracle in the reference-extractor harness.

## Cross-references

- `agent-docs/GRAPH_PLAN.md` — phased development plan and claims.
- `agent-docs/GRAPH_PERF.md` — performance findings and known bottlenecks.
- `agent-docs/GRAPH_AUDIT.md` — Phase 0 audit deliverables (concordance
  with `vg find` / `chunkix.py` / `odgi extract`, path-symmetry,
  re-entrant-path semantics note).
- `tools/gfa-to-tabix/README.md` — CLI reference for the preprocessor.
- `tools/graph-truth-extractor/README.md` — reference-extractor
  harness; includes installation pins for the truth backends.
- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaBinaryIO.ts` —
  reader implementation; record sizes and offsets here are the
  ground-truth implementation of this spec.
- `~/src/sequencetubemap/README.tabix.md` — prior-art format
  documentation.

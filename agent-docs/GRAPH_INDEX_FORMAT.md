# GFA Tabix Index — File Format Specification

Canonical spec for the static-file index emitted by `tools/gfa-to-tabix`
and consumed by `plugins/comparative-adapters/src/GfaTabixAdapter`. File
formats here back the publication's claims (see `GRAPH_PLAN.md`).
Update this file alongside any phase that adds or changes a file format.

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
- Endianness: little-endian throughout, on both Rust emit and JS read sides.

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

The catalog is split by *who consumes the file*. The runtime adapter
(`plugins/comparative-adapters/src/GfaTabixAdapter`) opens only the
files in **Index files** below — VCF in particular is preprocessor
input only and is shipped as a sidecar viewable track, not as a
runtime input.

The shipped index has **5 file types** consumed at runtime
(`pos.bed.gz`, `segments.bin`, `edges.bin`, `bubbles.bed.gz`,
`segments.seq.fa`), **1 alternative encoding tier**
(`segments.seq.bin` — opt-in; logically identical to the FASTA
tier per the SAM/BAM analogy), and **1 sidecar artifact**
(`vcf.gz` — JBrowse VariantTrack only, never opened by the
synteny adapter). Earlier drafts of this spec sketched additional
file types (`tiles.<stride>.bin`, `snarls.bed.gz`) for
multi-resolution coarsening and snarl-boundary expansion; both
were removed once the runtime edge-walk in
`gfaCoarsener.ts` proved sufficient at chr20 scale (see
`agent-docs/GRAPH_PLAN.md` "Design direction: unified extraction").

### Index files (consumed by the runtime adapter)

#### `prefix.pos.bed.gz` + `prefix.pos.bed.gz.tbi`

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

#### `prefix.segments.bin` + `prefix.segments.idx`

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

**Eager-load note.** `loadBinaryIndex` in `gfaBinaryIO.ts:79` reads the
entire `.idx` into memory at first access. Acceptable at HPRC-chr20
scale (~tens of MB); would need a streaming index for whole-pangenome.

#### `prefix.edges.bin` + `prefix.edges.idx`

Ordinal-keyed adjacency records. Optional — present only when the
input GFA had L-lines and `--emit-edges` is set.

- `edges.bin` (post-Phase 1):
  - 8-byte header: magic `EDGB` + version `u32`.
  - Followed by 10-byte records:
    `targetOrd:u32 | srcOrient:u8 | tgtOrient:u8 | tgtLen:u32`.
- `edges.idx`:
  - 8-byte header: magic `EDGI` + version `u32`.
  - `BigUint64Array` byte-offset table (numSegments + 1 entries).

#### `prefix.segments.seq.bin` + `prefix.segments.seq.idx` (alternative encoding tier — opt-in)

2-bit-packed sequence data, ordinal-keyed. The "BAM" tier in the
SAM/BAM/CRAM analogy: identical logical content to the plaintext
FASTA below, in a smaller wire encoding. Both tiers ship; the
adapter prefers binary when configured, but plaintext is the
default ("greppable, debuggable") for fixtures shipped today.
Default tier for the publication is pending Phase 8 measurement —
promoting binary is a one-line dispatcher change in
`BaseGfaTabixAdapter`.

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
  - Per-segment record (variable size, byte-aligned at segment boundaries):
    - `len:u32` little-endian — the segment's base count. Self-contained
      so a single record can be decoded without joining against
      `segments.bin`.
    - 2-bit packed bases (00=A, 01=C, 10=G, 11=T), `ceil(len/4)` bytes,
      high-bit-first within each byte (base index `i` reads bits at
      shift `6 - 2*(i & 3)`).
    - Per-segment N-bitmap, `ceil(len/8)` bytes, 1 bit per base
      (low-bit-first within each byte: `(bm[i>>3] >> (i & 7)) & 1`).
      A set bit means `N` at that position; the decoder substitutes
      `N` regardless of the 2-bit pack value, so the encoder doesn't
      need a 2-bit code reserved for N.
  - Missing segments (the source GFA used `*` placeholder) collapse to
    a zero-byte range — `idx[ord] == idx[ord+1]`, no record bytes
    written.
  - Future ambiguity codes (R/Y/K/etc.): defer until a spike on a
    fixture that contains them; magic-byte dispatcher allows a
    `SEQB` v2 with a different layout at that point.
- `segments.seq.bin.idx` (note: `.bin.idx`, not `.idx` — the latter is
  the plaintext tier's 12-byte-per-ordinal sidecar):
  - 8-byte header: magic `SEQI` + version `u32`.
  - `BigUint64Array` byte-offset table, `(numSegments + 1)` entries.
    Entry `[ord]` = byte offset of ordinal `ord`'s record start in
    `seq.bin`; entry `[numSegments]` = end-of-file sentinel for
    slicing the last record.

**File-naming note.** The plaintext tier already owns
`prefix.segments.seq.idx` (12 bytes/ord = u64 offset + u32 length into
the FASTA). The binary tier uses `prefix.segments.seq.bin.idx` to
avoid collision. Both can ship side-by-side in the same fixture; the
adapter prefers the binary tier when both are configured.

#### `prefix.segments.seq.fa[.gz]` + `.fai` (Phase 1, plaintext tier)

FASTA-formatted sequence file. The "SAM" tier — debuggable, greppable,
larger. One record per ordinal: `>seg<ord>\n<sequence>\n`. Sidecar
`.fai` (samtools-style) for ordinal lookup, or alternatively a
`.seq.idx` BigUint64Array byte-offset table sharing the format above.
Decision pinned during Phase 1.

#### `prefix.bubbles.bed.gz` + `prefix.bubbles.bed.gz.tbi`

The bubbles index — per-allele-pair edits per bubble locus, sourced
from `vg deconstruct` (the VCF rewrite step is *preprocessor only*;
the runtime opens this BED file directly, never the VCF). One BED row
per `(locus, alleleA, alleleB)` pair; the runtime parser groups rows
sharing `(start, end)` into one `BubbleSite` record per locus.

- BED schema (per row):
  `path | start | end | alleleA | alleleB | identity | cs | genomesA | genomesB`
- `alleleA`, `alleleB`: 0-based allele indices (0 = REF) within the
  bubble at this locus.
- `identity`: float in `[0, 1]`, ratio of matching bases between
  alleles A and B.
- `cs`: minimap2-style CS string describing alleleA → alleleB edits.
- `genomesA`, `genomesB`: comma-separated 0-based genome indices (into
  the file's `#genomes=` header) carrying each allele.
- Header: `#genomes=<comma-separated bubble-genome names>` (note: this
  list may differ from the `pos.bed.gz` `#genomes=` because VCF
  samples flatten per-haplotype).

For why we ship per-pair rather than per-allele or per-site, see
`architecture-decision-records/adr-013-bubble-shape-per-pair.md`.

This file is supporting infra for Phase 7 zoomed-in CS rendering,
not part of the headline subgraph contribution.

### Sidecar artifacts (not consumed by the runtime adapter)

These files travel alongside the index but are not opened by
`GfaTabixAdapter`. They exist for direct browsing in JBrowse and as
preprocessor inputs/outputs.

#### `prefix.vcf.gz` + `prefix.vcf.gz.tbi`

Rewritten `vg deconstruct` VCF with PanSN-stripped CHROM column.
Tabix-indexed for region lookup.

- *Preprocessor:* if `--bubbles <vcf>` is passed to `gfa-to-tabix`,
  this VCF is the input from which `bubbles.bed.gz` is generated, and
  it is also rewritten/copied to `prefix.vcf.gz` for downstream use.
- *JBrowse:* the auto-generated `--output-config` registers this file
  as a standard `VariantTrack` so users can inspect raw VCF records
  alongside the synteny display.
- *Synteny display:* never opens this file. The runtime read path
  goes through `bubbles.bed.gz` only.

## Magic-byte registry

To prevent collisions:

| Magic  | File                       | Type      |
|--------|----------------------------|-----------|
| `SEGB` | `segments.bin`             | binary    |
| `SEGI` | `segments.idx`             | binary    |
| `EDGB` | `edges.bin`                | binary    |
| `EDGI` | `edges.idx`                | binary    |
| `SEQB` | `segments.seq.bin`         | binary (alternative tier) |
| `SEQI` | `segments.seq.bin.idx`     | binary (alternative tier) |

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

We diverge by storing segments + walks in binary records (smaller
working set per range fetch) and by adding edges and bubble CS as
separate tabix-indexed files. Use `chunkix.py` as a correctness
oracle in the reference-extractor harness.

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

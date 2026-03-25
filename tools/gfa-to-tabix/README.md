# gfa-to-tabix

Converts GFA pangenome graphs into tabix-indexed files for JBrowse's
`GfaTabixAdapter`. Produces `pos.bed.gz`, `segments.bin`, `segments.idx`,
and optionally `aln.bin` + `aln.idx` for per-base alignment data.

## Usage

```bash
gfa-to-tabix [OPTIONS] <GFA_FILE> <OUTPUT_PREFIX>
```

### From a GFA file

```bash
gfa-to-tabix input.gfa output/prefix
```

### From a vg graph (streaming)

The tool reads GFA in a single pass, so it supports streaming from stdin via
`-`. This lets you pipe directly from `vg convert` without writing an
intermediate GFA file to disk:

```bash
vg convert -f input.vg | gfa-to-tabix - output/prefix
```

For HPRC d9 graphs (which contain segment sequences needed for `--aln-bin`):

```bash
vg convert -f hprc-v1.1-mc-grch38.chr20.d9.vg | gfa-to-tabix --aln-bin - output/hprc-chr20
```

### With binary alignment output

The `--aln-bin` flag generates `aln.bin` and `aln.idx` files containing
pre-computed pairwise alignments with binary CS tags. These provide per-base
mismatch/indel detail in the MultiLGVSyntenyDisplay.

```bash
gfa-to-tabix --aln-bin input.gfa output/prefix
```

The GFA must contain actual segment sequences (not `*`) for `--aln-bin` to
produce records. HPRC d9 graphs have sequences; the default (non-d9) graphs
do not.

Alignment records are generated bidirectionally: every assembly pair produces
records anchored to both assemblies, so the data is queryable from any
genome's coordinate space.

## Options

| Flag | Description |
|------|-------------|
| `--aln-bin` | Generate binary alignment files (aln.bin + aln.idx) |
| `--no-groom` | Skip path grooming (strand normalization) |
| `--assemblies A,B,C` | Only process listed assemblies |
| `--sharded` | Shard segments.bin by assembly |
| `--threads N` | Thread count for aln-bin generation (0 = auto) |

## Output files

| File | Description |
|------|-------------|
| `prefix.pos.bed.gz` | Tabix-indexed segment positions per path |
| `prefix.pos.bed.gz.tbi` | Tabix index |
| `prefix.segments.bin` | Binary segment data (sequences, lengths) |
| `prefix.segments.idx` | Segment index |
| `prefix.aln.bin` | Binary pairwise alignment records (with `--aln-bin`) |
| `prefix.aln.idx` | Alignment index (with `--aln-bin`) |

## Requirements

- `bgzip` and `tabix` (from htslib) must be on `$PATH`
- `sort` (GNU coreutils)
- `vg` (vg toolkit) if converting from `.vg` format

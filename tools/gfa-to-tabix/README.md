# gfa-to-tabix

Converts GFA pangenome graphs into tabix-indexed files for JBrowse's
`GfaTabixAdapter`. Produces `pos.bed.gz`, `segments.bin`, `segments.idx`, and
optionally `bubbles.bed.gz` for per-base variant detail from VCF.

## Usage

```bash
gfa-to-tabix [OPTIONS] <GFA_FILE> [OUTPUT_PREFIX]
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

### With bubbles from VCF

The `--bubbles` flag reads a VCF produced by `vg deconstruct` and generates a
tabix-indexed BED file with CS strings for all allele pairs at each variant
site. This provides per-base mismatch/indel detail in the synteny view.

```bash
vg deconstruct -p "GRCh38#0#chr20" -a graph.gfa > variants.vcf
bgzip variants.vcf && tabix -p vcf variants.vcf.gz
gfa-to-tabix --bubbles variants.vcf.gz input.gfa output/prefix
```

### With automatic JBrowse config

The `--output-config` flag writes a ready-to-use JBrowse config JSON containing
both the GfaTabix multi-synteny track and (when `--bubbles` is used) a VCF
variant track pointing at the source VCF. This lets users view the pangenome
variants in the standard multi-sample variant viewer alongside the synteny view.

```bash
gfa-to-tabix --bubbles variants.vcf.gz --output-config config.json input.gfa output/prefix
```

## Options

| Flag                     | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `--bubbles <VCF>`        | Generate bubbles BED from a vg deconstruct VCF    |
| `--output-config <PATH>` | Write JBrowse config JSON (GfaTabix + VCF tracks) |
| `--no-groom`             | Skip path grooming (strand normalization)         |
| `--ref-assembly <NAME>`  | Assembly to use as reference for grooming         |
| `--assemblies A,B,C`     | Only process listed assemblies                    |
| `--sharded`              | Shard segments.bin by assembly                    |
| `--chunk-size N`         | Walk steps per pos.bed.gz chunk (default: 100)    |

## Output files

| File                        | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `prefix.pos.bed.gz`         | Tabix-indexed segment positions per path          |
| `prefix.pos.bed.gz.tbi`     | Tabix index                                       |
| `prefix.segments.bin`       | Binary segment data (15-byte fixed-width records) |
| `prefix.segments.idx`       | Segment byte-offset index                         |
| `prefix.bubbles.bed.gz`     | Tabix-indexed bubble CS data (with `--bubbles`)   |
| `prefix.bubbles.bed.gz.tbi` | Bubbles tabix index (with `--bubbles`)            |

## Requirements

- `bgzip` and `tabix` (from htslib) must be on `$PATH`
- `sort` (GNU coreutils)
- `vg` (vg toolkit) if converting from `.vg` format or generating VCF

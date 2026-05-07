# gfa-to-tabix

Converts GFA pangenome graphs into tabix-indexed files for JBrowse's
`GfaTabixAdapter`.

## Usage

```bash
gfa-to-tabix [OPTIONS] <GFA_FILE> [OUTPUT_PREFIX]
```

### From a GFA file

```bash
gfa-to-tabix input.gfa output/prefix
```

### From a vg graph (streaming)

```bash
vg convert -f input.vg | gfa-to-tabix - output/prefix
```

### With bubbles from VCF

Reads a `vg deconstruct` VCF and generates per-snarl CS strings for the synteny
view's per-base mismatch/indel detail.

```bash
vg deconstruct -P "GRCh38#0#chr20" -a graph.gfa > variants.vcf
bgzip variants.vcf && tabix -p vcf variants.vcf.gz
gfa-to-tabix --bubbles variants.vcf.gz input.gfa output/prefix
```

### With automatic JBrowse config

```bash
gfa-to-tabix --bubbles variants.vcf.gz --output-config config.json input.gfa output/prefix
```

## Options

| Flag                     | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `--bubbles <VCF>`        | Generate bubbles BED from a vg deconstruct VCF |
| `--output-config <PATH>` | Write JBrowse config JSON                      |
| `--no-groom`             | Skip path grooming (strand normalization)      |
| `--ref-assembly <NAME>`  | Assembly to use as reference for grooming      |
| `--assemblies A,B,C`     | Only process listed assemblies                 |
| `--chunk-size N`         | Walk steps per pos.bed.gz chunk (default: 100) |

## Output files

| File                                 | Description                                          |
| ------------------------------------ | ---------------------------------------------------- |
| `prefix.pos.bed.gz[.tbi]`            | Tabix-indexed segment positions per path             |
| `prefix.synteny.bed.gz[.tbi]`        | Haplotype alignment blocks vs reference              |
| `prefix.synteny.coarse.bed.gz[.tbi]` | Merged blocks for bpPerPx > 1000 views               |
| `prefix.synteny.rev.bed.gz[.tbi]`    | Same blocks keyed by haplotype coordinates           |
| `prefix.edges.spatial.bed.gz[.tbi]`  | Bidirectional edge index for GetSubgraph             |
| `prefix.seglens.bin`                 | Flat u32 array of segment lengths indexed by ordinal |
| `prefix.bubbles.bed.gz[.tbi]`        | Per-snarl CS data (with `--bubbles`)                 |

### `seglens.bin` format

4-byte little-endian u32 per ordinal, contiguous from ordinal 0. To look up the
length of ordinal `k`, read bytes `[k*4, k*4+4]`.

## Requirements

- `bgzip` and `tabix` (htslib) on `$PATH`
- `sort` (GNU coreutils)
- `vg` (optional, for `.vg` input or VCF generation)

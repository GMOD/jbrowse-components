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

### With automatic JBrowse config

```bash
gfa-to-tabix --output-config config.json input.gfa output/prefix
```

Per-base SNP/indel detail comes from a standard VCF track (ship the
`vg deconstruct` output via `bgzip + tabix -p vcf`); it is intentionally not
part of this preprocessor — see adr-025.

## Options

| Flag                     | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `--output-config <PATH>` | Write JBrowse config JSON                      |
| `--no-groom`             | Skip path grooming (strand normalization)      |
| `--ref-assembly <NAME>`  | Assembly to use as reference for grooming      |
| `--assemblies A,B,C`     | Only process listed assemblies                 |
| `--chunk-size N`         | Walk steps per pos.bed.gz chunk (default: 100) |

## Output files

| File                                | Description                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `prefix.pos.bed.gz[.tbi]`           | Tabix-indexed segment positions per path             |
| `prefix.synteny.bed.gz[.tbi]`       | Haplotype alignment blocks vs reference              |
| `prefix.synteny.rev.bed.gz[.tbi]`   | Same blocks keyed by haplotype coordinates           |
| `prefix.edges.spatial.bed.gz[.tbi]` | Bidirectional edge index for GetSubgraph             |
| `prefix.seglens.bin`                | Flat u32 array of segment lengths indexed by ordinal |

### `seglens.bin` format

4-byte little-endian u32 per ordinal, contiguous from ordinal 0. To look up the
length of ordinal `k`, read bytes `[k*4, k*4+4]`.

## Requirements

- `bgzip` and `tabix` (htslib) on `$PATH`
- `sort` (GNU coreutils)
- `vg` (optional, for `.vg` input)

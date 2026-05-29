---
title: PIF (Pairwise Indexed Format)
description:
  Tabix-indexed pairwise alignment format for large-scale synteny data
guide_category: Advanced topics
---

PIF (Pairwise Indexed Format) is a tabix-indexed variant of
[PAF](https://github.com/lh3/minimap2/blob/master/doc/minimap2.1). Unlike plain
PAF, which must be loaded entirely into memory, PIF splits each alignment into
two indexed records — one per genome — so JBrowse fetches only the alignments
overlapping the current viewport, and can query from either assembly's
perspective.

## File format

Each PAF alignment line produces **two PIF lines**: a `t`-prefixed line indexed
by target coordinates, and a `q`-prefixed line indexed by query coordinates.

PAF columns:

```
qname  qlen  qstart  qend  strand  tname  tlen  tstart  tend  nmatch  blen  mapq  [optional fields...]
```

**t-line** (indexed by target coordinates):

```
t{tname}  tlen  tstart  tend  strand  qname  qlen  qstart  qend  nmatch  blen  mapq  [optional fields...]
```

**q-line** (indexed by query coordinates, CIGAR adjusted):

```
q{qname}  qlen  qstart  qend  strand  tname  tlen  tstart  tend  nmatch  blen  mapq  [optional fields...]
```

The `t`/`q` prefix lets tabix return the right set of lines for any chromosome
in either assembly with a single region query.

### CIGAR adjustment on q-lines

PAF CIGARs are from the query's perspective. The q-line adjusts them so `I`/`D`
operations are consistent with the q-line's column order (query is primary):

- **Plus strand**: swap all `I` and `D` operations
- **Minus strand**: reverse the CIGAR string and swap `I` and `D` operations

The t-line carries the original PAF CIGAR unchanged.

### Identity tag

`make-pif` enriches each alignment with a `de:f:` tag (the gap-compressed
per-base divergence used by minimap2) when the CIGAR contains `=`/`X` operators
and no `de:f:` tag is already present. The renderer reads this tag as
`identity = 1 - de`, falling back to `numMatches / blockLen` when the tag is
absent.

For accurate identity, run minimap2 with `--eqx` so the CIGAR distinguishes
matches (`=`) from mismatches (`X`). Without `--eqx` the CIGAR uses ambiguous
`M` operators and `make-pif` leaves identity to be approximated from the
standard PAF columns.

This matches the approach used by
[rustybam](https://github.com/mrvollger/rustybam) (`rb stats --paf` writes the
same `perID_by_all` quantity) and [SVbyEye](https://github.com/daewoooo/SVbyEye)
(which derives per-bin identity from the CIGAR for its miropeats-style ribbons).
Storing identity at file-build time means coloring at view time is a cheap
column lookup.

### Tabix index parameters

The file is sorted, bgzipped, and indexed with:

```
tabix -s1 -b3 -e4 -0
```

Column 1 is the sequence name (with `t`/`q` prefix), columns 3–4 are the 0-based
start and end coordinates.

## Creating PIF files

`jbrowse make-pif` requires `bgzip` and `tabix` to be installed:

```bash
# writes input.pif.gz and input.pif.gz.tbi
jbrowse make-pif input.paf

# specify output path
jbrowse make-pif input.paf --out output.pif.gz

# CSI index instead of TBI (for chromosomes > 512 Mb)
jbrowse make-pif input.paf --csi
```

Full workflow from two genome assemblies:

```bash
# --eqx makes minimap2 emit =/X in the CIGAR so make-pif can compute accurate
# per-alignment identity (stored as a de:f: tag in the PIF).
minimap2 -cx asm5 --eqx reference.fa query.fa > alignment.paf
jbrowse make-pif alignment.paf
jbrowse add-assembly reference.fa --out $OUT --load copy
jbrowse add-assembly query.fa --out $OUT --load copy
jbrowse add-track alignment.pif.gz -a query,reference --out $OUT --load copy
```

`jbrowse add-track` detects the `.pif.gz` extension and automatically configures
the `PairwiseIndexedPAFAdapter`.

### Optional preprocessing with rustybam

For large or messy PAFs (millions of short alignments, soft-clipped overhangs,
inconsistent strand orientation),
[rustybam](https://github.com/mrvollger/rustybam) can clean the alignments
before `make-pif`:

```bash
minimap2 -cx asm5 --eqx reference.fa query.fa \
  | rb trim-paf \
  | rb break-paf --max-size 10000 \
  | rb orient \
  | rb filter --paired-len 1000 \
  | jbrowse make-pif /dev/stdin --out alignment.pif.gz
```

This is entirely optional — rustybam-produced tags pass through `make-pif` and
are available to the renderer, but `make-pif` alone is sufficient. The
[SafFire](https://github.com/mrvollger/SafFire) viewer documents the rationale
for each rustybam step.

## JBrowse configuration

```json
{
  "type": "SyntenyTrack",
  "trackId": "my_synteny",
  "name": "My synteny",
  "assemblyNames": ["query", "reference"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "assemblyNames": ["query", "reference"],
    "pifGzLocation": { "uri": "alignment.pif.gz" },
    "index": {
      "indexType": "TBI",
      "location": { "uri": "alignment.pif.gz.tbi" }
    }
  }
}
```

Use `"indexType": "CSI"` if you created the index with `--csi`.

## Comparison with PAFAdapter

|                     | PAFAdapter          | PairwiseIndexedPAFAdapter |
| ------------------- | ------------------- | ------------------------- |
| Input file          | `.paf` (plain text) | `.pif.gz` (bgzipped)      |
| Index required      | No                  | Yes (`.tbi` or `.csi`)    |
| Data loading        | Entire file on open | Only visible region       |
| Large genomes       | Slow / memory-heavy | Efficient                 |
| Bidirectional query | No                  | Yes                       |

PAFAdapter is simpler to set up and fine for small alignments. For large
whole-genome comparisons PIF is strongly preferred.

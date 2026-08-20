---
title: PIF (Pairwise Indexed Format)
description:
  Tabix-indexed pairwise alignment format for large-scale synteny data
guide_category: Advanced topics
sidebar_label: PIF format
---

**TL;DR:** run `jbrowse make-pif input.paf` and load the resulting `.pif.gz`;
`jbrowse add-track` picks the `PairwiseIndexedPAFAdapter` from the extension.
Use PIF over plain PAF for anything whole-genome scale.

PIF (Pairwise Indexed Format) is a tabix-indexed variant of
[PAF](https://github.com/lh3/minimap2/blob/master/minimap2.1). Plain PAF must be
loaded entirely into memory; PIF splits each alignment into two indexed records
(one per genome), so JBrowse fetches only the alignments overlapping the
viewport and can query from either assembly's perspective.

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

- On the plus strand, swap all `I` and `D` operations
- On the minus strand, reverse the CIGAR string and swap `I` and `D` operations

The t-line carries the original PAF CIGAR unchanged.

A PIF row carries exactly one alignment string, `cg:Z:`. A minimap2 `cs:Z:`
difference string is folded into it (`=` for matches, `X` for substitutions),
and a row carrying both — what `minimap2 -c --cs` emits — keeps the one folded
from the `cs`, since that spells out mismatches where minimap2's own `cg` says
`M`. The substituted base letters are what the fold drops; mismatch positions
survive as `X`. Reorienting a `cs` for the q-line would mean reversing its op
order and reverse-complementing those bases, so carrying one alongside a flipped
CIGAR is a standing invitation for the two to disagree.

### Identity

Fine-tier rows pass the aligner's tags through untouched. The renderer derives
per-alignment identity from the first of these that a row carries:

- `de:f:` (minimap2's gap-compressed per-base divergence), read as
  `identity = 1 - de`
- `id:f:` (odgi untangle writes this, as a fraction or a percentage)
- the standard `num_matches` / `block_len` columns

This matches [rustybam](https://github.com/mrvollger/rustybam) (`rb stats --paf`
writes the same `perID_by_all` quantity) and
[SVbyEye](https://github.com/daewoooo/SVbyEye).

Coarse-tier rows carry a `de:f:` tag that `make-pif` writes from that same
chain, so identity coloring does not jump at the zoom where the view switches
tiers. It is never recomputed from the CIGAR: a plain `M` CIGAR folds mismatches
into matches, so a recompute would report a divergent alignment as 100%
identical.

For the most accurate identity, run minimap2 with `--eqx` so the CIGAR
distinguishes matches (`=`) from mismatches (`X`).

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

### Level-of-detail coarse tier

By default `make-pif` also writes a no-CIGAR "coarse" tier of the same
alignments (rows prefixed `T`/`Q` instead of `t`/`q`). At low zoom the view
serves this tier automatically, drawing clean ribbons without parsing
megabyte-scale CIGAR strings; zooming in switches back to the fine `t`/`q` tier.
No configuration is needed: the "Level of detail" control defaults to `auto`,
and `fine`/`coarse` pin a tier. It is a row in the synteny view's settings panel
and a submenu on the dotplot and the LGV synteny track.

A coarse row has no CIGAR, so it is drawn as a straight ribbon between its
endpoints. To keep that honest, a row is split wherever its CIGAR contains an
indel of at least `--coarse` bp, so no coarse ribbon spans a large gap. A gap at
either END of the row is trimmed the same way, which leaves one coarse row
tighter than the input's own coordinate columns.

Each piece reports the row's identity — `num_matches` is apportioned by aligned
length, so every piece implies the same identity as the row and as the `de:f:`
written beside it. The pieces' `num_matches` do not quite sum back to the row's
when its `block_len` counts the split gaps, which PAF's does.

The split is used only when the CIGAR walk lands exactly on the row's own far
corner. A CIGAR that disagrees with its coordinate columns — clipping ops, a
hand-written `cg`, a `cs` whose spans don't add up — leaves the coarse row on
the columns verbatim, since the columns are what the fine tier draws.

```bash
# coarse tier is on by default, split at indels >= 10kb
jbrowse make-pif input.paf

# tune the gap (bp) at which a coarse row is split to keep its bbox tight
jbrowse make-pif input.paf --coarse 50000

# one coarse row per alignment, never split
jbrowse make-pif input.paf --coarse 0

# disable the coarse tier (fine t/q tier only)
jbrowse make-pif input.paf --no-coarse
```

Keep
[`coarseBpPerPxThreshold`](/docs/config/pairwiseindexedpafadapter/#slot-coarsebpperpxthreshold)
at or above the `--coarse` gap you built with. Below it, the coarse tier is
served at zooms where the indels it was allowed to span are wide enough to see.

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

The rustybam tags pass through to both tiers, but `make-pif` alone is
sufficient. The [SafFire](https://github.com/mrvollger/SafFire) viewer documents
the rationale for each rustybam step.

`rb break-paf --max-size N` is worth calling out: it splits the input alignments
themselves at large indels, so **both** tiers inherit the same pieces. That is
different from `--coarse`, which splits only the coarse tier: the fine tier
keeps whole alignments and draws each large indel as a colored wedge. Break the
PAF upstream if you would rather see those indels as genuine breaks between
separate alignments, and have feature identity stay the same across a tier
switch.

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

## See also

- Adapter config reference: [](/docs/config/pairwiseindexedpafadapter) and
  [](/docs/config/pafadapter)
- [](/docs/developer_guides/creating_view)
- [Config guide: synteny track](/docs/config_guides/synteny_track)

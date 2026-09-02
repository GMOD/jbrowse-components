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
order and reverse-complementing those bases, so only the folded CIGAR is
carried.

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

A coarse-tier row carries the same count columns and tags as its fine row, so
the renderer lands on the same rung of that chain with the same value and
identity coloring does not jump at the zoom where the view switches tiers.
Identity is never recomputed from the CIGAR: a plain `M` CIGAR folds mismatches
into matches, so a recompute would report a divergent alignment as 100%
identical.

For the most accurate identity, run minimap2 with `--eqx` so the CIGAR
distinguishes matches (`=`) from mismatches (`X`).

### Header line

`make-pif` writes one meta line, which the C-locale sort puts first and tabix
keeps as a header (`tabix -H file.pif.gz` prints it):

```
#pif	version:i:1	tiers:Z:fine,coarse	coarse:i:10000	cigars:Z:all
```

- `version`: the format generation
- `tiers`: `fine` or `fine,coarse`, so a reader need not scan the contig list to
  know whether the coarse tier exists
- `coarse`: the coarse tier's accuracy bound in bp, the `--coarse` it was built
  with; absent when there is no coarse tier
- `cigars`: whether every input row carried a CIGAR (`all`), none did (`none`),
  or some (`some`)

Files built before the header existed have none, and readers treat every field
as optional.

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
# --eqx makes minimap2 emit =/X in the CIGAR so mismatches draw at base zoom
minimap2 -cx asm5 --eqx reference.fa query.fa > alignment.paf
jbrowse make-pif alignment.paf
jbrowse add-assembly reference.fa --out $OUT --load copy
jbrowse add-assembly query.fa --out $OUT --load copy
jbrowse add-track alignment.pif.gz -a query,reference --out $OUT --load copy
```

`jbrowse add-track` detects the `.pif.gz` extension and automatically configures
the `PairwiseIndexedPAFAdapter`.

### Level-of-detail coarse tier

By default `make-pif` also writes a "coarse" tier of the same alignments (rows
prefixed `T`/`Q` instead of `t`/`q`). At low zoom the view serves this tier
automatically, drawing the same ribbons without parsing megabyte-scale CIGAR
strings; zooming in switches back to the fine `t`/`q` tier. The "Level of
detail" control defaults to `auto`, and `fine`/`coarse` pin a tier. It is a
submenu of the settings menu on both comparative views, and of the track menu on
the LGV synteny track.

A coarse row is the same alignment as its fine row: one row, with the PAF
columns and every non-alignment tag verbatim. What changes is the alignment
string. The CIGAR is replaced by a **coarse CIGAR** in a `cr:Z:` tag, the CIGAR
folded at the `--coarse` length:

- every insertion or deletion longer than half of `--coarse` is kept as its own
  `I`/`D`/`N` op, exactly as in the CIGAR
- everything between two kept indels collapses to one match run. A run whose two
  sides consumed different lengths, because it absorbed small indels, is written
  `<own>:<mate>M` with the row's own side first; a square run stays `<n>M`
- a run is also closed before the small indels it absorbs would skew it by more
  than half of `--coarse`, so the straight line between a run's two corners is
  never more than `--coarse` bp off the alignment's real path. That bound is
  what `--coarse` means

```
cg:Z:31198M4800I18803M   fine row
cr:Z:31198M4800I18803M   coarse T row built with --coarse 1000: the insertion is kept
cr:Z:31198M4800D18803M   the same alignment's coarse Q row (I<->D from the query's side)
```

Built with the default `--coarse 10000` the 4.8 kb insertion is under half the
gap and folds into the run, and since the fold is then a single run the tag is
omitted altogether: the coordinate columns already say everything it would. The
Q row's coarse CIGAR is re-oriented the way the fine tier's `cg` is, `I`/`D`
swapped and the run lengths traded, and reversed on the minus strand.

The renderer walks a coarse CIGAR exactly as it walks a CIGAR at that zoom: each
run is one ribbon segment between its corners and each kept gap is a colored
indel wedge. An insertion or deletion large enough to see at whole-genome zoom
therefore looks the same in both tiers, and the tier switch changes nothing on
screen. The row's coordinates, `num_matches` and `block_len` are the fine row's,
so the feature detail panel shows the same alignment either way. Navigation
walks it as well: "Move other panel to the matching region", the follow mode and
the launch dialog's clip-to-region all map through the coarse CIGAR, and the
answer is within `--coarse` bp of the CIGAR's, which is under a pixel at any
zoom the tier is served automatically.

The tag is also omitted when the row has no CIGAR, and when the CIGAR does not
close on the row's own coordinate columns (clipping ops, a hand-written `cg`, a
`cs` whose spans don't add up): the columns are what the fine tier draws, so the
coarse row must not say anything the walk reconstructed. In a file whose header
states a bound and `cigars:Z:all`, a coarse row without the tag is therefore
exactly one run, and readers treat it as `<own>:<mate>M` over its columns, so it
walks, flips and clips like any fold.

The grammar, precisely: the alphabet is `M`, `I`, `D` and `N` plus the run form,
lengths are non-negative integers, and a run never has a zero side (the writer
spells such a run as the `I` or `D` it is). A reader also accepts `=` and `X` as
`M` and ignores `S`, `H` and `P`, which the writer never emits. On the Q row `N`
keeps the row's own axis, as it does in the fine tier's `cg`. `--coarse` must be
a positive number of bp: a coarse tier without a bound would be
indistinguishable from one whose rows all folded to a single run.

```bash
# coarse tier is on by default: runs within 10kb of the alignment, indels over 5kb kept
jbrowse make-pif input.paf

# a tighter coarse tier: runs within 1kb, indels over 500bp kept
jbrowse make-pif input.paf --coarse 1000



# disable the coarse tier (fine t/q tier only)
jbrowse make-pif input.paf --no-coarse
```

[`coarseBpPerPxThreshold`](/docs/config/pairwiseindexedpafadapter/#slot-coarsebpperpxthreshold)
is the zoom at which `auto` switches, and the header keeps it honest: a value
below the `--coarse` the file was built with is raised to it, since below that
the coarse tier would be served at zooms where the indels it folded away are
wide enough to see. A file built with `--no-coarse` serves the fine tier at
every zoom whatever the setting says, and the "Alignment blocks only" pin has
nothing to switch to.

PIF files built before the coarse CIGAR existed still load. Their coarse rows
were instead split into pieces at large indels and carry no alignment string,
and they have no header, so they draw as plain ribbons and nothing walks them;
rebuild with `make-pif` to get the wedges. The other way round, a JBrowse older
than the coarse CIGAR reads a new file too: it shows `cr` as a plain attribute
and draws every coarse row as one straight ribbon, so a site that must serve
such clients should build with `--no-coarse`.

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

`rb break-paf --max-size N` splits the input alignments themselves at large
indels, so **both** tiers inherit the same pieces. `--coarse` keeps a large
indel inside one row in both tiers, as a CIGAR op in the fine tier and a coarse
CIGAR op in the coarse tier, drawn as a colored wedge either way. Break the PAF
upstream to see those indels as genuine breaks between separate alignments.

## JBrowse configuration

```json addtrack
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

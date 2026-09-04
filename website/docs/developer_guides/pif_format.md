---
title: PIF (Pairwise Indexed Format)
description:
  Tabix-indexed pairwise alignment format for large-scale synteny data
guide_category: Advanced topics
sidebar_label: PIF format
---

PIF is a tabix-indexed transformation of
[PAF](https://github.com/lh3/miniasm/blob/master/PAF.md). Plain PAF must be
loaded entirely into memory. PIF stores each alignment twice, once indexed on
each genome, so a region query fetches only the overlapping alignments and works
from either genome's coordinates.

```bash
jbrowse make-pif input.paf   # writes input.pif.gz and input.pif.gz.tbi
```

`jbrowse add-track` picks [](/docs/config/pairwiseindexedpafadapter) from the
`.pif.gz` extension. Use PIF over plain PAF at whole-genome scale.

## Lines

Each PAF line becomes two PIF lines, one per indexed perspective. Both keep
PAF's 12 mandatory columns and its optional tags, in PAF's order. Column 1
carries a one-letter prefix naming the perspective.

| Line | Column 1      | Columns 2-4 | Columns 6-9 | `cg:Z:`           |
| ---- | ------------- | ----------- | ----------- | ----------------- |
| `t`  | `t` + `tname` | target      | query       | PAF's, unchanged  |
| `q`  | `q` + `qname` | query       | target      | reoriented, below |

A [coarse tier](#coarse-tier) repeats both lines under `T`/`Q`. The prefix is
always the first character of column 1.

Sorted under `LC_ALL=C`, bgzipped, and indexed with:

```bash
tabix -s1 -b3 -e4 -0
```

## CIGAR reorientation

A PAF CIGAR is written from the target's perspective, following SAM: `D`
consumes the target, `I` consumes the query. A PIF line is walked against
columns 1-4, so:

- the `t` line's own axis is already the target, and carries the CIGAR unchanged
- the `q` line on the plus strand swaps every `I` and `D`
- the `q` line on the minus strand reverses the op order and swaps `I` and `D`

Each line has exactly one thing rewritten: `t` swaps the columns, `q` swaps the
CIGAR.

## Alignment strings

A row carries exactly one, `cg:Z:`.

- a `cs:Z:` is converted to a CIGAR (`=` for matches, `X` for substitutions) and
  replaces any `cg:Z:` the row also had, since `cs` spells out mismatches that
  minimap2's own `cg` folds into `M`. The substituted bases are dropped, their
  positions survive as `X`
- `cs` is never emitted. Reorienting one means reversing op order _and_
  reverse-complementing its spelled-out bases
- an incoming `cr:Z:` is stripped from both tiers

Run minimap2 with `--eqx` so the CIGAR distinguishes `=` from `X`.

## Identity

The renderer reads the first of these that a row carries:

- `de:f:`, minimap2's gap-compressed per-base divergence, as `1 - de`
- `id:f:`, written by odgi untangle, as a fraction or a percentage
- the `num_matches` / `block_len` columns

This is the same quantity as rustybam's `rb stats --paf` `perID_by_all` and
[SVbyEye](https://github.com/daewoooo/SVbyEye). It is never recomputed from the
CIGAR, where a plain `M` folds mismatches into matches and would report a
divergent alignment as identical. A coarse row carries its fine row's counts and
tags, so identity coloring does not jump at a tier switch.

## Header

One meta line, sorted first and kept by tabix (`tabix -H file.pif.gz`):

```
#pif	version:i:1	tiers:Z:fine,coarse	coarse:i:10000	cigars:Z:all
```

| Field     | Meaning                                                      |
| --------- | ------------------------------------------------------------ |
| `version` | format generation                                            |
| `tiers`   | `fine` or `fine,coarse`                                      |
| `coarse`  | the coarse tier's bound in bp, absent when there is no tier  |
| `cigars`  | whether every input row had a CIGAR: `all`, `some` or `none` |

Every field is optional, and files built before the header have none.

## Coarse tier

`make-pif` writes a second tier of the same alignments under `T`/`Q` by default.
Low zooms serve it, drawing the same ribbons without parsing megabyte-scale
CIGARs. The "Level of detail" control defaults to `auto` (settings menu on both
comparative views, track menu on the LGV synteny track).

A coarse row is its fine row with the coordinate columns and every non-alignment
tag verbatim. The CIGAR is replaced by a **coarse CIGAR** in a `cr:Z:` tag:

- an indel longer than half of `--coarse` keeps its `I`/`D`/`N` op and length
- everything between two kept indels folds into one match run, written
  `<own>:<mate>M` when the two sides consumed different lengths and `<n>M` when
  square, the row's own side first
- a run also closes before the small indels it absorbs would skew it past half
  of `--coarse`, so the straight line between a run's corners is never more than
  `--coarse` off the alignment's real path. That bound is what `--coarse` means
- the alphabet is `M I D N` plus the run form, lengths are non-negative, and a
  run never has a zero side. A reader takes `=`/`X` as `M` and ignores `S`, `H`
  and `P`, which the writer never emits
- the `Q` row is reoriented the way the fine tier's `cg` is

```
cg:Z:31198M4800I18803M   fine row
cr:Z:31198M4800I18803M   coarse T row at --coarse 1000, the insertion is kept
cr:Z:31198M4800D18803M   the same alignment's coarse Q row
```

At the default `--coarse 10000` that insertion is under half the bound and folds
into the run, leaving a single run, so the tag is omitted altogether.

`cr:Z:` is omitted when:

- the row has no CIGAR
- the fold is a single run, which the coordinate columns already describe
- the CIGAR does not close on the row's own columns (clipping ops, a
  hand-written `cg`, a `cs` whose spans do not add up)

In a file whose header states a bound and `cigars:Z:all`, a tagless coarse row
is therefore exactly one run, and readers walk it as `<own>:<mate>M` over its
columns.

The renderer walks a coarse CIGAR exactly as it walks a CIGAR at that zoom: each
run is a ribbon segment between its corners, each kept gap a colored indel
wedge. An indel large enough to see at whole-genome zoom looks the same in both
tiers. Navigation walks it too, so "Move other panel to the matching region",
follow mode and the launch dialog's clip-to-region answer within `--coarse` bp
of the CIGAR's answer.

```bash
jbrowse make-pif input.paf                 # default, runs within 10kb
jbrowse make-pif input.paf --coarse 1000   # runs within 1kb
jbrowse make-pif input.paf --no-coarse     # fine t/q tier only
jbrowse make-pif input.paf --csi           # CSI index, for chromosomes > 512Mb
jbrowse make-pif input.paf --out out.pif.gz
```

[`coarseBpPerPxThreshold`](/docs/config/pairwiseindexedpafadapter/#slot-coarsebpperpxthreshold)
is the zoom at which `auto` switches, and the header keeps it honest: a value
below the `--coarse` the file was built with is raised to it. A `--no-coarse`
file serves the fine tier at every zoom whatever the setting says.

Both directions of compatibility work. A PIF built before `cr:Z:` existed has
coarse rows split at large indels with no alignment string, and draws as plain
ribbons. A JBrowse older than `cr:Z:` reads a new file and draws every coarse
row as one straight ribbon, so build with `--no-coarse` to serve such clients.

## All-vs-all

An all-vs-all PAF takes the same format and the same command. What carries the
extra genomes is the sequence names, following the
[PanSN](https://github.com/pangenome/PanSN-spec) convention
`sample#haplotype#contig`:

```
qgrape#1#chr1	1000	100	200	+	peach#1#G1	1000	300	400	90	100	60
tpeach#1#G1	1000	300	400	+	grape#1#chr1	1000	100	200	90	100	60
```

Column 1 is the prefix letter followed by the whole PanSN name. The mate in
columns 6-9 is the PanSN name alone, with no letter. Load such a file with
[](/docs/config/allvsallindexedpafadapter).

**The letter is a perspective, not an assembly.** In a pairwise file `q` is
`assemblyNames[0]` and `t` is `assemblyNames[1]` in every row, so one query per
contig is complete. An all-vs-all aligner writes each pair in whichever order it
reached it, so a sample is the PAF query in some records and the target in
others. Above, `peach#1#G1` is the target, and wherever peach was the query its
rows are filed under `qpeach#1#G1`. Both letters are read and unioned.

**Assembly identity comes from the name.** Each entry in the adapter's
[`assemblyNames`](/docs/config/allvsallindexedpafadapter/#slot-assemblynames)
must resolve to a PanSN prefix present in the file, either a sample (`grape`,
covering all of its haplotypes) or one haplotype (`grape#1`) for a
haplotype-resolved pangenome that loads each haplotype separately. Where the
JBrowse assembly name and the PanSN prefix differ, map them with
[`assemblyNameToPanSN`](/docs/config/allvsallindexedpafadapter/#slot-assemblynametopansn).
An assembly matching no prefix raises an error listing the prefixes the file
does hold.

Mates need not be listed. A plain linear genome view draws the track's assembly
against every other sample in the file, labelling an unlisted mate by its PanSN
prefix. A synteny view naming a target assembly narrows the same track to that
pair.

**Reciprocal restatements are deduplicated.** Such a file usually states each
pair from both ends, so A against B and B against A are both present, and both
are anchored on A when A is the row being drawn. Drawn as they arrive the same
ribbon gets two coats. The adapter keeps one, testing agreement on both spans
and on the same diagonal rather than direction, since the two passes need not
chain a homology into the same blocks. A file holding one direction per pair
(`minimap2 -X`, a curated PAF) has nothing to drop.

## Preprocessing with rustybam

Optional, for large or messy PAFs (millions of short alignments, soft-clipped
overhangs, inconsistent strand orientation):

```bash
minimap2 -cx asm5 --eqx reference.fa query.fa \
  | rb trim-paf \
  | rb break-paf --max-size 10000 \
  | rb orient \
  | rb filter --paired-len 1000 \
  | jbrowse make-pif /dev/stdin --out alignment.pif.gz
```

Tags pass through to both tiers, and `make-pif` alone is sufficient.
[SafFire](https://github.com/mrvollger/SafFire) documents the rationale for each
step. `rb break-paf --max-size N` splits the alignments themselves, so both
tiers inherit the same pieces, where `--coarse` keeps a large indel inside one
row as a wedge in both.

## Configuration

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

An all-vs-all file, where `assemblyNames` are PanSN prefixes:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "my_pangenome",
  "name": "All vs all",
  "assemblyNames": ["grape", "peach", "cacao"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "assemblyNames": ["grape", "peach", "cacao"],
    "pifGzLocation": { "uri": "all_vs_all.pif.gz" },
    "index": {
      "indexType": "TBI",
      "location": { "uri": "all_vs_all.pif.gz.tbi" }
    }
  }
}
```

Use `"indexType": "CSI"` for an index created with `--csi`.

## Comparison with PAFAdapter

|                     | PAFAdapter          | PairwiseIndexedPAFAdapter |
| ------------------- | ------------------- | ------------------------- |
| Input file          | `.paf` (plain text) | `.pif.gz` (bgzipped)      |
| Index required      | No                  | Yes (`.tbi` or `.csi`)    |
| Data loading        | Entire file on open | Only visible region       |
| Large genomes       | Slow / memory-heavy | Efficient                 |
| Bidirectional query | No                  | Yes                       |

PAFAdapter is fine for small alignments. PIF is strongly preferred for
whole-genome comparisons.

## See also

- Adapter config: [](/docs/config/pairwiseindexedpafadapter),
  [](/docs/config/allvsallindexedpafadapter), [](/docs/config/pafadapter)
- [Config guide: synteny track](/docs/config_guides/synteny_track)

Tutorials that build or load a PIF:

- [](/docs/tutorials/synteny_visualization) builds the pairwise case from two
  assemblies with minimap2
- [](/docs/tutorials/allvsall_synteny) is the smallest all-vs-all file, and
  shows where PanSN names come from when the aligner does not write them
- [](/docs/tutorials/pangenome_ecoli) and [](/docs/tutorials/pangenome_cactus)
  take the PAF out of a pggb and a Minigraph-Cactus graph
- [](/docs/tutorials/pangenome_hprc) loads hosted human PIF files rather than
  building one

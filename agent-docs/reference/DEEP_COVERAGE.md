---
name: deep-coverage
description: Measured on HG002 300x — what the alignments defaults do when there is nothing to find. The insert-size band's ±3 MAD cut flags ~1% of any sample however deep, so a tight library's own tail painted red; interchromosomal ticks are genuinely scattered mismapping, but a support floor still has to count over a window or it deletes real translocations with them; and the same floor on same-chromosome arcs is a density filter in disguise. Read before adding a threshold to this plugin, or before assuming a default that looks fine at 30x still works at 300x.
---

# Deep-coverage short reads: what the defaults get wrong, and why

Everything here was measured on **HG002 300x**
(`NHGRI_Illumina300X_AJtrio_novoalign_bams/HG002.hs37d5.300x.bam`, GIAB), over
two windows on GRCh37 chr1 — a 20 kb window at 1:1,000,000 (29,331 records) and
a 200 kb window at 1:2,000,000 (353,208 records). Both are ordinary sequence
containing no structural variant, which is the point: they say what the display
does when there is nothing to find.

The library is tight and the coverage is deep, and that combination is what
breaks the defaults. Its shape, from the 200 kb window:

```
proper pairs sampled   340,210
median |TLEN|              571
MAD                         94
largest |TLEN| anywhere   1,141      <- the whole distribution stops here
```

## The rule these share

**A cut calibrated as a FRACTION of the sample flags a fixed fraction of it,
however deep the pileup gets.** Every default below looked reasonable at 30x and
produced an unreadable wash at 300x, without any of them being wrong in a way
that shows up on a small file. When adding a threshold to this plugin, ask what
it does when the sample is 10x larger, because that is a thing users routinely
do to it.

## Insert-size colouring: the band needed a floor

`getInsertSizeStats` is median ± 3·1.4826·MAD, which on the 200 kb window puts
the upper bound at **989**. 3235 records (0.95%) painted long-insert — and 2625
of them (81%) sat in 989..1142, which is the library's own right tail. There is
no deletion in that window at all.

`widenBandToEventScale` (`shared/insertSizeStats.ts`) floors the band to 2x /
0.5x the typical fragment, which is a claim about what the colour MEANS — an
event comparable in size to the fragment — and is scale-free across library
types. The same window then keeps 608 records: 510 at 1142-2 kb, 2 past 2 kb, 96
with the mate on another contig. The cost is that a deletion shorter than about
one fragment no longer separates by colour, which at this depth it could not do
anyway; the floor is a `max`, so a shallow pileup keeps the tighter raw band.

## Interchromosomal ticks: scattered, and that is the criterion

The 200 kb window holds **868 interchromosomal connections**. Clustering them on
both sides — own position and partner position both within W, same partner
contig — barely moves the count:

| window | clusters | support 1 | biggest |
| ------ | -------- | --------- | ------- |
| 0 bp   | 865      | 862 (99%) | 2       |
| 100 bp | 861      | 854 (99%) | 2       |
| 600 bp | 860      | 852 (99%) | 2       |
| 2000bp | 860      | 852 (99%) | 2       |

Going from an exact key to a 2 kb window merges five clusters, and the largest
thing in the window is two reads. They are genuinely scattered mismapping, not a
real signal that a bad key failed to gather.

**But the window is still required**, and this is the part worth keeping. A real
translocation at 300x recruits ~100 pairs, and mates STRADDLE a breakpoint
rather than landing on it, so those pairs scatter across a fragment length too.
Under `arcKey`'s exact count every one of them is a singleton, so a naive
`support >= 2` floor would delete the real event exactly as thoroughly as the
noise. `clusteredInterchromSupport` counts over one fragment length on both
sides for that reason, and the window comes from `stats.upper` rather than a
constant so it tracks the library.

Driving the shipped function over the real records: at the default (window from
the band, min 2) **852 of 868 connections are dropped, 98.2%**.

## Same-chromosome discordant arcs: the same idea, and it does NOT work

Recorded because it looks obviously right and is not. Applying the same windowed
support to same-chr discordant pairs collapses 257 clusters at W=0 into 109 at
W=600, with apparent support of 24, 14, 10, 9, 9 — which reads as five real
events until the TLENs inside them are checked:

```
cluster near 2,157,702 (24 reads):  1172 1172 1174 1178 1204 1215 1231 1244 ...
cluster near 2,078,054 (14 reads):  1145 1152 1154 1160 1162 1171 1172 1188 ...
```

A smooth continuum starting at the 1142 cut — the shape of a distribution tail
being sliced, not a mode. A genuine 4 kb deletion would put twenty pairs at
~4600 ± 100. What produces the clusters is **density**: at 300x a 600 bp window
holds ~1200 pairs, so a fraction of a percent of tail yields several flagged
pairs per window and single-linkage chains them.

So a support threshold there is a density filter wearing an evidence filter's
costume, and it gets *more* aggressive exactly where coverage is deepest. The
insert-size floor is the control for that family; stacking support on top would
count the same noise twice. See REJECTED_IDEAS.

## Layout and paint order

- Concordant pairs outnumber categorized ones by a wide margin even after the
  band floor, and arc strokes are opaque, so paint order had to become an
  interest ranking (`arcPaintRank`, and ticks under arcs in `ARC_PASSES`). The
  live ratio is under "What the running app says" below.
- `colorShortInsert` sat 1.5 L\* from the concordant grey, separated by chroma
  alone, which is the weakest channel on a 1px stroke. `palette.ts` carries the
  full CIELCh working.
- **The `maxHeight` default is NOT reached at 300x**, contrary to what the
  truncation-notice change first claimed. See the measurement below. The notice
  is still a quiet in-place line rather than a warning chip, on the grounds that
  its press wrote a config slot irreversibly and that a working cap is not a
  fault — neither of which needs a frequency argument.

## What the running app says

The numbers above come from `samtools` over the same file. These come from the
display model in a real jbrowse-web session at `1:2,000,000-2,005,000`, read out
of `window.JBrowseSession`, and are the check that the pipeline agrees with the
offline analysis:

```
arcs drawn                 9204
  slot 0 normalInsert      9138      <- 138:1 against everything that means something
  slot 1 longInsert          17
  slot 2 shortInsert         48
  slot 5 pairRR               1
interchromosomal ticks        0      <- all filtered, minInterchromSupport 2
rows laid out               431
rows the cap allows         750      <- so pileupTruncated is FALSE at this depth
```

Two things to take from it. The 138:1 ratio is why the category-first paint
order is load-bearing rather than a nicety: 66 arcs carrying a meaning against
9138 that do not, all in one band, all opaque. And long-insert is 17 of 9204
(0.18%) where the un-floored band would have painted ~1%, so the floor is doing
on live data what the offline sweep predicted.

The 431-vs-750 row count is the one that corrected a mistake. Reproduce any of
it by pointing a local jbrowse-web at a `ChromSizesAdapter` assembly named with
plain `1`/`2`/... contigs (the BAM is hs37d5, so no alias file is needed) and
raising `fetchSizeLimit` or pressing Force Load — 5 kb at this depth is 6.65 Mb
buffered and the byte gate stops it first.

## Reproducing

`samtools view <url> 1:2000000-2200000` against the GIAB HTTP URL works
directly — no download needed, the index range-requests.

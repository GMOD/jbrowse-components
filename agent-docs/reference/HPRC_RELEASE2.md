---
name: hprc-release2
description: What HPRC release 2 publishes and which artifacts JBrowse can open — why the tutorial reads a v2.0 TAF rather than the v2.1 MAF, and the four measurements not to re-derive (impg's PAF is projections not compositions, the vs-GRCh38 PAF is a star so 741 of 780 sample pairs are unstated, the per-chromosome pggb graphs do not fit in memory, and the published MAF is tab-separated). Read before touching the pangenome MAF or synteny path, or before cutting a slice of one of these files.
audience: internal
---

# HPRC release 2 in JBrowse

The alignment/MAF side of the HPRC data. The graph view's own queue is
[Pangenome graph view queue](../todo/pangenome-graph-view-the-open-queue.md) and
does not overlap.

## What HPRC publishes, and what opens today

| artifact | opens? |
| --- | --- |
| `v2.0/…/hprc-v2.0-mc-grch38.full.taf.gz` + `.tai` (5.96 GB, 464 haplotypes) | **yes**, `BgzipTaffyAdapter`, and this is the one the tutorial uses |
| `hprc-v2.1-mc-grch38.full.maf.gz` + `.tai` (53 GB, 464 haplotypes) | yes, `BgzipMafAdapter` — same alignment, different build |
| `sv.gfa` (minigraph rGFA) | yes, graph view plugin |
| `wave.vcf.gz` (464-haplotype callset) | yes, genotype matrix |
| `hprc25272.aln.paf.gz` (complete all-vs-all, 310 GB) | yes in principle, never tried at that size |
| `hprc465vsgrch38.aln.paf.gz` (6.3 GB) | yes, but it is a **star** — see below |
| per-chromosome pggb `.gfa.zst` | **no** — see the memory measurement below |
| impg TPA (466 files, one per haplotype) | **no reader** |

Of everything on that list the TPA row is the one integration that would be
genuinely differentiating rather than catching up — 466 files ship as a
first-class alternative to the PAFs and nothing anywhere reads the format. It is
recorded here rather than in `TODO.md` because nobody has scoped a reader.

The human-pangenomics bucket serves `Access-Control-Allow-Origin: *` with
`Content-Range` exposed, so browsers can range-request all of it.

## The alignment is published twice, and the flat prefix is not the whole story

`pangenomes/freeze/release2/minigraph-cactus/` is the listing everyone reads — 12
flat files. Beside them are `v2.0/` and `v2.1/` subdirectories holding the full
per-build set, and what is in them changes which file to reach for.

- **v2.0 publishes the alignment as TAF, v2.1 as MAF, and neither publishes
  both.** `v2.0/…full.taf.gz` is 5.96 GB with a 4.98 MB `.tai`; `v2.1/…full.maf.gz`
  is 53.4 GB with a 5.35 MB `.tai`. Both index the same 195 GRCh38 contigs, both
  name sequences `GRCh38.chr6`, and the v2.0 TAF's header is
  `#taf run_length_encode_bases:1 version:1`, which `BgzipTaffyAdapter.ts` handles
  explicitly.
- **The graph and the callset are v2.0**, so the TAF is the alignment of the same
  build and the MAF is one revision on. That, not the size, is why the tutorial
  reads the TAF.
- **Locus reads, measured with the repo's own `queryBlockSpan` over the two
  `.tai` files** (chr6): 10 kb is 134 KB from the TAF against 598 KB from the MAF,
  30 kb is 189 KB against 878 KB, 100 kb is 1.4 MB against 3.1 MB. That is the
  read for the window itself; the display fetches the wider LGV block region. The
  MAF spec carried `fetchSizeLimit: 50_000_000` to draw the C4 figure at all and
  the TAF one carries none and draws, which is the only end-to-end statement here.
- **The v2.1 README lists fixes that apply to files this page uses**: a sample
  name typo in `sv.gfa.gz`, and a missing-genotypes bug in vcfwave output. Worth
  knowing before treating a v2.0 oddity as a JBrowse bug.
- **The flat `wave.vcf.gz` is older than the one in `v2.0/`.** The flat copy is
  the March 2025 build (2,275,985,017 bytes); `v2.0/…wave.vcf.gz` is a January
  2026 rewave (2,261,483,979 bytes) with `-rewave.log` and a `.old` beside it. All
  three wave VCFs carry the same 232 sample columns and all three strip
  `INFO/AT`. The tutorial still points at the flat one; moving it is a URL change
  plus a regen of two matrix figures.
- **The snarl-level carriage file is in the release tree now.**
  `v2.0/…pgbi.vcf.gz` is the same size as the
  `submissions/671F0A25-…--hprc_v2.0_mc_grch38_index/` copy the tutorial links,
  which is a UUID path rather than a discoverable one.

## Four things measured here — do not re-derive

**1. impg's PAF output is projections, not compositions.** The name and the `-x`
transitive flag make `impg query -x -o paf` sound like it fills in missing pairs.
It does not — impg's own help calls it "PAF-like projected interval matches", and
on the vs-GRCh38 star a 1 Mb chr20 query returned 338 rows of which **zero paired
two non-reference haplotypes**. Every row stays anchored on the sequence queried,
and anchoring on a haplotype instead changes nothing, so
`impg query -o paf | make-pif` reproduces the star it was given. Reaching A-vs-B
through impg means `-o fasta` and realigning, or `-o maf`/`-o gfa` with the
assembly FASTAs. impg is a retrieval and graph engine: the right tool for
extracting a locus across a cohort, the wrong one for generating pairwise
alignments.

**2. `hprc465vsgrch38.aln.paf.gz` is a pure star.** Sampled over 14 scattered
BGZF slices (829k rows, 39 query samples): every row targets GRCh38, so **39 of
780 sample pairs are stated and 741 are not**, and a synteny band between two
non-reference assemblies is empty by construction. Use the complete all-vs-all
(`hprc25272.aln.paf.gz`) if every pair is wanted. Both all-vs-all adapters raise
`noSuchPairError` on this now rather than drawing an empty band.

**A composition tool for this was built and then deleted** (`jbrowse
transitive-paf`, `a2858d0c86` → `79080af254`). **Do not rebuild it.** It worked —
88% recall at 99.8% precision on a held-out E. coli pair — but the field solves
this upstream: the complete all-vs-all is published, three stacked rows only need
two bands (order the reference between them), and beyond that a pangenome is a
multiple alignment rather than a stack of pairwise bands.

**3. The per-chromosome pggb graphs do not fit.** `pggb_gfa_to_bed.py` on chrY,
the smallest of the 25 (343 MB zstd against chr21's 2.4 GB): 4.12M segments,
7.69M links, **15.2 GB resident after 93 s while still loading**, nothing
written; killed at 4 GB from exhausting a 30 GB machine. It holds every segment,
link and path step at once, so it scales with the graph and not with the window.
For human, `odgi extract` a window or use the minigraph rGFA. The script carries
this measurement and refuses non-blunt overlaps.

**4. The published MAF is tab-separated.** UCSC writes MAF space-aligned; taffy
and Cactus write tabs. A ` +` split — which is what `parseBigMafStanza` uses, and
what got copied — leaves each row in one field, so every block silently vanishes
and the track draws nothing without erroring. `mafParsing.ts` splits on `\s+` and
says why.

## What the zoom-out tier is worth

Built whole-genome and hosted on 2026-08-14 at
`jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.summary.bed.gz` — 1.63 MB, 375,888
rows, 464 haplotypes, 152 of the index's 195 contigs — wired by
`test_data/hprc_maf_summary.json` and rebuilt by
`scripts/build_hprc_maf_summary.sh`, whose header carries the three failure modes.
A whole-chromosome read costs **828 bytes (chrM) to 127 kB (chr1)** against a
5 MB budget, so the tier has two to three orders of magnitude of headroom
everywhere. This is what it buys, read off the live session model on whole chr6
rather than inferred from a picture:

| | no `summaryAdapter` | with it |
| --- | --- | --- |
| `regionTooLarge` | true, "Requested too much data (354 Mb)" | false |
| `estimatedFetchBytes` | 353,902,971 | 250,801 |
| rows drawn | 0 | 464 |

**1,411x**, and the whole chromosome becomes navigable rather than a prompt. The
354 Mb agrees to the byte with what `queryBlockSpan` computes for chr6 off the
`.tai` (353,837,435 for the chromosome's own span, 353,902,971 with the gate's
one-block cushion), so the banner's number and the index arithmetic are the same
measurement. A whole chromosome of 464 haplotypes costs less than a quarter of
what one gene-sized detail read does.

The alignment tier stays the better view where it is affordable: at C4 the
detail read is ~1.2 MB against `LinearMafDisplay`'s 5 Mb budget.

### Three things the build has to get right, all found the hard way

Written up at length in `scripts/build_hprc_maf_summary.sh`; the shape of each is
worth carrying here because none is specific to HPRC.

- **`taffy view -r` fails silently on a range past the contig's end** — stderr
  message, empty MAF, exit 0. A first pass ended every range at
  last-index-entry + 10 Mb and lost **93 of 195 contigs, including chr1, chr2 and
  chrY**, while logging all 93 as "ok": the harness discarded stderr and tested
  `[ -s file ]`, which is true for a summary holding only its header. The
  per-chromosome table above is what caught it, because chr1 and chr2 were
  visibly missing from it — a single genome-wide total would have hidden 93
  absent contigs behind a plausible number.
- **`--merge-gap` is not the lever for row count.** In segmental-duplication
  territory a haplotype aligns to the same reference interval more than once, so
  the runs *overlap* and there is no gap to close: on chr14:18-20 Mb, raising the
  gap from 500 to 50,000 removed 0.04% of 854,467 rows. Collapsing each
  haplotype's overlapping runs into their union is what works — chr14 900,414
  rows / 2.9 MB becomes 9,089 / 43 kB, genome-wide 4,824,912 becomes 375,888, and
  GRCh38's own covered bases come out identical to the byte. That belongs
  upstream in `maf2bed`, since overlapping presence rows are redundant by
  construction for what the slot feeds.
- **A contig with a single `.tai` entry cannot be extracted by region at all**,
  even over 500 bp. That is what leaves 43 contigs out, all `chrUn_*` scaffolds
  of 970 bp - 15 kb. It is a taffy extraction limit, *not* evidence the alignment
  lacks them.

**Which is why the tier is a separate config rather than switched on for
`hprc_maf.json`, and that is a finding rather than a preference.** `showSummary`
swaps on **span** — `aboveForceLoadFloor`, 20 kb — while the question it is
standing in for is **cost**. The tutorial's own figure is drawn at
chr6:31,972,057-32,055,418, which is 83 kb, so wiring the summary onto that
track silently replaces the per-haplotype base rows the figure exists to show
with presence bands, for a detail read the budget would have allowed four times
over. Verified: `showSummary: true` at that locus with the summary configured.

This is the gap [MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md) §"What the LOD lesson
actually points at" predicted — "the per-species view built for see all 470
species at once is only available in the zoom range where fetching all 470 costs
the most per useful pixel" — now with a concrete instance and a config that
demonstrates both halves. Making the swap cost-based rather than span-based is
the fix, and it is a design question rather than a one-liner: the estimate that
would decide it is the *detail* tier's, which is exactly the measurement
`byteGateAdapterConfig` points away from once `showSummary` is on.

## Cutting a slice: two traps that look like tool bugs

**`taffy` dies on a byte-cut slice.** On a MAF whose last block is truncated it
aborts on `maf_read_block`'s `column_number == strlen(row->bases)` assertion, and
on a headerless mid-file TAF range it segfaults outright. Cut at a block boundary
— `awk 'f||/^a/{f=1;print}'` for the head, drop everything from the last `^a` for
the tail — and it is fine.

**`maf2bed` needs v0.6.0 or newer for `--summary`.** The released v0.5.1 both
lacked the flag and ignored unknown arguments, so the documented command exited 0
and wrote nothing. v0.6.0 is on crates.io.

## What the `LV==0` filter costs, measured

The wave VCF is vcfwave-decomposed, so the tutorial teaches `LV==0` to keep the
top-level record and not paint one event at two positions. Both halves of that
are true and the clause is doing real work — over `chr6:32,450,000-32,650,000`
it drops 22 records on the >=50 bp tier and 18 of them name an `ORIGIN` inside
the same window, which is the de-duplication it is for.

**The cost is a span collapsing onto a column.** A parent sits at one position
while its children spread over the span it covers, so a window can lose all its
records to a parent drawn elsewhere. Counted off the file:

| window | records | `LV==0` |
| --- | --- | --- |
| `chr6:32,000,000-32,005,690` | 76 | 0 |
| `chr6:32,005,690-32,011,057` | 170 | 0 |
| `chr6:32,011,057-32,020,000` | 103 | 0 |

That is 20 kb across CYP21A1P and TNXA — the most variable part of C4 — blank
under the filter, which is why `maf_hprc_pangenome`'s callset lane runs
unfiltered. A blank column under `LV==0` is a statement about the snarl tree.

**What this is NOT.** The sparse right third of
`pangenome/hprc_graph_vs_callset` was read as the same artifact and is not: over
its window the >=50 bp tier really is thin there (20, 4 and 10 records in the
last three 10 kb bins against 42, 39, 20, 25, 29 and 14 in the first six), and
the LV clause removes 24 of those whose parents are in view. Dropping it there
would double-paint 18 events to recover a texture that is mostly absent anyway.
Checked before changing it; do not re-derive.

## Short-read copy number at C4 agrees with the alignment, and is out of the figure anyway

`maf_hprc_pangenome` carried a lane of 1000 Genomes QuicK-mer2 copy number for
one round (`genomes/GRCh38/1000g/kidd_lab_cnv/<POP>/<SAMPLE>.qm2.CN.1k.bw`,
fourteen of the sixteen samples the alignment rows draw; HG002 is GIAB's and
CHM13 is a cell line, so neither is in the panel). It came out on review — "the
copy number can likely be removed, it is confusing, small number of samples" —
and fourteen rows of depth beside 464 of genotype and 32 of alignment do read as
a third cohort rather than as a measurement of the same one.

The measurement is worth keeping even though the lane is not, because the obvious
objection to it is wrong here. A unique-k-mer estimator has fewest unique k-mers
exactly where RCCX repeats itself, so the calls could have been noise. Checked
against the alignment over chr6:32,005,691-32,011,057 (CYP21A1P and TNXA), by
reading the drawn rows: seven haplotypes have no aligned sequence there, one each
of HG00099, HG00280, HG00290, HG00320 and HG00321 and both of HG00146. Each of
those six samples' depth call is exactly `2 - (unaligned haplotypes)` — five at 1
copy, HG00146 at 0 — and every sample with both haplotypes aligned is called 2 or
3. Thirteen of the fourteen agree. HG00140 is the fourteenth: depth says 1 copy
and both its haplotypes align.

**What only depth can say** is the gain side. An extra tandem module collapses
onto its own reference span, so a haplotype carrying two draws the same grey row
as one carrying one — HG00128 and HG00232 are called 3 and the alignment cannot
show it. If a figure ever needs the gains, this is the lane; the losses it does
not need it for.

## Cached test data

Re-downloading these is slow and the HPRC slices took scattered BGZF range reads
to assemble, so they live in `~/scratch/jbrowse-pangenome` (large artifacts go
under `~/scratch`, not a session scratchpad): the chr20 HPRC slice (6 haplotypes
vs GRCh38, both haplotypes of three samples), the E. coli hold-out set used to
measure composition recall, the untangle PAF, and a built `impg` binary. In
`~/scratch/hprc-gfa`: `chrY.gfa.zst`.

For summary-tier work, same directory: both published indexes (`hprc.tai` 5.35 MB
v2.1 MAF, `hprc_v20.tai` 4.98 MB v2.0 TAF), which answer any "what does a read of
span X cost" question offline through `queryBlockSpan`; the 200 kb C4 slice
`hprc_c4_slice.maf.gz` (4.35 MB, chr6:31.9–32.1 Mb, all 464 haplotypes); and
`hprc_c4.summary.bed.gz` plus its `.tbi`, what `maf2bed --summary` made of it.
The slice is enough to wire a real `summaryAdapter` against a real HPRC region
without touching the network.

## Related

- [MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md) §"A `.tai` is not a tier" — why both
  MAF adapters now take a `summaryAdapter` slot, with the bytes/bp measurements.
- [MAF_WORKER_PIPELINE.md](MAF_WORKER_PIPELINE.md) — what one region costs after
  the bytes arrive.
- [PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md) — the graph side of the same data.

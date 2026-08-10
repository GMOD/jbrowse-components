---
name: hprc-release2
description: What HPRC release 2 publishes and which artifacts JBrowse can open — why the tutorial reads a v2.0 TAF rather than the v2.1 MAF, and the four measurements not to re-derive (impg's PAF is projections not compositions, the vs-GRCh38 PAF is a star so 741 of 780 sample pairs are unstated, the per-chromosome pggb graphs do not fit in memory, and the published MAF is tab-separated). Read before touching the pangenome MAF or synteny path, or before cutting a slice of one of these files.
---

# HPRC release 2 in JBrowse

The alignment/MAF side of the HPRC data. The graph view's own queue is in
[TODO.md](../TODO.md#pangenome-graph-view-the-open-queue) and does not overlap.

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

## Cutting a slice: two traps that look like tool bugs

**`taffy` dies on a byte-cut slice.** On a MAF whose last block is truncated it
aborts on `maf_read_block`'s `column_number == strlen(row->bases)` assertion, and
on a headerless mid-file TAF range it segfaults outright. Cut at a block boundary
— `awk 'f||/^a/{f=1;print}'` for the head, drop everything from the last `^a` for
the tail — and it is fine.

**`maf2bed` needs v0.6.0 or newer for `--summary`.** The released v0.5.1 both
lacked the flag and ignored unknown arguments, so the documented command exited 0
and wrote nothing. v0.6.0 is on crates.io.

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

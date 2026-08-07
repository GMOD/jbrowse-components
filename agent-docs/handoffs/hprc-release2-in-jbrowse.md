---
name: hprc-release2-in-jbrowse
description: What HPRC release 2 publishes, which of it JBrowse can open today, why the alignment is a v2.0 TAF rather than the v2.1 MAF, and the four measurements a next session should not re-derive — impg's PAF is projections not compositions, the vs-GRCh38 PAF is a star, the pggb chromosome graphs do not fit, and the published MAF is tab-separated. Read before touching the pangenome MAF/synteny path.
---

# HPRC release 2 in JBrowse

State as of 2026-08-06. This is the alignment/MAF thread; the graph view's own
queue is `pangenome-graph-next.md` and does not overlap.

## What HPRC publishes, and what opens today

Release 2 ships several artifacts of the same pangenome. Which of them JBrowse
can open:

| artifact | opens? |
| --- | --- |
| `v2.0/…/hprc-v2.0-mc-grch38.full.taf.gz` + `.tai` (5.96 GB, 464 haplotypes) | **yes**, `BgzipTaffyAdapter`, and this is the one the tutorial uses |
| `hprc-v2.1-mc-grch38.full.maf.gz` + `.tai` (53 GB, 464 haplotypes) | yes, `BgzipMafAdapter` — same alignment, different build, see below |
| `sv.gfa` (minigraph rGFA) | yes, graph view plugin — see `pangenome_hprc.md` |
| `wave.vcf.gz` (464-haplotype callset) | yes, genotype matrix |
| `hprc25272.aln.paf.gz` (complete all-vs-all, 310 GB) | yes in principle, never tried at that size |
| `hprc465vsgrch38.aln.paf.gz` (6.3 GB) | yes, but it is a **star** — see below |
| per-chromosome pggb `.gfa.zst` | **no** — see the memory measurement below |
| impg TPA (466 files, one per haplotype) | **no reader** |

`website/docs/tutorials/pangenome_hprc.md` now covers graph, callset and
alignment. Its alignment section was committed 2026-08-06 and **is not yet
deployed** — `/jb2` lags, so confirm before citing that page for the MAF claim.

## The alignment is published twice, and the flat prefix is not the whole story

The listing everyone reads,
`pangenomes/freeze/release2/minigraph-cactus/`, is 12 flat files. Beside them are
`v2.0/` and `v2.1/` subdirectories holding the full per-build set, and what is in
them changes which file to reach for:

- **v2.0 publishes the alignment as TAF, v2.1 as MAF, and neither publishes
  both.** `v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz` is 5.96 GB
  with a 4.98 MB `.tai`; `v2.1/…full.maf.gz` is 53.4 GB with a 5.35 MB `.tai`.
  Both index the same 195 GRCh38 contigs, both name sequences `GRCh38.chr6`, and
  the v2.0 TAF's header is `#taf run_length_encode_bases:1 version:1`, which
  `BgzipTaffyAdapter.ts` handles explicitly. The bucket serves CORS `*` with
  `Content-Range` exposed on both.
- **The graph and the callset are v2.0**, so the TAF is the alignment of the same
  build and the MAF is one revision on. That, not the size, is why the tutorial
  reads the TAF.
- **Locus reads, measured with the repo's own `queryBlockSpan` over the two
  `.tai` files** (chr6): 10 kb is 134 KB from the TAF against 598 KB from the
  MAF, 30 kb is 189 KB against 878 KB, 100 kb is 1.4 MB against 3.1 MB. That is
  the read for the window itself; the display fetches the LGV block region, which
  is wider. The MAF spec carried `fetchSizeLimit: 50_000_000` to draw the C4
  figure at all, and the TAF one carries none and draws, which is the only
  end-to-end statement here — the per-window numbers above explain why but do not
  on their own predict the gate.
- **The v2.1 README lists fixes that apply to files this page uses**: a sample
  name typo in `sv.gfa.gz`, and a missing-genotypes bug in vcfwave output. Both
  are worth knowing before treating a v2.0 oddity as a JBrowse bug.
- **The flat `wave.vcf.gz` is older than the one in `v2.0/`.** The flat copy is
  the March 2025 build (2,275,985,017 bytes, `bcftools annotate` dated
  2025-03-18); `v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.wave.vcf.gz` is a
  January 2026 rewave (2,261,483,979 bytes, dated 2026-01-23), with
  `-rewave.log` and a `.old` beside it. All three wave VCFs (flat, v2.0, v2.1)
  carry the same 232 sample columns and all three strip `INFO/AT`. The tutorial
  still points at the flat one; moving it is a URL change plus a regen of two
  matrix figures.
- **The snarl-level carriage file is in the release tree now.**
  `v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.pgbi.vcf.gz` is the same size as
  the `submissions/671F0A25-…--hprc_v2.0_mc_grch38_index/` copy the tutorial
  links, which is a UUID path rather than a discoverable one.

## Four things measured here — do not re-derive

**1. impg's PAF output is projections, not compositions.** This is the trap: the
name and the `-x` transitive flag make `impg query -x -o paf` sound like it fills
in missing pairs. It does not. impg's own help calls it "PAF-like projected
interval matches", and on the vs-GRCh38 star, a 1 Mb chr20 query returned 338
rows of which **zero paired two non-reference haplotypes** — every row stays
anchored on the sequence queried. Anchoring the query on a haplotype instead
changes nothing. So `impg query -o paf | make-pif` reproduces the star it was
given. Reaching A-vs-B through impg means `-o fasta` and realigning, or `-o maf`
/ `-o gfa` with the assembly FASTAs. impg is a retrieval and graph engine; it is
the right tool for extracting a locus across a cohort, and the wrong one for
generating pairwise alignments. Checked by building it (`cargo build --release
--bin impg`, ~15 min, needs the `--recursive` clone); a binary is cached in
`~/scratch/jbrowse-pangenome/impg-bin`.

**2. `hprc465vsgrch38.aln.paf.gz` is a pure star.** Sampled 14 scattered BGZF
slices (829k rows, 39 query samples): every row targets GRCh38, so **39 of 780
sample pairs are stated and 741 are not**. A synteny band between two
non-reference assemblies is empty by construction. The complete all-vs-all
(`hprc25272.aln.paf.gz`) exists and is what to use if every pair is wanted. Both
all-vs-all adapters now raise `noSuchPairError` on this rather than drawing an
empty band.

**A composition tool for this was built and then deleted** (`jbrowse
transitive-paf`, commits a2858d0c86 → 79080af254). Do not rebuild it. It worked
— 88% recall at 99.8% precision on a held-out E. coli pair — but the field
solves this upstream: the complete all-vs-all is published, three stacked rows
only need two bands (order the reference between them), and beyond that a
pangenome is a multiple alignment rather than a stack of pairwise bands. The
reasoning is in 79080af254's message.

**3. The per-chromosome pggb graphs do not fit.** `pggb_gfa_to_bed.py` on chrY,
the smallest of the 25 (343 MB zstd against chr21's 2.4 GB): 4.12M segments,
7.69M links, **15.2 GB resident after 93 s while still loading**, nothing
written. Killed at 4 GB from exhausting a 30 GB machine. It holds every segment,
link and path step at once, so it scales with the graph and not with the window.
For human, `odgi extract` a window or use the minigraph rGFA. The script now
carries this measurement and refuses non-blunt overlaps.

**4. The published MAF is tab-separated.** UCSC writes MAF space-aligned;
taffy and Cactus write tabs. A ` +` split — which is what `parseBigMafStanza`
uses and what got copied — leaves each row in one field, so every block silently
vanishes and the track draws nothing without erroring. Cost a debug cycle;
`mafParsing.ts` splits on `\s+` and says why.

Incidental but load-bearing: the human-pangenomics bucket serves
`Access-Control-Allow-Origin: *` with `Content-Range` exposed, so browsers can
range-request it. Per-file index and read sizes are in the section above.

## Open threads

**The carriage lane. Done and deployed 2026-08-06.** The
blocking unknown had a plain answer: `RgfaTabixAdapter.getFeatures` parsed the
tag column and then dropped it, so `SM:Z:` reached `GraphNode.tags` through
`getSubgraph` and nothing else. `BedTabixAdapter` with `columnNames` was not
needed — the adapter now emits `samples` and `carriers` on every feature
(plugin `rgfaBed.ts`, `segmentSamples`), and `demos/ecoli_pangenome/config.json`
carries the lane as `ecoli_pggb_carriage`, colored by `feature.carriers` with a
legend, beside the depth track it improves on. Verified in the app: the IS5
element at K12 chr:1,299,499-1,300,693 draws as one 1,199 bp private box with
`samples: K12.1` in its detail panel, against a core band either side.

Both deploys are done. The bundle is published as `0093d998d280` and the demo
config is live; `test_data/graphgenomeview/*.json` is pinned at that bundle,
which also closes an inconsistency the previous session left: `pggb_carriage`'s
committed figure shows `carriedBy`, and the pin it was rendered against
(`aee5e17f4b2c`) predates carriage entirely, so nothing in the tree could
reproduce it.

`pangenome/pggb_carriage_lane` is the figure. One thing left undone and it is
someone else's: `pangenome/hprc_whole_chromosome` was excluded from the
pin-bump regen, because another agent has an uncommitted `hprc_bubble_score`
variability track in the same spec and in `figures.lock`, and regenerating it
here would have folded their change into this commit. It needs a regen against
the new pin whenever that lands.

**Launching the graph view from a clicked segment.** The data side is ready —
`links.bed` states both endpoints in full precisely so a reference segment can
reach an off-reference neighbour. The affordance belongs in the plugin repo.

**A TPA reader.** HPRC ships 466 TPA files as a first-class alternative to the
PAFs. Nothing reads the format. This is the one integration that would be
genuinely differentiating rather than catching up.

**464 rows in `LinearMafDisplay`.** The C4 figure needed `heightMode: 'grow'`,
`rowHeight: 2` and a 920 px viewport to fit the cohort, and `fetchSizeLimit`
raised because the byte gate was correctly measuring a large read.

**The summary-tier half of that is answered, and the answer was that there was
no tier.** `BgzipMafAdapter` and `BgzipTaffyAdapter` had no `summaryAdapter`
slot, deliberately, because a `.tai` bounds a read to the span on screen. It
does — and a read costs span × depth, so the index bounds one factor and nothing
bounds the other. Both take the slot now (`3e25ca40ce`). The measurements are in
[reference/MAF_LARGE_BLOCKS.md](../reference/MAF_LARGE_BLOCKS.md) §"A `.tai` is
not a tier" and should not be re-derived: ~19 compressed bytes/bp for the v2.1
MAF and ~2.1 for the v2.0 TAF, flat from 100 kb up, so whole chr6 is 3.19 GB and
354 MB. The same 200 kb of chr6 is 4.35 MB as alignment and **3.5 kB as
summary**, all 464 haplotypes present, `src` joining to the display's rows with
no mapping.

**The producer is published.** `maf2bed --summary` had been committed and
unpushed in `~/src/maf2bed` while every doc here told users to run it, and the
released v0.5.1 both lacked the flag and ignored unknown arguments, so the
documented command exited 0 and wrote nothing. **v0.6.0 is on crates.io**, tests
green, and its output over the cached C4 slice is identical to the local build's.

**What is left is producing and hosting the HPRC summary itself.** One streaming
pass over the 5.96 GB TAF (`taffy view` into `maf2bed --summary`, not the 53 GB
MAF), landing at roughly 75 MB bgzipped for the whole genome — at which point the
tutorial's track gets a real zoom-out tier. Hosting is an S3 write to the
jbrowse.org bucket. Nobody has needed it yet: the tutorial reads the v2.0 TAF,
which draws at gene scale within the default gate, so this buys whole-chromosome
navigation rather than fixing anything broken.

**A contribution to `pangenome/jbrowse-visualization`.** Their guide stops at
one MAF view via `wgatools` + `mafchunk` + `maf2bed` + a plugin-store install;
`@jbrowse/plugin-maf` is in core now and the graph, synteny, variants and depth
projections are all possible on the same pggb output. Draft is
`~/scratch/jbrowse-pangenome/jbrowse-visualization-contribution.md`; nothing has
been sent, and it carries its own check-before-sending list.

## Cached test data

Re-downloading these is slow, and the HPRC slices took scattered BGZF range
reads to assemble. In `~/scratch/jbrowse-pangenome`: the chr20 HPRC slice
(6 haplotypes vs GRCh38, both haplotypes of three samples), the E. coli
hold-out set used to measure composition recall, the untangle PAF, and the
built `impg` binary. In `~/scratch/hprc-gfa`: `chrY.gfa.zst`. Per
`feedback-big-scratch-goes-in-home-scratch`, keep large artifacts there and not
in the session `/tmp` scratchpad.

Added for the summary-tier work, same directory: both published indexes
(`hprc.tai` 5.35 MB v2.1 MAF, `hprc_v20.tai` 4.98 MB v2.0 TAF), which answer any
"what does a read of span X cost" question offline through `queryBlockSpan`; the
200 kb C4 slice `hprc_c4_slice.maf.gz` (4.35 MB, chr6:31.9–32.1 Mb, all 464
haplotypes); and what `maf2bed --summary` made of it, `hprc_c4.summary.bed.gz`
plus its `.tbi`. The slice is enough to wire a real `summaryAdapter` against a
real HPRC region without touching the network.

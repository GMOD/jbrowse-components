---
name: hprc-release2-in-jbrowse
description: What HPRC release 2 publishes, which of it JBrowse can open today, and the four measurements a next session should not re-derive — impg's PAF is projections not compositions, the vs-GRCh38 PAF is a star, the pggb chromosome graphs do not fit, and the published MAF is tab-separated. Read before touching the pangenome MAF/synteny path.
---

# HPRC release 2 in JBrowse

State as of 2026-08-06. This is the alignment/MAF thread; the graph view's own
queue is `pangenome-graph-next.md` and does not overlap.

## What HPRC publishes, and what opens today

Release 2 ships several artifacts of the same pangenome. Which of them JBrowse
can open:

| artifact | opens? |
| --- | --- |
| `hprc-v2.1-mc-grch38.full.maf.gz` + `.tai` (53 GB, 464 haplotypes) | **yes**, `BgzipMafAdapter`, added this session |
| `sv.gfa` (minigraph rGFA) | yes, graph view plugin — see `pangenome_hprc.md` |
| `wave.vcf.gz` (464-haplotype callset) | yes, genotype matrix |
| `hprc25272.aln.paf.gz` (complete all-vs-all, 310 GB) | yes in principle, never tried at that size |
| `hprc465vsgrch38.aln.paf.gz` (6.3 GB) | yes, but it is a **star** — see below |
| per-chromosome pggb `.gfa.zst` | **no** — see the memory measurement below |
| impg TPA (466 files, one per haplotype) | **no reader** |

`website/docs/tutorials/pangenome_hprc.md` now covers graph, callset and
alignment. Its alignment section was committed 2026-08-06 and **is not yet
deployed** — `/jb2` lags, so confirm before citing that page for the MAF claim.

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
range-request it. The `.tai` is 5.35 MB and downloads once; a 10 kb locus is then
a ~670 KB read.

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
raised because the byte gate was correctly measuring a large read. What the
summary tier does past a few hundred kb is unexamined, and that is where a
whole-chromosome view of this track lives or dies.

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

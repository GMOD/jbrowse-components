---
name: sv-multihop
description: The measured COLO829/K562/HG008-T facts the cancer_sv and sv_visualization_cgiab tutorials rest on, the batch study behind removing the in-app reconstruction (ADR-137), and the line the feature does not cross. Read before touching those figures or proposing any in-app reconstruction.
audience: internal
kind: dataset
---

# Multi-hop SVs and the cancer_sv tutorial

The `cancer_sv` tutorial teaches multi-hop somatic rearrangements: a gene fusion
formed by a chain of junctions rather than one breakpoint, reconstructed as a
derivative allele and checked against the reads. It ran on both cell lines until
2026-08-27; K562 could carry none of that method, having only RNA, so it is
`k562_fusions` now, off the same build script and the same spec file.

The tool behind it, the `sv_multihop` script, is gone
([ADR-140](../architecture-decision-records/adr-140-sv-analysis-is-not-ours-to-ship.md)):
chaining junctions belongs to LINX, Severus or gGnome, assembling the allele to
an assembler, and its VCF-to-BEDPE step to `jb2export batch --vcf`. What this
file keeps is the measured facts, which outlive it. The forward-looking dataset
ideas that used to sit at the bottom of this file are in
[ideas/waiting-on-someone-else/figures-blocked-on-data.md](../ideas/waiting-on-someone-else/figures-blocked-on-data.md).

## What exists

| Path | What |
| --- | --- |
| `scripts/depmap_to_jbrowse.py` | DepMap Omics release to STAR-Fusion TSV / CN bedGraph |
| `scripts/build_cancer_sv_demo.sh` | end-to-end rebuild of the hosted demo |
| `website/scripts/upload-cancer-sv-demo.sh` | upload guard, `EXPECTED` manifest, `copy` not `sync` |
| `website/docs/tutorials/cancer_sv.md` | the COLO829 tutorial, 7 figures |
| `website/docs/tutorials/k562_fusions.md` | the K562 tutorial, 3 figures over 6 images |
| `website/scripts/specs/cancer_sv.ts` | the figure specs for both |
| `https://jbrowse.org/demos/cancer_sv/` | hosted data, 2.3 GB, 18 files |

Behavior checks for the python helpers live in `scripts/check-build-scripts.py`.
The der(3) contig is a published artifact the build script fetches; nothing in
the repo rebuilds it.

## Verified facts, do not re-derive

Which cell lines are usable at all — and which are dead ends nobody should
re-check — is in
[ideas/waiting-on-someone-else/figures-blocked-on-data.md](../ideas/waiting-on-someone-else/figures-blocked-on-data.md).
This section is about the two the tutorial uses.

**COLO829 chain 1** is a closed 3-junction cycle across three chromosomes,
joining RARB (chr3), BICC1 (chr10) and TRHDE (chr12) inside under a kilobase of
derivative sequence. The reconstruction:

```
derivative      0-32,732  +  chr3   25,326,821-25,359,568
derivative 32,732-32,931  +  chr10  58,717,463-58,717,662
derivative 32,932-33,115  -  chr12  72,273,111-72,273,294
derivative 33,126-39,549  -  chr3   25,352,683-25,359,111
```

Two chr3 arms in opposite orientations (a foldback) with 199 bp of chr10 and
183 bp of chr12 spliced in at the turn. That structure has been derived three
ways — from the caller's breakend brackets, from a de novo consensus realigned
back, and from a LINX-style breakend walk in a separate codebase
([below](#the-breakend-walk-cross-check)) — and all three agree, but all three
read the same 2024 ONT molecules. **The independent confirmation is the
Valle-Inclán 2022 truth set** (Zenodo 4716169, hg38 liftover): its
`truthset_8`, `truthset_43` and `truthset_7` are exactly this chain's three
junctions, in these orientations, called from Illumina (two of them from
Illumina alone) and validated by capture. The chr9 fold-back's two junctions
are `truthset_34`, and `truthset_35` then `_36` on one molecule.

Supporting evidence, all measured rather than eyeballed:

- 29 tumour reads span all three loci; the longest is 57,134 bp
- 0 of 115 reads at the same locus in the matched normal carry multi-hop
  alignments, which is what makes it somatic
- realigned to the derivative, 25 of the 29 have one alignment crossing all
  four junctions. That is agreement with a consensus these reads polished, not
  independent evidence. 18 of them split at contig 32,275, where the fold-back's
  inverted copy of chr3 begins: a read whose return arm runs past the contig's
  end aligns that arm onto the forward copy, so those bases count twice left of
  32,275 and depth reads ~43x there against ~19x right of it. Three of the 18
  also split at 33,126, the return junction, so "none clips at a junction" does
  not hold at the whole-allele scale

**K562** `BCR--ABL1` is called by DepMap's STAR-Fusion (short-read RNA-seq) at
`chr22:23,290,413 -> chr9:130,854,064`, and an ENCODE Iso-Seq read splits at
exactly `chr9:130,854,064`. `NUP214--XKR3` (`chr9:131,199,015 -> chr22:16,808,083`)
is a second junction of the same amplicon, not the reciprocal of the first: its
chr22 partner is 6.5 Mb from BCR.

The DNA side, measured off the hosted `K562.10x-large-sv.vcf.gz` (lifted) and
`K562_cn.bw` on 2026-09-07:

| junction | RNA junction (exon edge) | 10X DNA break | apart |
| --- | --- | --- | --- |
| BCR donor | chr22:23,290,413 (end of exon 14) | chr22:23,290,556 | 143 bp into intron 14 |
| ABL1 acceptor | chr9:130,854,064 (start of exon 2) | chr9:130,731,760 | 122 kb, in intron 1 |
| NUP214 donor | chr9:131,199,015 (end of exon 29) | chr9:131,199,198 | 183 bp into intron 29 |
| XKR3 acceptor | chr22:16,808,083 (start of exon 3) | chr22:16,819,350 | 11 kb, in intron 2 |
| (none) | no fusion call | chr9:131,280,138 <-> chr13:108,009,064 | no RefSeq gene at either end |

Copy number on chr9 steps 1.0 -> 6.8 at 130,731,326, 6.8 -> 4.6 at
131,152,326 and 4.6 -> 0.9 at 131,280,326; chr22 16,386,068-16,820,068 sits at
3.9 and no segment covers BCR. So the two ends of the amplified block each carry
a DNA break (BCR-ABL1 on the left, the chr13 junction on the right), the middle
step has no breakend call, and the NUP214 break's copy-number step is on its
chr22 side. The ABL1 junction is in the 6.8 segment and the NUP214 junction in
the 4.6 one; the page used to say both were at "roughly seven copies" with the
chr22 partners "at one", which the bigWig contradicts. `cancer_sv/k562_amplicon_dna`
is the figure; Zhou et al. 2019 (Genome Research, 10.1101/gr.234948.118) is the
linked-read paper behind the ENCODE run.

## The breakend-walk cross-check

The other way to reconstruct this allele is to walk the caller's breakends
directly: no reads, no consensus contig, just the BND records and their mates.
The two are worth keeping distinct — a walk gives the segment order and
orientation the *caller* implies, `derive` gives what the *reads* actually
carry — and running both is what makes an agreement mean something.

Walked over COLO829's VCF, it returns the same four segments as the read-derived
reconstruction above: same chromosomes, same two templated inserts, same
foldback, once the traversal is read from the other end (a derivative and its
reverse complement are one molecule). Only the outer chr3 bounds differ, and
necessarily — a walk has no left-hand breakend to stop at, while the reads bound
the arms at read length. That agreement is the third independent derivation.

**Getting there needed a parser fix, and the bug is this file's own failure mode
in another shape:** an ALT pattern that matches at most one base either side of
the bracket drops, in silence, any BND carrying inserted sequence at the
junction. That is **28 of the 66 BND records** in COLO829's own VCF, and in this
chain precisely the junction holding the chr12 templated insert — the segment the
tutorial figure is about — leaving a 0-segment chain and a plausible-looking
walk.

VCF 4.5 §5.4 is explicit that the replacement string can be longer: "the string t
may be an extended version of s if some novel bases are inserted during the
formation of the novel adjacency". §5.4.1 gives a worked example, which such a
pattern also drops. **Delegate the ALT grammar to `@gmod/vcf`'s `parseBreakend`
rather than widening a regex** — it already handles inserted sequence,
assembly-contig mate positions (`<ctg1>:329`, §5.4.2) and single breakends, and
`vcf-js` gained a regression test (`e1f3be2`) pinning the multi-base case, which
was correct but untested there.

The mate refName case trap applies to any breakend walk too. Pairing by `MATEID`
sidesteps it, but a mate refName handed to consumers as the caller wrote it
(`CHR10` against a `chr10` CHROM) means anything that groups on it has to
normalize — the same bug this file had, one layer up.

The breakpoint split view was one of those consumers, and this was not
hypothetical: every one of the 66 BND records in COLO829's VCF writes CHROM
`chr3` and spells the same contig `CHR3` in the ALT bracket, so the overlay's
breakend bucketing gave a reciprocal pair two keys and its alt matching found
none. The reader got two panels and no curve between them — a wrong picture, not
an error. `getVariantJunctions` now keys both ends through sv-core's
`breakendLocKey`, and the alt matching is gone: the overlay reads each end's
kept side off `junctionEnds` instead. sv-core's own producers were never affected:
`junctionFromFeature` and `getBreakendCoveringRegions` resolve both ends through
`toCanonicalRefName`, whose `getCanonicalRefName2` already falls back to
`lowerCaseRefNameAliases`.

**And the walk's own "don't go back the way you came" guard worked in one
direction only.** A junction is reachable from either end, so which end the walk
came in on is a fact about the HOP; `nextJunctionFrom` read it off the RECORD
instead, comparing every candidate against `arrivedBy`'s first end. On a hop
taken through the junction's mate end that first end IS the current stop, so the
guard asked whether a candidate looped back onto the stop it was leaving — a
question nothing answers yes to — and did nothing at all. Which direction a
given hop takes is decided by which spelling of a reciprocal pair the callset
filed first, so the guard was on or off per callset with nothing saying which.

`visited` hides it in the ordinary case, since the previous stop is on the list.
What it does not cover is the case the guard names: one junction filed twice at
coordinates further apart than `BREAKEND_COLOCATION_BP`, which merging two
callers gives. The recorded stop and the junction's own end are up to the
tolerance apart, so a duplicate can be twice that from the stop and still be the
way back — and the walk turned round onto it, adding a panel a kilobase from one
it already had. Anchoring on the junction actually crossed (`arrivedFrom`) is
the reading that does not depend on how far the recorded stop drifted.

**And the walk went forward only, so which record a reader clicked decided how
much of the chain they were shown.** It extended past the starting record's MATE
end and never past its own, which COLO829 cannot see: its der(3) is a closed
triangle, so every record of it reaches the same three loci going one way round,
and `walkBreakendChain.test.ts`'s "walks the same three from any record" duly
passed. A LINEAR chain separates them. On `chr1 -j1- chr2 -j2- chr3 -j3- chr4`
the first record returned four panels, the middle three and the last two, with
nothing in the view saying the short answer was short — and every record of an
event is equally the event, since a reader clicks whichever breakend the track
drew under the cursor.

It now extends both ways, forward first so the `maxStops` budget is spent
exactly as before whenever the forward half fills it. Closed cycles are
unmoved for the reason they hid the bug: the backward step's only candidate
leads to a locus the forward walk already has, so `visited` closes it. `viaId`
is which junction was crossed to ARRIVE at a stop, reading the list top to
bottom, so a stop added to the FRONT takes over the one it displaced — nothing
outside the test reads that field, which is the other half of why this went
unnoticed.

**Walking both ways is only half of it: the query has to answer from both ends
too, and a coordinate-indexed one cannot.** A tabix index knows one coordinate
per record, and a BND feature's interval is `start + REF.length` — about 1 bp,
with `<TRA>` explicitly excluded from the spanning branch
(`plugins/variants/src/VcfFeature/util.ts`). So a record filed at chr1 naming a
mate on chr2 is unreachable from any chr2 query, and `makeFindJunctionsNear`
cannot be widened to find it: matching on the mate coordinate is a scan of the
whole callset, and it runs against whatever adapter a variant display holds,
where a somatic SV VCF is a few hundred records and a germline one is tens of
millions with nothing in an `adapterConfig` to tell them apart. Two things
supply the missing spelling instead and between them cover every callset in the
tree — a reciprocal BND pair, which is how VCF 4.x writes a breakend, and an
adapter that files a row under both contigs (`BedpeAdapter`,
`StarFusionAdapter`). What has neither, a filtered VCF missing one mate or a
one-record `<TRA>` naming CHR2, ends the chain early rather than wrongly.

The SV inspector's sheet is the one reader with no such limit, and the SV
inspector prefers it over the chord track's adapter. `SpreadsheetModel`'s
`findJunctionsNear` reads `svJunctions`, the whole parsed callset already in
memory, so matching a window against BOTH ends is one more comparison per
junction. `nextJunctionFrom` turns a candidate around itself, so a junction
matched by its mate end needs no flipping. Measured on `chr1 -j1- chr2 -j2-
chr3 -j3- chr4` written one record per junction: the own-locus-only filter
returns 2 stops from `j3` and either-end returns all 4, pinned as a pair in
`SpreadsheetModel.test.ts`. A reciprocal pair now comes back twice for a query
at either of its loci, which changes nothing — both spellings name the same next
locus and ambiguity is counted over destinations.

**One more parser trap, the same family as the ALT one above and one layer
down.** `parseSvAlt` split the mate locstring at its first colon. A refName may
contain one: GRCh38's full analysis set names its HLA contigs
`HLA-A*01:01:01:01`, so a mate on one arrives as `HLA-A*01:01:01:01:1000` and
came back as `HLA-A*01` at position 1 — a contig-and-locus the walk then went
looking for. The last colon is the separator by construction, which is the rule
`parseLocString` applies for exactly this reason. A non-numeric position now
returns undefined instead of a NaN that reached a fetch region and a panel's
`centerAt`, neither of which reports one.

**The walk's one concession on ambiguity is a caller that assembled the
answer.** Two junctions leaving one locus stop the walk by design. GRIDSS writes
`BEID`, the ids of the breakend assembly contigs behind a call, and Esvee
`ASMID`; two junctions sharing one were assembled on a single contig, which is
the caller saying they are phased cis. `junctionFromFeature` carries both into
`Junction.assemblyIds`, and `nextJunctionFrom` takes the one continuation that
shares a contig with the arrival junction — only when exactly one does, and
never when the locus was unambiguous anyway. Synthetic test only: no GRIDSS or
Esvee callset is in the tree. The rest of that stack — LINX's `links.tsv` as a
ready-made chain, junction copy number as a tiebreak — is parked in
[ideas/waiting-on-a-call/linx-chains-in-the-breakend-walk.md](../ideas/waiting-on-a-call/linx-chains-in-the-breakend-walk.md).

## HG008-T, the reconstruction's second dataset

The in-app picker these measurements checked was removed ([ADR-137](../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)); they stay as
the record of what it did. It was checked against a second cancer on different
chemistry, in `realReads.cgiab.test.ts` (gone with it): C-GIAB's HG008-T at 116x PacBio HiFi, over one
breakend of the `cluster_3` chromoplexy the `sv_visualization_cgiab` tutorial
follows. All of the below is measured, against the slice the hosted demo serves
and the files C-GIAB publishes, and the tutorial's "three ways" walkthrough is
built on it.

- **The caller.** `SV_20` / `SV_190` are one junction written twice, joining
  chr3:139,976,414 to chr13:114,353,244, filed under `EVENT=cluster_3` with two
  further breakends and tagged `EVENTTYPE=CHROMOPLEXY`.
- **The reads.** 134 of the slice's reads carry a chain. The top route is
  chr13 forward into the junction then chr3 inverted, at **65 reads**, its two
  segment edges landing on both published breakends. The next route has 10.
- **The normal.** At the same 5 kb window the matched normal returns 51 reads
  and **0** with an SA tag. That is the somatic control, and it is why the
  fixture carries no normal records: they would be 17 kB asserting that an empty
  list is empty.
- **The assembly.** The hosted `HG008T_v3.2.pif.gz` puts both loci on one
  contig, which the C-GIAB assembly named `chr3_chr13_hap1`. Its chr13 arm ends
  at 114,353,244 and its chr3 arm begins at 139,976,415, abutting at one base of
  contig coordinate with the same orientation flip the reads describe. The same
  contig also carries chr3:139,998,693, which is `cluster_3`'s other junction —
  so the assembly resolves more of this event than the read slice can.

**The demo slice bounds what the reads can reach**: chr3:139,936,789-139,986,329
and chr13:114,317,474-114,353,942, which is one of the two junctions. Widening
it means re-slicing the 118 GB NCBI BAM and re-uploading.

**Why this dataset earns its place beside COLO829**: the window ends at the
chr13 q-terminus, so under the real junction sit half a dozen routes built from
reads mismapped into other chromosomes' terminal repeats, each with a real read
count. The feature has to rank the true junction above them with nothing telling
it which is which, and the fixture asserts both that it does and that it does
not silently drop them.

**A route was built from the reads in the DISPLAYED REGIONS.** The chain
builder took one pileup entry per displayed region, so a locus that is not on
screen contributed no chain however completely its reads' SA tags describe the
join. Over the chr3 slice alone the picker offered exactly **one** route; over
both demo slices it offered **seven** — 65 reads, then 10, 5, 4, 3, 2, 2, the
runners-up all flagged "extends beyond this window". Chr13's window ends at that
chromosome's q-terminus and chr3's is nowhere near a telomere, which is where
the six extra rows came from. The same asymmetry holds for anything else read
over these slices: what is on screen sets what the reads can say.

## The batch study, and what it settled

A harness, `derivative_path_study.ts`, ran the picker's real chain builder and
grouping at every junction two somatic callsets report, with two control sets:
215 junctions, two cancers, two chemistries. It was removed with the picker
([ADR-137](../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md));
`git log --diff-filter=D --oneline -- 'scripts/derivative_path*'` finds the
commit that holds it. It ran as `fetch <dataset>` then `score <dataset>`, the
fetch minutes of remote range queries, the corpus it wrote gitignored.

The two datasets differ in the way that decides what a number means:

| | comparator | reads | independent? |
| --- | --- | --- | --- |
| `colo829` | nanomonsv PASS calls, 63 junctions | ONT ~60x | **no** -- same molecules |
| `cgiab` | C-GIAB V0.5 draft benchmark PASS, 152 junctions | HiFi 116x | **yes** -- GIAB's own, from several technologies and from assemblies |

**Recall is a step function in event size, and it replicates.** A junction
counts as recovered when a proposed route asserts it with both ends within
100 bp.

| Event size | COLO829 | HG008-T |
| --- | --- | --- |
| < 1 kb | 1 / 9 (11%) | 4 / 40 (10%) |
| 1 - 10 kb | 6 / 10 (60%) | 17 / 26 (65%) |
| 10 - 100 kb | 16 / 16 (100%) | 17 / 18 (94%) |
| > 100 kb | 17 / 17 (100%) | 54 / 54 (100%) |
| interchromosomal | 11 / 11 (100%) | 14 / 14 (100%) |
| all | 51 / 63 (81%) | 106 / 152 (70%) |

Two independent callsets on different chemistries agree to within 5 points in
every bin. **Above 10 kb and interchromosomal, 129 of 130.**

**The misses are the aligner's representation, not the grouping.** The study
asks, of each missed junction, whether the reads carry it as a CIGAR deletion of
about the called length instead of as a split alignment. 11 of COLO829's 12
misses, and 39 of HG008-T's 46, are in-CIGAR: the event is in the data, is not a
chain, and nothing reading SA tags could reach it. One COLO829 miss had no reads
in its window. **Seven HG008-T junctions are missed with reads present and no
in-read deletion either**, and those seven are the only genuinely unexplained
failures in the whole study; nobody has looked at them yet.

**Against an independent truth set the numbers are lower, and that is the
comparison to quote.** `derivative_path_study.ts fetch|score colo829truth`
scores the same ONT reads against the Valle-Inclán 2022 truth set (65 junctions
after insertions):

| Event size | Truth set junctions | Recovered | Rank 1 |
| --- | --- | --- | --- |
| < 1 kb | 12 | 2 | 2 |
| 1 - 10 kb | 10 | 4 | 4 |
| 10 - 100 kb | 14 | 12 | 10 |
| > 100 kb | 16 | 14 | 14 |
| interchromosomal | 13 | 9 | 9 |
| all | 65 | 41 | 39 |

Every recovered junction is rank 1 or 2, worst breakend 10 bp, and the matched
normal recovers none. Of the eight misses above 10 kb or interchromosomal,
seven were supported by Illumina alone in the truth set (`truthset_1`, `_13`,
`_19`, `_20`, `_33`, `_41`, `_44`), which may be absent from or unreachable in
this ONT stock; `truthset_40` (chr10–chr18, seen by all four technologies) is
missed with reads present. 13 of the 24 misses have reads and no in-read
deletion. Routes still appear at 27% of random loci (0.28 per window), so a row
without a matching call is a question, not an allele.

**Rank is not the weak link.** Where the junction is recovered it is rank 1 in
48 of 51 (COLO829) and 96 of 106 (HG008-T), and rank 1 or 2 in **every single
case in both**. Breakpoint agreement, taking the worse of a junction's two ends:
median 2 bp / max 40 bp on COLO829, median 1 bp / max 99 bp on HG008-T.

**The controls hold.** The matched normal recovers **0** somatic junctions in
both, at the same windows. It does propose routes elsewhere -- 40% of COLO829
windows, 4% of HG008-T's, the gap being 60x ONT against 35x HiFi -- and so do
random loci (28% and 3%). That is the dialog's caveat, quantified: routes appear
at ordinary loci, and read count alone does not separate them.

**A support floor of 2 is the knee, and there is a curve to point at.** Window
size (5/10/20 kb) does not move recall at all in either dataset, and neither
does the junction tolerance anywhere from 5 to 100 bp. The floor is the only
parameter that trades:

| support floor | COLO829 recall | routes per random locus | HG008-T recall | routes per random locus |
| --- | --- | --- | --- | --- |
| 1 | 84% | 3.77 | 73% | 1.80 |
| 2 | 81% | 0.30 | 70% | 0.37 |
| 3 | 76% | 0.02 | 70% | 0.17 |

Dropping to 1 buys 3 points of recall for a 12x increase in routes at loci with
no event. That is the defence of the default, and it is the first one that is
not an argument.

**What the study still does not do.** It scores against callsets, so a junction
neither caller reports is invisible to it; there is no false-DISCOVERY rate,
only a route count at control loci, because nothing here can say a route at a
random locus is wrong. And the size curve is a property of the ALIGNER
(minimap2/ngmlr here) as much as of this code, so it should be re-measured
before quoting it for a different aligner.

**Two bugs in the harness, both worth knowing.** Its first run lower-cased the
VCF's CHROM to fold mate-refName case and then fetched that spelling, so `chrX`
became `chrx` and six loci silently returned no reads -- the same leak this file
already recorded against a `--loci` list, reproduced from scratch by
someone who had read the warning. Control loci now come from the alignment
file's own `@SQ` header so the naming universe is the reads' by construction.
And 116x HiFi SAM overflowed node's maximum string length: `SEQ` and `QUAL` are
over 95% of those bytes and nothing in the study reads them, so the fetch
projects to six fields inside the pipeline.

## Reads on the allele: built, reverted, do not re-add

The in-app reconstruction (`Reconstruct derivative allele...`, a
`LinearAlignmentsDisplay` track-menu item, removed by ADR-137) drew the PATH
only. A lane placing
each supporting read onto that path — `projectReadsOntoDerivative`, beside the
grouping — was built and then reverted in `e7b4f2b29b`, which is the commit to
read before proposing it again. It is an attractive idea and the
arithmetic works: the path is a piecewise-linear map from reference coordinates
onto the allele's axis, a read's alignment is already a map from the read to the
reference, so composing the two places the read with no aligner and no
consensus. Three things killed it anyway.

- **It cannot fail at base level.** The derivative assembly has no sequence, so
  a read's own bases never touch the allele. A junction wrong by 30 bp, the
  wrong microhomology, the wrong inserted sequence: none of it can show.
- **It is close to circular.** The lane was fed the same chains the candidate
  list was built from, so it asked whether each chain matched a junction list
  derived from those chains, within the tolerance the grouping had already used.
- **It inherits every aligner artifact.** A read mismapped into a repeat
  contributes a confident chain, and the projection redraws the mismapping as
  support — the failure the tutorial's own prose warns about.

The check it was reaching for exists and is done properly outside the browser:
`derive` polishes the spanning reads into a consensus and realigns them onto it,
and that alignment is on the page as `reads_vs_der3`, with real mismatches and
real clipping against real bases.

One measurement from that work is about the DATA rather than the lane: reads in
the tutorial's window go chr3 → chr10 → chr3, skipping the 183 bp chr12
templated insert. The two that clear the picker's floor (`046a4d7e`,
`b42e2b8a`) place their chr10 piece at MAPQ 34 and 10 and carry no chr12 SA
entry at all, and their chr10 → chr3 junction is in no callset. They are an
alignment miss on noisy reads, not a second allele.

## Two figures that are not a baseline

`derivative_autogenerated` and `foldback_reconstruction` were listed here too,
on the grounds that the view they capture had gained a reads panel and that
`derivative_autogenerated`'s second stage was sized to a panel 180px taller than
the one it was shot against. Neither holds: that panel is the lane reverted in
`e7b4f2b29b` (above), so both figures still show what the feature draws and
neither needs re-rendering for this reason.

The other capture debt: the error-snackbar check and the semantic
`assertViewsPresent` gate both ship unswept. The snackbar check caught two broken
figures and has been sampled against three existing ones; the semantic gate was
exercised against a single-view spec, a nested-panel synteny spec, a dotplot and
an import form (0 declared views), plus its failure path against an injected
phantom view at both levels. A full `pnpm screenshots --force` run is the real
test and needs a quiet worktree (port 3334 is exclusive).

## Related tools, and which half of the job each does

Added 2026-09-02 after the question "what else does this". The tutorial's
"Related tools" section is the reader-facing copy; this is the reasoning.

| Job | Tool | Why it is the stronger version |
| --- | --- | --- |
| Somatic SV + complex clusters, long reads | [Severus](https://github.com/KolmogorovLab/Severus) (Keskus 2025, Nat Biotech) | Breakpoint graph over phased tumor/normal; benchmarked on COLO829, so it is the cross-check for der(3) |
| Ordering junctions with CN | LINX (Shale 2022) | Allele-specific CN + centromere constraint; already the doc's answer to "should `chains` order" |
| Junction-balanced graphs, walks | JaBbA + gGnome (Hadi 2020, Cell) | Closest published analogue to a derivative route, CN-aware, short-read |
| Haplotype-specific karyotypes | RCK (Aganezov & Raphael 2020) | ILP over evolutionary constraints; academic, needs a solver |
| Sequence of the allele | hifiasm / Shasta on the pulled reads; sawfish (Saunders 2025) for HiFi | Real assembly against `derive`'s one-backbone consensus; the "external tool can do de novo" case |
| The figure | ReConPlot (Espejo Valle-Inclán 2023); Ribbon | ReConPlot is aimed at the hand-pieced-figure audience directly |

Not listed on the page, known: Weaver, InfoGenomeR, CouGaR (older karyotype
reconstruction), ChainFinder and ClusterSV (cluster, do not reconstruct),
SplitThreader (already cited), Wakhan (haplotype-specific CN from ONT, preprint
at the time of writing).

## The line this feature does not cross

Worth stating plainly, because every idea in this area is one step from a
caller and the steps are individually reasonable.

**JBrowse shows what the reads and the callers literally say, and draws an
allele only when a tool outside it built one** ([ADR-137](../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)). The in-app picker sat
on the wrong side of that line: it proposed routes at 28–40% of ordinary ONT
loci and took copy counts from where reads stopped.

Three questions killed `projectReadsOntoDerivative`
([above](#reads-on-the-allele-built-reverted-do-not-re-add)) and they generalize,
so ask them of anything new here:

1. **Can it be wrong in a way the picture shows?** The projection could not — the
   allele has no sequence, so no read's bases ever touched it.
2. **Is its evidence independent of what it is checking?** The projection's was
   not; it tested chains against a junction list derived from those chains.
3. **Does it survive an aligner artifact honestly?** The projection redrew a
   mismapped read as support.

A "no" to any of them means the thing belongs in `scripts/`, or in somebody
else's program, and not in the browser.

## Traps in this worktree

- **The session scratchpad is a 16 GB tmpfs.** A `samtools sort` of a few GB
  filled it and wedged the sandbox so hard that `echo` failed. Set `TMPDIR` to
  real disk and keep large intermediates out of `/tmp`. Working data for this
  build is in `/home/cdiesh/fusion_demo_build/`. `derive` no longer contributes
  to this — it used to leave its whole temp directory behind, every run.
- **Port 3334 is exclusive to one screenshot run.** Other agents use it. Wait on
  it (`until ! ss -lptn 'sport = :3334' | grep -q LISTEN`), never kill it.
- **`galleryLinks.generated.ts` must be committed surgically.** Regenerating it
  from the working tree bakes in other agents' uncommitted spec entries and
  fails CI, which regenerates from committed specs. Build it as
  `git show HEAD:<file>` plus your own entries in spec-array order, verify the
  diff is additions only, commit, then regenerate to restore the shared tree.
  See `key_pattern_shared_worktree_generated_aggregate_commit`.
- **Verify CI checks in a detached worktree at HEAD**, which is what CI actually
  does: `gen-gallery-links --check`, `check-spec-recipes --check`,
  `check-sidebar`, `check-config-blocks`. `check-spec-recipes` will flag any new
  spec field with no click-path in `src/lib/spec-recipe/fields.ts`.
- **Rebuilding `products/jbrowse-web` picks up every agent's uncommitted source
  change.** Any figure rendered afterwards bakes those in. That is how item 1
  above happened.

## Rebuilding

```bash
bash scripts/build_cancer_sv_demo.sh
bash website/scripts/upload-cancer-sv-demo.sh cancer_sv_build/demo
cd website && CANCER_SV_BASE=http://localhost:8099 pnpm screenshots --filter cancer_sv
```

`CANCER_SV_BASE` points the specs at a local `npx serve` of the build output so
figures can be rendered before the data is uploaded. Leave it unset to render
against the hosted demo, which is what a committed figure must match.

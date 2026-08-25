---
name: sv-multihop
description: How scripts/sv_multihop.py and the in-app picker each reconstruct a derivative allele, the silent-wrong-answer bugs in both now pinned by checks, and the measured COLO829/K562/HG008-T facts the cancer_sv and sv_visualization_cgiab tutorials rest on. Read before touching those figures or the derivative-allele reconstruction.
audience: internal
---

# sv_multihop and the cancer_sv tutorial

The `cancer_sv` tutorial teaches multi-hop somatic rearrangements: a gene fusion
formed by a chain of junctions rather than one breakpoint, reconstructed as a
derivative allele and checked against the reads. `scripts/sv_multihop.py` is the
tool behind it and is meant to be reusable against any somatic SV callset.
Shipped 2026-08-02 in `6c8a7b4708`..`8f15a3be06`; the forward-looking dataset
ideas that used to sit at the bottom of this file are in
[ideas/cancer-sv-datasets-unshot.md](../ideas/cancer-sv-datasets-unshot.md).

## What exists

| Path | What |
| --- | --- |
| `scripts/sv_multihop.py` | `chains` (search a somatic SV VCF) + `derive` (rebuild the allele) |
| `scripts/depmap_to_jbrowse.py` | DepMap Omics release to STAR-Fusion TSV / CN bedGraph |
| `scripts/build_cancer_sv_demo.sh` | end-to-end rebuild of the hosted demo |
| `website/scripts/upload-cancer-sv-demo.sh` | upload guard, `EXPECTED` manifest, `copy` not `sync` |
| `website/docs/tutorials/cancer_sv.md` | the tutorial, 8 figures |
| `website/scripts/specs/cancer_sv.ts` | the figure specs |
| `https://jbrowse.org/demos/cancer_sv/` | hosted data, 2.3 GB, 18 files |

Behavior checks for both python helpers live in `scripts/check-build-scripts.py`,
53 of them for `sv_multihop` alone. Every bug below is pinned by one.

## Verified facts, do not re-derive

Which cell lines are usable at all — and which are dead ends nobody should
re-check — is in
[ideas/cancer-sv-datasets-unshot.md](../ideas/cancer-sv-datasets-unshot.md). This section is about the two the tutorial uses.

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
183 bp of chr12 spliced in at the turn. That structure has now been derived three
times independently — from the caller's breakend brackets, from a de novo
consensus realigned back, and from a LINX-style breakend walk in a separate
codebase ([below](#the-breakend-walk-cross-check)) — and all three agree.

Supporting evidence, all measured rather than eyeballed:

- 29 tumour reads span all three loci; the longest is 57,134 bp
- 0 of 115 reads at the same locus in the matched normal carry multi-hop
  alignments, which is what makes it somatic
- 0 of the 29 primary alignments clip at any of the four junctions once
  realigned to the derivative; depth holds flat at 28 across all of them

**K562** `BCR--ABL1` is called by DepMap's STAR-Fusion at
`chr22:23,290,413 -> chr9:130,854,064`, and an ENCODE Iso-Seq read splits at
exactly `chr9:130,854,064`. The amplified segment `chr9:130,731,327-131,152,326`
(CN 6.8 against flanking ~1.0) is bounded by the `BCR--ABL1` and `NUP214--XKR3`
junctions.

## sv_multihop design notes

`chains` needs only the VCF. It parses BND ALT brackets and symbolic
DEL/DUP/INV `END`, collapses reciprocal breakend pairs, and unions junctions
whose endpoints sit within `--max-segment` on the same chromosome. That
threshold is the one real knob: it is the longest reference segment you believe
one read can bridge, so it should track the read-length distribution.

### The dedup tolerance, and why it is not `--max-segment`

`--dedup-tolerance` (default 10 bp) is how far apart the two records of one
reciprocal breakend pair may place it and still read as one junction. It is a
*different* number from `--max-segment` and has to stay orders of magnitude
smaller, because the two are asking opposite questions: the dedup asks "are
these one adjacency written twice", the segment threshold asks "are these two
adjacencies a read could carry together". A dedup as wide as `--max-segment`
deletes exactly the junctions the chain is made of — on COLO829 the junction
count is flat at 100 from 0 bp all the way to 1 kb and only starts falling
(97) once the tolerance reaches 20 kb, which is that failure beginning.

Tolerance 0 is the old exact behavior, byte for byte (checked against the
previous implementation over 500 random callsets), so it is there if a caller
ever needs it.

Both COLO829 VCFs in `fusion_demo_build` are nanomonsv, which writes its
reciprocal pairs at identical coordinates — so no callset on this machine
exercises the off-by-one, and the fix is pinned by a synthetic pair plus the
proof that it does not move the real ones. A Manta/DELLY/GRIDSS callset is
where it would first show.

The union is done by bucketing endpoints at `--max-segment`, not by comparing
every pair of junctions: every endpoint in a bucket is within the threshold of
every other by construction, so a bucket is one component outright and two
neighbouring buckets join exactly when their closest pair does. 4,000 junctions
took 9 s pairwise and 0.01 s bucketed, and a whole-genome GRIDSS callset is
several times that — which matters for a tool whose claim is that it runs
against any somatic callset. The two forms agree on the partition over 300
random callsets wherever no two endpoints coincide exactly; coinciding endpoints
are the case the pairwise form got wrong (below).

`derive` makes exactly one pass over the alignment file, which may be a remote
URL, then works from a local slice. It picks the longest spanning read as a
backbone, polishes it to a consensus with the rest, trims leading/trailing `N`
(the backbone overhangs the others, and `--min-depth` masks those tails), aligns
the contig back, and realigns the reads to it.

Three things about the contig-to-reference alignment are not obvious:

- **It aligns against windows around the chain's own loci, not the genome.**
  Seeding fine enough to catch a 200 bp insert matches every repeat genome-wide.
  Coordinates are lifted back to whole-chromosome space afterwards.
- **A second pass re-aligns query intervals the first pass left unplaced.** No
  seeding parameters will surface an isolated 183 bp segment against a 32 kb
  chain; minimap2's chaining swallows it. Without the gap-fill pass the chr12
  insert vanishes silently, which is exactly the segment the figure is about.
- **`--min-mapq` drops the repeat hits** that fine seeding produces. Real
  segments come back at 60, repeats at 0.

**This tool is DNA-only, deliberately.** A `--splice` flag once existed, adding
minimap2's `-x splice -u n` to the contig-vs-reference alignment so the contig
could be a fusion *transcript* whose exons are adjacent in it but separated by
introns in the genome. It was removed: nothing ever passed it, no Iso-Seq ever
went through it, and the evidence multi-hop rests on is genomic — one long read
crossing a chain of junctions. RNA shows that a fusion exists; it cannot show
the reference segments the junctions join, which is the whole claim here.

Removing it also removes a trap, because the alignment was only the visible half
of the problem. The surrounding output stays DNA-shaped whatever minimap2 does:
`--min-segment` defaults to 50 bp, so the gap-fill pass silently drops an exon
shorter than that, and the segment BED labels each piece as
`chr9:130,731,327-131,152,326 (421.0 kb)` — the description of a derivative
chromosome's arm, not of an exon. A `--splice` that aligned correctly would still
have produced a track that read wrong.

`--preset` stays and is unrelated to any of this: it selects the read chemistry
for the read-to-contig alignments (`map-ont`, `map-hifi`, `map-pb`).

## Bugs worth knowing about

Every one of these produced a plausible wrong answer rather than an error, and
every one is now pinned by a behavior check.

Found while building the demo:

- `touches_all` originally tested proximity to a segment's **start** rather than
  containment. A read's chr3 arm can begin 50 kb from the breakpoint it crosses
  at its far end, so this found 14 of the 29 spanning reads, missed the 57 kb
  backbone, and built the reconstruction from what was left.
- Reciprocal breakend dedup needs the mate refName case-folded, because callers
  write it upper-cased in the ALT bracket. Without it a 3-junction chain reports
  as 6. The positions need a tolerance for the same reason —
  [below](#the-dedup-tolerance-and-why-it-is-not---max-segment).
- `depmap_to_jbrowse` must emit the `#`-prefixed header; `StarFusionAdapter`
  finds `LeftBreakpoint`/`RightBreakpoint` by name off that line and otherwise
  loads an empty track without complaining.
- The reference windows `derive` aligns the contig against were unmerged, so two
  loci on one chromosome — which is what a foldback is — put that sequence in
  the target twice. Every genuine hit then tied at MAPQ 0 and `--min-mapq`
  dropped it, leaving a "reconstruction" consisting of the templated insert
  alone. COLO829's own run passed one locus per chromosome and never hit it.
  Found by running the pipeline on a synthetic foldback (below); fixed by
  merging the windows.

Found in a later read of the tool itself. None of them changes COLO829's own
run — verified by re-deriving it, byte for byte, before and after — which is the
point: the demo dataset is not a test of this tool, it is one input to it.

- **`END=` matched inside `CIEND=`.** INFO keys were matched unanchored and
  `re.search` takes the first hit, so a symbolic DEL/DUP/INV that writes its
  confidence interval before its END (`SVTYPE=DUP;CIEND=5,10;END=9000`) got a
  junction at position 5. A negative first bound (`CIEND=-50,50`) doesn't match
  the digits, so whether it bites depends on the caller and on the sign.
  `OLDSVTYPE=DEL` satisfied `SVTYPE` the same way, making a `<CNV>` record a
  deletion. `info_field` now matches from the start of a field.
- **Two junctions leaving the same reference base did not link.** `find_chains`
  guarded its endpoint comparison with `endpoint_a != endpoint_b`, which
  excludes exactly the strongest link a chain can have: one breakpoint that two
  adjacencies both leave from. The chain came back as unrelated singletons, so
  the event was not reported at all rather than reported wrongly.
- **The lower-cased mate refName leaked into `--loci`.** Case-folding the mate is
  what collapses reciprocal pairs, but the folded spelling was also what
  `chain_loci` handed to `derive` — so on any assembly not spelled in lower case
  (`Chr1`, mixed-case scaffolds) the loci were regions the reference does not
  have. Mates now resolve to the spelling the VCF's own `##contig`/CHROM lines
  use, which collapses the pairs *and* stays a valid region. hg38 is lower-case
  throughout, which is why the demo never showed it.
- **A multi-parent GFF3 feature lost all but its last parent.** `project_gff`
  suffixes `ID`/`Parent` per segment so a foldback's two copies keep separate
  hierarchies. `Parent=t1,t2` took one suffix on the whole list, leaving `t1`
  pointing at an ID no copy carries — the orphan-exon problem the suffixing
  exists to prevent.
- **Reciprocal dedup matched positions exactly while chain-linking matched them
  within `--max-segment`.** The two records of one adjacency then survived as two
  junctions whenever a caller disagreed with itself by a base — which side of the
  junction the coordinate sits on is a convention, and an imprecise caller
  carries a `CIPOS` besides. Same symptom as the case bug above: every adjacency
  counted twice, a 3-junction chain reported as 6.
- **`derive` never deleted its temp directory.** 19 MB for COLO829's own chain,
  and it scales with depth × `--window` × loci, since the first intermediate is
  an uncompressed SAM of every read near every locus. On the session tmpfs
  ([below](#traps-in-this-worktree)) that is the thing that fills it.

Three more failures were loud but useless, and now say what happened: nothing
supported at `--min-depth` and nothing aligned back above `--min-mapq` both used
to write an empty "reconstruction" and exit 0, and a locus naming a sequence the
reference does not have died inside samtools *after* the fetch rather than
against the `.fai` before it.

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

**One more parser trap, the same family as the ALT one above and one layer
down.** `parseSvAlt` split the mate locstring at its first colon. A refName may
contain one: GRCh38's full analysis set names its HLA contigs
`HLA-A*01:01:01:01`, so a mate on one arrives as `HLA-A*01:01:01:01:1000` and
came back as `HLA-A*01` at position 1 — a contig-and-locus the walk then went
looking for. The last colon is the separator by construction, which is the rule
`parseLocString` applies for exactly this reason. A non-numeric position now
returns undefined instead of a NaN that reached a fetch region and a panel's
`centerAt`, neither of which reports one.

## HG008-T, the reconstruction's second dataset

The picker is checked against a second cancer on different chemistry, in
`realReads.cgiab.test.ts`: C-GIAB's HG008-T at 116x PacBio HiFi, over one
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
it means re-slicing the 118 GB NCBI BAM and re-uploading, i.e. the data-prep
work `agent-docs/ideas/cgiab-tutorial-followups.md` files.

**Why this dataset earns its place beside COLO829**: the window ends at the
chr13 q-terminus, so under the real junction sit half a dozen routes built from
reads mismapped into other chromosomes' terminal repeats, each with a real read
count. The feature has to rank the true junction above them with nothing telling
it which is which, and the fixture asserts both that it does and that it does
not silently drop them.

**A route is built from the reads in the DISPLAYED REGIONS**, which is what
decides how much of the ranked list a figure of this dialog can show.
`computeReadChains` takes one pileup entry per displayed region, so a locus that
is not on screen contributes no chain however completely its reads' SA tags
describe the join. Measured on `sv_cgiab/three_ways`: over the chr3 slice alone
the picker offers exactly **one** route, and over both demo slices it offers
**seven** — 65 reads, then 10, 5, 4, 3, 2, 2, the runners-up all flagged
"extends beyond this window". The mismapping the fixture's third `it` asserts
about is chr13's, and chr3's window is nowhere near a telomere, so the chr3-only
shot has nothing under the top row for the walkthrough to ask a reader to weigh.
The spec's two `loc` regions are the demo slice bounds, i.e. the same windows
`realReads.cgiab.test.ts` builds `REGIONS` from, so figure and fixture read the
same records.

## The in-app picker's junction tolerance is a distance, not a grid

`computeDerivativePaths` groups reads by the junctions their chains describe,
and two reads agree on a junction only to within the aligner's placement of it.
That tolerance was applied as `Math.round(bp / tolerance)` — which asks which
fixed 20 bp cell a coordinate falls in, not whether two coordinates are close —
so whether two reads merged depended on where the locus sat rather than on how
far apart they were. Endpoints 1 bp apart split whenever they straddled a cell
edge; endpoints 10 bp apart split half the time.

**It moved the published answer.** Swept over one cell width, the COLO829
der(3) fixture reported its support as anything from 24 to 28 reads and grew a
spurious second candidate at 14 of the 20 offsets. The chr9 fold-back fixture
carried the same path as two candidates at nine reads and one, i.e. offered one
route twice with its support divided.

Endpoints are now clustered per refName before comparison (`buildClusterOf`):
seeded at the coordinates most reads placed a junction at (ties to the lower),
each seed claiming, in descending-count order, every unclaimed endpoint within
the tolerance of it. The properties in `computePaths.test.ts` pin it, each
sweeping an offset rather than testing one pair, plus a translation-invariance
check over the real COLO829 records.

The mode-seeding replaced a leader sweep (sorted ascending, a new cluster
opened when an endpoint is further than the tolerance from the one that OPENED
the current cluster), which had its own silent divider: anchoring on the LOWEST
endpoint anybody supplied means one jittered 1-read chain landing just left of
a stacked junction re-anchors the cluster and cuts the junction's own upper
placements off into a second one — one allele as two candidates, support
divided, caused by a chain the `minReads` floor was about to discard anyway.
Every pinned `realReads.*` count is unchanged by the switch; the swept-outlier
property in `computePaths.test.ts` is the case that separates the two.

**The cluster rule caps a cluster at the tolerance around its own seed, and
that is load-bearing.** Linking each endpoint to its nearest neighbour instead —
single linkage — lets clusters chain, and this data has a real case: COLO829's
two chr9 fold-back junctions sit **28 bp apart**, and jittered reads between
them bridge the two into one cluster, merging two alleles into one candidate.
Two junctions further apart than the tolerance are two modes, so each seeds its
own cluster. `sv_multihop.py`'s `dedupe_junctions` is not single linkage either:
it compares each record against the records already KEPT, so a drifting run of
300/308/316 keeps the two ends and drops only the middle, which
`check-build-scripts.py` pins ("does not merge transitively"). What it anchors
on is the first record kept, the leader-sweep shape above, and at a 10 bp
tolerance over a callset that is the right trade — a caller writes one
position per record, so there is no pile of reads for a stray to re-anchor.

Two consequences to know about. The der(3) window now returns **two** rows: the
four-segment allele at 28 reads, and at 2 reads the three-segment route that
skips the chr12 templated insert — the dissent recorded below, now visible in
the product rather than only here. And at the chr9 fold-back two routes tie at
nine reads, so the segment-count tiebreak puts the three-segment route above the
two-segment fold-back; the picker's rows therefore carry a
`derivative-path-<segments>-<refNames>` testid and both specs select by it,
because a spec keyed on row order captures the wrong allele under the right
caption. **`derivative_autogenerated` and `foldback_reconstruction` are stale
until re-rendered** for this reason — the candidate lists in both frames are
what changed.

### A segment's identity within a read is its locus AND its read position

One layer below the clustering, in the chain builder the picker shares with the
arc band. `unpairedReadChain` collapses a fetched record with the SA-tag twin
its sibling carries, and the dedup key was refName + start alone — which also
folds together the PASSES of a read that traverses one locus more than once.
ecDNA / rolling-circle reads do exactly that: the circle-closing junction
vanished while the read still counted as support for a linear allele it does
not describe, and a one-segment circle read's chain dropped outright.
`segLocusKey` now includes clip-at-start-of-read, which no two segments of one
read can share and which a record and its SA twin agree on — both sides derive
the same strand-corrected clip from the same alignment's CIGAR, S and H alike.
`fetchToPaths.test.ts` pins the circling read through the real extraction.

### And the identity a picked route is held by is the junctions

Same family as the tolerance bug above, one layer up. The dialog is an observer
over a live getter, opened on a pileup that is usually still streaming, so it
deliberately holds the user's chosen route rather than a row number. It held it
by `locString` — which is built from the candidate's `segments`, whose OUTER
edges come from the group's representative, which is its **widest** chain. One
wider read joining the group the user already picked therefore rewrote that
group's locstring, the lookup missed, and the radio dropped silently back to row
0. No re-ranking needed, which is what the index-holding version at least
required.

The fix is to hand out the grouping key itself as `pathId`
(`computeDerivativePaths`), since "these two chains are one allele" is a
question that file already answers, from the clustered junctions alone. Three
properties in `computePaths.test.ts` pin it: stable while its own reads widen
it, distinct between two genuinely different routes, and one id for an allele
read from either end.

The general shape, worth checking anything new here against: **a candidate's
junctions are the allele and its outer edges are the reads.** Anything that
identifies, keys on, or compares a candidate has to be built from the first,
and `locString`, `segments`, `readCount` and `refNames` are all the second or
worse. `extendsOffScreen` is the remaining one that is read-derived, and it can
flip for the same reason; it is informational and shown only when the candidates
disagree about it, so it has not been worth a field.

**And the junctions are read-derived too, one level down — `pathId` is not a
stable id, only a better one.** It carries CLUSTERED coordinates, and the
cluster's LABEL is a coordinate some read supplied. Label it with the sweep's
own leader — the lowest endpoint anybody placed the junction at — and a read
landing to the left of the whole cluster renames it, so the route the user
already picked gets a new id with the allele unchanged. That is the same silent
drop back to row 0, one layer further down.

**It was the common case, not an edge.** Feeding the 37 real COLO829 tumour
chains in one at a time, over 40 arrival orders, the der(3) route's `pathId`
changed a mean of **2.98 times per run, in 37 of the 40 orders**.

The label is now the coordinate **most** reads placed the junction at, ties to
the lower: **0.10 changes per run, 4 orders in 40**. It is the better
representative anyway — reads stack exactly on an unambiguous breakpoint, so the
mode is the called position while the leader is the worst-placed read in the
pile. That fix moved only the name a cluster answers to; the later mode-seeding
([above](#the-in-app-pickers-junction-tolerance-is-a-distance-not-a-grid))
anchors membership on the same mode, so the seed and the label are now one
coordinate — and every pinned count in `realReads.*` and every tolerance
property is still unchanged.

The residue is real and irreducible: a route whose two reads disagree about a
junction has no mode to speak of, so a third read can still rename it. So the
picker does not trust the id alone either. `selectedCandidateIndex`
(`buildDerivativeVsRefSpec.ts`) matches on `pathId` first and falls back to the
route's SHAPE — `derivativePathTestId`, refNames and orientations, which no
coordinate moves — taking it only when it names exactly one row, since two
routes of one shape at nearby loci is precisely what a fold-back locus offers
and guessing between them draws the wrong allele under the right caption.

### And the support count was doubled by a display setting

`readCount` is the only number the picker ranks by, the only one it shows, and
the one `minReads` filters on — and with the track GROUPED it counted a read
once per lane that read's segments landed in.

`derivativePathCandidates` chained each lane separately and concatenated the
results, under a comment saying that lost nothing because a segment in another
lane is named by the read's own SA tag and `unpairedReadChain` folds it in from
there. It does, and that is the failure: every lane rebuilds the WHOLE chain on
its own, from one fetched entry plus that entry's SA tag, so both lanes emit
identical chains, they group, and the route claims twice its support.

**Group by strand is the case that bites, and it is not a corner.** A read
crossing an inversion has segments on both strands by definition, which is the
whole shape a fold-back is made of, so exactly the alleles this feature exists
for are the ones that double. Two synthetic reads over one inversion report 2
ungrouped and 4 grouped by strand; grouping by an HP tag a supplementary record
does not carry does the same thing. Nothing in the dialog says which reading it
is giving you.

`computeReadChains` now takes the LANES and buckets every one of them under a
single QNAME map before `resolveReadGroup` sees them, which is the ungrouped
answer by construction. It also puts the partner segment back on screen as a
fetched entry rather than an SA record, so `extendsOffScreen` stops claiming a
path leaves a window both of its ends are drawn in.
`fetchToPaths.test.ts` pins both, through the real extractor, since every other
suite under `derivativePaths/` hands the chain builder a single lane and cannot
see this at all.

### The split view's interior panel needs a junction, not a middle

A `BreakpointSplitView` built from a route opens one panel per segment, each on
the junction that segment carries: the first the one the path LEAVES by, the
last the one it ARRIVES at, an interior one the centre between its two. The
centre answers the question only while both junctions fit in the 10 kb window.
COLO829's interiors are 199 bp and 183 bp and do; an interior ARM does not, so a
centred window over a 30 kb segment showed NEITHER end — a panel of ordinary
reference with no read crossing anything and no curve to either neighbour. It
now anchors on the arrival junction past that length, keeping the connection to
the panel above.

Which reference coordinate a junction is depends on the strand, and
`buildSplitViewFromPath` was spelling that rule a second time as a nested
ternary nothing held against `computePaths`'s. The pair is exported as
`segmentEntryBp`/`segmentExitBp` now, for the reason `splitJunctionArc` shares
`connectionEndpointBps` with the entry path: getting it backwards draws no
connections rather than wrong ones, so nothing reports it.

## The batch study, and what it settled

`scripts/derivative_path_study.ts` runs the real `computeReadChains` +
`computeDerivativePaths` at every junction two somatic callsets report, with two
control sets. 215 junctions, two cancers, two chemistries. Run it as
`fetch <dataset>` then `score <dataset>`; the fetch is minutes of remote range
queries and the corpus it writes is gitignored and refetchable.

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

**Rank is not the weak link.** Where the junction is recovered it is rank 1 in
48 of 51 (COLO829) and 96 of 106 (HG008-T), and rank 1 or 2 in **every single
case in both**. Breakpoint agreement, taking the worse of a junction's two ends:
median 2 bp / max 40 bp on COLO829, median 1 bp / max 99 bp on HG008-T.

**The controls hold.** The matched normal recovers **0** somatic junctions in
both, at the same windows. It does propose routes elsewhere -- 40% of COLO829
windows, 4% of HG008-T's, the gap being 60x ONT against 35x HiFi -- and so do
random loci (28% and 3%). That is the dialog's caveat, quantified: routes appear
at ordinary loci, and read count alone does not separate them.

**`minReads = 2` is the knee, and now there is a curve to point at.** Window
size (5/10/20 kb) does not move recall at all in either dataset, and neither
does the junction tolerance anywhere from 5 to 100 bp. `minReads` is the only
parameter that trades:

| minReads | COLO829 recall | routes per random locus | HG008-T recall | routes per random locus |
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
already records against `sv_multihop.py`'s `--loci`, reproduced from scratch by
someone who had read the warning. Control loci now come from the alignment
file's own `@SQ` header so the naming universe is the reads' by construction.
And 116x HiFi SAM overflowed node's maximum string length: `SEQ` and `QUAL` are
over 95% of those bytes and nothing in the study reads them, so the fetch
projects to six fields inside the pipeline.

## Reads on the allele: built, reverted, do not re-add

The in-app reconstruction (`Reconstruct derivative allele...`, a
`LinearAlignmentsDisplay` track-menu item) draws the PATH only. A lane placing
each supporting read onto that path — `projectReadsOntoDerivative`, beside
`computePaths` — was built and then reverted in `e7b4f2b29b`, which is the
commit to read before proposing it again. It is an attractive idea and the
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

One measurement from that work is about the DATA rather than the lane, and is
worth keeping: three reads in the tutorial's window go chr3 → chr10 → chr3,
skipping the 183 bp chr12 templated insert the reconstruction claims. That
dissent is invisible in any picture built only from the reads that carry the
path, which is why it is recorded here instead.

## How to exercise `derive`

**Against the real data it is a 9-second run, not a demo rebuild.** samtools
fetches only the slices around the loci from the hosted CRAM, so

```bash
python3 scripts/sv_multihop.py derive \
  --aln https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram \
  --ref GRCh38.fa --loci chr10:58717464,chr12:72273112,chr3:25359111 --out der3
```

reproduces `der3_RARB.vs_reference.paf` **byte for byte** against what the demo
serves (`fusion_demo_build/demo/`), off a local `GRCh38.fa` and nothing else.
That is the cheapest real-data regression test this tool has, and the one that
says a change to it did not move the published figures. `chains` against
`COLO829.somatic-sv.vcf.gz` is the same kind of check for the other subcommand:
its output is quoted in the tutorial (100 junctions, 4 chains, chain 1 is the
RARB one), so a diff of it is a diff of the docs.

**The synthetic foldback is now a check, not a recipe.**
`scripts/check_sv_multihop_pipeline.py` builds the allele below, runs `derive`
over it and asserts the reconstruction, in about a second and with no network.
`check-build-scripts.py` runs it when samtools/minimap2/tabix are present and
says **SKIPPED** in its summary line when they are not, and the `docs` CI job
installs them so that it actually runs there. It is mutation-tested: unmerging
the reference windows, dropping the `-1` from the coordinate lift, dropping the
strand flip in `project_feature` and disabling the `Parent` rewrite each fail it.
Two mutations it does *not* catch, both understood — rebasing a second-pass row
(the fixture never needs the second pass, see that file's header; pinned by
`place_gap_row` instead) and clamping a window to the chromosome (cosmetic, it
only silences a faidx warning).

The recipe behind it, if you want to vary the shape:

A synthetic foldback runs the whole pipeline in seconds and has a known answer,
which is how the MAPQ-0 bug above surfaced. Build a two-contig reference, splice
a derivative out of it (`chrA[0:20000] + chrB[1000:1200] +
revcomp(chrA[10000:16000])`), simulate a dozen whole-molecule reads at ~1% error
plus a few that touch one locus only, `minimap2 -ax map-ont | samtools sort`,
then `derive --loci chrA:20000,chrB:1100,chrA:13000`. The PAF should come back as
the three segments, at MAPQ 60, matching the splice above; anything less is the
window/tie failure. Feeding the emitted `--jbrowse-out` config to jbrowse-web
(serve it under the built `jbrowse-web` package's `build/` output) is what
proves the wiring.

## The two gates this work added

- **The settle gate is semantic.** `assertViewsPresent` in
  `website/scripts/generate-screenshots.ts` reads each spec's own
  `session=spec-…` back out of its url and compares that view tree — nested
  panels included — against live `window.JBrowseSession.views`. A floor, not an
  equality: an `actions` chain can open a view and nothing in the suite closes
  one. It runs even under `allowUnsettled`, which opts out of "still loading",
  not out of "the view never existed".
- **`derive --jbrowse-out`** writes the `config.json` wiring the four outputs
  (both assemblies, synteny PAF, segment BED, realigned reads) with paths
  relative to the config, and prints the `session=spec-` url that opens them as
  a synteny view. `--ref-name` names the reference assembly. Verified end to end
  against jbrowse-web on the synthetic foldback above.

## Two figures that are not a baseline

`derivative_synteny` and `derivative_inserts` were captured against a
`products/jbrowse-web` build that contained other agents' uncommitted **synteny
and dotplot** source changes, and are committed as-is. Do not treat them as a
baseline until they are re-rendered; the precondition is a worktree where those
packages are clean, which is what has kept it from being done.

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

## Should sv_multihop become its own repo

Deferred, deliberately. It is ~600 lines with two PATH dependencies and one
proven consumer. Extracting now would put a version skew between the tutorial
and the tool (the build-script convention curls helpers from this repo's
`main`), and would move the only CI it has.

**Trigger for revisiting:** a second real consumer, or an external user wanting
to run it on their own callset. Either makes the interface concrete instead of
guessed. `--jbrowse-out` is the seam that makes a standalone run browsable, so
that is now what an external user would exercise first.

What *would* change the shape of the tool is the weakness in `chains`: proximity
unioning gives an unordered set of junctions, with no segment order or
orientation and one guessed `--max-segment`, against a `derive` whose strength is
the read-side evidence. Ordering has to come from a breakend walk over the VCF
([above](#the-breakend-walk-cross-check)) — a genuinely separate job from
reading the alignments, and one to run as its own program and consume the output
of, rather than to fold in here.

**And the program to consume is LINX, not one of ours.** Ordering breakends into
a derivative chromosome is exactly LINX's job, and the reason it is a separate
program is not tidiness: LINX resolves chaining by imposing allele-specific copy
number constraints at every point on each chromosome, plus the constraint that a
chromosome needs a centromere, fed by PURPLE's purity and ploidy estimates
([Shale et al. 2022](https://doi.org/10.1016/j.xgen.2022.100112)). Nothing in
this repo has purity, ploidy or allele-specific CN, so a `chains` that grew an
orderer would be guessing at precisely the step the literature solves with data
we do not have. Load LINX's output as a track instead.

## The line this feature does not cross

Worth stating plainly, because every idea in this area is one step from a
caller and the steps are individually reasonable.

**JBrowse may aggregate and rank what the reads literally say, and draw the
result. It may not decide what is true, and it must not emit anything that
outlives the view.**

Concretely, against [cuteSV's](https://doi.org/10.1186/s13059-020-02107-y) own
description of a caller as three steps — signature extraction, clustering and
refinement, then calling and genotyping — the in-app reconstruction does the
first for free (SA tags are already parsed to draw arcs), a thirty-line version
of the second (`buildClusterOf`), and none of the third. There is no genotype,
no likelihood, no FILTER and no VCF out. `computeDerivativePaths` is ~180 lines
of logic; the other ~1,300 lines of this feature build views, which is a genome
browser's actual job.

The ancestry to claim is Ribbon and SplitThreader, both cited in the tutorial and
both visualization tools. The picker is Ribbon with a `GROUP BY`: Ribbon draws
one read's SA chain against the reference, this groups those chains and counts
them.

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

The one capability here that no caller has, and the reason the feature earns its
place: it shows the **dissent**. The der(3) window returns the 28-read
four-segment allele *and* the 2-read route that skips the chr12 insert, each with
its own count. cuteSV and LINX are obliged to emit one answer. Preserving the
disagreement is the product; resolving it is not.

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

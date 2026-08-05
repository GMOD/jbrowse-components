---
name: sv-multihop
description: How scripts/sv_multihop.py reconstructs a derivative allele from a somatic SV callset plus the tumour reads, the four silent-wrong-answer bugs now pinned by behavior checks, and the COLO829/K562 facts the cancer_sv tutorial rests on. Read before touching the cancer_sv figures or the derivative-allele reconstruction.
---

# sv_multihop and the cancer_sv tutorial

The `cancer_sv` tutorial teaches multi-hop somatic rearrangements: a gene fusion
formed by a chain of junctions rather than one breakpoint, reconstructed as a
derivative allele and checked against the reads. `scripts/sv_multihop.py` is the
tool behind it and is meant to be reusable against any somatic SV callset.
Shipped 2026-08-02 in `6c8a7b4708`..`8f15a3be06`; the forward-looking dataset
ideas that used to sit at the bottom of this file are in
[OTHER_IDEAS.md](../OTHER_IDEAS.md), "Cancer SV datasets not yet shot".

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
re-check — is in [OTHER_IDEAS.md](../OTHER_IDEAS.md), "Cancer SV datasets not yet
shot". This section is about the two the tutorial uses.

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

## Reads on the allele, in the app

The in-app reconstruction (`Reconstruct derivative allele...`, a
`LinearAlignmentsDisplay` track-menu item) now draws the reads on the path it
proposes, in the path's own coordinates — the browser half of what `derive` does
offline, and it needs neither an aligner nor a consensus. The path is a
piecewise-linear map from reference coordinates onto the allele's axis and a
read's alignment is already a map from the read to the reference, so composing
the two places the read by arithmetic.

`projectReadsOntoDerivative` (alignments plugin, beside `computePaths`) is the
whole of it; `buildDerivativeVsRefSpec` turns its output into one feature per read
with a box per placed piece, blue where the read is consistent with the allele
over its whole length and orange where it is not. **The point is the break.** The
ribbons are drawn FROM the reads, so they cannot disagree with them; a read
placed on the allele can, and it is the only thing in the view that can.

Two decisions in the placement are not obvious, and both are pinned against the
COLO829 records in `realReads.colo829.test.ts`:

- **Both readings of every read are placed and the better fit kept.** A molecule
  has no reason to have been sequenced in the direction the path happens to be
  drawn in — on this allele 16 reads describe it one way and 10 the other.
- **A fit is scored by pieces placed, not by bases covered.** The outer segments
  of a path are the long ones (30 kb of chr3 against a 199 bp chr10 insert), so a
  bases-weighted score is decided by where the long arm landed and prefers a
  1-of-4 fit to a 4-of-4 one. It picks the WRONG reading of every supporting read
  here, and the result looks right at whole-allele zoom.

A foldback is what makes the placement a walk along the path rather than a
per-segment lookup: one reference interval appears on the path twice, so nothing
about a single chr3 arm in isolation says which copy it belongs to. The cursor
only moves forward, and of two overlapping copies an arm takes the one it runs
the same way as.

Measured on the tutorial's own window, and where the 100 bp gap tolerance comes
from: 37 reads there carry a junction, **all 37 place**, 29 land unbroken, and
the ones that fit are 0-9 bp off their junctions while the nearest read that does
not is **193 bp** out. Any threshold between those gives the same picture.

The interesting failures are not badly-mapped reads. Three reads go chr3 → chr10
→ chr3, skipping the 183 bp chr12 templated insert the reconstruction claims —
a disagreement invisible in a picture built only from the reads that carry it,
and the reason this panel is worth drawing at all.

Split reads only (chains of two or more segments), which is what the display's
`derivativeReadChains` holds. Unsplit reads cannot leave the path, so a whole
pileup of them would say nothing about it, and these features are a session
snapshot that share links carry.

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

## Four figures that are not a baseline

`derivative_synteny` and `derivative_inserts` were captured against a
`products/jbrowse-web` build that contained other agents' uncommitted **synteny
and dotplot** source changes, and are committed as-is. Do not treat them as a
baseline until they are re-rendered; the precondition is a worktree where those
packages are clean, which is what has kept it from being done.

`derivative_autogenerated` and `foldback_reconstruction` are now stale for a
different and simpler reason: both drive the picker and capture the view it
creates, and that view has gained a reads panel since they were shot ("Reads on
the allele", above). They are not wrong about what they claim — the path and its
provenance labels are unchanged — but they no longer show what the feature
draws, and `derivative_autogenerated`'s second stage is sized to a panel that has
grown by up to 180px. Re-render both with the other two, same precondition. The
verification screenshot behind the reads panel was taken against the hosted demo
data with a local build, so what they will show is known.

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

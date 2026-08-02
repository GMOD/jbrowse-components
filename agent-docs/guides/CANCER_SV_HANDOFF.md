# Cancer SV tutorial and sv_multihop: handoff

2026-08-02. Shipped in five commits on `main`, `6c8a7b4708`..`8f15a3be06`.

The `cancer_sv` tutorial teaches multi-hop somatic rearrangements: a gene fusion
formed by a chain of junctions rather than one breakpoint, reconstructed as a
derivative allele and checked against the reads. `scripts/sv_multihop.py` is the
tool behind it and is meant to be reusable against any somatic SV callset.

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

Behavior checks for both python helpers live in `scripts/check-build-scripts.py`
(40 checks total, was 24). It also gained a `contextlib`/`tempfile` import.

## Verified facts, do not re-derive

**SK-BR-3 is unusable as a dataset.** Every file under
`labshare.cshl.edu/shares/schatzlab/www-data/skbr3/` 404s. Only raw PacBio CLR
in SRA `PRJNA476239` remains. The paper is design inspiration only.

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
183 bp of chr12 spliced in at the turn. That structure was derived twice
independently, once from the caller's breakend brackets and once from a de novo
consensus realigned back, and the two agree.

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

**COLO829 has no matching RNA**, and K562 has no usable hg38 WGS (ENCODE's is
hg19 and 337 GB). That split is why the tutorial uses two cell lines.

**C-GIAB / HG008 has no RNA arm at all**, so it cannot carry a fusion tutorial.

## sv_multihop design notes

`chains` needs only the VCF. It parses BND ALT brackets and symbolic
DEL/DUP/INV `END`, collapses reciprocal breakend pairs, and unions junctions
whose endpoints sit within `--max-segment` on the same chromosome. That
threshold is the one real knob: it is the longest reference segment you believe
one read can bridge, so it should track the read-length distribution.

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

`--preset` and `--splice` exist but are **untested against real RNA**. They were
added for building a fusion-transcript contig from Iso-Seq and nothing has run
that path yet.

## Three bugs worth knowing about

All three produced a plausible wrong answer rather than an error, and all three
are now pinned by behavior checks:

- `touches_all` originally tested proximity to a segment's **start** rather than
  containment. A read's chr3 arm can begin 50 kb from the breakpoint it crosses
  at its far end, so this found 14 of the 29 spanning reads, missed the 57 kb
  backbone, and built the reconstruction from what was left.
- Reciprocal breakend dedup needs the mate refName lower-cased, because callers
  write it upper-cased in the ALT bracket. Without it a 3-junction chain reports
  as 6.
- `depmap_to_jbrowse` must emit the `#`-prefixed header; `StarFusionAdapter`
  finds `LeftBreakpoint`/`RightBreakpoint` by name off that line and otherwise
  loads an empty track without complaining.

## Open items, ranked

1. **Re-render the two synteny figures from a clean build.**
   `derivative_synteny` and `derivative_inserts` were captured against a
   `products/jbrowse-web` build that contained other agents' uncommitted synteny
   and dotplot source changes. They are committed as-is and should not be
   treated as a baseline until re-rendered.
2. **Sweep the new error-snackbar gate across all figures.** It caught two
   broken figures of mine; it has only been sampled against three existing ones.
   A full `pnpm screenshots --force` run is the real test and needs a quiet
   worktree (port 3334 is exclusive).
3. **Make the settle gate semantic.** The snackbar check is per-symptom. A spec
   that declares N views and ends with zero views is broken however the failure
   was reported, and `window.JBrowseSession.views.length` is already reachable
   from the harness (it is what annotation anchoring resolves through).
4. **`derive --jbrowse-out`.** The tool emits an assembly, a PAF, a labelled BED
   and a BAM, but not the `config.json` wiring them. That config was hand
   written for the demo. Emitting it would make the tool self-contained for
   someone running it on their own tumour, and is the natural integration seam.
5. **HCC1395 multi-caller copy number.** SEQC2 publishes CNV output from six
   callers plus SNP arrays on one tumour, all hg38, and PacBio Revio HiFi
   tumour/normal BAMs are public at
   `downloads.pacbcloud.com/public/revio/2023Q2/HCC1395/`. "Callers disagree,
   adjudicate them against the reads" is a distinct tutorial from the existing
   C-GIAB one.
6. **COLO320-DM ecDNA.** The strongest remaining focal-amplification story
   (MYC on ecDNA, CN ~100). Blocked here only by disk: the ONT data is raw
   fastq in `PRJNA1110283` (33-53 GB per run) and needs a genome-wide minimap2
   run before anything is browsable.

## Should sv_multihop become its own repo

Deferred, deliberately. It is ~470 lines with two PATH dependencies and one
proven consumer. Extracting now would put a version skew between the tutorial
and the tool (the build-script convention curls helpers from this repo's
`main`), and would move the only CI it has.

**Trigger for revisiting:** a second real consumer, or an external user wanting
to run it on their own callset. Either makes the interface concrete instead of
guessed. Item 4 above is the seam to build first either way.

## Traps in this worktree

- **The session scratchpad is a 16 GB tmpfs.** A `samtools sort` of a few GB
  filled it and wedged the sandbox so hard that `echo` failed. Set `TMPDIR` to
  real disk and keep large intermediates out of `/tmp`. Working data for this
  build is in `/home/cdiesh/fusion_demo_build/`.
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

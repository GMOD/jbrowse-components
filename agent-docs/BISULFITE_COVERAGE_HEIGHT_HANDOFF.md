# Bisulfite coverage-track methylation height — BUG HANDOFF

**Symptom (user-reported, with screenshot):** In the **bisulfite** color mode,
the alignments **coverage track**'s methylation rectangles render **not full
height**. At a position where the pileup shows nearly all reads methylated (many
red marks), the red coverage rectangle only reaches ~50% of the bar, not ~full.
The per-read pileup marks themselves are fine — this is specifically the
coverage-band summary.

Repo: `/home/cdiesh/src/jbrowse-components`, branch `webgl-poc`.

## Root cause (traced end-to-end, confirmed)

Bisulfite reuses the **modifications** coverage path, and that path's
`modifiable`/`detectable` denominator model is wrong for bisulfite because
**unmethylated reads read as `T` (C→T converted), not `C`**.

Data flow:

1. **`plugins/alignments/src/features/modification/extract.ts:202`
   `extractBisulfite`** emits per-cytosine calls into `modificationsData` (NOT
   the mismatch array). Each entry: `{ base:'C', modType:'m', strand:methStrand,
   prob:1, noMod:!methylated }`. Methylated → `noMod:false`; unmethylated (read
   is `T`, or `A` on the flip strand) → `noMod:true`. Emitted only for reads
   that are C(meth)/T(unmeth) at a reference `c` (or `g` on flip strand) in the
   chosen context. `flip = isReverse XOR isSecondOfPair` (IGV rule);
   `methStrand = isReverse ? -1 : 1`.

2. **`plugins/alignments/src/shared/runCoveragePipeline.ts`** →
   `computeModificationCoverage(modifications, modBaseCounts, …)` runs when
   `trackStrands` is set (true for the modification family, incl. bisulfite).
   `modBaseCounts` = `computeReadBaseCounts` = per-position **actual read bases**
   split by strand.

3. **`plugins/alignments/src/features/modCoverage/compute.ts`** groups entries by
   `(modType, noMod)` → two bins per position (methylated + unmethylated). Height
   per bin (~line 175):
   ```
   height = (modifiable / depthAtPosition) * (probabilityCount / detectable)
   ```

4. **`plugins/alignments/src/shared/calculateModificationCounts.ts`**:
   `modifiable = count(base) + count(complement)` from the actual read bases. For
   `base:'C'` → `modifiable = C.count + G.count`; simplex
   `detectable = C.fwd + G.rev`.

**The defect:** for MM/ML modBAM data an unmethylated C still *reads* as `C`
(the basecaller just assigns low probability), so `C.count` = all cytosine
reads and the denominator is right. For **bisulfite**, an unmethylated C **reads
as `T`** — those reads land in `strandBaseCounts['T']` and are **never counted
in `modifiable`/`detectable`**. So the methylated bin's `probabilityCount /
detectable` ≈ `methylated / (methylated_fwd + rev_G)` ≈ **~0.5 at full
methylation**, and `modifiable/depth` doesn't recover it → **half-height red
rectangle**. The `G.count` term also wrongly folds in opposite-strand reads that
carry no call for *this* cytosine (bisulfite is inherently one-strand /
simplex-like).

## Proposed fix

Bisulfite must not use `calculateModificationCounts` (built around modBAM base
*presence*). At a bisulfite position the informative reads = **methylated +
unmethylated calls actually emitted there** (both bins are already in
`modificationsData`, distinguished by `noMod`). The methylation fraction =
`meth / (meth + unmeth)`.

Two viable approaches:

- **(A, preferred) Dedicated bisulfite branch/denominator.** Thread a
  `bisulfite: boolean` (from `colorBy.type === 'bisulfite'`) into
  `computeModificationCoverage`. For bisulfite, per position set
  `denominator = methCount + unmethCount` (sum the two bins' `probabilityCount`),
  and emit red height `= meth/(meth+unmeth)` and blue `= unmeth/(meth+unmeth)`.
  Decide the vertical scale: user wants **full-height** when fully methylated, so
  the red+blue should fill the **whole** coverage bar (denominator = the calls,
  NOT depth) — i.e. the bisulfite coverage bar reads as a per-position
  methylation-level (0–100%) split, like a mini methylation track. (If instead
  you want it to occupy only the callable fraction of the bar, scale by
  `(meth+unmeth)/depth` — but that reintroduces the "short" look the user is
  complaining about, so prefer full-bar.)

- **(B) Separate bisulfite coverage compute** (a sibling to
  `computeSNPCoverage`) that counts meth/unmeth per position and emits the two
  stacked rectangles directly. Cleaner separation from the modBAM model; more
  new code.

Recommend (A) with a full-bar split.

### Verify the fix
Render a fully-methylated locus in the TE (`NC_003070.9:4,406,000–4,410,000`,
CpG context, config below) — the red coverage rectangle should reach ~full bar
height; a ~50/50 position should show ~half red / half blue. Use
`website/scripts/generate-screenshots.ts --filter methylation/arabidopsis_wgbs_cpg
--exact --force` after `pnpm build` in `products/jbrowse-web`.

## IGV cross-reference (`~/src/vendor/igv`)
- `src/main/java/org/igv/sam/BisulfiteCounts.java` — counts methylated vs
  unmethylated C per position; coverage renderer shows the ratio. This is the
  denominator model to mirror (calls, not base-presence).
- `src/main/java/org/igv/sam/BisulfiteBaseInfo.java` — **separate visual note:**
  IGV sets every non-context base to `DisplayStatus.NOTHING` (blank read body) so
  the red/blue marks pop. JBrowse instead paints the whole read body
  (`modificationsColor` → `colorModFwd/Rev` in
  `plugins/alignments/src/LinearAlignmentsDisplay/shaders/slang/read.slang:135`),
  which dilutes the marks. Consider de-emphasizing the body in bisulfite/meth
  mode (would make pileups read stronger — the user's original "looks weak"
  complaint). Marks are drawn full row-height already (`mismatch.slang`
  `pileupY`), but `filterMismatchesByFrequency` (on when
  `showLowFreqMismatches` is false, the default) fades them at <1 px/bp — NOT the
  main cause here, user confirmed, but relevant to zoomed-out strength.

## Separate track: demo/figure design (screenshot-review.json — all 5
`arabidopsis_wgbs_*` marked **bad**)
Reviewer notes:
- **zoom out more** (current views 14 kb / 800 bp are too tight)
- **plot CpG islands / gene+TE annotation** for context (like the COLO829
  figures use `cpgisland_ucsc_hg38`)
- **"what is the point of these boundaries?"** — reconsider the gene→TE boundary
  framing
- **plot other Arabidopsis datasets; ideally a dense MULTISAMPLE quantitative
  track** (Salk epigenome browser style — "they do thousands of these studies").
  Aggregate methylation (MethylDackel bedGraphs → `MultiQuantitativeTrack`) is a
  natural fit; `md_CpG/CHG/CHH.bedGraph` already exist in
  `/media/cdiesh/Beezle/bis_work`. Sourcing many methylomes (1001 Epigenomes /
  GSE43857 / Salk) is the bigger lift.
- `methylation/arabidopsis_wgbs_contexts` is the strongest — "could replace all
  the other arabidopsis figures."

## Current committed state (don't redo)
- CRAM demo hosted `s3://jbrowse.org/bisulfite/arabidopsis_wgbs_bisulfite.cram`
  (340 KB, quality dropped — unused by coloring, SEQ/pos/CIGAR verified
  byte-identical to BAM) + `.crai` + `arabidopsis_chr1.fa(.fai)`.
- Config `test_data/arabidopsis_methylation/config_emseq_bisulfite.json`:
  `CramAdapter` `uri` shorthand, **no manual `sequenceAdapter`** (CoreGetRefNames
  injects the assembly's), default `colorBy:{type:'bisulfite'}` (CpG), opens
  `NC_003070.9:4,398,000-4,412,000`.
- Tutorial `website/docs/tutorials/bisulfite.md`; specs in
  `website/scripts/specs/methylation.ts` (`arabidopsis_wgbs_cpg/chg/chh` +
  `_contexts` compose + `_boundary` zoom). Figures rendered from CRAM.
- Commits: `36f45675a9` (tutorial+demo), `519cac652e` (drop redundant
  sequenceAdapter — another agent's sweep, included this config),
  `d61059b6a6` (regenerate figures from CRAM).

## Pipeline scratch (`/media/cdiesh/Beezle/bis_work`, 6.4 GB, disposable)
`aln.bam` (genome-wide), `R1/R2.fq.gz`, `tair10.fa`, bwameth index,
`md_{CpG,CHG,CHH}.bedGraph`, `find_region.py`, `run_align.sh`. Tools:
`MethylDackel/MethylDackel`, `bwm_venv/bin/python bwameth_real.py`. Safe to
delete once the coverage fix + figures are settled.

## Files to touch for the coverage fix
- `plugins/alignments/src/features/modCoverage/compute.ts` (height calc / add
  bisulfite branch)
- `plugins/alignments/src/shared/calculateModificationCounts.ts` (or bypass for
  bisulfite)
- `plugins/alignments/src/shared/runCoveragePipeline.ts` (thread bisulfite flag)
- likely a new arg from `executeRenderAlignmentData.ts` where `colorBy.type` is
  known
- add/extend a unit test alongside `runCoveragePipeline.test.ts` /
  `modCoverage` tests with a synthetic bisulfite position (e.g. 9 meth `C` + 1
  unmeth `T` on fwd, some rev reads → red height ≈ 0.9 of bar).

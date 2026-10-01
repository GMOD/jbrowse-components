---
name: sv-multihop
description: The measured COLO829/K562/HG008-T facts the cancer_sv and sv_visualization_cgiab tutorials rest on, the batch study behind removing the in-app reconstruction (ADR-137), and the line the feature does not cross. Read before touching those figures or proposing any in-app reconstruction.
audience: internal
kind: dataset
---

# Multi-hop SVs and the cancer_sv tutorial

The `cancer_sv` tutorial teaches multi-hop somatic rearrangements on COLO829: a
gene fusion formed by a chain of junctions, reconstructed as a derivative
allele and checked against the reads. K562 has only RNA, so it is the
`k562_fusions` tutorial off the same build script and spec file. The
`sv_multihop` script is gone
([ADR-140](../architecture-decision-records/adr-140-sv-analysis-is-not-ours-to-ship.md)):
chaining junctions belongs to LINX, Severus or gGnome, and assembling the allele
to an assembler. This file keeps the measured facts, which outlive it. Usable
and dead-end cell lines are in
[ideas/waiting-on-someone-else/figures-blocked-on-data.md](../ideas/waiting-on-someone-else/figures-blocked-on-data.md).

## What exists

| Path | What |
| --- | --- |
| `scripts/depmap_to_jbrowse.py` | DepMap Omics release to STAR-Fusion TSV / CN bedGraph |
| `scripts/build_cancer_sv_demo.sh` | end-to-end rebuild of the hosted demo |
| `website/scripts/upload-cancer-sv-demo.sh` | upload guard, `EXPECTED` manifest, `copy` not `sync` |
| `website/docs/tutorials/cancer_sv.md`, `k562_fusions.md` | the tutorials |
| `website/scripts/specs/cancer_sv.ts` | the figure specs for both |

`scripts/check-build-scripts.py` checks the python helpers. The der(3) contig is
a published artifact the build script fetches; nothing in the repo rebuilds it.

## Verified facts, do not re-derive

**COLO829 chain 1** is a closed 3-junction cycle joining RARB (chr3), BICC1
(chr10) and TRHDE (chr12) inside under a kilobase of derivative sequence:

```
derivative      0-32,732  +  chr3   25,326,821-25,359,568
derivative 32,732-32,931  +  chr10  58,717,463-58,717,662
derivative 32,932-33,115  -  chr12  72,273,111-72,273,294
derivative 33,126-39,549  -  chr3   25,352,683-25,359,111
```

Two chr3 arms in opposite orientations (a foldback) with 199 bp of chr10 and
183 bp of chr12 spliced in at the turn. The caller's breakend brackets, a de
novo consensus realigned back, and a breakend walk all give this structure, but
all read the same 2024 ONT molecules. **The independent confirmation is the
Valle-Inclan 2022 truth set** (Zenodo 4716169, hg38 liftover): `truthset_8`,
`_43` and `_7` are this chain's three junctions in these orientations, called
from Illumina and validated by capture. The chr9 fold-back's junctions are
`truthset_34`, and `_35` then `_36` on one molecule.

- 29 tumour reads span all three loci (longest 57,134 bp); 0 of 115 reads at the
  locus in the matched normal carry multi-hop alignments, which makes it
  somatic.
- Realigned to the derivative, 25 of the 29 have one alignment crossing all four
  junctions, which is agreement with a consensus those reads polished, not
  independent evidence. Depth reads ~43x left of contig 32,275 against ~19x
  right of it: a read whose return arm runs past the contig end aligns that arm
  onto the forward copy, so those bases count twice. Some reads also split at
  33,126, so "none clips at a junction" does not hold at whole-allele scale.

**K562** `BCR--ABL1` is called by DepMap STAR-Fusion (short-read RNA-seq) at
`chr22:23,290,413 -> chr9:130,854,064`, and an ENCODE Iso-Seq read splits at
exactly `chr9:130,854,064`. `NUP214--XKR3` (`chr9:131,199,015 ->
chr22:16,808,083`) is a second junction of the same amplicon, not the
reciprocal: its chr22 partner is 6.5 Mb from BCR. Measured off the hosted
`K562.10x-large-sv.vcf.gz` (lifted) and `K562_cn.bw`:

| junction | RNA junction (exon edge) | 10X DNA break | apart |
| --- | --- | --- | --- |
| BCR donor | chr22:23,290,413 (end of exon 14) | chr22:23,290,556 | 143 bp into intron 14 |
| ABL1 acceptor | chr9:130,854,064 (start of exon 2) | chr9:130,731,760 | 122 kb, in intron 1 |
| NUP214 donor | chr9:131,199,015 (end of exon 29) | chr9:131,199,198 | 183 bp into intron 29 |
| XKR3 acceptor | chr22:16,808,083 (start of exon 3) | chr22:16,819,350 | 11 kb, in intron 2 |
| (none) | no fusion call | chr9:131,280,138 <-> chr13:108,009,064 | no RefSeq gene at either end |

Chr9 copy number steps 1.0 -> 6.8 at 130,731,326, 6.8 -> 4.6 at 131,152,326 and
4.6 -> 0.9 at 131,280,326; chr22 16,386,068-16,820,068 sits at 3.9 and no segment
covers BCR. The ABL1 junction is in the 6.8 segment and the NUP214 junction in
the 4.6 one. `cancer_sv/k562_amplicon_dna` is the figure; Zhou et al. 2019
(Genome Research, 10.1101/gr.234948.118) is the linked-read paper behind the
ENCODE run.

**HG008-T** (C-GIAB, 116x PacBio HiFi) underlies the `sv_visualization_cgiab`
tutorial, over one breakend of the `cluster_3` chromoplexy:

- `SV_20` / `SV_190` are one junction written twice, chr3:139,976,414 to
  chr13:114,353,244, tagged `EVENTTYPE=CHROMOPLEXY`.
- 134 slice reads carry a chain. The top route, chr13 forward then chr3
  inverted, has 65 reads with both segment edges on the published breakends; the
  next has 10. The matched normal returns 51 reads and 0 with an SA tag.
- The hosted `HG008T_v3.2.pif.gz` puts both loci on one contig,
  `chr3_chr13_hap1`, abutting at 114,353,244 / 139,976,415 with the same
  orientation flip. The contig also carries chr3:139,998,693, `cluster_3`'s
  other junction, so the assembly resolves more of the event than the read
  slice.
- The demo slice (chr3:139,936,789-139,986,329, chr13:114,317,474-114,353,942)
  bounds what reads can reach; widening it means re-slicing the 118 GB NCBI BAM
  and re-uploading. The chr13 window ends at the q-terminus, so reads mismapped
  into other chromosomes' terminal repeats produce half a dozen false routes
  beneath the true junction. What is on screen sets what the reads can say.

## Breakend-walk traps

The breakend walk (`walkBreakendChain`, `nextJunctionFrom` in sv-core) uses only
the caller's BND records. A walk gives the segment order the caller implies;
reads give what the molecules carry, so run both. Over COLO829's VCF it returns
the same four segments as the read-derived reconstruction. Each trap below
returned a plausible wrong answer without an error.

- **ALT grammar.** A regex allowing at most one base around the bracket silently
  drops any BND with inserted sequence (VCF 4.5 section 5.4), 28 of COLO829's 66
  BND records, including the chr12 insert junction. Delegate to `@gmod/vcf`'s
  `parseBreakend`. `parseSvAlt` splits the mate locstring at the last colon,
  because HLA contigs (`HLA-A*01:01:01:01`) contain colons, and returns
  undefined for a non-numeric position.
- **Mate refName case.** All 66 COLO829 BND records write CHROM `chr3` and the
  ALT bracket `CHR3`. Anything grouping on the raw spelling splits a reciprocal
  pair. `getVariantJunctions` keys both ends through sv-core's `breakendLocKey`.
  Pairing by `MATEID` sidesteps it.
- **Direction of the no-backtrack guard.** Which end a hop arrived by is a fact
  about the hop, not the record. `nextJunctionFrom` anchors on the junction
  crossed (`arrivedFrom`), so a duplicate junction filed beyond
  `BREAKEND_COLOCATION_BP` from the stop does not turn the walk round.
- **Both directions.** The walk extends past the start record's mate end and its
  own end, forward first so `maxStops` is spent as before. A closed cycle hides a
  forward-only walk, and `walkBreakendChain.test.ts` needs a linear chain to
  catch it. `viaId` is the junction crossed to arrive at a stop.
- **The query must answer from both ends.** A tabix index knows one coordinate
  per record, and a BND interval is `start + REF.length` (`<TRA>` is excluded
  from the spanning branch in `plugins/variants/src/VcfFeature/util.ts`), so a
  chr1 record naming a chr2 mate is unreachable from a chr2 query.
  `makeFindJunctionsNear` cannot match on the mate coordinate, because that is a
  whole-callset scan over adapters of unknown size. Reciprocal BND pairs and
  adapters filing a row under both contigs (`BedpeAdapter`,
  `StarFusionAdapter`) supply the missing spelling; anything else ends the chain
  early. The SV inspector's `SpreadsheetModel.findJunctionsNear` reads the whole
  parsed `svJunctions` and matches either end.
- **Assembly ids break ambiguity.** Two junctions leaving one locus stop the
  walk, except when GRIDSS `BEID` or Esvee `ASMID` shows exactly one sharing a
  contig with the arrival junction (`Junction.assemblyIds`). Synthetic test
  only. LINX `links.tsv` chains and copy-number tiebreaks are parked in
  [ideas/waiting-on-a-call/linx-chains-in-the-breakend-walk.md](../ideas/waiting-on-a-call/linx-chains-in-the-breakend-walk.md).

## The removed picker's batch study

The in-app derivative-allele picker was removed
([ADR-137](../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)),
along with its harness `derivative_path_study.ts` (`git log --diff-filter=D
--oneline -- 'scripts/derivative_path*'` finds it). Numbers that outlive it,
over 215 junctions in two cancers on two chemistries:

- Recall is a step function of event size and replicates across datasets to
  within 5 points per bin: about 10% under 1 kb, 60-65% for 1-10 kb, 94-100%
  above 10 kb and interchromosomal (129 of 130). The size curve belongs to the
  aligner (minimap2/ngmlr) as much as to the code.
- Misses are the aligner's representation: 11 of COLO829's 12 and 39 of
  HG008-T's 46 are CIGAR deletions rather than split alignments, which nothing
  reading SA tags can reach. Seven HG008-T misses have reads and no in-read
  deletion and remain unexplained.
- Against the independent Valle-Inclan truth set (65 junctions) recall is 41,
  all rank 1 or 2, and 7 of the 8 misses above 10 kb or interchromosomal were
  Illumina-only calls. Quote this comparison, not the callset one.
- The matched normal recovers 0 somatic junctions but proposes routes at 40%
  (COLO829) and 4% (HG008-T) of windows, and random loci at 28% and 3%, so read
  count alone does not separate a route from noise.
- Window size and junction tolerance do not move recall. A support floor of 1
  buys 3 points of recall for a 12x increase in routes at event-free loci, so 2
  is the knee.
- Harness traps: lower-casing CHROM to fold mate case then fetching that
  spelling returned no reads; take control loci from the alignment file's own
  `@SQ` header. 116x HiFi SAM overflows node's string limit, so project to six
  fields in the pipeline.

## Reads on the allele: built, reverted, do not re-add

A lane placing each supporting read onto the derivative path
(`projectReadsOntoDerivative`) was built and reverted in `e7b4f2b29b`. It
composes the path's reference-to-allele map with each read's alignment. Three
things killed it, and they generalize, so ask them of anything new here:

1. **Can it be wrong in a way the picture shows?** The allele has no sequence,
   so no read's bases ever touched it.
2. **Is its evidence independent of what it checks?** The lane was fed the chains
   the candidate list was built from.
3. **Does it survive an aligner artifact honestly?** A mismapped read redrew as
   confident support.

A "no" to any of them means the thing belongs in `scripts/` or someone else's
program. The check it reached for exists outside the browser: `derive` polishes
spanning reads into a consensus and realigns them, shown as `reads_vs_der3`.
The two reads in the tutorial window that go chr3 to chr10 to chr3 place chr10 at
MAPQ 34 and 10 with no chr12 SA entry; they are an alignment miss, not a second
allele.

## The line this feature does not cross

**JBrowse shows what the reads and the callers literally say, and draws an
allele only when a tool outside it built one**
([ADR-137](../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)).
The in-app picker sat on the wrong side of that line: it proposed routes at
28-40% of ordinary ONT loci and took copy counts from where reads stopped.
Related tools for the jobs this leaves outside: Severus (somatic SV with
complex clusters, the cross-check for der(3)), LINX (junction ordering with
copy number), JaBbA/gGnome (junction-balanced graphs), RCK (haplotype-specific
karyotypes), hifiasm/Shasta (sequence of the allele), ReConPlot (the figure).
The tutorial's "Related tools" section is the reader-facing copy.

## Traps

- Keep large intermediates off the session scratchpad tmpfs (a `samtools sort`
  of a few GB wedged the sandbox); set `TMPDIR` to real disk.
- Port 3334 is exclusive to one screenshot run. Wait on it, never kill it.
- Verify CI checks (`check-spec-recipes --check`, `check-sidebar`,
  `check-config-blocks`) in a detached worktree at HEAD.
  `check-spec-recipes` flags any new spec field with no click-path in
  `src/lib/spec-recipe/fields.ts`.
- Rebuilding `products/jbrowse-web` picks up every agent's uncommitted source
  change, and any figure rendered afterwards bakes those in.

## Rebuilding

```bash
bash scripts/build_cancer_sv_demo.sh
bash website/scripts/upload-cancer-sv-demo.sh cancer_sv_build/demo
cd website && CANCER_SV_BASE=http://localhost:8099 pnpm screenshots --filter cancer_sv
```

`CANCER_SV_BASE` points the specs at a local `npx serve` of the build output so
figures render before the data is uploaded. Leave it unset to render against the
hosted demo, which a committed figure must match.

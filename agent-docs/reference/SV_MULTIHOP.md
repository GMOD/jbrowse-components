---
name: sv-multihop
description: The measured COLO829/K562/HG008-T facts the cancer_sv and sv_visualization_cgiab tutorials rest on, the batch study behind removing the in-app reconstruction (ADR-137), and the line the feature does not cross. Read before touching those figures or proposing any in-app reconstruction.
audience: internal
kind: dataset
---

# Multi-hop SVs and the cancer_sv tutorial

The `cancer_sv` tutorial teaches multi-hop somatic rearrangements on COLO829; K562
has only RNA, so it is the `k562_fusions` tutorial off the same build script
(`scripts/build_cancer_sv_demo.sh`) and spec file
(`website/scripts/specs/cancer_sv.ts`). The `sv_multihop` script is gone
([ADR-140](../architecture-decision-records/adr-140-sv-analysis-is-not-ours-to-ship.md)):
chaining junctions belongs to LINX, Severus or gGnome, and assembling the allele
to an assembler. This file keeps the measured facts, which outlive it. Usable and
dead-end cell lines are in
[ideas/waiting-on-someone-else/figures-blocked-on-data.md](../ideas/waiting-on-someone-else/figures-blocked-on-data.md).
The der(3) contig is a published artifact the build script fetches; nothing in
the repo rebuilds it.

## Verified facts, do not re-derive

**COLO829 chain 1** is a closed 3-junction cycle joining RARB (chr3), BICC1
(chr10) and TRHDE (chr12) inside under a kilobase of derivative sequence:

```
derivative      0-32,732  +  chr3   25,326,821-25,359,568
derivative 32,732-32,931  +  chr10  58,717,463-58,717,662
derivative 32,932-33,115  -  chr12  72,273,111-72,273,294
derivative 33,126-39,549  -  chr3   25,352,683-25,359,111
```

The caller's breakend brackets, a de novo consensus realigned back, and a
breakend walk all give this structure, but all read the same 2024 ONT molecules.
**The independent confirmation is the Valle-Inclan 2022 truth set** (Zenodo
4716169, hg38 liftover): `truthset_8`, `_43` and `_7` are this chain's three
junctions in these orientations. The chr9 fold-back's junctions are
`truthset_34`, and `_35` then `_36` on one molecule.

**K562** `BCR--ABL1` is called by DepMap STAR-Fusion (short-read RNA-seq) at
`chr22:23,290,413 -> chr9:130,854,064`, and an ENCODE Iso-Seq read splits at
exactly `chr9:130,854,064`. `NUP214--XKR3` (`chr9:131,199,015 ->
chr22:16,808,083`) is a second junction of the same amplicon, not the reciprocal:
its chr22 partner is 6.5 Mb from BCR. Measured off the hosted
`K562.10x-large-sv.vcf.gz` (lifted) and `K562_cn.bw`:

| junction | RNA junction (exon edge) | 10X DNA break | apart |
| --- | --- | --- | --- |
| BCR donor | chr22:23,290,413 (end of exon 14) | chr22:23,290,556 | 143 bp into intron 14 |
| ABL1 acceptor | chr9:130,854,064 (start of exon 2) | chr9:130,731,760 | 122 kb, in intron 1 |
| NUP214 donor | chr9:131,199,015 (end of exon 29) | chr9:131,199,198 | 183 bp into intron 29 |
| XKR3 acceptor | chr22:16,808,083 (start of exon 3) | chr22:16,819,350 | 11 kb, in intron 2 |

The ABL1 junction sits in the chr9 copy-number 6.8 segment and the NUP214
junction in the 4.6 one; no chr22 segment covers BCR. `cancer_sv/k562_amplicon_dna`
is the figure; Zhou et al. 2019 (Genome Research, 10.1101/gr.234948.118) is the
linked-read paper behind the ENCODE run.

**HG008-T** (C-GIAB, 116x PacBio HiFi) underlies the `sv_visualization_cgiab`
tutorial, over one breakend of the `cluster_3` chromoplexy:

- `SV_20` / `SV_190` are one junction written twice, chr3:139,976,414 to
  chr13:114,353,244, tagged `EVENTTYPE=CHROMOPLEXY`.
- The top read route, chr13 forward then chr3 inverted, has 65 reads with both
  segment edges on the published breakends; the matched normal returns 0 reads
  with an SA tag.
- The hosted `HG008T_v3.2.pif.gz` puts both loci on one contig,
  `chr3_chr13_hap1`, so the assembly resolves more of the event than the read
  slice.
- The demo slice bounds what reads can reach; widening it means re-slicing the
  118 GB NCBI BAM and re-uploading. The chr13 window ends at the q-terminus, so
  reads mismapped into other chromosomes' terminal repeats produce half a dozen
  false routes beneath the true junction.

## The removed picker's batch study

The in-app derivative-allele picker was removed
([ADR-137](../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)),
along with its harness `derivative_path_study.ts` (`git log --diff-filter=D
--oneline -- 'scripts/derivative_path*'` finds it). Numbers that outlive it, over
215 junctions in two cancers on two chemistries:

- Recall is a step function of event size and replicates across datasets: about
  10% under 1 kb, 60-65% for 1-10 kb, 94-100% above 10 kb and interchromosomal.
  The size curve belongs to the aligner as much as to the code.
- Misses are the aligner's representation: most are CIGAR deletions rather than
  split alignments, which nothing reading SA tags can reach.
- Against the independent Valle-Inclan truth set (65 junctions) recall is 41, and
  7 of the 8 misses above 10 kb or interchromosomal were Illumina-only calls.
  Quote this comparison, not the callset one.
- The matched normal recovers 0 somatic junctions but proposes routes at 40%
  (COLO829) and 4% (HG008-T) of windows, so read count alone does not separate a
  route from noise. A support floor of 1 buys 3 points of recall for a 12x
  increase in routes at event-free loci, so 2 is the knee.

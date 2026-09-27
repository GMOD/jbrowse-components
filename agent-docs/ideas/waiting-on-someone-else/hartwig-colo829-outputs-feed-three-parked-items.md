---
name: hartwig-colo829-outputs-feed-three-parked-items
description: A GRIDSS VCF with `BEID`, a LINX `links.tsv` and a PURPLE copy-number file for COLO829 would give the breakend walk's assembly-id tiebreak its first real test, the LINX route converter its input and the der(3) figure a copy-number lane, on the cell line the cancer_sv tutorial already uses. Hartwig runs COLO829 through GRIDSS, PURPLE and LINX as its benchmark. Whether those outputs are public is unconfirmed; the smoke-test scripts expect local BAMs and the HMF resources page carries reference data alone.
---

# Hartwig COLO829 outputs feed three parked items

Three parked pieces of SV work each wait on one input the same dataset would
supply, and the dataset is the tumor the `cancer_sv` tutorial already teaches.

| Parked item | What it needs | Where COLO829 supplies it |
| --- | --- | --- |
| `BEID`/`ASMID` tiebreak in `walkBreakendChain.ts`, synthetic test only | a GRIDSS or Esvee callset with assembly ids | GRIDSS on COLO829T is Hartwig's own benchmark run |
| [linx-chains-in-the-breakend-walk](../waiting-on-a-call/linx-chains-in-the-breakend-walk.md) and the LINX row of [route-as-a-launch-input](../ready/route-as-a-launch-input.md) | a `links.tsv` with ordered, oriented segments | LINX on the same run |
| a copy-number lane under the der(3) figure | segmented copy number with integer calls | PURPLE's `purple.cnv.somatic.tsv` |

Agreement between LINX's chain and the reads-derived der(3) would be a fourth
independent derivation of that allele, on top of the three
[reference/SV_MULTIHOP.md](../../reference/SV_MULTIHOP.md) records, and the
first from short reads with copy number in the loop.

## What is known

- Hartwig sequenced COLO829T and COLO829BL three times each to 100x and 40x
  against GRCh37, and GRIDSS2's paper benchmarks on it.
- The public `gridss-purple-linx` smoke test expects `COLO829T_smoke.bam` and
  `COLO829R_smoke.bam` on a local volume and fetches nothing.
- The HMF resources page distributes the pipeline's reference files, not
  sample outputs.
- The Valle-Inclán 2022 truth set (Zenodo 4716169) is the COLO829 callset
  already in use here; it carries junctions, no assembly ids and no chains.

## What it waits on

Confirmation that the GRIDSS, LINX and PURPLE outputs for COLO829 are
downloadable without a data-access agreement, from the GRIDSS2 paper's
supplementary data, the hmftools repository's example data or HMF directly. If
they are GRCh37 only, the split view and the figure need a liftover of the
callset, which `lift_bnd_vcf.py` already does for K562's BND records.

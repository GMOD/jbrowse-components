---
name: dog10k-datasets
description: Which Dog10K callset, assembly and copy-number route does a tutorial figure need, and which figures were deliberately not built? Read before adding a Dog10K locus or figure.
audience: internal
kind: dataset
---

# Dog10K: callsets, loci and traps

The `local_ancestry`, `dog10k_svs`, `dog10k_lof` and `dog10k_selection` tutorials
rest on `test_data/dog10k/config.json`, remote slicing, and a breed-labeled
`layout`. Each figure has a `scripts/build_dog10k_*.sh` recipe; point an existing
one at a new locus. Editorial rules: `website/CLAUDE.md`.

## Assembly and callsets

Everything here is **canFam4 = UU_Cfam_GSD_1.0**. The wider dog literature (genetic
maps, most GWAS, dbSNP rsIDs) is still largely canFam3.1, so **treat any dog
coordinate from a paper as canFam3.1 until proven otherwise.**

- **Manta SV aggregate**
  (`kiddlabshare/dog10K/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz`):
  the only callset carrying DUP and INV. Use it for structural loci.
- **Zenodo 8084059**: the Paragraph SV set (no DUP/INV), small variants and the
  phased imputation panel. No copy number.
- **Kidd lab bigBeds** (`github.com/KiddLab/dog-long-read-sv`): Ohana selection
  output and two SV sets, bed9 with no names or scores. An overlay under a
  computed track, not a substitute.

**Take counts from the build script's output, not from prose.** Which category the
sample table files an animal under moves the numbers.

## Traps

- **There is no `dog10k-cyp1a2-copy-number` figure.** The 15-CRAM read-depth track
  (`dog10k_cyp1a2_cn`) survives as validation of the callset-`DP` route, since
  which dogs have CRAMs is an accident of the share. `specs/dog10k.ts` says the
  same.
- **There is no DENR figure; don't rebuild it.** Two ~220 bp SINE records
  genotyped across a few dozen animals is a table: drawn at true span they are two
  thin stripes, and the matrix display widens them into what reads as multi-kb
  deletions.
- **Don't read AMY2B as the Arctic low-copy result.** The genotype is
  presence/absence, not copies, and the Greenland Dogs split while every Malamute
  and Samoyed carries it.
- **Per-sample copy number comes from callset `DP`** normalized against each dog's
  flanks. QuicK-mer2 estimates are unreleased and the fastCN reference is
  canFam3.1 only. The 15 range-requestable CRAMs in `cram-share/` (`CN = 2 * depth
  / cov`, column 14 of the sample table) hold no wolves and no GBGV, so SLC28A3
  needs the callset route.
- **phyloP on canFam4** is a ~13 GB gzipped whole-file bigWig on Zenodo 8084059:
  download, decompress, slice. UCSC has no canFam4 conservation track.

## Verified loci not yet shot

Both are the `build_dog10k_nhej1_sv.sh` recipe over the Manta callset:

- **Ridgeback duplication**, chr18:48,828,545-48,962,003: every Rhodesian and Thai
  Ridgeback, plus the three African village dogs the paper names (VILLCG000006,
  VILLKE000001, VILLLR000017), and one Schipperke.
- **SLC28A3 duplication**, chr1:75,578,115: Fig 11 as genotypes, concentrated in
  GBGV and PBGV.

## Gotchas

- `layout` HP indices are **0-based** (`<sample> HP0`/`HP1`, see
  `makeHaplotypeSources`). Using 1/2 renders every second row empty.
- `LinearMultiRowFeatureDisplay` reads no filters, so `filterSetting` and `filter`
  do nothing.
- `flare_anc_to_bed.py` keys its palette on the ancestry **name**, not FLARE's
  code, which is not stable between runs and once swapped wolf and dog colors.
- A local-ancestry reference panel must include the targets' own background: a
  panel without shepherds put spurious wolf ancestry on the German Shepherd
  control.
- Zenodo serves a file and its index from separate `/content` URLs, so remote
  slicing needs `bcftools view … "$DATA##idx##$INDEX"`.

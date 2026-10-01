---
name: dog10k-datasets
description: The Dog10K callsets, loci and recipes behind the local-ancestry, SV and LoF tutorials — the assembly, which VCF carries DUP/INV, per-sample copy number from the hosted CRAMs. Read before adding a Dog10K locus or figure.
audience: internal
kind: dataset
---

# Dog10K: callsets, loci and measured recipes

What the `local_ancestry`, `dog10k_svs`, `dog10k_lof` and `dog10k_selection`
tutorials rest on: `test_data/dog10k/config.json`, remote slicing, and a
breed-labeled `layout`. Each figure has a `scripts/build_dog10k_*.sh` recipe;
point an existing one at a new locus. Tutorial ideas live in
[ideas/collections/tutorial-ideas-audit.md](../ideas/collections/tutorial-ideas-audit.md);
editorial rules in `website/CLAUDE.md`.

## Which dog assembly

Everything here is **canFam4 = UU_Cfam_GSD_1.0**: the config, its
`chrom.sizes`, the `test_data/cfam2` demo, all three Dog10K callsets, and the
hosted UCSC gene track. The wider dog literature (genetic maps, most GWAS,
dbSNP rsIDs) is still largely canFam3.1, which is why the local-ancestry
tutorial generates its own uniform map and the CYP1A2 recipe derives the stop
codon by translating the reference CDS. **Treat any dog coordinate from a paper
as canFam3.1 until proven otherwise.**

## The callsets

- **Manta SV aggregate**,
  `kiddlabshare/dog10K/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz`:
  ~1 GB, all samples, and the only callset carrying DUP and INV. Use it for
  structural loci.
- **Zenodo 8084059**: the Paragraph SV set (~6 GB, no DUP/INV), small variants
  and the phased imputation panel. No copy number.
- **Kidd lab bigBeds** (`github.com/KiddLab/dog-long-read-sv`): the authors'
  Ohana selection output and two SV sets, bed9 with no names or scores — an
  overlay under a computed track, not a substitute.

**Take counts from the build script's output, not from prose.** Which category
the sample table files an animal under moves the numbers.

## What ships, and what deliberately does not

- `local_ancestry.md` — wolfdogs painted by FLARE
  (`build_dog10k_wolfdog_ancestry.sh`), chr1 only. It carries a negative
  control (German Shepherd), a positive control (gray wolves held out of the
  panel) and a breed sweep.
- `dog10k_svs.md` — the Collie eye anomaly deletion
  (`build_dog10k_nhej1_sv.sh`); the diet genes AMY2B and RNASE1 as one composed
  figure sliced from both callsets in the same sample order
  (`build_dog10k_amy2b_sv.sh`); SLC28A3 copy number from per-sample `DP`
  normalized against each dog's flanks (`build_dog10k_slc28a3_cn.sh`).
- `dog10k_lof.md` — CYP1A2 p.Arg373Ter (`build_dog10k_cyp1a2.sh`), with Fig 10a
  as `dog10k-cyp1a2-cohort-copy-number` from callset `DP`
  (`build_dog10k_cyp1a2_cn.sh`).
- `dog10k_selection.md` — per-clade AF and Fst over the phased panel, written
  as bgzipped BED for `GWASAdapter` + `LinearManhattanDisplay`, with the Ohana
  bigBed as a validation row.

Traps:

- **There is no `dog10k-cyp1a2-copy-number` figure.** The 15-CRAM read-depth
  track (`dog10k_cyp1a2_cn`) is still in the config and the script still writes
  it, but which dogs have CRAMs is an accident of the share; it survives as
  validation of the callset-`DP` route. `specs/dog10k.ts` says the same.
- **There is no DENR figure; don't rebuild it.** `build_dog10k_nhej1_sv.sh`
  still writes the slice and the config still declares the tracks. Two
  ~220 bp SINE records genotyped across a few dozen animals is a table, not a
  picture: drawn at true span they are two thin stripes, and the matrix display
  widens them into what reads as multi-kb deletions.
- **Don't read AMY2B as the Arctic low-copy result.** The genotype is
  presence/absence, not copies, and the Greenland Dogs split while every
  Malamute and Samoyed carries it.

## Verified loci not yet shot

Both are the `build_dog10k_nhej1_sv.sh` recipe over the Manta callset:

- **Ridgeback duplication**, chr18:48,828,545-48,962,003 (133 kb): every
  Rhodesian and Thai Ridgeback, plus exactly the three African village dogs the
  paper names (VILLCG000006, VILLKE000001, VILLLR000017), and one Schipperke.
- **SLC28A3 duplication**, chr1:75,578,115 (136 kb): Fig 11 as genotypes,
  concentrated in GBGV and PBGV.

## Per-sample copy number at a locus

The published QuicK-mer2 estimates are not released, the fastCN reference is
canFam3.1 only, and the full collection's reads are not on the share, so
cohort-wide CN is out of reach. A locus profile needs none of that:

- `cram-share/` holds 15 range-requestable CRAMs with `.crai`. The `@SQ` lines
  carry M5, so `REF_PATH=https://www.ebi.ac.uk/ena/cram/md5/%s` fetches only
  the chromosome touched (`REF_CACHE` keeps it).
- Column 14 of the sample table is `effectiveAutosomalMeanCoverage`, so
  `CN = 2 * depth / cov` after `samtools depth -r <locus>`, binned.

It is plain depth, without QuicK-mer2's GC correction or SUNK mappability
(`callable-genome-mask/` on the share could supply a mask). The 15 samples are
Chihuahua, Bourbonnais Pointing Dog, English Springer Spaniel, one Greenland
Dog and one Azerbaijan village dog — no wolves and no GBGV, so SLC28A3 needs the
callset-`DP` route. Column 5 of the sample table carries SRA runs for a
read-level panel, at tens of GB of fastq per sample.

**phyloP on canFam4** is Zenodo 8084059's lifted Zoonomia bigWig, gzipped
whole (~13 GB), so it cannot be range-requested: download, decompress, slice
the locus. UCSC has no canFam4 conservation track.

## Gotchas

- `layout` HP indices are **0-based** (`<sample> HP0`/`HP1`, see
  `makeHaplotypeSources`). Using 1/2 renders every second row empty.
- `LinearMultiRowFeatureDisplay` reads no filters, so `filterSetting` and
  `filter` do nothing. A figure wanting a subset of painted rows needs a
  different track.
- `flare_anc_to_bed.py` keys its palette on the ancestry **name**, not FLARE's
  code, which is not stable between runs and once swapped wolf and dog colors.
- A local-ancestry reference panel must include the targets' own background:
  a truncated dog panel without shepherds put spurious wolf ancestry on the
  German Shepherd control.
- Zenodo serves a file and its index from separate `/content` URLs, so remote
  slicing needs `bcftools view … "$DATA##idx##$INDEX"`.

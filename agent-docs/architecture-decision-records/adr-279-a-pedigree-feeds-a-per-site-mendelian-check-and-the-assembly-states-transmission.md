---
status: Accepted
summary: "A VCF adapter's `pedigreeLocation` gives samples family, parent and sex attributes; the worker classifies each site's trios into a `mendelian` field by one gamete-partition rule, lenient where biology varies; the assembly's `transmission` slot, default `[]`, states sex chromosomes and organelles"
---

# ADR-279: A pedigree feeds a per-site Mendelian check, and the assembly states transmission

## Status

Accepted (2026-11-20). Built from trio-plan v3 after four reviews (design fit,
mechanism and genetics, product scope, a cold read). Colin asked that the
genetics hold across taxa, not only for diploid XY humans.

## Context

The variant display had no pedigree. A samples TSV could hold `father` and
`mother` columns, but nothing read them, so a trio VCF showed three unrelated
rows. The ask was a per-site check that colors, filters and tooltips, presented
as callset QC: genotype quality is not read (GQ masking is unbuilt), so a
de novo review is out of scope. JBrowse serves plant, insect, fungal and other
genomes, and a rule right for a diploid XY human gives false calls on a
tetraploid, a haplodiploid male, a ZW female or a yeast mitochondrion.

## Decision

### The pedigree

- **A separate adapter slot, `pedigreeLocation`**, on `VcfTabixAdapter`,
  `VcfAdapter` and `SplitVcfTabixAdapter`
  (`plugins/variants/src/shared/pedigree.ts`), read in
  `vcfSourcesAndWarnings`. It merges `family`, `father`, `mother`, `sex` and
  `phenotype` into the sources, and a `samplesTsvLocation` column of the same
  name wins with no warning.
- **The format is detected from the columns**, never the extension: a first
  row naming `SampleID` or `IID` is a header and columns are taken by name
  (`FatherID`/`PAT`, `MotherID`/`MAT`, `FamilyID`/`FID`, `Sex`,
  `Phenotype`/`PHENO`, any case); otherwise the file is headerless PLINK and
  the first six columns are read. 1000 Genomes'
  `20130606_g1k_3202_samples_ped_population.txt` loads verbatim, and its
  `Population` column stays the samples table's job.
- **Codes:** parent `0` is unknown; sex `1` male, `2` female, `0`/`-9`
  missing, anything else `other` (a hermaphrodite, a monoecious plant). An
  IID matching no VCF sample is tried as `FID_IID`, PLINK's `--recode vcf`
  name. A sample naming itself as a parent loses that parent with a warning;
  father equal to mother is a selfed line and stays.
- **The pedigree never narrows the samples.** Its rows naming no VCF sample are
  skipped, and a pedigree matching none warns where `samplesTsv` throws.
- **No reserved names.** The attributes are ordinary row attributes;
  `HAPLOTYPE_ROW_FIELDS` already strips its own, and existing tables have `sex`
  and `phenotype`.
- **No data-driven defaults.** A pedigree sets no facet, sort or color.
  `facet.field: ''` already means no sections, so a default resolved from the
  data could not be switched off across a reload; ADR-265 gives the multi-row
  display a declared default with no effective-field getter for the same
  reason. Family banding is
  `facet: 'family'` written by the config, and rows keep the file's order. No
  `role` attribute: one value cannot hold a sample that is both child and
  parent (NA12878 in family 1463).

### The check

- **`mendelian` takes `notInParents`, `inconsistent` or `consistent`**, and a
  site with nothing to say is `undefined`. With several trios the site takes
  the most severe (`mostSevereTrioClass`).
- **One pure classifier, `classifyTrio`** (`shared/classifyTrio.ts`), over
  genotype strings, the child's sex and the contig's rule. Phase is ignored.
  It chooses a mode, first match wins: a transmission entry; Union, when the
  child's ploidy is below the number of parents in the cross (a spore, a
  hemizygous call with no entry), each allele in some parent; Regular, each
  parent giving ⌈p/2⌉ or ⌊p/2⌋ alleles (1 + 1, 2 + 2, 1 + 2 for a 2x × 4x
  triploid), a haploid parent 1; Irregular, any split of 1..p per parent, for
  aneuploidy and unreduced gametes. That is the general gamete-partition rule:
  one procedure for every ploidy, with no table per case.
- **Lenient over false errors.** A gamete is drawn from the parent's allele
  set, so double reduction passes. `inconsistent` is never reported under
  Union, Irregular or `from: either`. A duo the known parent cannot settle is
  `undefined`. A sex entry judges only haploid or homozygous calls, so a het
  falls through to the autosomal rule; with sex missing both readings run and a
  disagreement is `undefined`. The cost is under-flagging, documented in the
  user guide (a PAR homozygote, polyploid dosage miscalls).
- **Classification runs in the worker on interned codes.** The display sends
  the trios (`triosOf`, child, parents and sex by sample name) and each
  region's resolved rule as RPC arguments, both in the fetch key.
  `makeMendelianCheck` maps trios to canonical columns through `sampleNames`,
  so split-file headers remap as genotypes do, and memoizes per (rule, sex,
  code triple), so a site costs a lookup per trio and no second genotype scan.
  Genotypes are read whenever trios are sent, rows drawn or not.
- **Readers special-case the field.** `MENDELIAN_FIELD` sits beside
  `PHASE_SET_FIELD`: the hue read, the records facet and the tooltip reads take
  the value from the fetch's `mendelian` map, and a `filter` entry on it is a
  third predicate group, tested beside the site filter in `analyzeVariants`
  rather than in `SITE_FILTER_FIELDS`, whose compiler reads missingness for
  any field but MAF. The worker ships the value and the main thread paints it
  (ADR-203), with a fixed preset in `UNIVERSAL_FIELD_PRESETS`.
- **The `mendelian` field has no `jexl:` function** and is not in the filter
  dialog's picker: it is a `filter` entry and a **Color by** preset. No record
  holds it, so a jexl reader over the feature would find nothing.
- **The feature widget alone re-runs `classifyTrio`**, over the full record it
  fetches, to list each trio's call (`TrioCallsTable`).

### Transmission

- **An assembly slot, `transmission`**, beside `geneticCodes` and
  `circularRefNames`, a list of `{ refName?, sex?, from }` with `from` one of
  `mother`, `father`, `either`. A missing `refName` is every contig
  (haplodiploidy), a missing `sex` every child (organelles). There is no display
  override, since the assembly states it once for every track on it.
- **Default `[]`, with no name matching.** sacCer3's `chrX` is chromosome 10
  and _Bombyx_'s Z is `1`, so the slot reads no meaning into a name. The hosted
  assemblies write their own entries (hg38 and hg19: chrX male from mother,
  chrY male from father, chrM either).
- **Resolved on the main thread.** `transmissionEntriesFor` matches entries
  through refName aliasing; `regionTransmission` sends one rule per region,
  and the worker keys them by the renamed `regions[i].refName` its features
  carry.

## Consequences

- With no entry, a diploid-coded male X or a mitochondrial call can read
  falsely `inconsistent`; the docs name the entry to write.
- On the `feature.get('genotypes')` fallback, codes are interned after the
  site loop, so the field stays `undefined` there.
- Reading genotypes with no rows drawn makes `samplePloidy` and
  `hasPhasedOrHaploid` cover samples that draw nothing.
- On a large cohort the site value is the worst trio's, so it flags any site
  one trio fails; per-child cell marking is parked
  (`ideas/waiting-on-a-call/per-child-mendelian-cell-marking.md`).

## Rejected alternatives

- **Reading the pedigree through `samplesTsv`.** A PLINK `.fam` has no header
  and a different column order, `samplesTsv` narrows the samples and throws on
  no match, and its first column must be the VCF name; a pedigree must load
  verbatim and never drop a sample.
- **Answering from `VcfFeature.get`.** The main thread holds simplified
  features (`analyzeVariants`), and split headers make an index attached to the
  feature unsafe, so the worker that holds the codes computes the value.
- **A diploid XY truth table.** It is wrong for tetraploids, triploids,
  haploids, haplodiploid males, ZW females and organelles; the gamete-partition
  rule covers each with one procedure.
- **Name-matched defaults** (`chrX` means X). sacCer3's `chrX` is an
  autosome, so the default would report false errors on yeast.
- **Parent-of-origin coloring per haplotype cell.** On trio-phased data HP1 is
  paternal by construction (KHV: 82,679 vs 1,030 informative sites), so it
  cannot show crossovers, and it needs a per-cell path; parked
  (`ideas/waiting-on-a-call/parent-of-origin-haplotype-coloring.md`).

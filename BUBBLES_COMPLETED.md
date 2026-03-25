# Bubbles — completed work

## Rust tool

`--bubbles <vcf>` flag reads VCF from `vg deconstruct`, computes CS between
allele pairs, outputs `bubbles.bed.gz` + `.tbi`. Tested on chrM (544 records,
7KB).

## Standalone TS script

`scripts/vcf-to-bubbles.ts` reads VCF.gz, computes text CS between allele
pairs, outputs same BED format. No GFA needed. Includes limits for huge SVs
(MAX_ALLELE_LEN=10K, MAX_PAIRS_PER_SITE=500).

## TypeScript runtime

`bubblesLocation`/`bubblesIndex` config added to both adapter schemas.
`annotateFeaturesWithBubbleCs()` queries bubbles at zoom-in (bpPerPx < 50),
finds genome alleles, attaches CS to features.

## Cleanup

All binary aln code removed (binaryAlnReader.ts, binaryCs.ts, alnBin config).
All text aln code removed (getMultiPairFeaturesFromAln, alnFile, alnLocation
config). Bubbles is the only approach.

## chr20 VCF generated

`vg deconstruct -p "GRCh38#0#chr20" -a chr20.gfa` produced 32MB compressed VCF
at `test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.vcf.gz`
(already tabix indexed).

## chr20 bubbles generated

77MB compressed, 1.2M records. Generated via `scripts/vcf-to-bubbles.ts` with
sort+bgzip+tabix. The huge SV at chr20:14.7M (84KB ref, 87 alt alleles = 3828
pairs) was handled by the size/pair limits.

## Bubble CS annotation refactored

`annotateFeaturesWithBubbleCs` now:

- Sorts bubbles by position before CS assembly
- Uses locus lookup map instead of O(n²) scanning
- Deduplicates overlapping loci
- Handles non-ref-centric views (resolves view ref assembly allele per-locus)
- Tries both original and remapped genome names

## Browser tested (chrM)

chrM loaded in JBrowse with bubbles config
(`test_data/config_hprc_chrM_local.json`). At bpPerPx < 50, SNPs render as
colored marks at variant positions across all 43 genomes. The
`annotateFeaturesWithBubbleCs` code path works end-to-end.

## GfaTabixAdapter assemblyNameMap fix

`resolveTabixRefName` now tries reverse-mapped original names from
`assemblyNameMap` (e.g. assembly `volvox` → original `volvox#0` → tries
`volvox#0#ctgA`). This enables GfaTabixAdapter to work when assembly names
differ from GFA genome names.

## Volvox GfaTabix test data & browser e2e tests

- Created `volvox_del_synteny.gfa` from minimap2 alignment of volvox vs
  volvox_del (4 segments, 2 genomes, deletion at 28498-33358)
- Processed through gfa-to-tabix → pos.bed.gz, segments.bin, segments.idx
- Added `volvox_del_gfa_multi` MultiSyntenyTrack to `test_data/volvox/config.json`
- 4 browser e2e tests: canvas + fullpage screenshots from both volvox and
  volvox_del perspectives
- Helper scripts: `scripts/paf-to-gfa.ts` (PAF→GFA converter)

## 50-sample volvox pangenome

`scripts/generate-volvox-pangenome.ts` generates a synthetic 50-sample pangenome
on volvox ctgA (50001bp). Seeded RNG for deterministic output. Produces:

- Variant pool: ~396 sites (357 SNPs, 32 indels, 7 SVs including inversions)
- Variants drawn from shared pool with allele frequencies → realistic sharing
- Segment-decomposed GFA with W lines for ref + 50 samples (1183 segments)
- Bubbles BED with CS strings computed directly from known variant alleles

Generated files in `test_data/volvox/`:
- `volvox_pangenome_50.gfa` (249K)
- `volvox_pangenome_50.pos.bed.gz` + `.tbi` (21K)
- `volvox_pangenome_50.segments.bin` (588K) + `.idx` (9.3K)
- `volvox_pangenome_50.bubbles.bed.gz` + `.tbi` (19K, 390 records)

Config: `test_data/config_volvox_pangenome_50.json` with GfaTabixAdapter + bubbles.

Browser e2e tests in `suites/multi-lgv-pangenome-50.ts`:
- Full genome canvas + page snapshots (50 genome rows)
- Zoomed-in view (ctgA:100-300) to exercise bubble CS rendering

## Plan

`SNARLS_PLAN.md` committed.

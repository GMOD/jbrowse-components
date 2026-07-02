# 1000 Genomes chr1 slice, real SnpEff consequence annotations

Real human variant calls with real SnpEff-predicted consequences, for the
multi-sample variant "color cells by consequence impact" feature
(`plugins/variants`, `jexl:impactColor(feature)`). Unlike the volvox demo data
(synthetic `ANN` values injected by `test_data/volvox/annotate_variants.mjs`),
every annotation here comes from actually running SnpEff on real genotypes — no
hand-crafted impact tiers.

## Source

- Genotypes: 1000 Genomes phase 3 chr1, `1:155,000,000-155,050,000`
  (hg19/GRCh37), 2,504 real samples, fetched by tabix range query — no
  full-chromosome download needed:
  `https://ftp-trace.ncbi.nlm.nih.gov/1000genomes/ftp/release/20130502/ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz`
- This locus (DCST2/DCST1/ADAM15 on 1q21.3) is the same one already used by the
  `variants/population_1000genomes` screenshot spec, and has several real
  stop-gained/splice-site variants alongside missense/synonymous/intronic ones —
  a natural spread across all four impact tiers.

## Annotation

Annotated with real SnpEff 5.4c (bioconda `snpeff-5.4.0c-hdfd78af_0`) against
the real Ensembl GRCh37.75 database (not a synthetic/test database):

```sh
# 1. grab the SnpEff jar (bioconda package, unpacked without needing conda itself)
curl -sL -o snpeff.conda "https://conda.anaconda.org/bioconda/noarch/snpeff-5.4.0c-hdfd78af_0.conda"
unzip -o snpeff.conda -d extracted
zstd -d extracted/pkg-snpeff-5.4.0c-hdfd78af_0.tar.zst -o pkg.tar
tar -xf pkg.tar -C pkg   # -> pkg/share/snpeff-5.4.0c-0/snpEff.jar

# 2. real GRCh37.75 database (whole-genome predictor; ~560MB, only v5_0 build is hosted)
curl -sL -o GRCh37.75.zip "https://snpeff-public.s3.amazonaws.com/databases/v5_0/snpEff_v5_0_GRCh37.75.zip"
unzip -q GRCh37.75.zip -d data && mv data/data/GRCh37.75 flatdata/

# 3. real genotypes, range-fetched (no full-chromosome download)
tabix -h \
  https://ftp-trace.ncbi.nlm.nih.gov/1000genomes/ftp/release/20130502/ALL.chr1.phase3_shapeit2_mvncall_integrated_v5a.20130502.genotypes.vcf.gz \
  1:155000000-155050000 > slice.vcf

# 4. real annotation run (2 structural-variant <CN2> records are skipped by
#    SnpEff with a warning — every SNV/indel record gets a real ANN)
java -Xmx4g -jar pkg/share/snpeff-5.4.0c-0/snpEff.jar ann \
  -dataDir "$(pwd)/flatdata" -noStats GRCh37.75 slice.vcf > annotated.vcf

bgzip -c annotated.vcf > ALL.chr1.phase3.155M.snpeff.vcf.gz
tabix -p vcf ALL.chr1.phase3.155M.snpeff.vcf.gz
```

Impact tally across the slice's 1,340 annotated records (each with several
transcript-level ANN entries): 44 HIGH, 744 MODERATE, 532 LOW, 22,738 MODIFIER.

## Demo track

`test_data/config_demo.json` → `1000g_chr1_snpeff_consequence` (hg19,
`LinearMultiSampleVariantDisplay`, `featureColor: jexl:impactColor(feature)`).
Screenshot spec: `variants/consequence_impact_1000g` in
`website/scripts/screenshot-specs.ts`.

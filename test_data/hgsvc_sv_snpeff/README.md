# HGSVC chr1 structural variants, real SnpEff consequence annotations

Real human structural variants (deletions/insertions from long-read phased
assemblies) with real SnpEff-predicted consequences — the SV analog of
`test_data/1000g_snpeff_chr1` (which does SNVs). Same feature under test:
`plugins/variants` multi-sample "color cells by consequence impact"
(`jexl:impactColor(feature)`), but exercising SnpEff's SV-specific consequence
terms (`exon_loss_variant`, `transcript_ablation`, `frameshift_variant`,
`gene_fusion`) instead of the SNV ones.

## Source

Real multi-sample (74 real HGSVC sample/haplotype columns, real `GT` phased
calls) structural variant catalog from the Human Genome Structural Variation
Consortium, GRCh38 coordinates:
`https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/HGSVC3/release/Variant_Calls/1.0/GRCh38/variants_GRCh38_sv_insdel_sym_HGSVC2024v1.0.vcf.gz`
(already referenced elsewhere in `config_demo.json` under the same
`['1000 Genomes', 'HGSVC']` category, undated 6.4MB, whole file downloaded then
sliced to chr1 — small enough not to need range-fetching).

Only whole chr1 is kept here (12,530 records, 1.2MB compressed) — SnpEff needs a
real annotation pass over the file, and shipping the whole chromosome (rather
than a hand-picked window) leaves room to explore other loci later.

Note: the _other_ real 1000 Genomes SV callset already in this repo
(`ALL.wgs.mergedSV.v8.20130502.svs.genotypes.GRCh38.vcf`, phase 3 "integrated SV
map") turned out to be unusable for this — it's almost entirely encoded with the
old `<CN0>/<CN2>/<CN3>...` copy-number symbolic-allele notation, which SnpEff
5.4c doesn't parse (`Unsupported structural variant type '<CN2>'`). HGSVC uses
the standard `<DEL>`/`<INS>` + `SVTYPE=` notation SnpEff expects, so it was used
instead.

## Annotation

Real SnpEff 5.4c (bioconda `snpeff-5.4.0c-hdfd78af_0`) against the real Ensembl
GRCh38.99 database — see `test_data/1000g_snpeff_chr1/README.md` for the
SnpEff-jar-via-bioconda setup, identical here except the database:

```sh
curl -sL -o GRCh38.99.zip "https://snpeff-public.s3.amazonaws.com/databases/v5_0/snpEff_v5_0_GRCh38.99.zip"
unzip -q GRCh38.99.zip -d data38 && mv data38/data/GRCh38.99 flatdata38/

curl -sL -o hgsvc_sv.vcf.gz "https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/HGSVC3/release/Variant_Calls/1.0/GRCh38/variants_GRCh38_sv_insdel_sym_HGSVC2024v1.0.vcf.gz"
tabix -p vcf hgsvc_sv.vcf.gz
tabix -h hgsvc_sv.vcf.gz chr1 > chr1_sv.vcf

java -Xmx4g -jar snpEff.jar ann -dataDir "$(pwd)/flatdata38" -noStats GRCh38.99 chr1_sv.vcf > chr1_sv_annotated.vcf

bgzip -c chr1_sv_annotated.vcf > HGSVC2024v1.0_GRCh38_sv_chr1.snpeff.vcf.gz
tabix -p vcf HGSVC2024v1.0_GRCh38_sv_chr1.snpeff.vcf.gz
```

Every one of the 12,530 chr1 records got a real `ANN` (no parse failures, unlike
the `<CN2>` case above). Impact tally: 2,420 HIGH, 5 MODERATE, 71 LOW, 53,034
MODIFIER (across all transcript-level ANN entries per record).

## A real, biologically-expected hotspot

`chr1:145,250,000-145,450,000` is almost entirely HIGH-impact
(`exon_loss_variant`/`frameshift_variant`) hits in **NBPF20** — a member of the
NBPF (neuroblastoma breakpoint family) gene cluster, one of the most
well-documented structural-variation hotspots in the human genome (segmental
duplications prone to recurrent deletion/insertion). This wasn't cherry-picked
biology — it's exactly the kind of locus a real SV+consequence pipeline is
expected to flag.

## Demo track

`test_data/config_demo.json` → `hgsvc_sv_chr1_snpeff_consequence` (hg38,
`LinearMultiSampleVariantDisplay`, `featureColor: jexl:impactColor(feature)`).
Screenshot spec: `variants/consequence_impact_sv` in
`website/scripts/screenshot-specs.ts`.

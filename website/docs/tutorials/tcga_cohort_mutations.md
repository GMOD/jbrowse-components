---
title: Mutation cohort (TCGA)
description:
  Read somatic point mutations across a thousand tumors as a genotype matrix,
  grouped by clinical annotation
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** turn a TCGA project's open-access somatic MAFs into one multi-sample
VCF and open it as a `LinearMultiSampleVariantMatrixDisplay`, so each distinct
mutation is a column, each tumor is a row, and the rows group by whichever
clinical column you point `groupBy` at.

## Prerequisites

- A JBrowse 2 instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web)) and the [JBrowse CLI](/docs/cli)
- Both files, hosted:

| File                                                        | What                                  |
| ----------------------------------------------------------- | ------------------------------------- |
| `https://jbrowse.org/demos/tcga/tcga_brca_mutations.vcf.gz` | the cohort's somatic mutations        |
| `https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv`     | per-tumor histology, receptors, stage |

## What the two files hold

The VCF is the GDC's per-tumor **Masked Somatic Mutation** calls merged into one
multi-sample file, one column per tumor:

```
#CHROM POS       ID  REF ALT  INFO                          FORMAT    TCGA-A2-A0T2-01A  TCGA-A8-A07C-01A
chr3   179234297 .   A   G    GENE=PIK3CA;HGVSP=p.H1047R... GT:AD:DP  0/1:81,29:110     0/0
```

Two things about that matrix are worth knowing before reading any figure off it.
`0/0` means the tumor's MAF reports no mutation here, which is an absence of a
call and not a proven reference base: a MAF carries no coverage record for sites
its caller did not call. And every somatic call is written het, because a MAF
gives no ploidy and a subclonal call at high allele fraction is not a
homozygote. The read counts behind each call are kept in `AD`/`DP`, so the
variant popup shows what the caller saw.

`INFO/CSQ` re-encodes the MAF's own VEP columns (`Consequence`, `IMPACT`,
`HGVSp_Short`, SIFT, PolyPhen), which is what lets the track color cells by
consequence impact without running an annotator.

The clinical TSV is one row per tumor barcode and one column per attribute:

```
name              histology  er        pr        her2      subtype    stage
TCGA-3C-AAAU-01A  lobular    positive  positive  negative  HR+/HER2-  X
```

`histology` and `stage` come from the GDC's harmonized case fields.
`er`/`pr`/`her2` are read from each case's open-access clinical XML, with the
in-situ hybridization result taking precedence over immunohistochemistry for
HER2 wherever a case has both, since that is the test an equivocal IHC gets sent
for. `subtype` is derived from those three, and a tumor whose receptor calls do
not resolve it stays `unknown` rather than being guessed into a group.

## Load it into JBrowse

Add hg38. The hosted FASTA names its contigs bare (`1`) while the VCF uses
`chr1`, so pass the alias file too and both resolve:

```bash
export OUT=/var/www/html/jbrowse2

jbrowse add-assembly https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --name hg38 --type bgzipFasta \
  --refNameAliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --out $OUT
```

Then the track, hand-written because the display config is the interesting part:

```json
{
  "type": "VariantTrack",
  "trackId": "tcga_brca_mutations",
  "name": "TCGA-BRCA somatic mutations (979 primary tumors)",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_mutations.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "height": 1010,
      "featureColor": "jexl:impactColor(feature)"
    }
  ]
}
```

Three choices there:

- The
  [matrix display](/docs/user_guides/multivariant_track#matrix-best-for-snpindel-patterns)
  rather than the regular multi-sample display. A cohort's somatic mutations are
  sparse and spread across a whole gene, so laying cells out at their genomic
  positions spends the figure on empty space. The matrix lays columns out by
  feature index, and the band above the rows keeps a line from each column to
  the position it came from.
- [`featureColor`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-featurecolor)
  with the `impactColor` helper takes each mutation's VEP impact tier out of the
  `CSQ` field, so truncating and missense cells are told apart without a
  per-figure color table. It is the same **Color by... Consequence impact**
  preset the track menu offers.
- [`samplesTsvLocation`](/docs/config/vcftabixadapter/#slot-samplestsvlocation)
  on the adapter, which is what makes the clinical columns available to group
  and color rows by. Nothing groups until you ask for it, below.

[`height`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-height) is
worth setting explicitly at this row count. Rows auto-fit by dividing the
display height, and unlike the multi-row feature display they are allowed to go
below a pixel: at 979 tumors in a short display, a mutation carried by one tumor
paints a fraction of a pixel and effectively disappears.

## Read it

Run **Clustering → Cluster rows by genotype...** from the track menu before
reading anything off a cohort this deep (see [](/docs/user_guides/clustering)
for the mechanic). Somatic mutations are sparse, so in barcode order a carrier
is one 1px row wherever its tumor happens to sort, and even a hotspot draws as a
dashed streak. Clustering makes the carriers contiguous, which turns the same
column into a solid bar.

<Figure caption="PIK3CA across 979 TCGA-BRCA primary tumors, clustered by genotype. Each column is one distinct somatic mutation, each row one tumor, and every alt-carrying cell takes its mutation's VEP impact color. Three columns are solid bars in the block of carriers at the top, and the tumors with nothing here are the empty field below." src="/img/tcga/mutations_pik3ca.png" />

Those three columns are the canonical PIK3CA hotspots, H1047R in the kinase
domain and E542K/E545K in the helical domain
([TCGA 2012](https://doi.org/10.1038/nature11412)). Hovering a column in the
live view names its mutation and its consequence, and clicking one opens the
variant popup with the per-tumor read counts.

The rest of the picture is the shape of somatic mutation data: most columns are
one tumor wide. That is why the whole-genome view of this track is not worth
opening, and why the figures here are all gene-scale. The GDC's open mutation
calls are exome only, so there is no intergenic signal to see.

## Group the rows by clinical annotation

The rows start in barcode order, which encodes nothing.
[`groupBy`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-groupby)
names a column of the samples TSV and makes each of its values a contiguous band
of rows.
[`colorBy`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-colorby)
puts the matching color strip in the gutter, so the bands are labeled rather
than being unexplained row ranges. Both are also in the track menu.

```json
{
  "displays": [
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "height": 1010,
      "featureColor": "jexl:impactColor(feature)",
      "groupBy": "histology",
      "colorBy": "histology"
    }
  ]
}
```

<Figure caption="CDH1 with rows grouped and colored by histology. The truncating (HIGH impact) cells crowd into the lobular band, leaving the much larger ductal band nearly empty, and the connector fan ties each column to the exon it was called in." src="/img/tcga/mutations_cdh1_histology.png" />

E-cadherin loss is the defining lesion of lobular breast cancer
([Ciriello et al. 2015](https://doi.org/10.1016/j.cell.2015.09.033)), and
grouping is what turns this window from a scatter of private mutations into that
result.

That figure also drags the connector band open
([`lineZoneHeight`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-linezoneheight),
or the handle under the band), which is worth doing wherever _where_ a mutation
sits is part of the reading. A tumor suppressor is inactivated by any truncating
call anywhere in the coding sequence, so the fan lands across the whole
transcript; PIK3CA's three hotspot bars come off three codons, and at the
default band that difference is not in either picture.

Point the same two slots at `subtype` and the same mechanic reads a different
axis:

<Figure caption="TP53's coding exons with rows grouped and colored by receptor subtype. The triple-negative band is dense with mutations while the HR+/HER2- band, the cohort's largest, stays sparse." src="/img/tcga/mutations_tp53_subtype.png" />

The bottom band is `unknown`, the tumors whose receptor calls do not resolve a
subtype. It is a gap in the annotation rather than a fourth subtype, which is
worth knowing before reading anything into how dense it looks.

## Thinning the matrix down to recurrent mutations

The track menu's **Filter by... Minor allele frequency** slider (and its
[`minorAlleleFrequencyFilter`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-minorallelefrequencyfilter)
config slot) drops the low-frequency columns, which on somatic data means
keeping only mutations recurrent across the cohort: at PIK3CA the hotspots
survive and the private columns go. See
[filtering by allele frequency and missingness](/docs/user_guides/multivariant_track#filtering-by-allele-frequency-and-missingness)
for the sliders themselves.

Two things to keep in mind. The threshold is an **allele** frequency over called
alleles, and each somatic call here is one alt allele out of two, so a mutation
carried by 10% of the cohort sits at 0.05. And a tumor suppressor is the case
where this filter has little to keep: CDH1's truncating mutations are spread
along the gene rather than piled on one codon, so a threshold high enough to
isolate a hotspot empties the window the histology figure above is built on.
Recurrence filtering is for hotspot genes.

## Using your own cohort

Nothing here is TCGA specific past the clinical columns. Any MAF collection
reshapes with the same step, and
[`maf_to_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_vcf.py)
takes a directory of them, so output from
[vcf2maf](https://github.com/mskcc/vcf2maf), cBioPortal's study downloads, or
your own caller works as long as the rows carry `Chromosome`, `Start_Position`,
the two allele columns, `Tumor_Sample_Barcode`, and `CONTEXT`. For the grouping,
any TSV whose first column matches the VCF's sample names will do.

## Reproduce it end to end

One script builds both files for any project id:
[`build_tcga_cohort_mutations.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_tcga_cohort_mutations.sh),
which merges the MAFs with
[`maf_to_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_vcf.py)
and assembles the clinical table with
[`tcga_clinical_tsv.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/tcga_clinical_tsv.py).
It needs `curl`, `python3`, and `bgzip` + `tabix` from
[htslib](http://www.htslib.org/).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_tcga_cohort_mutations.sh
bash build_tcga_cohort_mutations.sh TCGA-BRCA 20 # 20 tumors, to test the pipeline
bash build_tcga_cohort_mutations.sh TCGA-BRCA    # the full cohort, ~10 minutes
# -> tcga_brca_mutations.vcf.gz (+ .tbi), tcga_brca_clinical.tsv
```

The full run reports
`87574 distinct mutations from 992 MAFs across 979 tumors (400 rows wrong sample type, 351 rows replicate aliquot)`
in 7.7 MB, plus a 140 KB clinical table. Swap in any other project id
(`TCGA-LUAD`, `TCGA-COAD`, ...) for a different cohort, and pass
`--no-receptors` to `tcga_clinical_tsv.py` for a non-breast project, whose
receptor columns would come back empty.

Three of its steps decide whether the resulting track is correct:

**It takes only open-access files.** The GDC's Masked Somatic Mutation MAFs are
the aliquot-merged ensemble calls with germline and other risky sites masked
out, and need no dbGaP application.

**It picks the cohort out of the MAFs, not out of the file query.** A GDC file
query can only filter on what a _case_ has, so asking for `Primary Tumor` keeps
a case's metastasis MAF as readily as its primary one, and the manifest's
`cases.samples.submitter_id` names whichever sample of the case comes first,
which for most TCGA cases is the matched blood normal. Which tumor a MAF is of
is in the file, so the merge step filters on the sample-type code of the barcode
it reads there (`01`, primary solid tumor), the same tumors the
[copy-number cohort](/docs/tutorials/tcga_cohort_cnv) paints.

**It anchors indels off the MAF's own `CONTEXT` column.** A MAF writes a
deletion as its deleted bases against a `-` alt, where VCF needs both alleles to
share a flanking base that no coordinate column carries. That base is in
`CONTEXT`, the reference sequence the caller recorded around the call, so no
reference FASTA is fetched and nothing has to be kept in sync with one. The
conversion is checked against the reference allele each row also states, and a
row whose context cannot support it is reported rather than silently misplaced.

**It keeps one MAF per sample barcode.** A few cases were sequenced twice under
the same barcode, and merging both aliquots would make one tumor look mutated
wherever either run called something. Sample names are truncated to the sample
barcode, which is also what the copy-number cohort partitions its rows by, so
the same tumor is one row name in both tracks.

## Where to go next

- [](/docs/tutorials/tcga_cohort_cnv), the same tumors' copy number as a
  one-row-per-tumor painting, plus the cohort recurrence track
- **Allele-specific copy number** (ASCAT, open access at the GDC) reports major
  and minor allele copy number separately, so it shows loss of heterozygosity
  that a total copy-number segment call reads as balanced
- **Methylation** (Beta Value arrays, open access) is probe level with genomic
  coordinates, and loads as a multi-row track with beta as the color field

## See also

- [Multi-sample variant tracks](/docs/user_guides/multivariant_track), the
  display's own menus, filters, and coloring
- [Variant tracks](/docs/config_guides/variant_track), for the consequence and
  metadata config
- [](/docs/user_guides/clustering)
- [](/docs/tutorials/dog10k_selection), the same matrix display over a germline
  panel
- [jexl](/docs/config_guides/jexl)

## References

- [GDC Data Portal](https://portal.gdc.cancer.gov/)
- [GDC MAF format](https://docs.gdc.cancer.gov/Data/File_Formats/MAF_Format/)
- [TCGA publication guidelines](https://www.cancer.gov/ccg/research/genome-sequencing/tcga/using-tcga-data/citing)

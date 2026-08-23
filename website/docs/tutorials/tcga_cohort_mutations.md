---
title: Mutation cohort (TCGA)
description:
  Read somatic point mutations across a thousand tumors as a genotype matrix,
  grouped by clinical annotation
guide_category: Tutorials
tutorial_category: Cancer genomics
data: download
---

**TL;DR:** we turn a TCGA project's somatic mutation calls into one matrix, each
column a distinct mutation and each row a tumor. JBrowse groups the rows by
whichever clinical field you point it at, receptor status or stage, so the
mutations a subtype shares line up.

## Prerequisites

- A JBrowse 2 instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop), which loads these tracks by
  URL with nothing to host) and the [JBrowse CLI](/docs/cli)
- These files, hosted:

| File                                                                                  | What                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------- |
| `https://jbrowse.org/demos/tcga/tcga_brca_mutations.vcf.gz`                           | the cohort's somatic mutations        |
| `https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv`                               | per-tumor histology, receptors, stage |
| `https://jbrowse.org/demos/tcga/tcga_brca_mutation_recurrence_by_subtype.bedGraph.gz` | per-gene mutation rate per subtype    |

## What the two files hold

The VCF is the GDC's per-tumor **Masked Somatic Mutation** calls merged into one
multi-sample file, one column per tumor:

```
#CHROM POS       ID  REF ALT  INFO                          FORMAT    TCGA-A2-A0T2-01A  TCGA-A8-A07C-01A
chr3   179234297 .   A   G    GENE=PIK3CA;HGVSP=p.H1047R... GT:AD:DP  0/1:81,29:110     0/0
```

Two conventions bear on any figure read off that matrix:

- `0/0` marks a site the caller did not call, since a MAF carries no coverage
  record for one.
- Every somatic call is written het, because a MAF gives no ploidy.

The read counts are kept in `AD`/`DP`, so the variant popup shows what the
caller saw.

`INFO/CSQ` re-encodes the MAF's own VEP columns (`Consequence`, `IMPACT`,
`HGVSp_Short`, SIFT, PolyPhen), which is what lets the track color cells by
consequence impact without running an annotator.

The clinical TSV is one row per tumor barcode and one column per attribute:

```
name              histology  er        pr        her2      subtype    stage
TCGA-3C-AAAU-01A  lobular    positive  positive  negative  HR+/HER2-  X
```

Its columns come from three different places:

- `histology` and `stage` come from the GDC's harmonized case fields.
- `er`/`pr`/`her2` are read from each case's open-access clinical XML, with the
  in-situ hybridization result taking precedence over immunohistochemistry for
  HER2 wherever a case has both, since that is the test an equivocal IHC gets
  sent for.
- `subtype` is derived from those three, and a tumor whose receptor calls do not
  resolve it stays `unknown`.

The table is built per project, so it names more tumors than either track
carries: a case with no mutation calls still has receptor status. JBrowse
reports the tumors it could not match when the track loads.

## Load the cohort VCF into JBrowse

Two commands set the whole thing up, an assembly and a track. Start with hg38,
where the one thing to watch is naming: the hosted FASTA calls its contigs bare
(`1`) while the VCF uses `chr1`, so pass the alias file alongside it and both
resolve.

```bash
export OUT=/var/www/html/jbrowse2

jbrowse add-assembly https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --name hg38 --type bgzipFasta \
  --refNameAliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --out $OUT
```

Then the track:

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

Three settings there:

- The
  [matrix display](/docs/user_guides/multivariant_track#matrix-best-for-snpindel-patterns)
  lays columns out by feature index, so a gene's mutations pack together however
  far apart they sit, and the band above the rows keeps a line from each column
  to the position it came from.
- [`featureColor`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-featurecolor)
  with the `impactColor` helper takes each mutation's VEP impact tier out of the
  `CSQ` field, so truncating and missense cells are told apart. It is the same
  **Color by... → Consequence impact** preset the track menu offers.
- [`samplesTsvLocation`](/docs/config/vcftabixadapter/#slot-samplestsvlocation)
  on the adapter makes the clinical columns available to group and color rows
  by.

[`height`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-height) sets
how much of the page the cohort gets, and rows auto-fit by dividing it. A matrix
row goes below a pixel, so a band's mutation density reads as how dark it is.

## Group the rows by clinical annotation

The rows start in barcode order, which encodes nothing.
[`groupBy`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-groupby)
names a column of the samples TSV and makes each of its values a contiguous band
of rows.
[`colorBy`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-colorby)
puts the matching color strip in the gutter, so each band is labeled. `colorBy`
is also **Color by... → Samples** in the track menu; `groupBy` is config only.

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
      "height": 450,
      "lineZoneHeight": 130,
      "featureColor": "jexl:impactColor(feature)",
      "groupBy": "histology",
      "colorBy": "histology"
    }
  ]
}
```

Point the two slots at `histology` and the rows band by how the tumor was called
under the microscope:

<Figure caption="CDH1's exons with rows grouped and colored by histology and the gene's introns collapsed. The truncating (HIGH impact) cells crowd into the lobular band and the much larger ductal band above it is nearly empty." src="/img/tcga/mutations_cdh1_histology.png" />

E-cadherin loss is the defining lesion of lobular breast cancer
([Ciriello et al. 2015](https://doi.org/10.1016/j.cell.2015.09.033)).

The window that figure is drawn in comes from the gene itself. Right-click
_CDH1_ in the gene lane, choose **Collapse introns**, and **Replace current
view** reshapes the frame to its exons (see [](/docs/user_guides/gene_track)):

<Video src="/media/tcga/mutations_collapse_introns.mp4" caption="The whole CDH1 transcript reshaped to its exons from the gene's own context menu, and the 979-tumor matrix redrawn over the coding sequence." />

Two more things in that figure travel to any gene-scale matrix:

- [`lineZoneHeight`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-linezoneheight)
  (or the handle under the band) drags the connector band open, which says where
  in the transcript a gene's calls fall. A tumor suppressor is inactivated by
  any truncating call anywhere in the coding sequence, so _CDH1_'s fan lands in
  exon after exon.
- A ClinVar track puts the germline record beside the somatic one, on the same
  coordinates, so a matrix column and a pathogenic tick meet where a somatic
  call sits on a submitted germline variant. It reads at hotspot or single-exon
  zoom; across sixteen collapsed exons ClinVar's submissions touch each other
  and the lane is a barcode.

Most columns are one tumor wide, and the GDC's open mutation calls are exome
only, so these figures are all gene-scale.

## Group by receptor subtype

Point the slots at `subtype` and the rows band by receptor status
([TCGA 2012](https://doi.org/10.1038/nature11412)):

<Figure caption="TP53's exons with rows grouped and colored by receptor subtype, introns collapsed. The triple-negative band is visibly the dense one and the much larger HR+/HER2- band above it is sparse, with the calls spread the length of the coding sequence." src="/img/tcga/mutations_tp53_subtype.png" />

The bottom band is the tumors whose receptor calls do not resolve a subtype.
Hovering a column in the live view names its mutation and its consequence, and
clicking one opens the variant popup with the per-tumor read counts.

_PIK3CA_'s calls at the same zoom pile on two hotspots in the HR+/HER2- band,
H1047R in the kinase domain and E542K/E545K in the helical one, so its connector
fan comes off a couple of points.

## Add a mutation recurrence track

A band's darkness reads as its mutation rate where the bands are of comparable
height. The bands above differ in height, so how often the calls fall needs its
own axis.

[`mutation_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mutation_recurrence.py)
is the mutation counterpart of the copy-number cohort's
[`cnv_recurrence.py`](/docs/tutorials/tcga_cohort_cnv#add-a-recurrence-track).
It takes the same `SAMPLES.tsv:COLUMN` group spec, so a tumor falls in the same
group in every track on both pages, and writes one interval per gene valued in
percent of the cohort:

<!-- from: scripts/build_tcga_cohort_mutations.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mutation_recurrence.py
python3 mutation_recurrence.py tcga_brca_mutations.vcf.gz by_subtype.bedGraph \
  --groups tcga_brca_clinical.tsv:subtype
```

```
#chrom  start      end        HR+/HER2-  HER2+  triple-negative  unknown
chr3    179199065  179234302  40.56      30.18  11.19            30.71
chr17   7670683    7676564    19.44      39.64  80.42            32.28
```

That is the same shape the copy-number recurrence writes, so the same adapter
and the same display read it: `BedGraphTabixAdapter` takes every column past
`end` as its own signal, and a
[`MultiQuantitativeTrack`](/docs/config_guides/multiquantitative_track) draws
one row per group.

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "tcga_brca_mutation_recurrence_by_subtype",
  "name": "TCGA-BRCA mutation recurrence by receptor subtype",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "BedGraphTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_mutation_recurrence_by_subtype.bedGraph.gz"
  },
  "displayDefaults": {
    "height": 260,
    "minScore": 0,
    "maxScore": 100,
    "showRowSeparators": true
  }
}
```

[`minScore`](/docs/config/multilinearwiggledisplay/#slot-minscore)/[`maxScore`](/docs/config/multilinearwiggledisplay/#slot-maxscore)
pin every row to one axis, so the rows read against each other. Open it above
the matrix and each band has its own rate over it.

The two rows above go opposite ways across the same four columns: _TP53_ climbs
toward the triple-negative group where _PIK3CA_ falls.

`--impact` sets what counts as a hit, defaulting to the HIGH and MODERATE tiers,
which are the tiers `impactColor` paints in the matrix. LOW and MODIFIER are the
synonymous, UTR and intronic calls.

The rate carries no background model and no significance test, and gene length
enters the count directly: _TTN_ is 100 kb of coding sequence, so it ranks near
the top on passenger mutations alone.

## Cluster the rows by genotype

**Clustering → Cluster rows by genotype...** in the track menu orders the rows
by their genotypes (see [](/docs/user_guides/clustering) for the mechanic),
which gathers every carrier into one block and turns a hotspot column into a
solid bar. It replaces the clinical bands while it is on, and answers which
tumors share a mutation.

## Thin the matrix down to recurrent mutations

The track menu's **Filter by... → Minor allele frequency** slider (and its
[`minorAlleleFrequencyFilter`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-minorallelefrequencyfilter)
config slot) drops the low-frequency columns, which on somatic data means
keeping only mutations recurrent across the cohort: at _PIK3CA_ the hotspots
survive and the private columns go. See
[filtering by allele frequency and missingness](/docs/user_guides/multivariant_track#filtering-by-allele-frequency-and-missingness)
for the sliders themselves.

The threshold is an allele frequency over called alleles, and each somatic call
here is one alt allele out of two, so a mutation carried by 10% of the cohort
sits at 0.05. _CDH1_'s truncating calls are spread along the gene, so a
threshold high enough to isolate a hotspot empties the window the histology
figure is built on.

## Use your own cohort

Nothing here is TCGA specific past the clinical columns. Any MAF collection
reshapes with the same step, and
[`maf_to_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_vcf.py)
takes a directory of them, so output from
[vcf2maf](https://github.com/mskcc/vcf2maf), cBioPortal's study downloads, or
your own caller works as long as the rows carry `Chromosome`, `Start_Position`,
the two allele columns, `Tumor_Sample_Barcode`, and `CONTEXT`. For the grouping,
any TSV whose first column matches the VCF's sample names will do.

## Where to go next

The [copy-number cohort](/docs/tutorials/tcga_cohort_cnv) paints the same tumors
one row each, under a recurrence track, and its
[next steps](/docs/tutorials/tcga_cohort_cnv#where-to-go-next) are this page's
too: allele-specific copy number and the methylation arrays are both open access
at the GDC and cover these tumors.

## Reproduce it end to end

One script builds every file above for any project id:
[`build_tcga_cohort_mutations.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_tcga_cohort_mutations.sh),
which merges the MAFs with
[`maf_to_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_vcf.py),
assembles the clinical table with
[`tcga_clinical_tsv.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/tcga_clinical_tsv.py),
and tallies the per-gene rates with
[`mutation_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mutation_recurrence.py).
It needs `curl`, `python3`, and `bgzip` + `tabix` from
[htslib](http://www.htslib.org/), which on Debian/Ubuntu is
`apt install curl python3 tabix`.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_tcga_cohort_mutations.sh
bash build_tcga_cohort_mutations.sh TCGA-BRCA 20 # 20 tumors, to test the pipeline
bash build_tcga_cohort_mutations.sh TCGA-BRCA    # the full cohort, ~10 minutes
npx --yes serve jbrowse2                         # then open the printed URL
```

It writes `tcga_brca_mutations.vcf.gz` (+ `.tbi`), `tcga_brca_clinical.tsv` and
`tcga_brca_mutation_recurrence_by_subtype.bedGraph.gz` (+ `.tbi`), then a
`jbrowse2/` opening on _PIK3CA_ with the recurrence rows over the matrix
display. The assembly is the hosted UCSC hg38 hub's own entry copied in, so the
reference is never downloaded. The recurrence step is derived from the VCF
rather than re-downloaded, and is separately runnable as
[`mutation_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mutation_recurrence.py)
if you have a cohort VCF already.

The full run reports
`87574 distinct mutations from 992 MAFs across 979 tumors (400 rows wrong sample type, 351 rows replicate aliquot)`
in 7.7 MB, plus a 140 KB clinical table. Swap in any other project id
(`TCGA-LUAD`, `TCGA-COAD`, ...) for a different cohort, and pass
`--no-receptors` to `tcga_clinical_tsv.py` for a non-breast project, whose
receptor columns would come back empty. A third argument names the clinical
column the recurrence track splits on, since `subtype` is derived from the
receptor calls and so is breast only, while `histology` and `stage` come from
harmonized GDC fields and work for any project.

Four of its steps decide whether the resulting track is correct:

- **Open-access files only.** The GDC's Masked Somatic Mutation MAFs are the
  aliquot-merged ensemble calls with germline and other risky sites masked out,
  and need no dbGaP application.
- **The sample type comes off the barcode inside each MAF.** A GDC file query
  filters on what a _case_ has, so asking for `Primary Tumor` keeps a case's
  metastasis MAF as readily as its primary one. Which tumor a MAF is of is in
  the file, so the merge step filters on the sample-type code of the barcode it
  reads there (`01`, primary solid tumor), the same tumors the
  [copy-number cohort](/docs/tutorials/tcga_cohort_cnv) paints.
- **Indels are anchored off the MAF's own `CONTEXT` column.** A MAF writes a
  deletion as its deleted bases against a `-` alt, where VCF needs both alleles
  to share a preceding base. That base is in `CONTEXT`, so no reference FASTA is
  fetched, and a row whose context cannot support the conversion is reported.
- **One MAF per sample barcode.** A few cases were sequenced twice under the
  same barcode, and the merge keeps one aliquot, so a tumor's row is one run's
  calls. Sample names are truncated to the sample barcode, so the same tumor is
  one row name in both tracks.

## See also

- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)
- [](/docs/user_guides/clustering)
- [](/docs/tutorials/tcga_cohort_cnv)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/config_guides/jexl)

## References

- [GDC Data Portal](https://portal.gdc.cancer.gov/)
- [GDC MAF format](https://docs.gdc.cancer.gov/Data/File_Formats/MAF_Format/)
- [TCGA publication guidelines](https://www.cancer.gov/ccg/research/genome-sequencing/tcga/using-tcga-data/citing)

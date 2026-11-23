---
title: Phased trio analysis (1000 Genomes)
sidebar_label: Phased trio (1000 Genomes)
description:
  Paint a child's inherited haplotype blocks from hap-ibd IBD segments, one row
  per parental copy, and read the crossovers off the track
guide_category: Tutorials
tutorial_category: Population genomics
---

A child inherits one copy of each chromosome from each parent, and each copy is
a patchwork of the parent's own two copies, switching at the crossovers of that
meiosis. In a phased trio, hap-ibd finds the stretches where the child's
haplotypes match a parent's, so the patchwork and its crossovers can be painted
along a chromosome. Before painting, bcftools marks the sites where the child's
genotype cannot be made of one allele from each parent. On chr1 of a 1000
Genomes trio, we:

- load the trio's phased VCF, annotated by bcftools, as a variant track, with
  the 1000 Genomes pedigree
- color the VCF by its Mendelian error count, and open the child's high-coverage
  reads under a flagged site
- switch the VCF to a genotype matrix with one row per haplotype
- load hap-ibd's segments, converted to BED, as a multi-row feature track with
  one colored row per parental haplotype, and read the crossovers along chr1 off
  the painted rows
- line the painted rows up with the genotypes at a paternal and a maternal
  crossover

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- the `hg38` assembly set up in JBrowse
  ([assemblies guide](/docs/config_guides/assemblies))
- Java 8+, for hap-ibd
- `python3`
- `node`, for the [JBrowse CLI](/docs/cli)
- htslib (`bgzip`, `tabix`)
- bcftools, whose `+mendelian2` plugin marks the Mendelian errors

<!-- BEGIN GENERATED TUTORIAL_INSTALL htslib,bcftools,node,jbrowse-cli -->

```bash
# Debian/Ubuntu
sudo apt install tabix bcftools nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib bcftools nodejs
# any platform
npm install -g @jbrowse/cli@next
```

<!-- END GENERATED TUTORIAL_INSTALL htslib,bcftools,node,jbrowse-cli -->

On Debian/Ubuntu, `apt install default-jre` installs Java. `hap-ibd.jar` is a
single download from its
[releases page](https://github.com/browning-lab/hap-ibd/releases).

## The data

1000 Genomes Project phased low-coverage calls
([1000 Genomes Project Consortium 2015](https://doi.org/10.1038/nature15393)),
the Kinh-Vietnamese trio HG02024 (daughter), HG02026 (father) and HG02025
(mother), chr1 only.

The tracks below read local files that the
[build script](#reproduce-it-end-to-end) writes from these, so run it first, or
run the bcftools and hap-ibd steps on the phased VCF of a trio of your own. The
script fetches everything itself.

| What it is                                                                                                                                      | File                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The phased trio VCF                                                                                                                             | [HG02024_VN049_KHVTrio.chr1.vcf.gz](https://jbrowse.org/demos/kgp-trio/HG02024_VN049_KHVTrio.chr1.vcf.gz)  |
| The GRCh38 PLINK genetic map hap-ibd needs, the `no_chr_in_chrom_field` variant, since the trio VCF calls its chromosome `1` rather than `chr1` | [plink.GRCh38.map.zip](https://bochet.gcc.biostat.washington.edu/beagle/genetic_maps/plink.GRCh38.map.zip) |

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                   | File                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The 1000 Genomes pedigree, which names each sample's parents | [20130606_g1k_3202_samples_ped_population.txt](https://jbrowse.org/demos/kgp-trio/20130606_g1k_3202_samples_ped_population.txt)               |
| The child's (HG02024) high-coverage CRAM                     | [HG02024.final.cram](https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/additional_698_related/data/ERR3988976/HG02024.final.cram) |
| The mother's (HG02025) high-coverage CRAM                    | [HG02025.final.cram](https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3242042/HG02025.final.cram)                        |

</details>

## Load the hg38 assembly

The trio calls are on GRCh38, and the hap-ibd blocks below use its chr1
coordinates, so we load that assembly first:

```json addassembly genome=hg38
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

The figures also show NCBI's RefSeq genes as a track:

```json addtrack
{
  "trackId": "ncbi_refseq_109_hg38_latest",
  "name": "NCBI RefSeq (GFF3Tabix)",
  "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GRCh38_latest_genomic.sort.gff.gz",
  "assemblyNames": ["hg38"]
}
```

## Mark Mendelian errors with bcftools

bcftools' `+mendelian2` plugin asks at each site whether the child's genotype
can be made of one allele from each parent's, and writes the answer into the VCF
as INFO fields, which JBrowse reads like any other:

```bash
# -p names the trio as child,father,mother
# -m a adds INFO/MERR, the number of trios with a Mendelian error at the site,
#   beside MGOOD, MMISS and MNORULE (consistent, missing and rule-less trios)
# --rules GRCh38 applies the X, Y, pseudoautosomal and chrM inheritance rules
bcftools +mendelian2 trio.vcf.gz -p child,father,mother --rules GRCh38 -m a \
  -Oz -o trio.merr.vcf.gz
tabix -p vcf trio.merr.vcf.gz
```

A site where the child has an allele neither parent was called with counts as an
error, as does one where no pair of parental alleles gives the child's genotype,
such as a hom-alt child of a hom-ref parent. MERR counts both kinds the same
way; the genotypes and the reads below separate them.

## Load the trio's phased VCF

In a phased VCF each genotype is written `0|1` or `1|0`, which assigns each
allele to a haplotype.

The VCF loads on `hg38` as an ordinary `VariantTrack`
([variant track guide](/docs/config_guides/variant_track)). For your own trio,
swap `uri` for a bgzipped VCF with its `.tbi` beside it and the same chromosome
naming as the assembly, and `pedigreeLocation` for your pedigree file. In
JBrowse Web you can instead paste the URL into **File → Open track...**, which
infers the adapter and the index but sets no pedigree.

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "khv_trio_vcf",
  "name": "KHV trio phased calls (chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/kgp-trio/HG02024_VN049_KHVTrio.chr1.merr.vcf.gz",
    "pedigreeLocation": {
      "uri": "https://jbrowse.org/demos/kgp-trio/20130606_g1k_3202_samples_ped_population.txt"
    }
  }
}
```

`pedigreeLocation` points at the 1000 Genomes pedigree, whose line
`VN049 HG02024 HG02026 HG02025` names HG02026 as HG02024's father and HG02025 as
the mother. From it JBrowse gives each sample `family`, `father`, `mother` and
`sex` attributes, and a `relationship` the row labels show after the name:
`HG02024 (daughter)`, `HG02025 (mother)` and `HG02026 (father)`. A PLINK `.fam`
works the same way.

<Figure caption="The VCF on initial load: one row per sample, each genotype at its variant's position." src="/img/trio-basic.png"/>

## Color the trio's calls by Mendelian errors {#coloring-the-trios-calls-by-mendelian-errors}

We'll check the calls before analyzing them by coloring the alt cells by
`INFO.MERR`. A `threshold` scale with one cut at 1 gives a site with no error
one color and a site with any error another, set as the variant display's
`encoding`:

```json
"displays": [
  {
    "type": "LinearVariantDisplay",
    "encoding": {
      "color": {
        "field": "INFO.MERR",
        "scale": {
          "type": "threshold",
          "domain": [1],
          "range": ["#90a4ae", "#c2185b"],
          "names": ["No Mendelian error", "Mendelian error"]
        },
        "legend": { "title": "MERR" }
      }
    }
  }
]
```

Type `chr1:196,745,000-196,850,000` in the location box to go to CFHR3 and
CFHR1, where both kinds of error show:

<Figure caption="The trio VCF colored by INFO.MERR across CFHR3 and CFHR1, rows HG02024 (daughter), HG02025 (mother) and HG02026 (father). Left of CFHR3 the child has alt cells at error sites where both parents are hom-ref, and across CFHR1 the parents' rows have a run of error sites." src="/img/trio-merr.png"/>

This VCF is the 1000 Genomes low-coverage callset, statistically phased, and
under one percent of its chr1 sites have a Mendelian error. A child's allele
neither parent was called with is a de novo candidate, and here it is far more
often a genotyping error than a mutation. At the site checked below, the reads
show a parent's het that the low-coverage calls missed. The 1000 Genomes SV
callset gives the father and the daughter a deletion across CFHR1 (`HGSV_9982`),
and a sample with one copy of a sequence is called homozygous for that copy's
allele, which accounts for the run of errors there. Those calls are right for a
one-copy sample, so the errors there mark the deletion rather than a genotyping
error.

- **Filter:** the display's `filter` entry `{ "field": "INFO.MERR", "gte": 1 }`
  keeps the sites with an error alone.
- **Click:** clicking a cell opens the feature details, which list MERR with the
  site's other INFO fields and each sample's genotype.

The reads show which call at a flagged site is wrong. The child has a
high-coverage CRAM from the 1000 Genomes 30x resequencing, streamed from the
project's S3 bucket:

```json addtrack loc=chr1:196,762,950-196,763,030
{
  "type": "AlignmentsTrack",
  "trackId": "hg02024_cram",
  "name": "HG02024 high coverage",
  "assemblyNames": ["hg38"],
  "uri": "https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/additional_698_related/data/ERR3988976/HG02024.final.cram"
}
```

At chr1:196,762,950-196,763,030 the callset has the child `0|1` and both parents
`0|0` at 196,762,987, a de novo candidate. The child's reads show the G allele
there, so the child's call stands. The mother's CRAM,
`https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3242042/HG02025.final.cram`,
loaded the same way, also has reads with G, so the low-coverage calls missed the
mother's het.

To check every flagged site this way, the
[KHV trio review portal](https://jbrowse.org/demos/khv_trio_review/) stacks the
daughter's, father's and mother's 30x reads under each flagged site in
chr1:190-200 Mb, with a verdict per site. A de novo candidate's reads show one
of these, most often one of the first two:

- a child miscall: the child's reads lack the allele, or are homozygous where
  the call is het
- a parent's het the calls missed
- a parent's indel, which the call writes as a different allele
- the allele in the child's reads alone, which supports a de novo variant
- nothing clear either way

[variant-review-portal](https://github.com/cmdcolin/variant-review-portal)
builds such a portal from a trio VCF, its pedigree and the three alignment
files.

**Color by → Genotype** returns the cells to the genotype colors the steps below
use.

## Show the trio VCF as a genotype matrix {#showing-the-trio-vcf-as-a-genotype-matrix}

In the track menu, check **Layout → Genotype matrix** (the
[variant sample rows guide](/docs/user_guides/multivariant_track) has the other
settings).

<Figure caption="The variant display as a genotype matrix. One row per sample, one column per variant, black lines connecting columns to their genome positions." src="/img/trio-matrix.png"/>

## Split each sample into two haplotype rows

Choose **Rows → Per haplotype** from the track menu, which splits each sample
into its two haplotypes. Per-haplotype rows need phased genotypes, written
`0|1`; unphased calls (`0/1`) need a phasing program such as SHAPEIT first.

<Figure caption="One row per haplotype: the two haplotypes (HP1, HP2) of HG02024, HG02025 and HG02026, top to bottom, each label followed by the pedigree's relationship (daughter, mother, father), under the RefSeq genes, with connector lines tying each matrix column back to the position it came from." src="/img/trio-matrix-phased-clean.png"/>

<Video src="/media/variants/trio_phased_matrix.mp4" caption="Layout → Genotype matrix switched on, then Rows → Per haplotype splitting each trio member into its two haplotype rows." />

## Run hap-ibd to find segments shared with each parent

[hap-ibd](https://github.com/browning-lab/hap-ibd) takes a phased VCF and a
PLINK-format genetic map, and reports the matching stretches as "identical by
descent" (IBD) segments. The trio VCF calls its chromosome `1`, so the run uses
the `no_chr_in_chrom_field` variant of the GRCh38 map:

<!-- from: scripts/build_khv_trio_hapibd.sh -->

```bash
# min-seed: shortest shared stretch (cM) hap-ibd starts a segment from
# min-output: shortest segment (cM) it writes
# both default to 2.0, so 1.0 also reports segments between 1 and 2 cM
java -jar hap-ibd.jar \
  gt=HG02024_VN049_KHVTrio.chr1.vcf.gz \
  map=plink.chr1.GRCh38.map \
  out=trio min-seed=1.0 min-output=1.0
```

The output is `trio.ibd.gz`, one row per shared segment, with columns sample1,
hap1, sample2, hap2, chrom, start, end, cM-length. In a trio every segment pairs
the child with one parent, and the child's two haplotypes split cleanly between
them:

| child haplotype | matches parent   | inherited copy |
| --------------- | ---------------- | -------------- |
| HG02024:1       | HG02026 (father) | paternal       |
| HG02024:2       | HG02025 (mother) | maternal       |

## Paint hap-ibd segments as inheritance blocks

hap-ibd's output has gaps and short spurious segments from the statistical
phasing, so
[`hapibd_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/hapibd_to_bed.py)
merges them into clean blocks. Per child haplotype it:

- merges adjacent segments of the same parental copy into runs
- drops short interior runs, which are switch errors
- snaps each remaining crossover to the midpoint of the gap between runs so the
  blocks abut; a gap too wide to bridge stays blank

The script writes one BED9 line per block, with a `parenthap` label naming one
of the painted track's four rows (father copy 1 or 2, mother copy 1 or 2) and an
`itemRgb` of blue for the father's copies and red for the mother's. The commands
below run it with the child, father and mother sample IDs, then sort, compress
and index the output:

<!-- from: scripts/build_khv_trio_hapibd.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/hapibd_to_bed.py
python3 hapibd_to_bed.py trio.ibd.gz HG02024 HG02026 HG02025 trio.hapibd.bed
jbrowse sort-bed trio.hapibd.bed | bgzip > trio.hapibd.bed.gz
tabix -f -C -p bed trio.hapibd.bed.gz
```

[`sort-bed`](/docs/cli#jbrowse-sort-bed) keeps the `#`-header line on top and
sorts the rest under `LC_ALL=C`, so the adapter reads the column names from the
header, needs no `columnNames`, and sees the same order in every locale.

Load `trio.hapibd.bed.gz` as a `FeatureTrack` with a
`LinearMultiRowFeatureDisplay`. In
[grammar-of-graphics](/docs/config_guides/mark_display) terms, `rows` assigns
one row per value of the `parenthap` field and `rows.sort` orders them, while
each block is colored by its BED `itemRgb`.
[`legend.show`](/docs/config/legend/#slot-show) is off because the row labels
already name the four categories:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "khv_trio_hapibd",
  "name": "KHV trio hap-ibd haplotype blocks (chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "uri": "trio.hapibd.bed.gz",
    "csi": true
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": {
        "field": "parenthap",
        "sort": ["Father hap1", "Father hap2", "Mother hap1", "Mother hap2"]
      },
      "legend": { "show": false }
    }
  ]
}
```

## Read crossovers off the painted blocks

Open the whole of chr1 with the painted track. JBrowse draws each parent's two
copies as rows, blue for father HG02026 and red for mother HG02025:

<Figure caption="hap-ibd inheritance blocks in the multi-row feature display, the father's haplotypes blue and the mother's red." src="/img/trio-hapibd-painting.png"/>

The blue rows together are the child's paternal chromosome. A filled blue row
marks the father's copy the child inherited there, so each step from one blue
row to the other is a paternal crossover. Likewise, the red rows are the
maternal chromosome.

Both blue rows filled at one position, or both red rows, would mean hap-ibd
matched one child haplotype to both of a parent's copies. A position with
neither row filled is one where hap-ibd found no segment long enough to report.
The blocks run straight through the centromere, because hap-ibd joins the
markers on either side of it.

## Compare the painted blocks with the raw genotypes

To line the painted blocks up with the genotypes underneath:

- Drag the painting's track label above the VCF's.
- Uncheck **Layout → Genotype matrix** on the VCF track, so the **phased variant
  display** draws each genotype at its genomic position.
- To show one parent's two rows only, as the figures below do, set the
  painting's `rows.kept` to those names, for example
  `["Father hap1", "Father hap2"]`.
- To name the VCF's rows after the painting's rows, set the variant display's
  `rows.labels` to
  `{ "HG02024 HP1": "Child hap1", "HG02024 HP2": "Child hap2", "HG02025 HP1": "Mother hap1", "HG02025 HP2": "Mother hap2", "HG02026 HP1": "Father hap1", "HG02026 HP2": "Father hap2" }`,
  or rename the rows in **Edit colors/arrangement...** in its track menu. These
  labels name each row's relationship, so set `rows.subtitle` to `""` to drop
  the `(daughter)`, `(mother)` and `(father)` drawn after them.

**Advanced → Edit plot...** in the track menu shows the `rows` edits as text and
applies them live.

Zoom to a few hundred kb around one boundary, where the block-step is obvious
and the genotype columns resolve into individual variants. Start with the
paternal crossover near chr1:29.7 Mb:

<Figure caption="A paternal crossover, where the painting steps from Father hap2 to Father hap1. Tinted frames mark the switch in the genotypes." src="/img/trio-crossover-paternal.png"/>

Near chr1:55.8 Mb the child's maternal haplotype steps between the mother's two
copies:

<Figure caption="A maternal crossover, where the painting steps from Mother hap2 to Mother hap1." src="/img/trio-crossover-maternal.png"/>

The 1000 Genomes VCF is statistically phased, so its genotypes switch between
the two parental copies more often than real crossovers do. hap-ibd drops
segments shorter than its cM-length threshold, which removes most of those
switches from the painting, so the two crossovers above are well supported and
the finer blocks are approximate. For crossover mapping, use a pedigree-aware
method such as
[duoHMM](https://mathgen.stats.ox.ac.uk/genetics_software/duohmm/duohmm.html).

## Reproduce it end to end

[`build_khv_trio_hapibd.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_khv_trio_hapibd.sh)
runs the whole pipeline. It:

- downloads the trio VCF, hap-ibd and the genetic map
- marks the Mendelian errors with bcftools `+mendelian2`
- runs hap-ibd and paints the BED with
  [`hapibd_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/hapibd_to_bed.py)
- downloads JBrowse
- writes `khv_trio_build/jbrowse2` with a `config.json` holding the hg38
  assembly, the annotated VCF with its pedigree, and the hap-ibd track

Serve the folder and open the URL `serve` prints:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_khv_trio_hapibd.sh
bash build_khv_trio_hapibd.sh
npx --yes serve khv_trio_build/jbrowse2
```

In JBrowse Desktop, **File → Session → Open config.json or .jbrowse file...**
opens `khv_trio_build/jbrowse2/config.json` directly.

## See also

- [](/docs/tutorials/local_ancestry)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/ld_human)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## Citations

- Danecek et al. (2021).
  [Twelve years of SAMtools and BCFtools](https://doi.org/10.1093/gigascience/giab008)

- 1000 Genomes Project Consortium (2015).
  [A global reference for human genetic variation](https://doi.org/10.1038/nature15393)
- Zhou et al. (2020).
  [A fast and simple method for detecting identity-by-descent segments in large-scale data](https://doi.org/10.1016/j.ajhg.2020.02.010),
  hap-ibd
- O'Connell et al. (2014).
  [A general approach for haplotype phasing across the full spectrum of relatedness](https://doi.org/10.1371/journal.pgen.1004234),
  duoHMM

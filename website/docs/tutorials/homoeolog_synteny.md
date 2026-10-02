---
title: Synteny visualization (a polyploid against itself)
sidebar_label: Synteny (polyploid subgenomes)
description:
  Draw hexaploid oat against itself from syntenic anchors, coloured by the
  selection pressure between each pair of copies
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

An allopolyploid has several near-complete copies of its own genome, so one
assembly goes on both axes of a dotplot. jcvi chains a protein self-alignment
into syntenic anchors, `kaks_from_pairs.py` measures dN and dS on each anchor,
and `color: { field: 'dnds' }` paints selection pressure across the whole
karyotype.

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- [jcvi](https://github.com/tanghaibao/jcvi)
- [DIAMOND](https://github.com/bbuchfink/diamond)
- python3 with [biopython](https://biopython.org/)
- `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

[Selection pressure between two genomes](/docs/tutorials/selection_pressure)
covers installing jcvi and what dN/dS measures.

## Where the data comes from

Oat cultivar Williams
([Peng et al. 2022](https://doi.org/10.1038/s41588-022-01127-7)), annotated by
Ensembl Plants release 63 as
[GCA_951802345.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_951802345.1/).

- the annotation the self-alignment runs on:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/gff3/avena_sativa_gca951802345v1cm/Avena_sativa_gca951802345v1cm.Asativa_cv_Williams_v1.0.63.gff3.gz
- the CDS the proteome is translated from:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/fasta/avena_sativa_gca951802345v1cm/cds/Avena_sativa_gca951802345v1cm.Asativa_cv_Williams_v1.0.cds.all.fa.gz

## Oat subgenomes and homoeologs

Oat (_Avena sativa_) is an allohexaploid: three diploid grasses hybridized and
the result kept all three genomes. Its 21 chromosomes are seven homoeologous
groups of three, one per subgenome (A, C and D), and nearly every gene exists
three times. The copies across subgenomes are homoeologs, and a table of them is
a comparative dataset from one assembly, so `MCScanBlocksAdapter` puts one
genome on both axes.

The karyotype shows where the copies sit, and a segment moved between groups
leaves the diagonal. dN/dS measures the selection pressure on each pair of
copies, and the dotplot draws it as a colour.

## Producing the data

### Gene models, a proteome, and chromosome sizes

jcvi turns the GFF3 into the BED the adapter also reads, one primary transcript
per gene:

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
  --primary_only oat.gff3.gz -o oat.all.bed
awk -F'\t' '$1 ~ /^[1-7][ACD]$/' oat.all.bed > oat.bed
```

The `awk` keeps the 21 chromosomes and drops the unplaced contigs.

The [end-to-end script](#reproduce-it-end-to-end) translates the proteome from
the CDS, keeping the transcript ids the BED uses.

The assembly needs no sequence. We'll load it from the chromosome lengths in the
GFF3's `##sequence-region` header, written to `oat.chrom.sizes` (a name and a
length per line):

```json addassembly
{ "name": "oat", "uri": "oat.chrom.sizes" }
```

### Syntenic anchors from a self-alignment

Naming one prefix twice is a self-comparison: jcvi drops the gene-against-itself
diagonal, then chains what is left into syntenic blocks.

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
diamond makedb --in oat.pep -d oat.pep
diamond blastp --threads 14 --query oat.pep --db oat.pep --out oat.oat.last \
  --max-target-seqs 20 --evalue 1e-10 --outfmt 6
python -m jcvi.compara.catalog ortholog --no_strip_names --dbtype prot \
  --align_soft diamond_blastp --self_remove 100 --no_dotplot oat oat
```

Two flags matter here:

- `--self_remove` defaults to 98 and discards every hit at or above that percent
  identity. Oat's A-D homoeologs sit above it, so this run sets 100
- `--no_strip_names` keeps the ids byte-identical to the BED the adapter joins
  on

The alignment is the long step, over an hour on every core here. Running it
separately keeps DIAMOND at default sensitivity, which finds homoeologs this
recent; jcvi's own call uses `--ultra-sensitive --max-target-seqs 1000`. jcvi
picks the file up by name and skips its alignment step.

Chaining keeps an anchor only where its neighbours agree, which removes the
off-diagonal noise of gene families' best hits. A self-comparison also chains
the tandem and segmental duplicates within each subgenome; a homoeolog pair has
its ends on different subgenomes, so the script filters on the chromosome name.

Take `oat.oat.anchors`, not `oat.oat.lifted.anchors`, for the reason
[selection pressure](/docs/tutorials/selection_pressure#dn-and-ds) gives.

### dN and dS on each anchor

Ensembl declares `dn` and `ds` in every homology export and leaves both empty in
every division, so the script computes them:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/kaks_from_pairs.py
```

<!-- from: scripts/build_oat_homoeologs.sh -->

```bash
python3 kaks_from_pairs.py oat.pairs.tsv oat.cds.fa.gz \
  --key record --min-syn-subs 3 -o oat.kaks.tsv
```

`--key record` reads the CDS by transcript id, and `--min-syn-subs` drops pairs
with too few synonymous differences to trust a ratio.
[Selection pressure](/docs/tutorials/selection_pressure#dn-and-ds) explains the
method and the filters.

## Loading the blocks table in JBrowse

The output is a two-column pair table with the two rates after it, which is the
`.blocks` shape [`MCScanBlocksAdapter`](/docs/config_guides/synteny_track)
reads. A self-comparison names one assembly twice, in `blockAssemblies`, in the
track's `assemblyNames`, and in both entries of `bedLocations`:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "oat_homoeologs",
  "name": "Oat homoeologs (dN/dS)",
  "assemblyNames": ["oat", "oat"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "oat.homoeologs.blocks.gz",
    "blockAssemblies": ["oat", "oat"],
    "bedLocations": ["oat.bed.gz", "oat.bed.gz"],
    "attributeColumns": ["dn", "ds", "syn_subs", "fisher_p"]
  }
}
```

`attributeColumns` names the columns after the two gene columns, and each
becomes a feature attribute in the detail panel. `dn` and `ds` drive the palette
button's **dN/dS**, a ramp with 1 at its middle and 2 at its top. `syn_subs` and
`fisher_p` are the evidence behind a colour.

**Add → Dotplot view** with oat on both axes opens the track as a dotplot, and
the session [below](#checking-the-rates-against-the-raw-data) does the same.

## Checking the rates against the raw data

The [script](#reproduce-it-end-to-end) ends on the numbers behind the picture.

The control is dS. Oat's A and D subgenomes descend from closely related diploid
_Avena_ species and its C subgenome from a more distant one, so A-D pairs should
come out at a lower synonymous divergence than A-C or C-D. The palette button's
**Color by value → ds** <!-- menu-path-ok --> paints each anchor by it. The
session pins the ramp's ends with `domainMin` and `domainMax`, so a colour means
one dS wherever the view goes; the menu has no field for them:

```json session config=https://jbrowse.org/demos/oat_homoeologs/config.json
{
  "defaultSession": {
    "name": "Oat homoeologs by dS",
    "views": [
      {
        "type": "DotplotView",
        "views": [
          {
            "assembly": "oat",
            "displayedRegionNames": [
              "4A",
              "4C",
              "4D",
              "5A",
              "5C",
              "5D",
              "7A",
              "7C",
              "7D"
            ]
          },
          {
            "assembly": "oat",
            "displayedRegionNames": [
              "4A",
              "4C",
              "4D",
              "5A",
              "5C",
              "5D",
              "7A",
              "7C",
              "7D"
            ]
          }
        ],
        "tracks": ["oat_homoeologs"],
        "color": {
          "field": "ds",
          "domainMin": 0,
          "domainMax": 0.25,
          "title": "dS"
        }
      }
    ]
  }
}
```

<Figure caption="The oat self-alignment over groups 4, 5 and 7, each anchor coloured by dS on a pinned ramp. The cells pairing an A chromosome with a D one sit lower on the ramp than those pairing either with C." src="/img/homoeolog_synteny/oat_ds.png" links="Open this view=homoeolog_synteny/oat_ds" />

Almost every pair is blue, and `fisher_p` supports the great majority. A ratio
over 1 between copies this recently separated rests on few substitutions, and
the count clearing the test is close to what chance gives. The
[primate walkthrough](/docs/tutorials/selection_pressure) goes through that
arithmetic on a locus small enough to check by eye.

## Reproduce it end to end

[`build_oat_homoeologs.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_oat_homoeologs.sh)
runs everything above and writes a `config.json` with the assembly, the track
and a dotplot session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_oat_homoeologs.sh
bash build_oat_homoeologs.sh
npx --yes serve oat_homoeologs_build/jbrowse2  # then open the printed URL
```

The script needs the tools under [Prerequisites](#prerequisites) on PATH.

## See also

- [](/docs/tutorials/mcscan_synteny_grape_peach)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/hg002_haplotypes)

## References

- Peng, Y. _et al._ Reference genome assemblies reveal the origin and evolution
  of allohexaploid oat. _Nature Genetics_ 54, 1248-1258 (2022).
  https://doi.org/10.1038/s41588-022-01127-7
- Nei, M. & Gojobori, T. Simple methods for estimating the numbers of synonymous
  and nonsynonymous nucleotide substitutions. _Molecular Biology and Evolution_
  3, 418-426 (1986). https://doi.org/10.1093/oxfordjournals.molbev.a040410
- Tang, H. _et al._ jcvi: A versatile toolkit for comparative genomics analysis.
  _iMeta_ 3, e211 (2024). https://doi.org/10.1002/imt2.211

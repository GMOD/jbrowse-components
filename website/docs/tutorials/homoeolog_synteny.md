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

Hexaploid oat has three near-complete copies of its genome, one from each grass
that hybridized to make it, so most of its genes exist three times. We draw oat
against itself in a dotplot from the gene pairs between those copies, and colour
each pair by how far it has diverged at silent sites (dS) and at
protein-changing ones (dN). The two subgenomes from closely related ancestors
should pair at a lower dS than either does with the third. jcvi finds the pairs
from a protein self-alignment, and `kaks_from_pairs.py` measures the rates.

## Prerequisites

- a JBrowse to open the files in: [Desktop](/docs/quickstart_desktop) takes a
  local file by path, [Web](/docs/quickstart_web) through **Add track**
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

The dotplot shows where the copies sit, and a segment moved between groups
leaves the diagonal. dN/dS measures the selection pressure on each pair of
copies, and the dotplot draws it as a colour.

## Producing the homoeolog table

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

### Finding homoeolog pairs from a protein self-alignment

Naming one prefix twice is a self-comparison: jcvi drops the gene-against-itself
diagonal, then chains the rest into syntenic blocks (co-linear runs of pairs).

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

Chaining keeps a gene pair (an anchor) only where its neighbours agree, which
removes the off-diagonal noise of gene families' best hits. A self-comparison
also chains tandem and segmental duplicates within a subgenome. A homoeolog pair
has its two genes on different subgenomes, so the script keeps the pairs whose
chromosomes carry different subgenome letters and writes them, two transcript
ids per line, to `oat.pairs.tsv`.

Take `oat.oat.anchors` and skip `oat.oat.lifted.anchors`. Liftover recruits
extra pairs near an established block, and their dS runs far above the chained
ones', which marks them as paralogs.

### Measuring dN and dS on each homoeolog pair

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

## Loading the homoeolog table as a dotplot track

The `oat.kaks.tsv` output lists gene pairs, then dN, dS, the synonymous
substitution count and a Fisher exact p, the `.blocks` shape
[`MCScanBlocksAdapter`](/docs/config_guides/synteny_track) reads. The script
copies it to `oat.homoeologs.blocks` and gzips that and `oat.bed` for the track.
A self-comparison names one assembly twice, in `blockAssemblies`, in the track's
`assemblyNames` and in both entries of `bedLocations`:

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

## Colouring homoeolog pairs by dS, with A-D pairs as the control {#checking-the-rates-against-the-raw-data}

The [script](#reproduce-it-end-to-end) ends by printing the median dS for each
subgenome pair, the numbers behind the picture below.

**Color by value → ds** <!-- menu-path-ok --> on the palette button paints each
pair by its dS. Oat's A and D subgenomes descend from closely related diploid
_Avena_ species and its C subgenome from a more distant one, so A-D pairs should
come out at a lower dS than A-C or C-D pairs. The session pins the ramp's ends
with `domainMin` and `domainMax`, so a colour means one dS wherever the view
goes; the menu has no field for them:

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

<Figure caption="Oat against itself over groups 4, 5 and 7, each homoeolog pair coloured by dS on a pinned ramp. Cells pairing an A chromosome with a D one sit lower on the ramp than cells pairing either with C." src="/img/homoeolog_synteny/oat_ds.png" links="Open this view=homoeolog_synteny/oat_ds" />

With **dN/dS** chosen on the palette button, almost every pair draws below 1 on
the ramp. A ratio over 1 between copies this recently separated rests on few
substitutions; the [primate walkthrough](/docs/tutorials/selection_pressure)
works through that arithmetic on a locus small enough to check by eye.

## Reproduce it end to end

[`build_oat_homoeologs.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_oat_homoeologs.sh)
runs everything above and writes a `config.json` with the assembly, the track
and a dotplot session:

1. Turn the GFF3 into a BED of one primary transcript per gene on the 21
   chromosomes, and translate the CDS into a proteome keyed on the same ids.
2. Align the proteome against itself with DIAMOND and chain the hits with jcvi,
   with `--self_remove 100` so the A-D homoeologs survive.
3. Keep the chained anchors whose two genes sit on different subgenomes, and
   measure dN and dS on each.
4. Print the median dS per subgenome pair, the control the figure is read
   against, and write the config.

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

## Citations

- Peng, Y. _et al._ Reference genome assemblies reveal the origin and evolution
  of allohexaploid oat. _Nature Genetics_ 54, 1248-1258 (2022).
  https://doi.org/10.1038/s41588-022-01127-7
- Nei, M. & Gojobori, T. Simple methods for estimating the numbers of synonymous
  and nonsynonymous nucleotide substitutions. _Molecular Biology and Evolution_
  3, 418-426 (1986). https://doi.org/10.1093/oxfordjournals.molbev.a040410
- Tang, H. _et al._ jcvi: A versatile toolkit for comparative genomics analysis.
  _iMeta_ 3, e211 (2024). https://doi.org/10.1002/imt2.211

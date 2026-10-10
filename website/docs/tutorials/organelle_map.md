---
title: A map of the human mitochondrial genome
sidebar_label: Organelle map (human mitochondrion)
description:
  The human mitochondrial genome drawn as a circular map from NCBI's FASTA and
  GFF3, with its genes split by strand and the D-loop drawn across the origin
guide_category: Tutorials
tutorial_category: Genes & annotation
---

We draw the human mitochondrial genome as a circular map, the way plasmid and
organelle genomes are usually pictured, with base-pair ticks around one closed
ring and the genes along it in a row per strand, colored by feature type. The
same steps make a map of any small circular sequence that NCBI annotates, from a
chloroplast to a plasmid. The circular view draws a feature track as a ring and
closes a sequence its assembly marks as circular, leaving no gap at its origin.

## Prerequisites

- a JBrowse to open the sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- [Node.js](https://nodejs.org/), which the JBrowse CLI runs on
- the [JBrowse CLI](/docs/cli), for `jbrowse add-assembly`, `jbrowse sort-gff`
  and `jbrowse add-track`
- samtools, for the FASTA index
- htslib (`bgzip`, `tabix`), for the GFF3 index

## Where the data comes from

NC_012920.1 is the revised Cambridge Reference Sequence of the human
mitochondrion (Andrews et al. 1999). The commands below fetch both files from
NCBI, so there is nothing to download by hand.

- the sequence as FASTA:
  https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_012920.1&rettype=fasta
- the annotation as GFF3:
  https://www.ncbi.nlm.nih.gov/sviewer/viewer.cgi?db=nuccore&report=gff3&id=NC_012920.1

## Downloading the sequence and its genes

We'll start from a GenBank accession, which is all NCBI needs to hand back the
sequence and its annotation. Set it once, so the same commands fetch your own
organelle or plasmid:

```bash
ACC=NC_012920.1
```

The sequence comes back as FASTA from NCBI's E-utilities:

```bash
curl -o genome.fa "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=$ACC&rettype=fasta"
```

The annotation comes back as GFF3 from the sequence viewer's export:

```bash
curl -o genes.gff3 "https://www.ncbi.nlm.nih.gov/sviewer/viewer.cgi?db=nuccore&report=gff3&id=$ACC"
```

Two lines of `genes.gff3` matter for a circular genome. The `##sequence-region`
pragma near the top gives the sequence's length, and the D-loop, the control
region that spans the origin, is written as one record whose end runs past that
length:

```bash
grep -e '^##sequence-region' -e 'D_loop' genes.gff3
```

```text
##sequence-region NC_012920.1 1 16569
NC_012920.1	RefSeq	D_loop	16024	17145	.	-	.	ID=id-NC_012920.1:1..16569;gbkey=D-loop
```

GFF3 writes a feature that crosses the origin of a circular sequence this way,
in coordinates that continue past the end. JBrowse's GFF3 adapters read the
length off `##sequence-region` and cut such a feature at the origin into a piece
before it and a piece after, so keep that line in the file you load.

## Loading the genome and the genes

We'll load the sequence as an assembly, indexed with samtools first:

```bash
samtools faidx genome.fa
```

The assembly is named `human_mito`, and two of its settings name the sequence
`NC_012920.1`. The add-genome form has a field for neither, so the JSON adds
both:

```json addassembly
{
  "name": "human_mito",
  "uri": "https://jbrowse.org/code/jb2/main/test_data/human_mito/sequence.fasta.gz",
  "circularRefNames": ["NC_012920.1"],
  "geneticCodes": { "NC_012920.1": 2 }
}
```

- `circularRefNames` marks the sequence circular, so the circular view closes it
  into a ring with no gap at its origin.
- `geneticCodes` translates it with NCBI's vertebrate mitochondrial code, table
  2, wherever JBrowse shows a protein.

We'll sort, compress and index the GFF3, keeping the pragma at the top
([Quickstart](/docs/quickstart_web) has the general recipe):

```bash
jbrowse sort-gff genes.gff3 | bgzip > genes.gff.gz
```

```bash
tabix -p gff genes.gff.gz
```

In grammar-of-graphics terms, the gene track's `facet` splits it into a section
per `strand`, and its `color` is a color scale mapping the GFF3 `type` field to
colors. The name label falls back through the GFF3 attributes, so a record with
no `gene` or `product`, like the D-loop, takes its `gbkey`:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "mito_genes",
  "name": "NCBI genes",
  "assemblyNames": ["human_mito"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/code/jb2/main/test_data/human_mito/mito.gff.gz"
  },
  "displayDefaults": {
    "labels": {
      "name": "jexl:feature.gene || feature.product || feature.name || feature.gbkey || feature.id"
    },
    "facet": { "field": "strand" },
    "color": { "field": "type" },
    "height": 250
  }
}
```

## Opening the genome as a circle

We'll open the assembly in a circular view with the gene track. A circular view
of one circular sequence closes at position 1, ticks its bases, and prints the
sequence's name and length in the middle:

```json session config=test_data/human_mito/config.json
{
  "defaultSession": {
    "name": "Human mitochondrion as a circle",
    "views": [
      {
        "type": "CircularView",
        "assembly": "human_mito",
        "showLegend": true,
        "tracks": ["mito_genes"]
      }
    ]
  }
}
```

The config sets the track's facet and color, and the track menu offers both too,
under the circular view menu's **Tracks** item:

- **Group by...** with `strand` splits the ring into a row per strand
- **Color by... → Attribute...** with `type` colors each feature by its GFF3
  type

The track's `height` is how much of the circle it asks for. A ring takes at most
half the circle's radius, and a track that asks for more lays its rows and
labels out in the band it gets.

<Figure src="/img/organelle_map/mito_ring.png" caption="The human mitochondrial genome NC_012920.1 as a circle, with the NCBI genes grouped by strand and colored by type. The outer row holds the plus-strand genes, the inner row the minus-strand ones: ND6 among the protein-coding genes, a handful of tRNAs, and the D-loop, which runs across position 1 as one arc." />

## Checking ND6 against the GFF3

The minus-strand row holds a single protein-coding gene, _ND6_, which sits
between _ND5_ and _CYTB_. Type `NC_012920.1:12,000-16,569` into a linear view
with the same track to see the three side by side:

<Figure src="/img/organelle_map/nd6_linear.png" caption="The last few kilobases of NC_012920.1, the NCBI genes grouped by strand. ND5 and CYTB run on the plus strand with ND6 between them on the minus strand. The D-loop's piece before the origin runs to the end of the sequence." />

Listing the minus-strand genes from the GFF3's strand column gives _ND6_ and
eight tRNA genes:

```bash
awk -F'\t' '$3 == "gene" && $7 == "-"' genes.gff3 | grep -o 'Name=[^;]*'
```

Anderson et al. (1981) published the sequence with this layout, twelve of the
thirteen protein-coding genes on one strand and _ND6_ on the other.

## See also

- [](/docs/user_guides/circular_view)
- [](/docs/tutorials/circular_synteny)
- [](/docs/tutorials/gene_density)
- [](/docs/quickstart_web)

## External links

- [NC_012920.1 at NCBI](https://www.ncbi.nlm.nih.gov/nuccore/NC_012920.1)
- [GFF3 specification](https://github.com/The-Sequence-Ontology/Specifications/blob/master/gff3.md)

## Citations

- Anderson et al. (1981).
  [Sequence and organization of the human mitochondrial genome](https://doi.org/10.1038/290457a0)
- Andrews et al. (1999).
  [Reanalysis and revision of the Cambridge reference sequence for human mitochondrial DNA](https://doi.org/10.1038/13779)

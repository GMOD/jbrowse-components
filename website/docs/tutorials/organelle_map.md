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
chloroplast to a plasmid. We:

- fetch a GenBank accession's FASTA and GFF3 from NCBI
- load the genome as an assembly marked circular, so the ring closes with no gap
  at its origin, and the genes as a feature track
- open the genome in the circular view and color the genes by feature type
- open _ND6_ and its neighbours in a linear view

## Prerequisites

- a JBrowse to open the sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- [Node.js](https://nodejs.org/), which the JBrowse CLI runs on
- the [JBrowse CLI](/docs/cli), for `jbrowse add-assembly`, `jbrowse sort-gff`
  and `jbrowse add-track`
- samtools, for the FASTA index
- htslib (`bgzip`, `tabix`), for the GFF3 index

<!-- BEGIN GENERATED TUTORIAL_INSTALL samtools,htslib,node,jbrowse-cli -->

```bash
# Debian/Ubuntu
sudo apt install samtools tabix nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools htslib nodejs
# any platform
npm install -g @jbrowse/cli@next
```

<!-- END GENERATED TUTORIAL_INSTALL samtools,htslib,node,jbrowse-cli -->

## The data

NC_012920.1 is the revised Cambridge Reference Sequence of the human
mitochondrion (Andrews et al. 1999). The commands below fetch both files from
NCBI, and every step after them runs on those copies.

| What it is             | File                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The sequence as FASTA  | [efetch.fcgi](https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_012920.1&rettype=fasta) |
| The annotation as GFF3 | [viewer.cgi](https://www.ncbi.nlm.nih.gov/sviewer/viewer.cgi?db=nuccore&report=gff3&id=NC_012920.1)              |

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

```text output
##sequence-region NC_012920.1 1 16569
NC_012920.1	RefSeq	D_loop	16024	17145	.	-	.	ID=id-NC_012920.1:1..16569;gbkey=D-loop
```

GFF3 writes a feature that crosses the origin of a circular sequence this way,
in coordinates that continue past the end. JBrowse's GFF3 adapters read the
length off `##sequence-region` and cut such a feature at the origin into a piece
before it and a piece after, so keep that line in the file you load.

## Loading the genome and the genes

We'll load the sequence as an assembly, indexed with samtools first:

<!-- from: scripts/build_organelle_map.sh -->

```bash
samtools faidx genome.fa
```

The assembly is named `human_mito`, and two of its settings name the sequence
`NC_012920.1`. The add-genome form has a field for neither, so in JBrowse
Desktop the assembly loads from a
[CLI-built config.json](/docs/tutorials/cli_desktop#open-the-cli-built-folder-in-jbrowse-desktop):

```json addassembly
{
  "name": "human_mito",
  "uri": "genome.fa",
  "circularRefNames": ["NC_012920.1"],
  "geneticCodes": { "NC_012920.1": 2 }
}
```

- `circularRefNames` marks the sequence circular, so the circular view closes it
  into a ring with no gap at its origin.
- `geneticCodes` translates it with NCBI's vertebrate mitochondrial code, table
  2, wherever JBrowse shows a protein.

For your own accession, put your sequence's name in both settings and pick its
[NCBI genetic code](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi)
(11 for a plastid or a bacterial plasmid).

We'll sort, compress and index the GFF3, keeping the pragma at the top
([Quickstart](/docs/quickstart_web#gff3-and-gtf) has the general recipe):

<!-- from: scripts/build_organelle_map.sh -->

```bash
jbrowse sort-gff genes.gff3 | bgzip > genes.gff.gz
```

<!-- from: scripts/build_organelle_map.sh -->

```bash
tabix -p gff genes.gff.gz
```

In [grammar-of-graphics](/docs/config_guides/mark_display) terms, the gene
track's `facet` splits it into a section per `strand`, and its `encoding.color`
is a color scale mapping the GFF3 `type` field to colors. The name label falls
back through the GFF3 attributes, so a record with no `gene` or `product`, like
the D-loop, takes its `gbkey`:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "mito_genes",
  "name": "NCBI genes",
  "assemblyNames": ["human_mito"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "genes.gff.gz"
  },
  "displayDefaults": {
    "labels": {
      "name": "jexl:feature.gene || feature.product || feature.name || feature.gbkey || feature.id"
    },
    "facet": { "field": "strand" },
    "encoding": { "color": "type" },
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
        "legend": { "show": true },
        "tracks": ["mito_genes"]
      }
    ]
  }
}
```

The config sets the track's facet and color, and the track menu offers both too,
under the circular view menu's **Tracks** item:

- **Group by** with `strand` splits the ring into a row per strand
- **Color by → Attribute...** with `type` colors each feature by its GFF3 type

The track's `height` is how much of the circle it asks for. A ring takes at most
half the circle's radius, and a track that asks for more lays its rows out in
the band it gets. A circle of one sequence names its features outside the ruler,
each joined to its feature by a line.

<Figure src="/img/organelle_map/mito_ring.png" caption="NC_012920.1 as a circle, the NCBI genes grouped by strand and colored by type." />

## ND6 in a linear view

The minus-strand row holds a single protein-coding gene, _ND6_, which sits
between _ND5_ and _CYTB_. Type `NC_012920.1:12,000-16,569` into a linear view
with the same track to see the three side by side:

<Figure src="/img/organelle_map/nd6_linear.png" caption="The end of NC_012920.1, the NCBI genes grouped by strand." />

Anderson et al. (1981) published the sequence with this layout, twelve of the
thirteen protein-coding genes on one strand and _ND6_ on the other.

## Reproduce it end to end

[`build_organelle_map.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_organelle_map.sh)
wraps every step above. It:

1. fetches the accession's FASTA and GFF3 from NCBI
2. indexes the sequence, and sorts and indexes the genes
3. writes a JBrowse with the circular assembly, the gene track and the circle as
   its default session

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_organelle_map.sh
bash build_organelle_map.sh                   # builds ./organelle_map_build/jbrowse2
ACC=NC_000932.1 GENETIC_CODE=11 NAME=arabidopsis_chloroplast bash build_organelle_map.sh chloroplast_build
npx --yes serve organelle_map_build/jbrowse2  # then open the printed URL
```

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

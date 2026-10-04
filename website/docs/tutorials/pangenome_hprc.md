---
title:
  "Pangenome (HPRC) part 1: the graph's alleles and the haplotypes that have
  them"
sidebar_label: Pangenome (HPRC pt 1, graph alleles and haplotypes)
description:
  Open HPRC release 2's pangenome graph from genomes.jbrowse.org as a track of
  the linear view, trace an allele to the assembly it came from, list every
  haplotype with it from the release's phased VCF, and read the same alleles as
  aligned bases in the release's multiple alignment
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

The Human Pangenome Reference Consortium's release 2 builds 464 human haplotypes
into a pangenome graph. Where the haplotypes differ, the graph forms a bubble,
and each route through a bubble is an allele. HPRC writes each haplotype's route
through every bubble as a phased VCF, so a record lists which haplotypes have
which allele. We open the graph and the VCF from the HPRC page on
genomes.jbrowse.org as tracks of a linear view of GRCh38, and:

- read a whole chromosome, one node per bubble
- at C4, read the graph's backbone, bubbles and alleles
- at MHC class II, trace an allele beside _HLA-DRB5_ to the assembly it came
  from
- list every haplotype with that allele from the VCF
- back at C4, read the same alleles as aligned bases in HPRC's multiple
  alignment

Two more pages start from the same HPRC page:
[haplotypes against each other](/docs/tutorials/pangenome_hprc_haplotypes) and
[repeat lengths](/docs/tutorials/pangenome_hprc_repeats).

:::caution Experimental

The graph view is a beta plugin, and the HPRC page is on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/)
until JBrowse 5 ships. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, which every launch from the HPRC page loads;
  [hosting your own graph](/docs/tutorials/pangenome_prepare_graph) loads it
  into your own JBrowse
- for [the alignment](#the-same-alleles-as-aligned-bases) on your own data:
  [taffy](https://github.com/ComparativeGenomicsToolkit/taffy)

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), with tabix
projections of its graph that we host.

- the SV-level graph (`sv.gfa`) the projections are cut from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt
- the config every launch on the HPRC page opens, which declares every release 2
  haplotype as an assembly with its CAT gene annotation:
  https://jbrowse.org/pangenome/hprc-grch38/config.json
- the phased VCF, one record per allele, 462 haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz
- the multiple alignment of every haplotype against GRCh38:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.full.maf.gz

## The HPRC page

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc). Each
row of its **Loci** table ends in launches: **graph**, **variants**,
**haplotypes** and **gene hub**.

<Figure caption="The HPRC page: the whole-chromosome links, then the head of the Loci table, where each row ends in its launches. The RHD / RHCE and SMN1 / SMN2 rows have no graph launch. The boxed link is the HLA / MHC graph launch." src="/img/pangenome/genomes_hprc_loci.png" />

## A whole chromosome {#a-chromosome-and-back}

Press **chr1** among the **Whole chromosome** links above the Loci table. Past a
zoom named in the graph adapter's `coarse` slot, JBrowse draws one node per
bubble, so the whole chromosome fits. A curve of segments per bubble shows how
much the haplotypes disagree at each locus.

<Figure caption="GRCh38 chr1 with the cytogenetic bands, three chr1 loci the HPRC pages open, and two lanes from one file. The blue curve is segments per bubble; the tier lane draws the same bubbles, one gold block per bubble. The blank column is 1q12, where nothing aligns." src="/img/pangenome/hprc_whole_chromosome.png" />

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
tier and writes the `coarse` slot.

## The C4 locus as a graph

Back on the HPRC page, press **graph** on the HLA / MHC row. The launch opens
the genes, the bubbles lane, the allele inventory and the graph track; hide the
bubbles lane and the allele inventory from the track selector to leave the genes
over the graph track. Type `C4A` in the location box, pick the chr6 hit, and
zoom out twice to take in _C4B_. Open the graph track's menu and pick **Layout →
Force-directed layout**, which draws the graph by its shape.

<Figure caption="The C4 locus as a force-directed graph under the hg38 genes for the same window, colored by reference position. The labels name a backbone segment, an allele, and a bubble whose two routes are the reference path and the dashed arc that skips one whole copy of the tandem C4-CYP21-TNX module." src="/img/pangenome/hprc_graph_anatomy.png" />

The graph has four kinds of object:

- the **backbone** is GRCh38's path, colored red to magenta by reference
  position
- a **bubble** is a place where haplotypes disagree
- an **allele** is a haplotype's sequence in place of the reference, drawn in
  charcoal because it has no reference position
- an **edge** that skips sequence is a deletion, drawn as a dashed arc

The dashed arc in the labelled bubble is the route of a haplotype with one fewer
C4 copy than GRCh38.

## The stretch of GRCh38 an allele replaces

Type `chr6:32,500,000-32,560,000`, the MHC class II window. The charcoal node
beside _HLA-DRB5_ is an allele much shorter than the stretch of backbone it
hangs across. Right-click it and take **Highlight in hg38**: a band marks the
span of GRCh38 it replaces, which covers most of _HLA-DRB5_.

<Figure caption="MHC class II with the graph track in the force-directed layout, colored by reference position. The ringed charcoal node is the allele beside HLA-DRB5, with its right-click menu open on Highlight in hg38." src="/img/pangenome/hprc_mhc_layout_force.png" />

## Opening the haplotype an allele came from

Left-click the charcoal allele beside _HLA-DRB5_. Its details give
`contributingHaplotype`, `NA20809#2`: the graph's `SN` tag names the assembly
minigraph first took the allele from. **Open in** appears when the session holds
an assembly named or aliased `sample#haplotype`. The launch's config declares
every release 2 haplotype that way; to declare one yourself, load its contig
sizes, or its FASTA, under a name the browser shows and an alias that is the
graph's name:

```json addassembly
{
  "name": "NA20809.2",
  "aliases": ["NA20809#2"],
  "uri": "https://jbrowse.org/pangenome/hprc-grch38/NA20809.2.chrom.sizes"
}
```

Right-click the allele again and take **Open in NA20809.2**. A second linear
view opens below the first, on that haplotype's chromosome 6, framed on the
allele with its CAT gene annotation. Zoom out a few steps.

<Figure caption="The same launch in two frames. First, the MHC class II cut in the force-directed layout, with the NA20809.2 allele ringed and its right-click menu open on Open in NA20809.2. Second, the view that entry opens: NA20809 haplotype 2's chromosome 6 with its CAT genes." src="/img/pangenome/hprc_haplotype_launch.png" />

The haplotype's CAT annotation has _HLA-DRB9_ and _HLA-DRB6_ either side of the
allele and no _HLA-DRB5_, the gene its band covered on hg38.

## Every haplotype with the allele

The graph names one source assembly per allele. HPRC's phased VCF lists every
haplotype's allele at every bubble: a record is one allele written against
GRCh38, and each sample's genotype holds a 1 for each of its haplotypes with
that allele. We'll add it to the graph launch's session:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hprc2_pgbi_grch38",
  "name": "HPRC release 2 phased VCF, one record per allele (462 haplotypes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz",
    "fetchSizeLimit": 20000000
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "renderingMode": "phased",
      "jexlFilters": ["jexl:alleleLength(feature)>=50"]
    }
  ]
}
```

- `renderingMode: "phased"` gives each haplotype its own row.
- `alleleLength(feature)>=50` keeps alleles of 50 bp and up, the size of the
  bubbles minigraph draws. `alleleLength` is the length of the record's longest
  allele, so it counts an insertion's inserted bases. **Filter by... → Edit
  filters...** in the track menu shows the filter and changes it.
- `fetchSizeLimit` raises the download cap from 5 MB to 20 MB. The VCF spells
  out each inserted allele, which puts more than 5 MB in the 90 kb MHC class II
  window and about three times that at LPA's kringle repeat.

Open the track menu again and take **Clustering → Cluster rows by genotype...**,
then **Run clustering**: the rows reorder so haplotypes with the same alleles
sit together, with a dendrogram beside them.

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="The 462-haplotype VCF at MHC class II clustered from the track menu: Clustering, Cluster rows by genotype, Run clustering, and the rows arriving in their new order with a dendrogram beside them." />

Right-click the charcoal allele beside _HLA-DRB5_ in the force-directed graph
and take **Highlight in hg38** again.

<Figure caption="The VCF and the graph in one window. The band is the span the HLA-DRB5 allele replaces, over every haplotype clustered by genotype: blue where a haplotype has an allele of 50 bp or more. Below, the force-directed graph, where an arrow runs from the band to the same allele as the graph draws it, alleles in charcoal." src="/img/pangenome/hprc_graph_vs_callset.png" />

The VCF holds the _HLA-DRB5_ allele as four records, one for each of its
sequences, which differ by a base or two. The blue block under the band is the
haplotypes with any of the four, plus a smaller block with an 86 kb deletion
that removes the whole stretch.

## The same alleles as aligned bases

minigraph builds the SV-level graph this page draws. Cactus then aligns every
assembly against it base by base, and HPRC exports that alignment twice: as the
base-level graph that `vg deconstruct` writes the VCF from, and as
`hprc-v2.1-mc-grch38.full.maf.gz`, one row of bases per haplotype. Beside the 53
GB MAF sits a `.tai` index that makes a locus one ranged read:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "hprc_v2_1_mc_grch38",
  "name": "HPRC release 2 pangenome alignment (464 haplotypes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BgzipMafAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.full.maf.gz"
  }
}
```

The `uri` shorthand resolves the sibling `.tai`. For a MAF of your own, taffy
writes the index beside it:

```bash
# writes alignment.maf.gz.tai, which the adapter finds by its name
taffy index -i alignment.maf.gz
```

Go back to the C4 window, `chr6:31,980,000-32,050,000`, with the genes, the VCF
and this alignment over the graph track. A white stretch in an alignment row is
sequence that haplotype lacks. Order the rows with **Clustering → Cluster rows
by genotype...** on the VCF and **Clustering → Cluster rows by identity...** on
the alignment, which clusters over the window in view because HPRC's file ships
no guide tree. **Reset row order** restores the order in the file.

<Figure caption="C4 with the RefSeq genes, the VCF's haplotypes clustered by genotype, a subtree of them as alignment rows clustered by identity, and the graph track in the force-directed layout. The band marks the pseudogene pair between C4A and C4B, and the haplotypes with no sequence across the module gather into one block." src="/img/maf_hprc_pangenome.png" />

The VCF's widest blue block is one record, a deletion of a whole C4-CYP21-TNX
module, which is the dashed arc in the C4 graph. Every alignment row in the
white block has that deletion in the VCF. The narrower blocks are the 6.4 kb
HERV-K insertion in a C4 gene's intron, the difference between a long and a
short C4. The figure keeps thirty-two alignment rows so each has room for its
name; the track as configured above draws every haplotype.

## Reproduce it end to end

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
projections and the bubbles lane in one command that runs on any rGFA; pointed
at `hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files we host, and
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them records
their provenance. For a graph of your own, minigraph lists each assembly's route
through every bubble, and
[hosting your own graph](/docs/tutorials/pangenome_prepare_graph#which-haplotypes-walk-each-segment)
walks through it.

## See also

- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_hprc_repeats)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/maf_track)
- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_cattle)

## External links

- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), which define the `SN`/`SO`/`SR`
  tags this page opens the graph by, and whose `bubble` subcommand calls the
  bubbles it reads.
- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), which writes the
  `.tai` index that makes the alignment addressable by locus.

## Citations

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the Minigraph-Cactus graph, the multiple alignment and the VCFs
  `vg deconstruct` writes from the graph.

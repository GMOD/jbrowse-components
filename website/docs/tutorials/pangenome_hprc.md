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
into a pangenome graph; the phased VCF used here lists 462 of them. Where the
haplotypes differ, the graph forms a bubble, and each route through a bubble is
an allele. HPRC writes each haplotype's route through every bubble as a phased
VCF, so a record lists which haplotypes have which allele. We open the graph and
the VCF from the HPRC page on genomes.jbrowse.org as tracks of a linear view of
GRCh38, and:

- read a whole chromosome, one node per bubble
- at C4 (complement genes), read the graph's backbone, bubbles and alleles
- at MHC class II, trace an allele beside _HLA-DRB5_ to the assembly it came
  from
- list every haplotype with that allele from the VCF
- back at C4, read the same alleles as aligned bases in HPRC's multiple
  alignment

:::caution Experimental

The graph view is a beta plugin, and the
[HPRC page](https://genomes.jbrowse.org/pangenomes/) launches it on the JBrowse
5 development build until JBrowse 5 ships. We welcome your [feedback](/contact).

The graph and the page also leave real variation out, at some of the best-known
loci in the genome. Read [what they do not show](#limits) before trusting an
empty or simple picture.

:::

## Prerequisites

- the GraphGenomeView plugin. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); every
  launch from the HPRC page already loads it
- for [the alignment](#the-same-alleles-as-aligned-bases) on your own data:
  [taffy](https://github.com/ComparativeGenomicsToolkit/taffy)

## The data

Nothing to download: the HPRC page's launches read the files of
[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), and our tabix
index of its graph, by URL.
[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
same files for a graph of your own.

<details>
<summary>The files</summary>

| What it is                                                           | File                                                                                                                                                                                         |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The structural-variant graph (`sv.gfa`) the index files are cut from | [hprc-v2.1-mc-grch38.sv.gfa.gz](https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz)     |
| The phased VCF, one record per allele, 462 haplotypes                | [hprc-v2.1-mc-grch38.pgbi.vcf.gz](https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz) |
| The multiple alignment of every haplotype against GRCh38             | [hprc-v2.1-mc-grch38.full.maf.gz](https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.full.maf.gz) |

</details>

## Launching tracks from the HPRC page

Open the [HPRC page](https://genomes.jbrowse.org/pangenomes/hprc), which opens
on its first example. Click another **Examples** entry, or type a gene symbol or
a region such as `chr6:32,510,001-32,600,000` into the **Gene or region** box
and press **Show**. The page draws a map of the window: GRCh38's genes, then one
row per structural form the haplotypes fall into, commonest first, each with its
share of the haplotypes aligned there.

<Figure caption="The HPRC page's map of its HLA / MHC example. The boxed button opens the window in JBrowse." src="/img/pangenome/genomes_hprc_loci.png" />

**Open in JBrowse** opens the window in a JBrowse tab. Clicking a row draws that
form's largest change as a graph under the map, cut from the graph's haplotype
walks, and the button then opens that form's haplotype as a lane. **More about
this window** unfolds a table of each change with its carriers, and every
launch:

- **Graph**: the region drawn as a graph, with the structural variants each
  haplotype has under it
- **Variants**: the structural variants each haplotype has, over the genes
- **Haplotypes**: one lane per structural form, commonest first
- **BandageJS**: the same haplotypes' walks in
  [BandageJS](https://jbrowse.org/demos/bandagejs/)

A window up to 150 kb wide adds two rows under the genes in every launch: the
[known alleles](#a-known-allele-cfhr3-cfhr1) in it, and the
[GWAS Catalog](https://www.ebi.ac.uk/gwas/)'s hits. A window over 150 kb offers
the graph alone. The page keeps the window in its address, so a link such as
[`?region=chr6:32,510,001-32,600,000`](https://genomes.jbrowse.org/pangenomes/hprc/?region=chr6%3A32%2C510%2C001-32%2C600%2C000)
opens the same map.

## A known allele: CFHR3–CFHR1 {#a-known-allele-cfhr3-cfhr1}

Some windows hold an allele with a published story. Click the **CFH / CFHR**
example. Above the map, the page names the **CFHR3–CFHR1 deletion**, says what
it does, counts its carriers in the panel (138 of the 462 haplotypes) and cites
[Hughes et al. 2006](https://doi.org/10.1038/ng1890), who tied it to a lower
risk of age-related macular degeneration. The map calls the change by the same
name.

Press **Open in JBrowse**. Under the genes:

- **Known alleles** spans the deletion and names it
- **GWAS Catalog (NHGRI-EBI)** marks the trait associations in the window. Click
  a hit for its trait, paper and p-value; the two advanced age-related macular
  degeneration hits sit one on either side of the deletion
- the matrix under the graph marks the deletion in each carrier's row

## What the graph and the page do not show {#limits}

The examples are loci where at least one launch draws something readable. At
other loci, a picture that looks simple or empty is often one of these cases:

- **Near-identical duplications draw as a single thread.** The graph puts the
  copies at RHD / RHCE and CYP2D6 on one path, so those examples offer no
  **Graph** launch, and SMN1 / SMN2, SRGAP2 and the 8p23.1 beta-defensin cluster
  are not examples at all. A gene-level graph answers copy-number questions
  there.
- **The graph does not align every haplotype everywhere.** A haplotype the graph
  does not align across a window gets no lane, and the page counts them. At FLNA
  / EMD those are the haplotypes without an X chromosome; elsewhere the sequence
  exists in the assembly and the graph leaves it out.
- **The VCF has no record for the largest events.** HPRC drops the biggest sites
  from the VCF and keeps the smaller sites nested inside them, so the
  **Variants** launch cannot show the UGT2B17 deletion. The page's map reads
  each haplotype's forms from the graph itself, so it draws the deletion and
  names it.
- **Only the examples are checked.** A gene or region you type can still land
  where the graph is a thread or the VCF is blank, and the page will offer the
  launch anyway.
- **No single launch shows the whole locus.** The graph shows which sequence
  exists, the VCF which haplotypes have it, and the lanes how a few haplotypes
  are arranged.

## Overview of chr1 with one node per variant region {#a-chromosome-and-back}

Open
[chr1 on the HPRC page](https://genomes.jbrowse.org/pangenomes/hprc/?region=chr1)
and press **Open in JBrowse**. Zoomed out past the graph adapter's `coarse`
level, JBrowse draws one node per bubble, so the whole chromosome fits. A curve
of segments per bubble (how many pieces of sequence each bubble holds) shows how
much the haplotypes disagree at each locus.

<Figure caption="GRCh38 chr1 with the cytogenetic bands and two tracks built from the graph's bubbles: segments per bubble as a blue curve, and one node per bubble as gold blocks." src="/img/pangenome/hprc_whole_chromosome.png" />

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds this
overview and writes the `coarse` slot.

## The C4 locus as a graph

Click the **HLA / MHC** example on the HPRC page, then **Open in JBrowse**. The
Graph launch opens genes, the GWAS Catalog's hits, the graph in the
force-directed layout, and under it a matrix of the structural variants each
haplotype has, one row per haplotype. Then:

- Hide the GWAS Catalog and the variant matrix in the track selector, leaving
  the genes over the graph.
- Type `C4A` in the location box, pick the chr6 hit, and zoom out twice to take
  in _C4B_.

<Figure caption="C4 as a force-directed graph under the hg38 genes. The dashed arc skips one copy of the C4-CYP21-TNX module." src="/img/pangenome/hprc_graph_anatomy.png" />

The graph has four kinds of object:

- the **backbone** is GRCh38's path, colored red to magenta by reference
  position
- a **bubble** is a place where haplotypes disagree
- an **allele** is a haplotype's sequence in place of the reference, drawn in
  charcoal because the reference path does not visit it
- an **edge** that skips sequence is a deletion, drawn as a dashed arc

## Opening the haplotype the HLA-DRB5 allele came from {#opening-the-haplotype-an-allele-came-from}

Type `chr6:32,500,000-32,560,000`, a window in MHC class II, a cluster of
immune-system HLA genes. Beside _HLA-DRB5_, a charcoal node is an allele much
shorter than the backbone stretch it hangs across. Left-click it. Its details
give `contributingHaplotype`, `NA20809#2`: the graph's `SN` tag records which
assembly minigraph first took the allele from.

**Open in** appears when the session has an assembly named or aliased
`sample#haplotype`, the graph's name for it. The launch's config declares every
release 2 haplotype that way. To declare one, load its contig sizes (or FASTA)
under a display name, with the graph's name as an alias:

```json addassembly
{
  "name": "NA20809.2",
  "aliases": ["NA20809#2"],
  "uri": "https://jbrowse.org/pangenome/hprc-grch38/NA20809.2.chrom.sizes"
}
```

Right-click the allele and take **Open in NA20809.2**. A second linear view
opens below the first, on that haplotype's chromosome 6, framed on the allele
with its CAT (Comparative Annotation Toolkit) gene annotation. Zoom out a few
steps.

<Figure caption="MHC class II with an allele's right-click menu open, and the view Open in NA20809.2 opens." src="/img/pangenome/hprc_haplotype_launch.png" />

The haplotype's CAT annotation has _HLA-DRB9_ and _HLA-DRB6_ either side of the
allele and no _HLA-DRB5_, the gene it hangs across on hg38.

## Listing every haplotype with the HLA-DRB5 allele {#every-haplotype-with-the-allele}

The graph names one source assembly per allele. HPRC's phased VCF lists every
haplotype's allele at every bubble: a record is one allele written against
GRCh38, and each sample's genotype holds a 1 for each of its haplotypes with
that allele. We'll add it to the graph launch's session:

```json addtrack loc=chr6:32,500,000-32,560,000
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
      "unit": "haplotype",
      "filter": ["jexl:alleleLength(feature)>=50"]
    }
  ]
}
```

- `unit: "haplotype"` draws one row per haplotype.
- `filter` drops records, and `alleleLength(feature)>=50` keeps alleles of 50 bp
  and up, the size of the bubbles minigraph draws. `alleleLength` is the length
  of the record's longest allele, so it counts an insertion's inserted bases.
- `fetchSizeLimit` raises the download cap past
  [its default](/docs/config/vcftabixadapter/#slot-fetchsizelimit). The VCF
  spells out each inserted allele, which puts the MHC class II window over the
  default.
- **Filter by → Edit filters...** in the track menu shows the filter and changes
  it.
- **Advanced → Edit plot...** in the track menu shows `unit` and `filter` as
  text and applies edits live.

Take **Clustering → Cluster rows by genotype...** in the track menu and press
**Run clustering**. The rows reorder so haplotypes with the same alleles sit
together, with a dendrogram beside them.

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="The VCF at MHC class II clustered from the track menu." />

Right-click the charcoal allele beside _HLA-DRB5_ in the force-directed graph
and take **Highlight in hg38**: a band marks the span of GRCh38 it replaces,
which covers most of _HLA-DRB5_.

<Figure caption="The VCF clustered by genotype over the force-directed graph. The arrow runs from the HLA-DRB5 allele's band to the same allele in the graph." src="/img/pangenome/hprc_graph_vs_callset.png" />

The VCF holds the _HLA-DRB5_ allele as four records, one for each of its
sequences, which differ by a base or two. The blue block under the band is the
haplotypes with any of the four, plus a smaller block with an 86 kb deletion
that removes the whole stretch.

## Reading C4's alleles as aligned bases {#the-same-alleles-as-aligned-bases}

HPRC also publishes its alignment as `hprc-v2.1-mc-grch38.full.maf.gz`, a
multiple alignment with one row of bases per haplotype. A `.tai` index beside
the large file makes a locus one ranged read:

```json addtrack loc=chr6:31,980,000-32,050,000
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
sequence that haplotype lacks. Then:

- **Clustering → Cluster rows by genotype...** on the VCF orders its rows.
- **Clustering → Cluster rows by identity...** on the alignment clusters over
  the window in view, because HPRC's file ships no guide tree.
- **Reset row order** restores the order in the file.

<Figure caption="C4 with the RefSeq genes, the VCF, alignment rows and the graph track. The arrow runs from the shaded band to the graph segment holding it." src="/img/maf_hprc_pangenome.png" />

The VCF's widest blue block is one record, a deletion of a whole C4-CYP21-TNX
module, which is the dashed arc in the C4 graph. Every alignment row in the
white block has that deletion in the VCF. The narrower blocks are haplotypes
that lack the 6.4 kb HERV-K (endogenous retrovirus) in a C4 gene's intron, which
GRCh38 carries: the difference between a long and a short C4.

## Reproduce it end to end

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
index files and the bubbles track in one command that runs on any rGFA. Run on
`hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files we host, and
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them records
their provenance. For a graph of your own, minigraph can list each assembly's
route through every bubble; see
[Which haplotypes pass through each segment](/docs/tutorials/pangenome_prepare_graph#which-haplotypes-walk-each-segment).

## See also

- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_hprc_repeats)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/maf_track)
- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_cattle)
- [BandageJS](https://jbrowse.org/demos/bandagejs/)

## External links

- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), which define the `SN`/`SO`/`SR`
  tags this page opens the graph by, and whose `bubble` subcommand calls the
  bubbles it reads.
- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), which writes the
  `.tai` index that makes the alignment addressable by locus.
- [ggbandage](https://github.com/GMOD/ggbandage), which draws
  [the C4 graph](https://github.com/GMOD/ggbandage/blob/main/docs/gallery.md#c4a-and-c4b-in-the-stress-layout)
  from the same hosted files as ggplot2 layers in R.
- [ggtubemap](https://github.com/GMOD/ggtubemap), which draws
  [HLA-A's haplotypes](https://github.com/GMOD/ggtubemap#from-a-walk-file) as a
  tube map in ggplot2.

## Citations

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the Minigraph-Cactus graph, the multiple alignment and the VCFs
  `vg deconstruct` writes from the graph.

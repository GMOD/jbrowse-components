---
title: Pangenome (cattle)
description:
  Open the bovine super-pangenome, deconstruct it into the callset that names
  which assembly carries what, and find published breed and species variants in
  it
guide_category: Tutorials
tutorial_category: Pangenomes
---

The bovine super-pangenome aligns twelve cattle assemblies against ARS-UCD1.2.
The panel is unusually wide for a livestock pangenome, with taurine and indicine
breeds beside yak, bison and gaur, so a locus that varies here varies across
most of the genus.

Each of those assemblies walks the graph as a named path, and `vg deconstruct`
turns those paths into a VCF. The same locus then reads as a graph showing where
sequence is present and absent, and as a callset naming who carries it.

We serve the graph as the same rGFA projections the
[HPRC pangenome page](/docs/tutorials/pangenome_hprc/) opens, so the tracks, the
adapters and the coarse tier are that page's.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, the step
describes a current limit of the view. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  loaded the way the HPRC page loads it

## Where the data comes from

The projections, the callset and its sample table are hosted beside the graph,
and OMIA supplies the curated causal variants:

- the segment and link index:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.segs.bed.gz
  and
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.links.bed.gz
- the bubble index:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.bubbles.bed.gz
- the allele inventory:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.alleles.bed.gz
- the coarse tier:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.tier10000
- the deconstructed callset:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.vcf.gz
- the breed and lineage of each assembly in the callset:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.samples.tsv
- OMIA's database dump, the source of the curated variant lane:
  https://omia.org/static/omia.sql.gz

[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) describes
what each of the graph files holds and how a graph produces them.

## Where the graph and the callset show different things

ARS-UCD1.2 lacks an 11 kb segment beside _HSPA1A_ that carries a second copy of
the heat shock gene, _HSPA1B_. Leonard et al. (2022) recovered it in every
assembly they built. The **graph** holds that segment as alleles in the allele
inventory, and it attributes them only by convention. These graphs record no
construction rank, so `firstSeenIn` in the allele file names the first assembly
in a fixed list, and that assembly need not carry the sequence.

The **callset** attributes each allele. One `vg deconstruct` call per chromosome
over the same graph gives a genotype per assembly:

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
# -p writes vg's own PackedGraph format, which deconstruct reads
vg convert -g "$TMPDIR/$k.renamed.gfa" -p > "$TMPDIR/$k.vg"
# -p names the reference path to decompose against; -a processes nested
# snarls too, so a bubble inside a bubble gets its own record
vg deconstruct -p "chr$k" -a -t "$THREADS" "$TMPDIR/$k.vg" > "vcf/chr$k.vcf.tmp"
```

The VCF names each assembly by the three-letter code its path carries in the
graph. The sample table gives each code a breed and a lineage, so `rows.labels`
writes the breed beside each row, `rowColor` tints the row by lineage, and
`rows.domain` lists the cattle breeds above the wild species. Every assembly is
one haplotype, and `renderingMode: "phased"` draws one row per assembly with a
second alternate allele in a colour of its own:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "bovine_pangenome_vcf",
  "name": "Bovine super-pangenome variants (12 assemblies)",
  "assemblyNames": ["bosTau9"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.samples.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "bovine_pangenome_vcf_regular",
      "renderingMode": "phased",
      "rows": {
        "domain": [
          "ANG",
          "BSW",
          "HIG",
          "OBV",
          "PIE",
          "SIM",
          "BRA",
          "NEL",
          "GAU",
          "BIS",
          "YAK"
        ],
        "labels": {
          "ANG": "Angus",
          "BSW": "Brown Swiss",
          "HIG": "Highland",
          "OBV": "Original Braunvieh",
          "PIE": "Piedmontese",
          "SIM": "Simmental",
          "BRA": "Brahman",
          "NEL": "Nellore",
          "GAU": "Gaur",
          "BIS": "Bison",
          "YAK": "Yak"
        }
      },
      "rowColor": {
        "field": "lineage",
        "domain": ["taurine", "indicine", "gaur", "bison", "yak"],
        "range": ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00"]
      }
    }
  ]
}
```

Open `chr23:27,508,000-27,536,000` with the RefSeq genes, the callset and the
allele inventory.

<Figure caption="HSPA1A on ARS-UCD1.2: RefSeq genes, the deconstructed callset with one row per assembly, and the allele inventory. Every row but the yak carries the insertion the inventory lists without carriers." src="/img/pangenome/bovine_bola.png" />

The yak row carries the reference. Leonard et al. built no yak assembly, so
their result has nothing to say about it.

The mouse graph is the other end of this. `minigraph` writes no path lines at
all, so there is no callset to deconstruct and nothing recovers carriage.
[](/docs/tutorials/pangenome_mouse) works with what is left.

## Published variants in the callset

Each locus below is a structural variant a paper reported in one of these breeds
or species. The rows that do not carry it are the control.

### The Celtic polled allele

Angus cattle are born without horns. Medugorac et al. (2012) traced the Celtic
form of polledness to a 202 bp duplication and insertion on chromosome 1, which
OMIA curates as OMIA 000483-9913. Add OMIA's cattle records as a lane:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "omia_cattle_variants",
  "name": "OMIA causal variants (cattle)",
  "assemblyNames": ["bosTau9"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "omia_cattle_variants.gff3.gz"
  },
  "displayDefaults": {
    "labels": {
      "description": "jexl:feature.inheritance"
    }
  }
}
```

Then open `chr1:2,424,000-2,436,000`.

<Figure caption="The POLLED locus on ARS-UCD1.2: RefSeq genes, OMIA's record of the Celtic polled allele, and the callset. Only the Angus row carries the insertion under the record." src="/img/pangenome/bovine_polled.png" />

OMIA also records the Friesian polled allele, an 80 kb duplication 200 kb
further along, which Holstein cattle carry. The panel has no Holstein, and the
callset holds nothing that size there.

### A repeat upstream of KIT in white-headed cattle

Simmental and Hereford cattle have white heads. Milia et al. (2025) tied the
trait to a 14.3 kb segment repeated in tandem upstream of _KIT_: white-headed
breeds carry extra copies, colour-headed breeds a deletion. The Hereford
reference holds a collapsed copy. Open `chr6:70,080,000-70,180,000`.

<Figure caption="Upstream of KIT on ARS-UCD1.2: RefSeq genes and the callset. The Simmental row carries its own allele across the repeat, and every other row carries the deletion." src="/img/pangenome/bovine_kit.png" />

Click the Simmental cell to read its allele length against the reference.

### A deletion of TAS2R46 in gaur

_TAS2R46_ encodes a bitter taste receptor. Leonard et al. (2022) found a 17 kb
deletion in gaur that removes it. Open `chr5:98,575,000-98,615,000`.

<Figure caption="TAS2R46 on ARS-UCD1.2: RefSeq genes and the callset. The gaur row carries the deletion, and four cattle rows carry a different allele across the same span." src="/img/pangenome/bovine_tas2r46.png" />

The four cattle rows hold an allele about as long as the reference with a
different sequence. Click one to compare the two.

## A whole chromosome, off the coarse tier

The level-of-detail tier has one node per bubble, which makes a whole chromosome
drawable. Type `chr23` on ARS-UCD1.2 with the tier and the bubble curve showing.
Over a full cattle chromosome the _fine_ segments track refuses with "Too many
features", and the tier draws.

<Figure caption="A whole ARS-UCD1.2 chromosome with the RefSeq genes, the segments-per-bubble curve and the bubble tier on one axis. BoLA is the densest stretch of the curve." src="/img/pangenome/bovine_whole_chromosome.png" />

A graph view pointed at a tier raises `maxRegionBp` explicitly. The view refuses
a cut wider than 5 Mb. That width limit stands in for node count, and it tracks
node count well only at segment granularity.

:::note

The bovine pangenome holds a dozen assemblies, against ninety haplotypes for
HPRC. Its cuts are chains with a few loops, and the anchored layout often reads
better. Check the node and edge counts in the graph pane's header before
switching to the force layout. Use the force layout where the bubbles lane
reports a tangled window.

:::

BoLA came out of the same ranking the
[mouse page](/docs/tutorials/pangenome_mouse#finding-the-loci) describes, which
ranks the coarse tier by segments per bubble and then names each entry off the
reference annotation. It is the densest stretch of chr23 in the figure above,
and the ranking found it without a curated list.

## Build it yourself

[`build_bovine_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bovine_pangenome.sh)
downloads the published archive, recovers rGFA tags from its path lines with
[`gfa_paths_to_rgfa.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/gfa_paths_to_rgfa.py),
projects the files above, and deconstructs the callset. It takes about half an
hour after the download.

The script writes a `README.txt` beside the data recording the source, the
modifications, the tool versions and the audits that ran. Copy the audits into
your own build. The build stops unless the reference path reproduces the
reference chromosome lengths, and stops on a duplicate segment id after
renumbering. Without these audits, either failure produces a graph with wrong
coordinates, and every downstream check passes on it.

If your own graph has path lines, use
[`build_pggb_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pggb_tabix.sh)
in place of `build_rgfa_tabix.sh`. The PGGB script walks the paths and writes a
carriage tag, which rGFA has no field for. The graph view then shows which
samples cross each node.

The OMIA lane comes from OMIA's nightly database dump.
[`build_omia_cattle_variants.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_omia_cattle_variants.sh)
keeps the cattle records published on ARS-UCD1.2 or ARS-UCD1.3, which share
every chromosome's coordinates, and writes them as GFF3:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_omia_cattle_variants.sh
bash build_omia_cattle_variants.sh   # writes ./omia_cattle_build/
```

## See also

- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_prepare_graph)

## References

- Leonard AS, Crysnanto D, Fang ZH, Heaton MP, Vander Ley BL, Herrera C,
  Bollwein H, Bickhart DM, Kuhn KL, Smith TPL, Rosen BD, Pausch H. Structural
  variant-based pangenome construction has low sensitivity to variability of
  haplotype-resolved bovine assemblies. Nature Communications. 2022;13:3012.
  https://doi.org/10.1038/s41467-022-30680-2
- Leonard AS, Crysnanto D, Mapel XM, Bhati M, Pausch H. Graph construction
  method impacts variation representation and analyses in a bovine
  super-pangenome. Genome Biology. 2023;24:124.
  https://doi.org/10.1186/s13059-023-02969-y
- Li H, Feng X, Chu C. The design and construction of reference pangenome graphs
  with minigraph. Genome Biology. 2020;21:265.
  https://doi.org/10.1186/s13059-020-02168-z
- Medugorac I, Seichter D, Graf A, Russ I, Blum H, Göpel KH, Rothammer S,
  Förster M, Krebs S. Bovine polledness: an autosomal dominant trait with
  allelic heterogeneity. PLoS ONE. 2012;7(6):e39477.
  https://doi.org/10.1371/journal.pone.0039477
- Milia S, Leonard AS, Mapel XM, Bernal Ulloa SM, Drögemüller C, Pausch H.
  Taurine pangenome uncovers a segmental duplication upstream of KIT associated
  with depigmentation in white-headed cattle. Genome Research.
  2025;35(4):1041-1052. https://doi.org/10.1101/gr.279064.124

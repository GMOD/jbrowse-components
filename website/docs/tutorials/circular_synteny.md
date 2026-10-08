---
title: Synteny on a circle (human and mouse)
sidebar_label: Synteny (circular, human and mouse)
description:
  Put two genomes on one circular view, draw UCSC's liftOver chain between them
  as ribbons straight from the copy jbrowse.org indexes, colour the ribbons by
  chromosome and by strand, read the mouse karyotype in human chromosomes, add a
  gene density ring per genome, and check a ribbon and a ring value against the
  files they came from
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

We lay the human and mouse chromosomes around one circle and draw UCSC's
hg38-to-mm39 liftOver chain as ribbons between them, so one picture shows where
the autosomes have been shuffled and where the X has not. The circle is a
Circos-style circular genome view opened on both assemblies at once. It reads
the chain from the indexed copy on jbrowse.org and orders the mouse arc to
follow the human one. We add a gene density ring per genome, then read one
ribbon and one ring value back out of the indexed alignment file and the bigWig
they came from.

## Prerequisites

- a JBrowse to open the files in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- to build the density ring for another pair of genomes, htslib (`bgzip`,
  `tabix`), `bedGraphToBigWig` and `bigWigToBedGraph` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), and `node` for
  the [JBrowse CLI](/docs/cli)

## Where the data comes from

UCSC's hg38-to-mm39 liftOver chain (Kent et al. 2003), the RefSeq curated gene
sets of both genomes from genomes.jbrowse.org's copies of the UCSC hubs, and the
density bigWig the build script makes of them.

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- RefSeq curated genes, hg38:
  https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz
- RefSeq curated genes, mm39:
  https://jbrowse.org/ucsc/mm39/ncbiRefSeqCurated.gff.gz

<details>
<summary>Read by URL (no download needed)</summary>

- the chain:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/liftOver/hg38ToMm39.over.chain.gz

</details>

## Declaring the human and mouse assemblies

The ribbons name chromosomes, so the circle needs both genomes declared. Each
alias table is the hub's with the build's genome-prefixed names added, so a
track naming `1`, `chr1` or `hg38.chr1` finds `chr1`:

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://jbrowse.org/demos/circular_synteny/hg38.chromAlias.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

```json addassembly
{
  "name": "mm39",
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/mm39/bigZips/mm39.2bit",
  "refNameAliases": {
    "uri": "https://jbrowse.org/demos/circular_synteny/mm39.chromAlias.txt"
  }
}
```

## The chain as an indexed alignment

jbrowse.org keeps every liftOver chain UCSC publishes as an indexed PAF, one row
per chain, the same files the
[vertebrates tutorial](/docs/tutorials/hg38_vertebrates_synteny) stacks under a
locus. The track names that file and its two assemblies, query first. A chain's
query is the genome it lifts to, so for hg38ToMm39 that is mouse:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hg38ToMm39_liftover",
  "name": "hg38 to mm39 liftOver chain",
  "assemblyNames": ["mm39", "hg38"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "uri": "https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz",
    "csi": true,
    "queryAssembly": "mm39",
    "targetAssembly": "hg38"
  }
}
```

For your own pair, convert the alignment to a PIF, JBrowse's indexed PAF. A
chain goes through `chain2paf` from
[paftools](https://github.com/lh3/minimap2/tree/master/misc); a PAF from
minimap2 or wfmash goes straight in. Then add the track with `assemblyNames` as
`query,target`:

```bash
paftools.js chain2paf pair.over.chain.gz > pair.paf
jbrowse make-pif pair.paf
jbrowse add-track pair.pif.gz -a query,target --load copy
```

A liftOver chain set holds a few hundred chains that cover the genome and tens
of thousands of short ones, most of them repeats and gene copies. **Min length**
in the view's menu keeps the short ones off the figure, and the sessions below
set it to 100 kb with `minAlignmentLength`.

## Opening both genomes on one circle

The circular view's `assembly` takes a list, and each assembly lays out its
chromosomes in turn: hg38 takes the first arc of the circle, mm39 the next, and
ribbons cross between them. `displayedRegionNames` is matched against each
assembly separately, so one list of chromosome names keeps both genomes'
unplaced contigs off the circle. The import form's Quick start opens the same
circle from the chain track (**Add → Circular view**, then pick the chain
track). As a session:

```json session config=https://jbrowse.org/demos/circular_synteny/config.json
{
  "defaultSession": {
    "name": "hg38 and mm39 on one circle",
    "views": [
      {
        "type": "CircularView",
        "assembly": ["hg38", "mm39"],
        "minAlignmentLength": 100000,
        "displayedRegionNames": [
          "chr1",
          "chr2",
          "chr3",
          "chr4",
          "chr5",
          "chr6",
          "chr7",
          "chr8",
          "chr9",
          "chr10",
          "chr11",
          "chr12",
          "chr13",
          "chr14",
          "chr15",
          "chr16",
          "chr17",
          "chr18",
          "chr19",
          "chrX"
        ],
        "height": 780,
        "tracks": ["hg38ToMm39_liftover"]
      }
    ]
  }
}
```

Both assemblies name their chromosomes alike, so the arcs carry the same labels.
To read the circle:

- **Layout.** Human chromosomes run clockwise from the top and mouse chromosomes
  follow; the title bar names the two in that order.
- **Colour.** Each ribbon takes the ideogram colour of the human chromosome it
  leaves, so a human chromosome's pieces can be followed to every mouse
  chromosome that holds one.
- **Twists.** A reverse alignment twists between its two ends.
- **Faint ribbons.** A row narrower than a pixel draws at the share of the pixel
  it covers, as in the
  [linear synteny view](/docs/user_guides/linear_synteny_view), so large blocks
  dominate and short rows stay faint.

<Figure src="/img/circular_synteny/ribbons.png" caption="Human chromosomes clockwise from the top, mouse chromosomes after them, and every liftOver row of 100 kb and over as a ribbon in the colour of the human chromosome it leaves. Each human autosome fans out to several mouse chromosomes, and the two X arcs hold one bundle." />

## Ordering the mouse arc to follow human

In native contig order, a mouse chromosome sits wherever its number falls, so
ribbons cross the middle of the circle to reach their human partners. On open,
the circle reorders the mouse arc as the
[linear synteny view](/docs/user_guides/linear_synteny_view) and the
[dotplot](/docs/user_guides/dotplot_view) do, placing each mouse chromosome next
to the human chromosome it shares the most aligned bases with.

- The circle draws the mouse arc mirrored, so a mouse chromosome running the
  same way as its human partner faces it and their ribbons run straight across.
- A mouse chromosome running antiparallel is flipped whole, so a twist left in
  the figure is an inversion inside a chromosome.
- **Re-order chromosomes** in the view's menu reruns the reorder, and
  `"autoDiagonalize": false` on the view keeps each genome in its native contig
  order.

## The mouse genome in human chromosomes

Each stretch of a mouse chromosome's ideogram is painted the colour of the human
chromosome aligned to it, and grey where nothing is. A mouse chromosome carved
from one human chromosome is one colour, and one assembled from several is
striped with them.

Hover the mouse chr11 band on the circle opened above to dim every ribbon that
misses it. The tooltip lists each human chromosome aligned to it with the share
it covers.

<Figure src="/img/circular_synteny/band_hover.png" caption="Hovering mouse chr11 dims every ribbon that does not touch it, and the tooltip lists the human chromosomes it is assembled from, largest share first." />

## Colouring the ribbons by strand

The chromosome colours show where each piece went; strand shows which way round
it lies. Two settings switch the colouring:

- **Color by... → Strand** in the view's menu paints the reverse alignments a
  second colour, and **Show legend** names the two.
- In a session, `"color": { "field": "strand" }` on the view sets the same, and
  `"field": "query"` is the chromosome colouring the circle opens with.

<Figure src="/img/circular_synteny/color_by_strand.png" caption="The human and mouse circle coloured by strand. Whole mouse chromosomes take one colour or the other by which way they run against their human partners; a ribbon of the other colour inside a bundle is an inversion." />

## The X chromosome as the control

The X chromosome has stayed whole across the two lineages, so no ribbon at the
100 kb cut should join it to an autosome. Open the first session above with
`displayedRegionNames` cut to `["chr1", "chr2", "chrX"]` to read the control.
The two autosomes cross-wire between the genomes, and the X ribbons run between
the two X arcs with nothing joining either X to an autosome.

<Figure src="/img/circular_synteny/x_control.png" caption="Human chr1, chr2 and chrX in one half of the circle and the same three mouse chromosomes in the other, with a gene density ring inside the ideogram. The autosome ribbons cross between the genomes, and the X ribbons stay between the two X arcs." />

Chain rows under the 100 kb **Min length** cut do join the X to autosomes: the
PIF holds short rows between human chrX and mouse autosomes, each a repeat or a
retrocopy a few hundred bases long. Lowering **Min length** in the view's menu
brings them back.

## Gene density as a ring

A track that draws in the linear genome view also draws on the circle, as a ring
inside the ideogram, so asking whether the conserved blocks are the gene-rich
stretches takes one more track. `jbrowse make-density` counts a GFF3's top-level
features per bin into a bigWig, so a gene is one count however many transcripts
hang under it.

For one genome, `make-density` takes the GFF3 and its chrom.sizes directly:

```bash
jbrowse make-density genes.gff.gz --chrom-sizes genome.chrom.sizes --bin 100000
```

A ring on a two-genome circle comes from one track naming both assemblies, so
both genomes' densities go into one bigWig.

<!-- from: scripts/build_circular_synteny.sh -->

```bash
# one chrom.sizes and one GFF3 for the pair, every contig prefixed by genome
for g in hg38 mm39; do
  awk -v g="$g" -F'\t' -v OFS='\t' '{print g "." $1, $2}' "$g.chrom.sizes" >> hg38ToMm39.chrom.sizes
  gzip -dc "$g.genes.gff.gz" | awk -v g="$g" -F'\t' -v OFS='\t' '/^#/ {next} {$1 = g "." $1; print}' >> hg38ToMm39.genes.gff
  # the hub's alias table, plus the prefixed name as one more alias per row
  awk -v g="$g" -F'\t' -v OFS='\t' '/^#/ {print; next} {print $0, g "." $1}' "$g.hub.chromAlias.txt" > "$g.chromAlias.txt"
done
bgzip -f hg38ToMm39.genes.gff
# a whole-genome ring is megabases per pixel, so the bin is 100 kb
jbrowse make-density hg38ToMm39.genes.gff.gz --chrom-sizes hg38ToMm39.chrom.sizes --bin 100000
```

The track names both assemblies, and its display defaults draw it as a heatmap
strip whose colour is the average over each pixel's bins:

```json addtrack
{
  "trackId": "hg38ToMm39_gene_density",
  "name": "Genes per 100 kb",
  "uri": "https://jbrowse.org/demos/circular_synteny/hg38ToMm39.genes.gff.density.bw",
  "assemblyNames": ["hg38", "mm39"],
  "displayDefaults": {
    "mark": "span",
    "summaryScoreMode": "mean",
    "color": {
      "field": "score",
      "scale": "threshold",
      "range": ["#e01e26", "#d95f02"]
    },
    "height": 40
  }
}
```

**Edit colors/arrangement...** in the track menu sets the `color` pair, one
colour below the baseline and one above.

Rings stack inward from the ideogram in the order the view's `tracks` lists
them, and the ribbons draw inside the innermost ring, so the density entry goes
before the synteny track:

```json session config=https://jbrowse.org/demos/circular_synteny/config.json
{
  "defaultSession": {
    "name": "hg38 and mm39 with a gene density ring",
    "views": [
      {
        "type": "CircularView",
        "assembly": ["hg38", "mm39"],
        "minAlignmentLength": 100000,
        "displayedRegionNames": [
          "chr1",
          "chr2",
          "chr3",
          "chr4",
          "chr5",
          "chr6",
          "chr7",
          "chr8",
          "chr9",
          "chr10",
          "chr11",
          "chr12",
          "chr13",
          "chr14",
          "chr15",
          "chr16",
          "chr17",
          "chr18",
          "chr19",
          "chrX"
        ],
        "height": 780,
        "tracks": [
          {
            "trackId": "hg38ToMm39_gene_density",
            "type": "LinearWiggleDisplay",
            "mark": "span",
            "summaryScoreMode": "mean",
            "color": {
              "field": "score",
              "scale": "threshold",
              "range": ["#e01e26", "#d95f02"]
            },
            "height": 40
          },
          "hg38ToMm39_liftover"
        ]
      }
    ]
  }
}
```

<Figure src="/img/circular_synteny/rings.png" caption="The human and mouse circle with a gene density ring inside the ideogram, dark where a stretch is gene-rich. The densest stretches sit on the small human chromosomes and their mouse counterparts, and both X arcs are paler than the autosomes beside them." />

## Checking a ribbon and a ring value against the source files

Cut the ring session's `displayedRegionNames` to `["chr1", "chr2", "chrX"]` and
hover the widest ribbon, the X block that runs reverse between the two genomes
and so twists. The ribbon fills in the hover colour, and a tooltip gives its
span in each genome and its strand.

<Figure src="/img/circular_synteny/ribbon_hover.png" caption="The widest X ribbon hovered on the three-chromosome circle, filled grey and crossing itself between the two X arcs because it is on the reverse strand. The tooltip names its span in each genome." />

The two loci in the tooltip come from one row of the PIF. `tabix` returns that
row at the human coordinate the tooltip starts at:

```bash
# the t prefix asks for the row in hg38 coordinates; q would ask in mm39's
tabix https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz tchrX:10447551-10447552
```

The row's strand column reads `-`, and its query span on mouse chrX is the other
end of the ribbon. `bigWigToBedGraph` reads the ring's values back, printing the
bins under any stretch of either arc, addressed by the prefixed contig name the
bigWig has.

```bash
# the first 100 kb of the X block, then the start of human chr19
bigWigToBedGraph -chrom=hg38.chrX -start=10447550 -end=10547550 \
  https://jbrowse.org/demos/circular_synteny/hg38ToMm39.genes.gff.density.bw stdout
bigWigToBedGraph -chrom=hg38.chr19 -start=0 -end=300000 \
  https://jbrowse.org/demos/circular_synteny/hg38ToMm39.genes.gff.density.bw stdout
```

A bin's value is the count of genes starting in it, so the pale X ring and the
dark chr19 ring are the two counts side by side.

## Your own pair of genomes

The script takes any UCSC pair by name. A pair of your own needs the files the
script writes:

- an alignment as a sorted, tabix-indexed PIF. jbrowse.org's copy of a UCSC
  liftOver chain opens as is with `"csi": true` beside its URL, and a pair with
  no hosted chain goes through the `make-pif` commands above. The synteny
  track's `assemblyNames` is `[query, target]` either way
- both assemblies declared in the config, from a hub entry or the `addassembly`
  blocks above (`jbrowse add-assembly genome.fa`)
- one bigWig per ring, naming the ring's assembly; for a ring that covers both
  genomes, one bigWig with prefixed contigs and an alias per assembly as above

## Reproduce it end to end

The script works in four steps:

1. Fetch the hg38 and mm39 hub configs, chromosome sizes and alias tables, and
   both RefSeq curated gene sets.
2. Prefix every contig with its genome and add the prefixed name to each alias
   table, so one bigWig can hold both genomes' counts.
3. Count genes per 100 kb into that bigWig with `jbrowse make-density`, one
   count per gene however many transcripts it has.
4. Write the config with the chain track pointing at jbrowse.org's indexed copy,
   which the ribbons and the reorder both read.

`TARGET` and `QUERY` pick another UCSC pair, `PIF` points the track at a chain
indexed elsewhere, `MIN_LENGTH` moves the cut, and `BASE_URL` is the prefix the
finished files will be served under; see [Prerequisites](#prerequisites).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_circular_synteny.sh
bash build_circular_synteny.sh
```

## See also

- [](/docs/user_guides/circular_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/tutorials/hg38_vertebrates_synteny)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/gene_density)

## Citations

- Kent WJ, Baertsch R, Hinrichs A, Miller W, Haussler D. Evolution's cauldron:
  duplication, deletion, and rearrangement in the mouse and human genomes. Proc
  Natl Acad Sci USA (2003). https://doi.org/10.1073/pnas.1932072100
- Ohno S. Sex Chromosomes and Sex-Linked Genes. Springer (1967), the argument
  that the mammalian X chromosome's gene content is conserved across species.
- Krzywinski M, Schein J, Birol I, et al. Circos: an information aesthetic for
  comparative genomics. Genome Research 19:1639-1645 (2009).
  https://doi.org/10.1101/gr.092759.109

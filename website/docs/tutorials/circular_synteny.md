---
title: Synteny on a circle (human and mouse)
sidebar_label: Synteny (circular, human and mouse)
description:
  Put two genomes on one circular view, draw UCSC's liftOver chain between them
  as ribbons straight from the copy jbrowse.org indexes, colour the ribbons by
  chromosome and by strand, add a gene density ring per genome, and check a
  ribbon and a ring value against the files they came from
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

We lay the human and mouse chromosomes around one circle and draw UCSC's
hg38-to-mm39 liftOver chain as a ribbon between the stretch each row covers in
each genome, so where the autosomes have been shuffled and where the X has not
is one picture. The chain comes straight from the indexed copy jbrowse.org
keeps, the circle orders the mouse arc to follow the human one as it opens, a
gene density ring per genome sits inside the ideogram, and the page ends by
reading one ribbon and one ring value back out of the PIF and bigWig they came
from. The circle is a circular genome view opened on two assemblies at once.

## Prerequisites

- a JBrowse to open them in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- to build the density ring for another pair of genomes, htslib (`bgzip`,
  `tabix`), `bedGraphToBigWig` and `bigWigToBedGraph` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), and `node` for
  the [JBrowse CLI](/docs/cli)

## Where the data comes from

UCSC's hg38-to-mm39 liftOver chain (Kent et al. 2003), the RefSeq curated gene
sets of both genomes from genomes.jbrowse.org's copies of the UCSC hubs, and the
density bigWig the build script makes of them, rehosted so the figures open
without the build.

- the chain:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/liftOver/hg38ToMm39.over.chain.gz
- the same chain as an indexed PAF, every row, which the ribbons draw from and
  the last section queries:
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz
- the hub configs the two assemblies are taken from, those of the
  [hg38](https://genomes.jbrowse.org/ucsc/hg38/) and
  [mm39](https://genomes.jbrowse.org/ucsc/mm39/) pages:
  https://jbrowse.org/ucsc/hg38/config.json and
  https://jbrowse.org/ucsc/mm39/config.json
- RefSeq curated genes, hg38:
  https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz
- RefSeq curated genes, mm39:
  https://jbrowse.org/ucsc/mm39/ncbiRefSeqCurated.gff.gz
- both genomes' gene density in one bigWig, the ring:
  https://jbrowse.org/demos/circular_synteny/hg38ToMm39.genes.gff.density.bw
- the finished config, both assemblies and the four tracks:
  https://jbrowse.org/demos/circular_synteny/config.json

## Two genomes on one circle

A whole-genome alignment between two species is usually read as a dotplot or as
lanes under one locus. The Circos-style picture asks a different question: for
each chromosome of one genome, which chromosomes of the other carry its
sequence, and how much of each. Human and mouse are the textbook case. The
autosomes have been cut and rejoined many times since the two lineages split,
and the X chromosome has not, so a human autosome should fan out across several
mouse chromosomes while the two X chromosomes hold one bundle between them. That
expectation is the control the figures are read against.

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

A liftOver chain set holds a few hundred chains that cover the genome and tens
of thousands of short ones, most of them repeats and gene copies. The circle's
**Min length** setting keeps those off the figure: the sessions below set
`minAlignmentLength` to 100 kb, and the same control sits in the view's menu, so
the cut can be moved without touching a file.

## The circle

The circular view's `assembly` takes a list, and each assembly lays its
chromosomes out in turn: hg38 takes the first arc of the circle and mm39 the
next, and a ribbon crosses between them. `displayedRegionNames` is resolved
against each assembly separately, so one list of chromosome names keeps both
genomes' unplaced contigs off the circle. The circle reorders the mouse arc as
it opens, which the next section explains. The import form's Quick start opens
the same circle from the chain track; as a session it is:

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

hg38 and mm39 share their chromosome names, so the arcs are labelled identically
around the circle: the human chromosomes run clockwise from the top and the
mouse chromosomes follow, and the view's title bar names the two in that order.
Each ribbon takes the ideogram colour of the human chromosome it leaves, so a
human chromosome's pieces can be followed to every mouse chromosome that carries
one, and a reverse alignment reads as a twist between its two ends. A row
narrower than a pixel draws at the share of the pixel it covers, as the
[linear synteny view](/docs/user_guides/linear_synteny_view) draws it, so the
large blocks carry the picture and the short rows the filter lets through stay
faint.

<Figure src="/img/circular_synteny/ribbons.png" caption="Human chromosomes clockwise from the top, mouse chromosomes after them, and every liftOver row of 100 kb and over as a ribbon in the colour of the human chromosome it leaves. Each human autosome fans out to several mouse chromosomes; the two X arcs hold one bundle." />

## Ordering the second genome

The human and mouse arcs run the same way round the circle, so a mouse
chromosome laid out in its native contig order sits opposite the human
chromosome it does not align to, and each ribbon crosses the middle to reach its
partner.

The circle runs the reorder the
[linear synteny view](/docs/user_guides/linear_synteny_view) and the
[dotplot](/docs/user_guides/dotplot_view) run on open: each mouse chromosome
takes the human chromosome it shares the most aligned bases with, and the mouse
arc follows that order. The circle lays it out mirrored, so the mouse arc's
coordinate falls where the human arc's rises. Chords between two arcs cross only
where both sides rise together, so the ribbons come out as a band. A mouse
chromosome that runs antiparallel to its human partner is drawn the other way
round again, and the twists left on the figure are the inversions.

**Re-order chromosomes** in the view's menu runs the same pass on demand, with a
progress bar and a cancel; re-running it on a circle that is already ordered
moves nothing. `"autoDiagonalize": false` on the view keeps each genome in its
own contig order.

## Colouring the ribbons by strand

The chromosome colours show where each piece went; strand shows which way round
it lies. **Color by... → Strand** in the view's menu paints the reverse
alignments a second colour. A mouse chromosome that runs antiparallel to its
human partner is then one colour along its whole bundle, and a ribbon of the
other colour inside that bundle is an inversion within it. As a session setting
it is `"color": { "field": "strand" }` on the view, and `"field": "query"` is
the chromosome colouring the circle opens with.

<Figure src="/img/circular_synteny/color_by_strand.png" caption="The same circle coloured by strand. Whole mouse chromosomes take one colour or the other by which way they run against their human partners; a ribbon of the other colour inside a bundle is an inversion." />

## The X chromosome as the control

Three chromosomes of each genome make the control readable. The two autosomes
cross-wire between the genomes, and the X ribbons run between the two X arcs
with nothing joining either X to an autosome.

<Figure src="/img/circular_synteny/x_control.png" caption="Human chr1, chr2 and chrX in one half of the circle and the mouse three in the other, the mouse arc mirrored. The autosomes' ribbons cross between the genomes; the X ribbons stay between the two X arcs, and no ribbon leaves either X for an autosome." />

The chain rows shorter than the cut are where the X does touch the autosomes:
the PIF holds a few hundred of them between human chrX and mouse autosomes, each
a repeat or a retrocopy a few hundred bases long, and the length filter keeps
them off the circle. Lowering **Min length** in the view's menu brings them
back.

## Gene density as a ring

Any track that draws in the linear genome view draws on the circle as a ring
inside the ideogram, so the question of whether the conserved blocks are the
gene-rich stretches is one more track. `jbrowse make-density` counts a GFF3's
top-level features per bin into a bigWig, so a gene is one count however many
transcripts hang under it.

A ring on a two-genome circle is drawn by one track that names both assemblies,
so both genomes' densities go into one bigWig: each contig is prefixed with its
genome before counting, and each assembly's alias table gains that spelling as
an alias of the bare name, which is how the track's `chr1` request from the
mouse arc reaches `mm39.chr1` and the human arc's reaches `hg38.chr1`.

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

The track is a quantitative track naming both assemblies, and on the circle it
is opened as a density strip whose colour is the average over each pixel's bins:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "hg38ToMm39_gene_density",
  "name": "Genes per 100 kb",
  "assemblyNames": ["hg38", "mm39"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/circular_synteny/hg38ToMm39.genes.gff.density.bw"
  },
  "displays": [
    {
      "type": "LinearWiggleDisplay",
      "displayId": "hg38ToMm39_gene_density-LinearWiggleDisplay",
      "mark": "heatmap",
      "summaryScoreMode": "avg",
      "height": 40
    }
  ]
}
```

Rings stack inward from the ideogram in the order the view's `tracks` lists
them, and the ribbons draw inside the innermost ring, so the density entry goes
before the synteny track:

```json session config=https://jbrowse.org/demos/circular_synteny/config.json
{
  "defaultSession": {
    "name": "hg38 and mm39 with gene density rings",
    "views": [
      {
        "type": "CircularView",
        "assembly": ["hg38", "mm39"],
        "minAlignmentLength": 100000,
        "displayedRegionNames": ["chr1", "chr2", "chrX"],
        "height": 780,
        "tracks": [
          {
            "trackId": "hg38ToMm39_gene_density",
            "type": "LinearWiggleDisplay",
            "mark": "heatmap",
            "summaryScoreMode": "avg",
            "height": 40
          },
          "hg38ToMm39_liftover"
        ]
      }
    ]
  }
}
```

<Figure src="/img/circular_synteny/rings.png" caption="The same circle with the gene density ring inside the ideogram, dark where a stretch is gene-rich. The densest stretches sit on the small human chromosomes and their mouse counterparts, and both X arcs are pale along their length." />

A mirrored arc's ring is mirrored with it, so a bin sits under the stretch of
ideogram it belongs to whichever way round that chromosome is drawn.

## Reading a ribbon back

Hovering a ribbon fills it in the hover color, and a tooltip names the
alignment: its span in each genome and which way round the two read. The widest
ribbon on the three-chromosome circle is the X block that runs reverse between
the two genomes, which is why it twists.

<Figure src="/img/circular_synteny/ribbon_hover.png" caption="The widest X ribbon hovered on the three-chromosome circle, filled grey. It crosses itself between the two X arcs, which is the reverse strand; the tooltip names its span in each genome." />

The tooltip's two loci are the row the PIF holds. `tabix` returns it at the
human coordinate the tooltip starts at:

```bash
# the t prefix asks for the row in hg38 coordinates; q would ask in mm39's
tabix https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz tchrX:10447551-10447552
```

The row's strand column reads `-`, and its query span on mouse chrX is the other
end of the ribbon. The ring reads back the same way: `bigWigToBedGraph` prints
the bins under any stretch of either arc, addressed by the prefixed contig name
the bigWig carries.

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

The script takes any UCSC pair by name, and the files it writes are what a
reader's own pair has to satisfy:

- an alignment as a PIF, sorted and tabix-indexed. jbrowse.org's copy of a UCSC
  liftOver chain opens as is, with `"csi": true` beside its URL; a pair with no
  hosted chain goes through `jbrowse make-pif` over a PAF from minimap2, wfmash
  or `chain2paf`. Whichever way, the synteny track's `assemblyNames` is
  `[query, target]`. The reorder needs nothing beyond that: it reads the same
  file
- both assemblies declared in the config, from a hub entry as here or from
  `jbrowse add-assembly genome.fa`
- one bigWig per ring, naming the ring's assembly; for a ring that covers both
  genomes, one bigWig with prefixed contigs and an alias per assembly as above

## Reproduce it end to end

The script fetches both hub configs and both gene sets, builds the density
bigWig and writes the config with the chain track pointing at jbrowse.org's
copy. `TARGET` and `QUERY` pick another UCSC pair, `PIF` points the track at a
chain indexed elsewhere, `MIN_LENGTH` moves the cut, and `BASE_URL` is the
prefix the finished files will be served under; see
[Prerequisites](#prerequisites).

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

## References

- Kent WJ, Baertsch R, Hinrichs A, Miller W, Haussler D. Evolution's cauldron:
  duplication, deletion, and rearrangement in the mouse and human genomes. Proc
  Natl Acad Sci USA (2003). https://doi.org/10.1073/pnas.1932072100
- Ohno S. Sex Chromosomes and Sex-Linked Genes. Springer (1967), the argument
  that the mammalian X chromosome's gene content is conserved across species.
- Krzywinski M, Schein J, Birol I, et al. Circos: an information aesthetic for
  comparative genomics. Genome Research 19:1639-1645 (2009).
  https://doi.org/10.1101/gr.092759.109

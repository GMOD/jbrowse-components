---
title: Synteny from liftOver chains (hg38 and eight vertebrates)
sidebar_label: Synteny (liftOver lanes, vertebrates)
description:
  Stack eight UCSC genomes under a human locus from the liftOver chains UCSC
  already publishes, one indexed alignment per genome composed into one track
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

We look at one human locus across eight other mammals at once, from alignments
that already exist. UCSC publishes a liftOver chain from hg38 to every genome it
hosts, and jbrowse.org keeps each chain as an indexed alignment file. We:

- compose eight chains into one multi-way synteny track, a lane per genome under
  the human view, each lane drawing the RefSeq gene models from that genome's
  UCSC hub
- stack nine genomes at _TP53_ and at _PMP22_
- read each lane's span, width multiple and ribbons
- check one lane against its chain file

## Prerequisites

- htslib (`tabix`), to read a hosted index without downloading the alignment
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

<!-- TUTORIAL_INSTALL htslib START -->

```bash
# Debian/Ubuntu
sudo apt install tabix
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib
```

<!-- TUTORIAL_INSTALL htslib END -->

## The data

UCSC's pairwise liftOver chains from hg38 (Kent et al. 2003), each converted to
an indexed PAF and rehosted beside the hub configs
[genomes.jbrowse.org](https://genomes.jbrowse.org) serves, and eight UCSC genome
hubs, whose assembly entry and NCBI RefSeq gene track each lane takes verbatim.

The page's commands build local files from these, and the tracks over those read
them from disk; every other track reads a hosted copy. The
[build script](#reproduce-it-end-to-end) fetches everything itself. To index a
chain of your own, convert it with `chain2paf` and `make-pif`, as _LiftOver
chains as one indexed alignment per genome_ shows.

| What it is                                                                     | File                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| UCSC's liftOver folder for hg38, one `hg38To<Genome>.over.chain.gz` per genome | [liftOver/](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/liftOver/) |

<details>
<summary>The same chains as indexed alignments (no download needed)</summary>

| What it is                                                             | File                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Chimpanzee, [panTro6](https://genomes.jbrowse.org/ucsc/panTro6/)       | [hg38ToPanTro6.over.pif.gz](https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz)   |
| Gorilla, [gorGor6](https://genomes.jbrowse.org/ucsc/gorGor6/)          | [hg38ToGorGor6.over.pif.gz](https://jbrowse.org/ucsc/hg38/liftOver/hg38ToGorGor6.over.pif.gz)   |
| Orangutan, [ponAbe3](https://genomes.jbrowse.org/ucsc/ponAbe3/)        | [hg38ToPonAbe3.over.pif.gz](https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPonAbe3.over.pif.gz)   |
| Rhesus macaque, [rheMac10](https://genomes.jbrowse.org/ucsc/rheMac10/) | [hg38ToRheMac10.over.pif.gz](https://jbrowse.org/ucsc/hg38/liftOver/hg38ToRheMac10.over.pif.gz) |
| Marmoset, [calJac4](https://genomes.jbrowse.org/ucsc/calJac4/)         | [hg38ToCalJac4.over.pif.gz](https://jbrowse.org/ucsc/hg38/liftOver/hg38ToCalJac4.over.pif.gz)   |
| Mouse, [mm39](https://genomes.jbrowse.org/ucsc/mm39/)                  | [hg38ToMm39.over.pif.gz](https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz)         |
| Dog, [canFam6](https://genomes.jbrowse.org/ucsc/canFam6/)              | [hg38ToCanFam6.over.pif.gz](https://jbrowse.org/ucsc/hg38/liftOver/hg38ToCanFam6.over.pif.gz)   |
| Cow, [bosTau9](https://genomes.jbrowse.org/ucsc/bosTau9/)              | [hg38ToBosTau9.over.pif.gz](https://jbrowse.org/ucsc/hg38/liftOver/hg38ToBosTau9.over.pif.gz)   |

</details>

## LiftOver chains as one indexed alignment per genome

A liftOver chain maps each stretch of one genome to a position in another,
whether or not a gene lies there, so the track can draw each lane from the chain
alone.

Each UCSC chain aligns hg38 to one other genome, so no row aligns chimpanzee to
mouse. The track places each lane from its own chain, and every ribbon joins a
lane to hg38, whichever lane sits above it.

Each hosted file is a chain converted to PAF and indexed with
`jbrowse make-pif`, which can write a coarser tier beside the per-base one for
whole-chromosome zooms. Coarse-tier sequence names are upper-case, so `tabix`
lists the tiers from the index without downloading the alignment.

To index a chain of your own, convert it to PAF with
[chain2paf](https://github.com/AndreaGuarracino/chain2paf), which reads an
uncompressed chain, then run `make-pif`:

```bash
gzip -dc genomeA.genomeB.over.chain.gz > genomeA_genomeB.chain
chain2paf -i genomeA_genomeB.chain > genomeA_genomeB.paf
jbrowse make-pif genomeA_genomeB.paf
```

<!-- from: scripts/build_hg38_liftover_multiway.sh -->

```bash
# the #pif header, if the file was built recently enough to have one
tabix -H https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz | awk 'NR==1'
# how many coarse-tier sequences the index holds; zero means one tier
tabix -l https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz | grep -c '^[TQ]'
```

## Composing the eight chains into one track

One `SyntenyTrack` names hg38 and every genome it stacks. Its adapter, a
`MultiPairwiseSyntenyAdapter`, holds one `PairwiseIndexedPAFAdapter` per chain:

- Each child names its two assemblies as `query,target`, with the genome the
  chain lifts to first. The anchor is the one assembly every chain names.
- The config below is cut to three genomes for the page, and the hosted config
  has all eight.
- The assemblies and their gene tracks come from the hub configs unchanged, and
  each lane finds its gene models through the session, so this track is the only
  addition to the hub entries.

A genome of your own loads from its FASTA instead:

```json addassembly
{
  "name": "myGenome",
  "uri": "myGenome.fa.gz"
}
```

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hg38_liftover_multiway",
  "name": "hg38 vs 8 UCSC genomes (liftOver chains)",
  "assemblyNames": ["hg38", "panTro6", "rheMac10", "mm39"],
  "adapter": {
    "type": "MultiPairwiseSyntenyAdapter",
    "adapters": [
      {
        "type": "PairwiseIndexedPAFAdapter",
        "uri": "https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz",
        "csi": true,
        "assemblyNames": ["panTro6", "hg38"]
      },
      {
        "type": "PairwiseIndexedPAFAdapter",
        "uri": "https://jbrowse.org/ucsc/hg38/liftOver/hg38ToRheMac10.over.pif.gz",
        "csi": true,
        "assemblyNames": ["rheMac10", "hg38"]
      },
      {
        "type": "PairwiseIndexedPAFAdapter",
        "uri": "https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz",
        "csi": true,
        "assemblyNames": ["mm39", "hg38"]
      }
    ]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "height": 600
    }
  ]
}
```

**Level of detail** in the track menu picks which stored tier a zoom reads, as
on a pairwise synteny track. The menu offers it once every child has a coarse
tier, which the `tabix -l` line above checks on each file.

## Stacking nine genomes at TP53 and at PMP22

Opened on hg38 around _TP53_, the track draws a lane per genome under the human
axis, each fitted to wherever its chain places the window. Each lane header
names the chromosome and the span the lane shows, with `[rev]` where that
chromosome runs the other way relative to hg38. `rows.domain` stacks the lanes
down the tree from human, the apes first and the cow last.

```json session config=https://jbrowse.org/demos/hg38_vertebrates/config.json
{
  "defaultSession": {
    "name": "TP53 neighbourhood across nine vertebrates",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr17:7,400,000-7,700,000",
        "tracks": [
          "hg38-ncbiRefSeq",
          {
            "trackId": "hg38_liftover_multiway",
            "type": "MultiWaySyntenyDisplay",
            "ribbonColor": { "field": "strand" },
            "rows": {
              "domain": [
                "panTro6",
                "gorGor6",
                "ponAbe3",
                "rheMac10",
                "calJac4",
                "mm39",
                "canFam6",
                "bosTau9"
              ]
            },
            "height": 600
          }
        ]
      }
    ]
  }
}
```

**Color by... → Strand**, under **Ribbons** in the track menu, sets
`ribbonColor`, a color scale on the ribbons that maps a `field` to colors. Each
ribbon takes the strand of the chain record that placed it, red where the lane
runs the same way as hg38 and blue where it runs reversed.

Around _TP53_ every lane but gorilla places the whole window from one chain,
with the same genes in the same order.

- The gorilla ribbons stop after _FXR2_, because gorGor6 holds the _TP53_ end of
  the window on an unplaced contig.
- The mouse, cow and dog lanes break into many ribbons, because the track cuts a
  chain record at every indel of 10 kb or more, which leaves gap-free runs, one
  ribbon each, with a gap wherever the lane has sequence hg38 lacks.
- The ape chain gaps fall under the 10 kb cut, so their ribbons look continuous.
- The mouse lane shows `[rev]` because its chain runs the other way against hg38
  here, so its ribbons are blue.

<Figure caption="The TP53 neighbourhood on hg38 over eight UCSC genome lanes in tree order, each ribbon joining its lane to hg38 and colored by strand. The ape lanes run red and nearly unbroken, the gorilla one stopping partway; the monkey and non-primate lanes break into more ribbons, and the reversed mouse lane's are blue." src="/img/multiway_synteny/hg38_vertebrates_tp53.png" />

Navigate to `chr17:15,200,000-16,400,000`, eight megabases toward the
centromere, near _PMP22_. The region is a hotspot of segmental duplications
(long repeated copies of sequence): every genome places it as several blocks,
and many of those blocks run the other way against their neighbours.

A lane whose blocks mostly run backwards along hg38 draws mirrored, so its
ribbons run straight on screen while the strand color still marks each of them
as an inversion. Inside a lane, a ribbon crosses where one block runs against
its neighbour, as in the dog and cow lanes.

A lane draws one stretch of its chromosome at a time. Where the window lands on
two stretches a window or more apart, the lane draws the one holding more of the
window, and its header names the other after `also at`. The marmoset lane draws
the reversed block that places the right of the window, and names the forward
chain that places the left.

The gorilla lane header names chr17 beside chr5, the chromosome the lane drew.
Part of the window aligns to chr17, the homologous chromosome, so the chr5 frame
misses some of what the alignment places. Four items on the lane header menu set
the frame:

- **Show chr17 in this lane** pins the lane onto chr17.
- **Show chr5:80,472,173..81,176,598 in this lane**, on the marmoset lane, pins
  it onto the stretch its header names.
- **Flip lane** turns the lane the other way on the same contig, for a lane
  whose blocks split about evenly between the two orientations.
- **Let the lane choose its orientation** hands the choice back.

<Figure caption="The eight lanes at chr17 near the PMP22 duplications, ribbons colored by strand. Most lanes place the window as several blocks of both colors, against the TP53 window's single red runs, and a flipped lane, marked reversed in its header, runs its ribbons straight and still blue." src="/img/multiway_synteny/hg38_vertebrates_17p_strand.png" />

## Reading a lane's span, width multiple and ribbons {#reading-the-stack}

Each lane draws in the coordinates of its own genome, fitted to wherever the
alignment places the hg38 window.

- **Span**: the number at a lane's right edge is the span the lane shows, and
  the multiple after it is how many times wider than the hg38 window that span
  is, rounded to one of a few fixed steps. The step fits the stretch the lane
  draws: a lane up to a tenth wider than a step stays on that step, and short
  pieces off that stretch fall off its edges.
- **Ribbons**: each joins a lane to hg38, the anchor, since each chain aligns
  one genome to hg38. The ticked rule above the ribbons is hg38's axis, and the
  badge opening each lane label names it.
- Hover a ribbon to light the same alignment in every lane it reaches.
- Drag a lane label to reorder the stack.
- Use the lane header menu to re-anchor the view on that genome or open it in a
  separate view.

## Checking the marmoset lane against its chain

The marmoset rows over the PMP22 window come straight out of the hosted index:

```bash
# marmoset rows over the window, 50 kb and longer:
# hg38 start, end, strand, marmoset contig, start, end
tabix https://jbrowse.org/ucsc/hg38/liftOver/hg38ToCalJac4.over.pif.gz tchr17:15200000-16400000 \
  | awk -F'\t' '$11 > 50000' | cut -f3,4,5,6,8,9
```

The marmoset rows come back on both strands of chr5, the forward chain the lane
follows and the reversed block it draws as a crossing.

## Reproduce it end to end

The script writes one config, with nothing to build or upload, in three steps:

1. Probe which of the listed genomes have both a hub config and an indexed chain
   with its `.csi` on jbrowse.org, and drop the rest.
2. Report the tiers each chain file holds, since **Level of detail** needs a
   coarse tier in every child.
3. Write each kept genome's hub entry and gene track, and one composed track
   with a child per chain.

`GENOMES` picks a different set; see [Prerequisites](#prerequisites).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hg38_liftover_multiway.sh
bash build_hg38_liftover_multiway.sh   # writes ./hg38_vertebrates_build/config.json
```

## See also

- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/primate_orthologs_synteny)
- [](/docs/tutorials/t2t_apes_cactus_synteny)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/circular_synteny)

## External links

- UCSC Genome Browser downloads: https://hgdownload.soe.ucsc.edu/downloads.html

## Citations

- Kent WJ, Baertsch R, Hinrichs A, Miller W, Haussler D. Evolution's cauldron:
  duplication, deletion, and rearrangement in the mouse and human genomes. Proc
  Natl Acad Sci USA (2003). https://doi.org/10.1073/pnas.1932072100

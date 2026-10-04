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
hosts, and jbrowse.org keeps each of those chains as an indexed alignment file,
so one track composes eight of them into a lane per genome under the human view,
each lane drawing the RefSeq gene models from the UCSC hub for that genome. At
_TP53_ most ape lanes come out nearly continuous and mouse, dog and cow show
where their chains gap; eight megabases away every lane breaks and most reverse,
and the page ends by reading one of those breaks back out of its chain file.

## Prerequisites

- htslib (`tabix`), to read a hosted index without downloading the alignment
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

UCSC's pairwise liftOver chains from hg38 (Kent et al. 2003), each converted to
an indexed PAF and rehosted beside the hub configs
[genomes.jbrowse.org](https://genomes.jbrowse.org) serves, and eight UCSC genome
hubs, whose assembly entry and NCBI RefSeq gene track each lane takes verbatim.

**The chains**

- UCSC's liftOver folder for hg38, one `hg38To<Genome>.over.chain.gz` per
  genome: https://hgdownload.soe.ucsc.edu/goldenPath/hg38/liftOver/

**The same chains as indexed alignments**

- chimpanzee, [panTro6](https://genomes.jbrowse.org/ucsc/panTro6/):
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz
- gorilla, [gorGor6](https://genomes.jbrowse.org/ucsc/gorGor6/):
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToGorGor6.over.pif.gz
- orangutan, [ponAbe3](https://genomes.jbrowse.org/ucsc/ponAbe3/):
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPonAbe3.over.pif.gz
- rhesus macaque, [rheMac10](https://genomes.jbrowse.org/ucsc/rheMac10/):
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToRheMac10.over.pif.gz
- marmoset, [calJac4](https://genomes.jbrowse.org/ucsc/calJac4/):
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToCalJac4.over.pif.gz
- mouse, [mm39](https://genomes.jbrowse.org/ucsc/mm39/):
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz
- dog, [canFam6](https://genomes.jbrowse.org/ucsc/canFam6/):
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToCanFam6.over.pif.gz
- cow, [bosTau9](https://genomes.jbrowse.org/ucsc/bosTau9/):
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToBosTau9.over.pif.gz

**The hub configs**

- hg38: https://jbrowse.org/ucsc/hg38/config.json
- every other genome at the same path under its UCSC name, panTro6 for one:
  https://jbrowse.org/ucsc/panTro6/config.json
- the finished config, the eight hub entries and the composed track together:
  https://jbrowse.org/demos/hg38_vertebrates/config.json

## One alignment per genome

A liftOver chain places sequence. Every base of the human window that the chain
reaches has a position in the other genome, inside a gene or not, and the track
draws each lane from that.

UCSC's chains are one alignment per genome, each between hg38 and that one
genome. Composed, they make a star with hg38 at the centre: hg38 against
chimpanzee, hg38 against mouse, and no row anywhere that aligns chimpanzee to
mouse. A lane stack anchored on hg38 matches that star: the track places each
lane from the chain between hg38 and that genome, and composes the ribbons
between two adjacent mate lanes through the human coordinates they share.

Each hosted file is a chain converted to PAF and indexed with
`jbrowse make-pif`, which can write a coarse tier beside the per-base one for
whole-chromosome zooms. `tabix` reads the tiers from the index without fetching
the alignment: the header names the tiers the file lists, and the coarse-tier
sequence names are the upper-case ones.

To index a chain of your own, convert it to PAF with `chain2paf` from
[paftools](https://github.com/lh3/minimap2/tree/master/misc), then run
`make-pif`:

```bash
paftools.js chain2paf genomeA.genomeB.over.chain.gz > genomeA_genomeB.paf
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

One `SyntenyTrack` names hg38 and every genome it stacks, and its adapter is a
`MultiPairwiseSyntenyAdapter` holding one child per chain. Each child is a
`PairwiseIndexedPAFAdapter` over one chain file, naming its two assemblies as
`query,target`, the genome the chain lifts to first. The anchor is the one
assembly every child names. The list below is cut to three genomes for the page;
the hosted config contains all eight. The assemblies and their gene tracks come
from the hub configs unchanged, and a lane finds its gene models through the
session, so the track is the one addition to the hub entries. A genome of your
own loads from its FASTA instead:

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

The track menu has **Level of detail** beside the lane controls, as a pairwise
synteny track does. The entry picks the stored tier a zoom reads. The menu
offers it once every child has a coarse tier; run the `tabix -l` line above on
each file to check.

## Stacking nine genomes at the TP53 neighbourhood

Opened on hg38 around _TP53_, the track draws a lane per genome under the human
axis, each fitted to wherever its chain places the window. Each lane header
names the chromosome and the span the lane shows, with `[rev]` where that
chromosome runs the other way relative to hg38, and the lanes stack densest
first, so the genomes placing the most of the window sit at the top.

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
            "height": 600
          }
        ]
      }
    ]
  }
}
```

Around _TP53_ every lane but gorilla places the whole window from one chain,
with the same genes in the same order, and the ribbons show where that chain is
not continuous. The gorilla lane stops after _FXR2_, because gorGor6 holds the
_TP53_ end of the window on an unplaced contig. A liftOver chain holds its
insertions and deletions inside one record, and the track cuts each record at
every indel of 10 kb or more. It draws a ribbon per gap-free run, so the white
wedges between runs are the stretches one genome has and the other lacks. The
mouse, cow and dog chains have many such gaps, and the ape chains have gaps
under the cut and draw as near-continuous ribbons. The mouse lane shows `[rev]`,
since its chain runs the other way against hg38 here.

<Figure caption="The TP53 neighbourhood on hg38 over eight UCSC genome lanes from one composed liftOver track, each lane drawing the RefSeq gene models annotated on its chromosome. The white wedges in the ribbons are the large indels in each chain, few in the apes and many in mouse, cow and dog; the mouse lane is reversed, and the gorilla lane stops where gorGor6 moves the rest of the window onto an unplaced contig." src="/img/multiway_synteny/hg38_vertebrates_tp53.png" />

Navigate to `chr17:15,200,000-16,400,000`, eight megabases toward the
centromere, near _PMP22_. The region is a segmental-duplication hotspot: every
genome places it as several blocks, and many of those blocks run the other way
against their neighbours.

A lane whose blocks run backwards along hg38 on balance shows `[rev]` in its
header and draws mirrored, so its inversions come out straight; a ribbon crosses
where one block runs against its neighbour inside a lane. The marmoset lane is
the clearest case: its chain covers the left of the window forwards and then
stops, and a reversed block further along the same chromosome places the rest of
the window.

The gorilla lane names chr17 in its header beside the chr5 frame it drew. chr17
is the homologous chromosome, and some of this window aligns there too, so the
chr5 frame misses part of what the alignment places. **Show chr17 in this lane**
on the lane header menu pins the lane onto the other contig. Where the blocks in
a lane split about evenly between the two orientations, **Flip lane** on its
header menu turns it the other way on the same contig, and **Let the lane choose
its orientation** hands the choice back.

<Figure caption="hg38 chr17 near the PMP22 segmental duplications over the same eight lanes. Every genome places the window as several blocks and many run against their neighbours: a lane running backwards along hg38 shows a reversed marker in its header, the crossed ribbons are where a block runs against its neighbour inside a lane, and the gorilla lane names a second chromosome that also places the window." src="/img/multiway_synteny/hg38_vertebrates_17p_break.png" />

**Color by... → Strand**, under **Ribbons** on the track menu, colors each
ribbon by strand. Between the anchor and the first lane a ribbon takes the
strand of one alignment, and between two mate lanes it takes the strands of two
alignments multiplied together. The track flips a lane whose alignments all run
the other way and marks it `[rev]` in its header, so its ribbons come out
straight on screen while the strand color still marks every one of them as an
inversion. A single crossed ribbon into an unflipped lane is one block running
against its neighbours.

<Figure caption="The same eight lanes at chr17 near the PMP22 duplications, ribbons colored by strand. In a flipped lane the ribbons run straight and still have the reversed color, so crossing and color disagree on the same block." src="/img/multiway_synteny/hg38_vertebrates_17p_strand.png" />

## Reading lane spans, zoom steps and composed ribbons {#reading-the-stack}

Each lane uses the coordinates of the genome it shows, fitted to wherever the
alignment places the anchor window. The number at the right edge of a lane is
the span that lane shows, and the multiple after it is how much wider than the
anchor window that span is, rounded to one of a few fixed steps. A lane placing
up to a tenth more than a step stays on that step, and the extra runs off its
edges, as sequence beside the anchor window runs off that window.

Ribbons join a lane to the lane directly above it. Where a source holds no
alignment between two mates, as in this star, the track composes the ribbon
between them through the anchor. Hovering a ribbon lights the same alignment in
every lane it reaches, dragging a lane label reorders the stack, and the header
menu on a lane re-anchors the view on that genome or opens it in a separate
view.

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

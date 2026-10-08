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

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- UCSC's liftOver folder for hg38, one `hg38To<Genome>.over.chain.gz` per
  genome: https://hgdownload.soe.ucsc.edu/goldenPath/hg38/liftOver/

<details>
<summary>The same chains as indexed alignments (no download needed)</summary>

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

</details>

## LiftOver chains as one indexed alignment per genome

A liftOver chain maps each stretch of one genome to a position in another,
whether or not a gene lies there, so the track can draw each lane from the chain
alone.

Each UCSC chain aligns hg38 to one other genome, so no row aligns chimpanzee to
mouse. The track places each lane from the chain between hg38 and that genome,
and draws the ribbon between two neighbouring lanes through the human
coordinates both share.

Each hosted file is a chain converted to PAF and indexed with
`jbrowse make-pif`, which can write a coarser tier beside the per-base one for
whole-chromosome zooms. Coarse-tier sequence names are upper-case, so `tabix`
lists the tiers from the index without downloading the alignment.

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

**Level of detail** on the track menu picks which stored tier a zoom reads, as
on a pairwise synteny track. The menu offers it once every child has a coarse
tier; run the `tabix -l` line above on each file to check.

## Stacking nine genomes at TP53 and at PMP22

Opened on hg38 around _TP53_, the track draws a lane per genome under the human
axis, each fitted to wherever its chain places the window. Each lane header
names the chromosome and the span the lane shows, with `[rev]` where that
chromosome runs the other way relative to hg38. The lanes stack with the genomes
placing the most of the window at the top.

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
            "height": 600
          }
        ]
      }
    ]
  }
}
```

`ribbonColor` is what **Color by... → Strand**, under **Ribbons** on the track
menu, sets. A ribbon between the anchor and the first lane takes the strand of
one alignment, red forward and blue reverse, and a ribbon between two genome
lanes takes the product of two alignments' strands, so two reverse alignments
give forward.

Around _TP53_ every lane but gorilla places the whole window from one chain,
with the same genes in the same order.

- **Gorilla**: the ribbons stop after _FXR2_, because gorGor6 holds the _TP53_
  end of the window on an unplaced contig.
- **Mouse, cow and dog**: the track cuts a chain record at every indel of 10 kb
  or more, so the chain breaks into many gap-free runs, one ribbon each, with a
  gap wherever the lane carries sequence hg38 lacks.
- **Apes**: the chain gaps fall under the 10 kb cut, so their ribbons look
  continuous.
- **Mouse** shows `[rev]` because its chain runs the other way against hg38
  here, so its ribbons are blue.

<Figure caption="The TP53 neighbourhood on hg38 over eight UCSC genome lanes, ribbons colored by strand. Chimp and orangutan run red and unbroken under hg38; the lanes below them break into many ribbons, and the reversed mouse lane's are blue." src="/img/multiway_synteny/hg38_vertebrates_tp53.png" />

Navigate to `chr17:15,200,000-16,400,000`, eight megabases toward the
centromere, near _PMP22_. The region is a hotspot of segmental duplications
(long repeated copies of sequence): every genome places it as several blocks,
and many of those blocks run the other way against their neighbours.

A lane whose blocks mostly run backwards along hg38 draws mirrored, so its
ribbons run straight on screen while the strand color still marks each of them
as an inversion. Inside a lane, a ribbon crosses where one block runs against
its neighbour. The marmoset lane is the clearest case: its chain covers the left
of the window forwards and then stops, and a reversed block further along the
same chromosome places the rest of the window.

The gorilla lane header names chr17 beside chr5, the chromosome the lane drew.
Part of the window aligns to chr17, the homologous chromosome, so the chr5 frame
misses some of what the alignment places. Three items on the lane header menu
set the frame:

- **Show chr17 in this lane** pins the lane onto chr17.
- **Flip lane** turns the lane the other way on the same contig, for a lane
  whose blocks split about evenly between the two orientations.
- **Let the lane choose its orientation** hands the choice back.

<Figure caption="The eight lanes at chr17 near the PMP22 duplications, ribbons colored by strand. Every lane places the window as several blocks of both colors, against the TP53 window's single red runs, and a flipped lane, marked reversed in its header, runs its ribbons straight and still blue." src="/img/multiway_synteny/hg38_vertebrates_17p_strand.png" />

## Reading a lane's span, width multiple and ribbons {#reading-the-stack}

Each lane draws in the coordinates of its own genome, fitted to wherever the
alignment places the hg38 window.

- **Span**: the number at a lane's right edge is the span the lane shows, and
  the multiple after it is how many times wider than the hg38 window that span
  is, rounded to one of a few fixed steps. A lane that places up to a tenth more
  than a step stays on that step, and the extra runs off the lane's edges.
- **Ribbons**: each joins a lane to hg38, the anchor, since each chain aligns
  one genome to hg38. The ticked rule above the ribbons is hg38's axis, and the
  badge opening each lane label names it.
- **Hover** a ribbon to light the same alignment in every lane it reaches.
- **Drag a lane label** to reorder the stack.
- **The lane header menu** re-anchors the view on that genome or opens it in a
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

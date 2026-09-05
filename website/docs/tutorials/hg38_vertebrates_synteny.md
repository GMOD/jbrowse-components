---
title: Synteny from liftOver chains (hg38 and eight vertebrates)
sidebar_label: Synteny (liftOver lanes, vertebrates)
description:
  Stack eight UCSC genomes under a human locus from the liftOver chains UCSC
  already publishes, one indexed alignment per genome composed into one track
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: hosted
---

**TL;DR:** we look at one human locus across eight other mammals at once, from
alignments that already exist. UCSC publishes a liftOver chain from hg38 to
every genome it hosts, and jbrowse.org keeps each of those chains as an indexed
alignment file, so one track composes eight of them into a lane per genome under
the human view, each lane drawing that genome's own RefSeq gene models from its
UCSC hub. The primate lanes come out nearly straight; mouse, dog and cow are
where the chain breaks, reverses and skips, and the page ends there.

## Prerequisites

- htslib (`tabix`), to read a hosted alignment's index without downloading it
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

UCSC's pairwise liftOver chains from hg38 (Kent et al. 2003), each converted to
an indexed PAF and rehosted beside the hub configs genomes.jbrowse.org serves,
and eight UCSC genome hubs, whose assembly entry and NCBI RefSeq gene track each
lane takes verbatim.

**The chains**

- UCSC's liftOver folder for hg38, one `hg38To<Genome>.over.chain.gz` per
  genome: https://hgdownload.soe.ucsc.edu/goldenPath/hg38/liftOver/

**The same chains as indexed alignments**

- chimpanzee, panTro6:
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz
- gorilla, gorGor6:
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToGorGor6.over.pif.gz
- orangutan, ponAbe3:
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPonAbe3.over.pif.gz
- rhesus macaque, rheMac10:
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToRheMac10.over.pif.gz
- marmoset, calJac4:
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToCalJac4.over.pif.gz
- mouse, mm39: https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz
- dog, canFam6: https://jbrowse.org/ucsc/hg38/liftOver/hg38ToCanFam6.over.pif.gz
- cow, bosTau9: https://jbrowse.org/ucsc/hg38/liftOver/hg38ToBosTau9.over.pif.gz

**The hubs each lane's assembly and gene track come from**

- hg38: https://jbrowse.org/ucsc/hg38/config.json
- every other genome at the same path under its own name, panTro6 for one:
  https://jbrowse.org/ucsc/panTro6/config.json
- the finished config, the eight hub entries and the composed track together:
  https://jbrowse.org/demos/hg38_vertebrates/config.json

## One alignment per genome

The [primate page](/docs/tutorials/primate_orthologs_synteny) and the
[E. coli page](/docs/tutorials/ecoli_orthologs_synteny) fill their lanes from a
gene table, joining genes across genomes by name, so a lane holds genes and
nothing between them. An alignment file places sequence instead: every base of
the human window that a chain reaches has a position in the other genome, gene
or not, and the lanes on this page are drawn from that.

UCSC's chains are one alignment per genome, each between hg38 and that genome
alone. Composed, they make a star with hg38 at the centre: hg38 against
chimpanzee, hg38 against mouse, and no row anywhere that aligns chimpanzee to
mouse. That is exactly the shape a lane stack anchored on hg38 reads. Each lane
is placed from its own chain, and the ribbons between two adjacent mate lanes
are composed through the human coordinates they share.

Each hosted file is a chain converted to PAF and indexed with
`jbrowse make-pif`, which can write a coarse tier beside the per-base one for
whole-chromosome zooms. `tabix` reads either question off the index without
fetching the alignment: the header names the tiers the file carries, and the
coarse tier's sequence names are the upper-case ones.

<!-- from: scripts/build_hg38_liftover_multiway.sh -->

```bash
# the #pif header, if the file was built recently enough to carry one
tabix -H https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz | head -1
# how many coarse-tier sequences the index holds; zero means one tier
tabix -l https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz | grep -c '^[TQ]'
```

## The composed track

One `SyntenyTrack` names hg38 and every genome it stacks, and its adapter is a
`MultiPairwiseSyntenyAdapter` holding one child per chain. Each child is an
ordinary `PairwiseIndexedPAFAdapter` with its own pair of assembly names, in the
order the file states them, and the anchor is never written: it is the one
assembly every child names. The list below is cut to three genomes for the page;
the hosted config carries all eight. The assemblies and their gene tracks come
from each genome's hub config unchanged, and a lane finds its gene models
through the session, so the only thing the track adds to the hub entries is
itself.

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
      "displayId": "hg38_liftover_multiway-MultiWaySyntenyDisplay",
      "height": 600
    }
  ]
}
```

The track menu is the one a pairwise synteny track has. Its **Level of detail**
entry, which picks the stored tier a zoom reads, is offered once every child
carries a coarse tier, and the `tabix -l` line above is how to tell whether a
file does.

## One locus, nine genomes

Opened on hg38 around _TP53_, the track draws a lane per genome under the human
axis, each fitted to wherever its chain places the window. A lane's header names
its chromosome and where it is looking, with `[rev]` where that chromosome runs
the other way relative to hg38, and the lanes stack densest first, so the
genomes placing the most of the window sit at the top.

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

The primate lanes read as the human axis drawn again: one chain block across the
window, gene models in the same order, ribbons that run straight down. Mouse,
dog and cow are the other picture. Each of those lanes is several chain blocks
where the primates have one, the blocks change strand partway along, the header
carries `[rev]` where the whole lane runs backwards, and the ribbons cross and
leave gaps where a stretch of the human window lands nowhere in that genome.
Those lanes are also the ones with the fewest of the window's genes, which is
why they sort to the bottom.

<Figure caption="The TP53 neighbourhood on hg38 over eight UCSC genome lanes from one composed liftOver track, each lane drawing its own RefSeq gene models on its own chromosome. The primate lanes place the window as one straight block; the mouse, dog and cow lanes break it into blocks, reverse some of them, and leave gaps where the chain reaches nothing." src="/img/multiway_synteny/hg38_vertebrates_tp53.png" />

**Color ribbons by → Strand** on the track menu paints a ribbon that crosses,
which is a block running the other way relative to the lane above it, so a
lane's `[rev]` and the ribbons reaching it agree.

## Reproduce it end to end

The script assembles the config and nothing else: it probes which of the listed
genomes have a hub config and an indexed chain, reports each file's tiers, and
writes the hub entries and the composed track into one config. `GENOMES` picks a
different set; see [Prerequisites](#prerequisites).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hg38_liftover_multiway.sh
bash build_hg38_liftover_multiway.sh
```

## See also

- [](/docs/tutorials/hprc_multiway_synteny)
- [](/docs/tutorials/primate_orthologs_synteny)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/allvsall_synteny)

## References

- Kent WJ, Baertsch R, Hinrichs A, Miller W, Haussler D. Evolution's cauldron:
  duplication, deletion, and rearrangement in the mouse and human genomes. Proc
  Natl Acad Sci USA (2003). https://doi.org/10.1073/pnas.1932072100
- UCSC Genome Browser downloads: https://hgdownload.soe.ucsc.edu/downloads.html

---
title: Synteny from a Cactus alignment (T2T apes)
sidebar_label: Synteny (Cactus lanes, apes)
description:
  Stack six T2T ape genomes under a human locus in tree order, each joined to
  its neighbour by the Cactus chain between the two
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

We stack six ape genomes under a human locus in the order of their family tree
and compare each genome with the one above it, so a change of orientation shows
up between the two lineages that differ. The comparisons come from the Cactus
alignment of the telomere-to-telomere ape genomes, whose authors publish a chain
for every pair of genomes in it. One indexed file holds the chains the lanes
need, and each lane draws the RefSeq genes of that ape's hub on
[genomes.jbrowse.org](https://genomes.jbrowse.org).

At _TP53_ every ape runs in one orientation down to the siamang. On 17q12 a
block runs one way in chimpanzee, bonobo and gorilla and the other way in human,
both orangutans and the siamang, and the page ends by counting that block's
aligned bases out of the file.

## Prerequisites

- [chain2paf](https://github.com/AndreaGuarracino/chain2paf), built with
  `cargo install --path .` from its checkout
- The [JBrowse CLI](/docs/cli), for `jbrowse make-pif`
- htslib (`tabix`) and `python3`, for the check at the end
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

<!-- TUTORIAL_INSTALL htslib,jbrowse-cli START -->

```bash
# Debian/Ubuntu
sudo apt install tabix
# or conda
conda install -c bioconda -c conda-forge htslib
npm install -g @jbrowse/cli
```

<!-- TUTORIAL_INSTALL htslib,jbrowse-cli END -->

## The data

The Cactus alignment of hg38 and the T2T ape assemblies (Yoo et al. 2025), built
with Progressive Cactus (Armstrong et al. 2020).

The [build script](#reproduce-it-end-to-end) fetches these files, so there is
nothing to download by hand.

- Chains between every pair of genomes in the 8-way alignment, one
  `<genome>_vs_<genome>.chain.gz` per pair:
  https://cgl.gi.ucsc.edu/data/cactus/t2t-apes/8-t2t-apes-2023v2/chains/

<details>
<summary>Read by URL (no download needed)</summary>

- The twelve pairs the track uses, as one indexed alignment:
  https://jbrowse.org/demos/t2t_apes_cactus/apes.pif.gz

</details>

## Chains between neighbours, from one alignment

Each lane reads two chains from the file. The chain between hg38 and that ape
places the lane under the human window, and the chain between that ape and the
one above it draws the ribbons between them. Twelve pairs cover six apes:

- hg38 against each ape
- chimpanzee against bonobo, bonobo against gorilla, gorilla against the
  Sumatran orangutan, the Sumatran against the Bornean orangutan, and the
  Bornean orangutan against the siamang

All twelve come out of one multiple alignment, so the chimpanzee in the hg38
pair and the chimpanzee in the bonobo pair are aligned the same way.

`chain2paf` reads a chain uncompressed:

<!-- from: scripts/build_t2t_apes_cactus_multiway.sh -->

```bash
gzip -dc genomeA_vs_genomeB.chain.gz > pair.chain
```

`chain2paf` writes the chain's query (`genomeB`) as each PAF row's first
sequence and its target (`genomeA`) as the second. A PanSN prefix on each name
(`genome#haplotype#contig`) tells JBrowse which genome a sequence belongs to, so
every pair can go into one file:

<!-- from: scripts/build_t2t_apes_cactus_multiway.sh -->

```bash
# the prefix is the assembly name JBrowse knows each genome by
chain2paf -i pair.chain \
  | awk -F'\t' -v q=genomeB -v t=genomeA 'BEGIN { OFS = "\t" } { $1 = q "#0#" $1; $6 = t "#0#" $6; print }' \
  >> apes.paf
```

`make-pif` sorts and indexes the concatenated pairs, writing each row twice so a
query from either genome is one tabix lookup:

<!-- from: scripts/build_t2t_apes_cactus_multiway.sh -->

```bash
jbrowse make-pif apes.paf --out apes.pif.gz
```

`make-pif` warns that the file states only some of its pairs. The missing ones
are the pairs no two neighbouring lanes need, such as chimpanzee against the
siamang.

## One track over the six apes

A `MultiGenomeIndexedPAFAdapter` reads the file and finds each genome by its
PanSN prefix. `rows.domain` stacks the lanes in tree order, so each lane's
neighbour above it is the genome its ribbons were aligned to. The assemblies and
gene tracks come from each genome's hub unchanged, as in the hosted config.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "t2t_apes_cactus",
  "name": "T2T apes (Cactus alignment)",
  "assemblyNames": [
    "hg38",
    "GCF_028858775.2",
    "GCF_029289425.2",
    "GCF_029281585.2",
    "GCF_028885655.2",
    "GCF_028885625.2",
    "GCF_028878055.3"
  ],
  "adapter": {
    "type": "MultiGenomeIndexedPAFAdapter",
    "uri": "https://jbrowse.org/demos/t2t_apes_cactus/apes.pif.gz",
    "assemblyNames": [
      "hg38",
      "GCF_028858775.2",
      "GCF_029289425.2",
      "GCF_029281585.2",
      "GCF_028885655.2",
      "GCF_028885625.2",
      "GCF_028878055.3"
    ]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "t2t_apes_cactus-MultiWaySyntenyDisplay",
      "rows": {
        "domain": [
          "GCF_028858775.2",
          "GCF_029289425.2",
          "GCF_029281585.2",
          "GCF_028885655.2",
          "GCF_028885625.2",
          "GCF_028878055.3"
        ]
      }
    }
  ]
}
```

## Reading TP53 down the tree

Opened on hg38 around _TP53_, the track draws a lane per ape under human, each
in that genome's own coordinates. Each lane header names the chromosome and the
span the lane shows, with `[rev]` where the lane runs against human.

**Color by... → Strand**, under **Ribbons** in the track menu, colors each
ribbon by whether its two lanes agree in orientation, and the session below
opens with it:

```json session config=https://jbrowse.org/demos/t2t_apes_cactus/config.json
{
  "defaultSession": {
    "name": "TP53 neighbourhood across seven apes",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr17:7,400,000-7,700,000",
        "tracks": [
          "hg38-ncbiRefSeq",
          {
            "trackId": "t2t_apes_cactus",
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

<Figure caption="The TP53 neighbourhood on hg38 over six T2T ape lanes in tree order, each ribbon joining a lane to the one above it and colored by strand. The ribbons run red from human down to the Bornean orangutan, and the reversed siamang lane's run blue." src="/img/multiway_synteny/t2t_apes_cactus_tp53.png" />

## A block on 17q that splits the African apes

Navigate to `chr17:33,200,000-35,800,000`, on 17q12.

<Figure caption="Human chr17 on 17q12 over the same six ape lanes, ribbons colored by strand. Blue fills the gutter between human and chimpanzee and the gutter between gorilla and the Sumatran orangutan; chimpanzee, bonobo and gorilla run red among themselves, and so do the two orangutans and the siamang." src="/img/multiway_synteny/t2t_apes_cactus_17q.png" />

Down the stack, the orientation changes from human to chimpanzee and back from
gorilla to the Sumatran orangutan, so chimpanzee, bonobo and gorilla carry the
block one way and human, both orangutans and the siamang the other.

## Checking the 17q block against the chains

The hg38 rows of the file give each ape's orientation over the window directly.
A Cactus chain spans its own gaps, and a reversed chain often sits inside the
gap of a forward one, so the script counts the bases each chain aligns inside
the window:

```python
# aligned bases per genome and strand over hg38 chr17:33.2-35.8 Mb
import re
import subprocess
from collections import Counter

PIF = 'https://jbrowse.org/demos/t2t_apes_cactus/apes.pif.gz'
START, END = 33_200_000, 35_800_000

# rows keyed on hg38 ('t' prefix): one per chain against each ape
rows = subprocess.run(
    ['tabix', PIF, f'thg38#0#chr17:{START}-{END}'],
    capture_output=True, text=True, check=True,
).stdout.splitlines()

aligned = Counter()
for row in rows:
    f = row.split('\t')
    pos, strand, genome = int(f[2]), f[4], f[5].split('#')[0]
    cigar = next(x[5:] for x in f[12:] if x.startswith('cg:Z:'))
    for n, op in re.findall(r'(\d+)([MID])', cigar):
        n = int(n)
        if op == 'M':
            aligned[genome, strand] += max(0, min(pos + n, END) - max(pos, START))
        if op != 'I':
            pos += n

for (genome, strand), n in sorted(aligned.items()):
    if n > 100_000:
        print(genome, strand, n)
```

Chimpanzee (`GCF_028858775.2`), bonobo (`GCF_029289425.2`) and gorilla
(`GCF_029281585.2`) align the window on the reverse strand of hg38, and both
orangutans (`GCF_028885655.2`, `GCF_028885625.2`) and the siamang
(`GCF_028878055.3`) on the forward strand, each with nearly all of its aligned
bases on one strand.

## Reproduce it end to end

The script works in four steps:

1. Fetch each genome's hub config from genomes.jbrowse.org, which gives its lane
   the assembly and the NCBI RefSeq gene track.
2. Download the twelve chains: hg38 against each ape, and each ape against the
   next one down the tree.
3. Convert each chain to PAF with PanSN names and index all twelve as one file.
4. Write the config, with the lanes stacked in tree order.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_t2t_apes_cactus_multiway.sh
bash build_t2t_apes_cactus_multiway.sh   # writes ./t2t_apes_cactus_build/config.json
```

## See also

- [](/docs/tutorials/hg38_vertebrates_synteny)
- [](/docs/tutorials/primate_orthologs_synteny)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/tutorials/allvsall_synteny)

## External links

- Cactus T2T ape alignments: https://cglgenomics.ucsc.edu/february-2024-t2t-apes
- The T2T primates project: https://github.com/marbl/Primates
- chain2paf: https://github.com/AndreaGuarracino/chain2paf

## Citations

- Yoo D, Rhie A, Hebbar P, et al. Complete sequencing of ape genomes. Nature
  (2025). https://doi.org/10.1038/s41586-025-08816-3
- Armstrong J, Hickey G, Diekhans M, et al. Progressive Cactus is a
  multiple-genome aligner for the thousand-genome era. Nature (2020).
  https://doi.org/10.1038/s41586-020-2871-y

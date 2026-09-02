---
title: Synteny visualization (OrthoFinder orthogroups)
sidebar_label: Synteny (OrthoFinder)
description:
  Stack genomes too diverged to align, using OrthoFinder orthogroups as the
  synteny table
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** an [OrthoFinder](https://github.com/davidemms/OrthoFinder) run groups
genes by homology and says nothing about position, so it produces a synteny
track for genomes no aligner can line up. `Orthogroups.tsv` converts to the
`.blocks` table `MCScanBlocksAdapter` reads, with one BED per genome, and a
duplicated gene becomes several rows.

## Prerequisites

- [OrthoFinder](https://github.com/davidemms/OrthoFinder) with
  [DIAMOND](https://github.com/bbuchfink/diamond)
- `python3`
- htslib (`bgzip`, `tabix`)
- `wget`
- `node`, for the [JBrowse CLI](/docs/cli)
- The
  [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
  (`datasets` and `dataformat`), for the sets that name a genome's chromosomes
  from a sequence report: `wheat`, `drosophila` and `solanaceae`
- [gffread](https://github.com/gpertea/gffread), which translates a genome and
  its annotation into the proteome OrthoFinder compares. Needed for
  [your own genomes](#your-own-genomes); the sets above download a published
  proteome instead
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

OrthoFinder bundles its own DIAMOND: [bioconda](https://bioconda.github.io/) has
`orthofinder`, and the `davidemms/orthofinder` container has the same bundle.
Everything here calls `orthofinder` on `PATH`; the
[build script](#reproduce-it-end-to-end) header has an
[Apptainer](https://apptainer.org/) shim for the container.

## Where the data comes from

Five OrthoFinder sets, one per section below, each built from one Ensembl
division's protein FASTA and GFF3 per genome.

- **`vertebrates`**: human, chicken, frog, gar, zebrafish, Ensembl release 113:
  https://ftp.ensembl.org/pub/release-113/
- **`wheat`**: _Aegilops tauschii_, bread wheat, durum, wild emmer, _Triticum
  urartu_, _T. timopheevii_, Ensembl Plants release 63:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/
- **`drosophila`**: _Drosophila melanogaster_, _D. simulans_, _D. yakuba_, _D.
  pseudoobscura_, _D. virilis_, Ensembl Metazoa release 63:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/metazoa/release-63/
- **`solanaceae`**: tomato, potato, pepper and _Nicotiana attenuata_, with
  coffee as the outgroup, Ensembl Plants release 63:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/
- **`grasses`**: rice, sorghum, maize, brachypodium, setaria, Ensembl Plants
  release 63: https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/
- **Sequence reports** for the six assemblies whose refName aliases are read
  from NCBI rather than a URL, which the datasets CLI fetches by accession: _T.
  timopheevii_ GCA_963921465.1, tomato GCA_000188115.5, and the four flies other
  than _D. melanogaster_, GCA_016746395.2, GCA_016746365.2, GCA_009870125.2 and
  GCA_030788295.1: https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/

## Orthogroups as a synteny source

OrthoFinder clusters proteins into orthogroups without reference to position, so
a table of orthogroups is a synteny track for a human against a zebrafish, past
the divergence where [minimap2](/docs/tutorials/synteny_visualization) and
[MCScan](/docs/tutorials/mcscan_synteny_grape_peach) return nothing. Nothing in
an orthogroup asserts synteny, so any collinearity in the ribbons is a property
of the genomes.

Five sets follow, a section each; the second half of the page builds `wheat`
from `Orthogroups.tsv`.

## Vertebrates: blocks that survive out to zebrafish {#vertebrates}

The `vertebrates` set is human, chicken, frog, spotted gar and zebrafish. Their
orthologs still fall into chromosome-scale blocks, and the teleost genome
duplication shows as a human chromosome answering to more zebrafish chromosomes
than chicken ones.

<Figure caption="Five vertebrate genomes stacked on OrthoFinder orthogroups: human, chicken, frog, spotted gar, zebrafish, all four bands off one vertebrates_orthogroups track. Gar against zebrafish, past the teleost duplication, is the dense band." src="/img/orthofinder_synteny/vertebrates.png" />

A band resolves into wedges only where a chromosome's orthologs mostly land on
one chromosome of the row below; the build script prints that share per pair.

### One locus, one lane per vertebrate

For one locus, a
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
draws the same table as a lane per genome in a single linear view, each in its
own coordinates.

```json session config=https://jbrowse.org/demos/orthofinder_vertebrates/config.json
{
  "defaultSession": {
    "name": "Vertebrate multi-way synteny track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "human",
        "loc": "2:176,090,000-176,290,000",
        "tracks": [
          {
            "trackId": "human_genes",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact"
          },
          {
            "trackId": "vertebrates_orthogroups",
            "type": "MultiWaySyntenyDisplay",
            "rowOrder": ["chicken", "frog", "gar", "zebrafish"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

The human _HOXD_ cluster is one block every one of the four keeps.

<Figure caption="The human HOXD cluster over chicken, frog, gar and zebrafish lanes from one OrthoFinder orthogroups track. The cluster's block stays syntenic in every lane, each lane names its own chromosome and orientation, and the ribbon chains thin outside it where the orthogroups scatter." src="/img/multiway_synteny/vertebrate_hox_lanes.png" />

## Wheat: six genomes of one polyploid history {#wheat}

The `wheat` set is six genomes of wheat's own polyploidy history:

- **Aegilops tauschii**, the diploid D-genome donor
- **bread wheat**, hexaploid, genomes A+B+D
- **durum**, the domesticated tetraploid, A+B
- **wild emmer**, durum's wild tetraploid ancestor
- **Triticum urartu**, the diploid A-genome donor
- **T. timopheevii**, a second, independent tetraploid that also traces to the
  A-genome donor

Stacked in that order, each adjacent pair is an evolutionary step. Diagonalizing
brings each homoeologous group's chromosomes together, with nothing telling the
view which chromosomes are homoeologs.

**Show all regions - same bp per pixel** in the view menu (`sameScale` in a
session spec) puts the rows on one bp/px, so a row's drawn length is its genome
size.

<Figure caption="Six wheat-lineage genomes stacked on OrthoFinder orthogroups, in evolutionary order. All six rows are on one genomic scale, so a row's length is its genome size: the two diploid donors against the hexaploid they built, with the tetraploids between." src="/img/orthofinder_synteny/wheat.png" />

### Reading one chromosome out of the stack

Any pair of the set opens as a two-row view. This one puts Aegilops tauschii's
seven chromosomes over bread wheat 4A, with the palette button's **Query**
painting each link by the tauschii chromosome it leaves.

<Figure caption="Aegilops tauschii's seven D-genome chromosomes over bread wheat chromosome 4A, from the same wheat_orthogroups track. Color by → Query gives each chromosome its own color, and 4A resolves into three blocks in order along it: 4D, then 5D, then 7D." src="/img/orthofinder_synteny/wheat_4a.png" />

6D and the other three uninvolved chromosomes reach 4A only as scattered
singletons. The blocks are the 4AL/5AL and 4AL/7BS translocation pair,
RFLP-mapped by Devos et al. and revisited by Dvorak et al.; a group number is
shared across subgenomes, so the 5D and 7D bundles are the D-genome counterparts
of the 5A and 7B those names refer to.

### Bread wheat 4A against Triticum urartu

Triticum urartu, the A-genome donor, is the same two-row view with one assembly
swapped.

<Figure caption="Triticum urartu's seven chromosomes over bread wheat 4A, the same track and locus as the figure above. Where tauschii's three blocks came off three chromosomes, urartu's come off two." src="/img/orthofinder_synteny/wheat_4a_urartu.png" />

Urartu's chromosome 4 covers the first two blocks and its chromosome 7 the
distal one.

## Drosophila: chromosome arms that outlast gene order {#drosophila}

The `drosophila` set is _D. melanogaster_, its near relatives _D. simulans_ and
_D. yakuba_, and the distant _D. pseudoobscura_ and _D. virilis_. Flies keep
their chromosome arms (Muller's elements) across that range and rewrite the gene
order inside them.

The conversion prints, per adjacent pair, the share of a chromosome's links
landing on its single best partner in the row below:

```
chromosome-level correspondence, each row against the next:
  melanogaster -> simulans     best partner holds  98% of a chromosome's links (5 chromosomes)
  simulans     -> yakuba       best partner holds  89% of a chromosome's links (5 chromosomes)
  yakuba       -> pseudoobscura best partner holds  86% of a chromosome's links (5 chromosomes)
  pseudoobscura -> virilis      best partner holds  77% of a chromosome's links (4 chromosomes)
```

Stacked, each melanogaster arm's colour arrives as one bundle in every row.

<Figure caption="Five Drosophila genomes stacked on OrthoFinder orthogroups: melanogaster, simulans, yakuba, pseudoobscura, virilis, on one bp/px. Each melanogaster arm's colour lands on a single chromosome in every row below, and the bundles cross themselves where inversions have accumulated." src="/img/orthofinder_synteny/drosophila.png" />

### One locus, one lane per fly

Gene order needs a window. A
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
draws a lane per fly in its own coordinates, the header naming the chromosome
that fly keeps these orthologs on.

```json session config=https://jbrowse.org/demos/orthofinder_drosophila/config.json
{
  "defaultSession": {
    "name": "Drosophila multi-way synteny track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "melanogaster",
        "loc": "3L:5,789,000-5,931,000",
        "tracks": [
          {
            "trackId": "melanogaster_genes",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact"
          },
          {
            "trackId": "drosophila_orthogroups",
            "type": "MultiWaySyntenyDisplay",
            "rowOrder": ["simulans", "yakuba", "pseudoobscura", "virilis"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

Every fly keeps all of the melanogaster genes in this 3L window, from _Bre1_ to
_PXo_. The near relatives keep them in order; the distant ones reverse the
block, which the header says as `[rev]`.

<Figure caption="A window on melanogaster 3L over four Drosophila lanes from one orthogroups track. simulans and yakuba draw the same genes in the same order on their own 3L; pseudoobscura and virilis draw them reversed, and the pseudoobscura lane names the X." src="/img/multiway_synteny/drosophila_lanes.png" />

Muller element D is melanogaster's 3L, and in the obscura lineage it is fused to
the X, so the pseudoobscura lane sits on a chromosome the assembly calls X.

## Nightshades: the same genes over four times the DNA {#nightshades}

The `solanaceae` set is tomato, potato, pepper, _Nicotiana attenuata_ and coffee
as the outgroup. Their gene counts are similar and their genome sizes are not,
the difference being repeat sequence between the genes. On one bp/px a row's
length is its genome size.

<Figure caption="Five nightshade-family genomes stacked on OrthoFinder orthogroups: tomato, potato, pepper, Nicotiana attenuata, coffee, all on one bp per pixel. Pepper's row is by far the longest while answering tomato gene for gene, and coffee's is the shortest." src="/img/orthofinder_synteny/solanaceae.png" />

_N. attenuata_ is still on scaffolds, which the correspondence print shows as a
low best-partner share. Its genes are spread over thousands of sequences, of
which the build keeps the densest, so the row draws the share that fell on
those.

### One locus, five lanes, five scales

A
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
makes the size difference per-gene: each lane is fitted to the window's
orthologs in its own coordinates and says what scale that took.

```json session config=https://jbrowse.org/demos/orthofinder_solanaceae/config.json
{
  "defaultSession": {
    "name": "Nightshade multi-way synteny track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "tomato",
        "loc": "SL4.0ch04:62,880,000-63,037,000",
        "tracks": [
          {
            "trackId": "tomato_genes",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact",
            "showLabels": "none"
          },
          {
            "trackId": "solanaceae_orthogroups",
            "type": "MultiWaySyntenyDisplay",
            "rowOrder": ["potato", "pepper", "tobacco", "coffee"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

Every genome keeps the two dozen genes in this tomato window. Pepper and _N.
attenuata_ need several times the anchor's span for them, the intergenic
expansion arriving as a number in a lane header.

<Figure caption="A tomato window over potato, pepper, Nicotiana attenuata and coffee lanes from one orthogroups track, each lane in its own coordinates. The potato and coffee lanes hold the block at the anchor's own scale; the pepper and N. attenuata lanes need several times it for the same genes, with the multiple in each header." src="/img/multiway_synteny/solanaceae_lanes.png" />

Every lane's genes stay in the anchor's order; the coffee lane is `[rev]`.

## Grasses: a whole-genome duplication only maize has {#grasses}

The `grasses` set is rice, sorghum, maize, brachypodium and foxtail millet.
Maize carries a whole-genome duplication the other four do not.

<Figure caption="Five grass genomes stacked on OrthoFinder orthogroups: rice, sorghum, maize, brachypodium, foxtail millet. Maize's whole-genome duplication shows up as visibly more ribbons per gene in its two bands than in the non-duplicated pairs." src="/img/orthofinder_synteny/grasses.png" />

The ribbon count is a conversion setting;
[what to do with a duplicated gene](#what-to-do-with-a-duplicated-gene) is where
the build picks it.

### One rice window, one lane per grass

One window of the duplication, as a
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
under rice's gene track:

```json session config=https://jbrowse.org/demos/orthofinder_grasses/config.json
{
  "defaultSession": {
    "name": "Grasses multi-way synteny track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "rice",
        "loc": "3:31,590,000-31,775,000",
        "tracks": [
          {
            "trackId": "rice_genes",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact"
          },
          {
            "trackId": "grasses_orthogroups",
            "type": "MultiWaySyntenyDisplay",
            "rowOrder": ["sorghum", "brachypodium", "setaria", "maize"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

A lane carries one refName, so the maize lane shows one of the two copies.

<Figure caption="A rice window over sorghum, brachypodium, setaria and maize lanes from one OrthoFinder orthogroups track, each lane carrying that grass's own gene models. The block is syntenic in all four, and the maize lane shows the better-kept of maize's two duplicated copies." src="/img/multiway_synteny/grasses_rice_lanes.png" />

Both maize copies at once is the stacked view's job. **Launch stacked synteny
view (visible region)** in the lane track's menu offers a full row per grass
over the visible window.

<Video src="/media/synteny/multiway_launch_stack.mp4" caption="The handoff from the grasses lane track: the track menu's launch entry, the dialog printing where each grass's row would open and offering a checkbox per row, and Replace current view swapping the lane view for the stack." />

## Producing the blocks table

The commands from here on build the `wheat` set; the other four differ only in
which proteomes go into the directory:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
# -og stops after the orthogroups, skipping the gene trees and the species
# tree, which this table does not use and which are most of the runtime.
# -S diamond picks the aligner; -t is threads.
orthofinder -f proteomes -og -S diamond -t "$(getconf _NPROCESSORS_ONLN)"
```

It writes `proteomes/OrthoFinder/Results_<date>/Orthogroups/Orthogroups.tsv`.
That table needs the header row and the leading id column dropped, each cell
reduced to a gene id, and an empty cell marked `.`:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o tauschii.blocks \
  --bed tauschii=tauschii.bed --bed wheat=wheat.bed --bed durum=durum.bed \
  --bed emmer=emmer.bed --bed urartu=urartu.bed --bed timopheevii=timopheevii.bed
```

The table is named after one genome by convention only. The script prints the
column order off the header row, which is what `blockAssemblies` has to be. A
column is named after its proteome file minus extensions;
`--assembly COLUMN=NAME` renames one, and a key matching no column is an error.

### What to do with a duplicated gene

A cell holds every gene of that genome in the orthogroup, and a synteny link
runs gene to gene, so a cell holding two genes has no single answer. In
[the grasses](#grasses) a rice gene commonly has two maize orthologs. Three
treatments:

| `--pick`           | A rice gene with two maize orthologs                         | Use when                                                  |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| `first`            | one ribbon, to whichever maize gene OrthoFinder listed first | you want maximum coverage and accept the arbitrary choice |
| `expand` (default) | two ribbons, one per maize copy                              | the duplication is part of what you are looking at        |
| `single`           | no ribbon                                                    | you want a strictly one-to-one table                      |

`expand` writes one row per copy, pairing copies by index across columns, so an
orthogroup costs rows equal to its largest cell. A cell with more genes than
`--max-copies` is read as a family and contributes nothing; the conversion
counts those. The track draws a gene pair once however many rows name it, so the
extra ribbons stay on the band the duplication is about.

At one locus the two ribbons are countable. Sorghum sits over rice as the
control, sharing the grasses' ancestry without maize's duplication.

<Figure caption="One rice locus between sorghum and maize, off the same grasses_orthogroups track, with each genome's gene track under its row. Sorghum answers a rice gene with one ortholog and maize with two, one into each of the two maize regions, and the genes that kept only one maize copy sit among them." src="/img/orthofinder_synteny/grasses_maize_wgd.png" />

The genes with a single maize ribbon lost a copy after the duplication.

### Making the ids resolve

The BEDs place each gene, and column 4 must match the table's ids byte for byte.
OrthoFinder takes an id from the first token of the FASTA header, while a BED
from the GFF3 is keyed on the gene, so the build script renames each protein to
its gene id when it prepares the proteomes.

With `--bed name=file` per column, the script reports what share of each
column's ids that BED places and drops the rest. A column placing near none has
an id mismatch, and one placing none stops the conversion. The same output
counts the orthogroups that became several rows.

## Loading the orthogroups in JBrowse

One track backs every band of the stack, the same as the
[MCScan blocks track](/docs/tutorials/multiway_synteny_grape_peach_cacao#loading-it-in-jbrowse-with-mcscanblocksadapter):

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "wheat_orthogroups",
  "name": "Wheat orthogroups (OrthoFinder)",
  "assemblyNames": [
    "tauschii",
    "wheat",
    "durum",
    "emmer",
    "urartu",
    "timopheevii"
  ],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "tauschii.blocks.gz",
    "blockAssemblies": [
      "durum",
      "emmer",
      "tauschii",
      "timopheevii",
      "urartu",
      "wheat"
    ],
    "bedLocations": [
      { "uri": "durum.bed.gz" },
      { "uri": "emmer.bed.gz" },
      { "uri": "tauschii.bed.gz" },
      { "uri": "timopheevii.bed.gz" },
      { "uri": "urartu.bed.gz" },
      { "uri": "wheat.bed.gz" }
    ],
    "assemblyNames": [
      "tauschii",
      "wheat",
      "durum",
      "emmer",
      "urartu",
      "timopheevii"
    ]
  }
}
```

`blockAssemblies` and `bedLocations` follow the table's columns (OrthoFinder's
proteome scan, alphabetical here), while `assemblyNames` is the order the stack
draws. Take the column order from what the conversion printed; a mismatch is
reported as a track error naming both lists.

An orthogroup is a set, so any two filled columns are a direct statement about
that pair and row order in the stack is free, unlike a
[jcvi `.blocks` table](/docs/tutorials/multiway_synteny_grape_peach_cacao#direct-vs-transitive-pairs)
anchored on one column.

### Assemblies without sequence

A gene-level synteny view never reads a base, so each assembly is a
[`ChromSizesAdapter`](/docs/config/chromsizesadapter) built from the
`##sequence-region` header of its GFF3: a few kilobytes where the sequence is
tens of gigabytes.

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
jbrowse add-assembly wheat.chrom.sizes --name wheat --load copy
```

Ensembl lists every unplaced scaffold in that header, so the script keeps only
the sequences carrying the most genes and prints what share of each genome's
genes they hold. Raise `MAXSEQ` where the sequences it would add are
chromosomes.

## Reproduce it end to end

[`build_orthofinder_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_orthofinder_synteny.sh)
runs everything above and writes a `config.json` with the assemblies, gene
tracks, the synteny track and a stacked default session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_orthofinder_synteny.sh
bash build_orthofinder_synteny.sh wheat   # or: vertebrates, grasses, drosophila, solanaceae
npx --yes serve orthofinder_wheat_build/jbrowse2  # then open the printed URL
```

The sets it knows, and what each costs to build:

<!-- ORTHOFINDER_SETS START -->

<!-- prettier-ignore -->
| Set | Genomes | DIAMOND runs | Annotation source |
| --- | --- | --- | --- |
| <code>vertebrates</code> | human, chicken, frog, gar, zebrafish | 25 | Ensembl 113 |
| <code>grasses</code> | rice, sorghum, maize, brachypodium, setaria | 25 | Ensembl Plants 63 |
| <code>wheat</code> | tauschii, wheat, durum, emmer, urartu, timopheevii | 36 | Ensembl Plants 63 |
| <code>drosophila</code> | melanogaster, simulans, yakuba, pseudoobscura, virilis | 25 | Ensembl Metazoa 63 |
| <code>solanaceae</code> | tomato, potato, pepper, tobacco, coffee | 25 | Ensembl Plants 63 |

<!-- ORTHOFINDER_SETS END -->

Two cuts are environment variables:

<!-- ORTHOFINDER_CUTS START -->

<!-- prettier-ignore -->
| Variable | Default | What it cuts |
| --- | --- | --- |
| <code>MAXSEQ</code> | 30 | sequence regions kept per genome, the ones carrying the most genes |
| <code>MAXCOPIES</code> | 4 | genes in one orthogroup cell past which it is a gene family rather than a set of copies |

<!-- ORTHOFINDER_CUTS END -->

```bash
MAXSEQ=60 MAXCOPIES=6 bash build_orthofinder_synteny.sh wheat
```

OrthoFinder searches every proteome against every other, so its DIAMOND count is
the square of the set's size. Every step is guarded on its output file, so a
re-run picks up where it stopped. Three sets need the NCBI datasets CLI to name
chromosomes their GFF3 gives as INSDC accessions, each from its
[sequence report](/docs/config/ncbisequencereportaliasadapter).

## Your own genomes

A set name only tells the script which Ensembl files to download. The same run
works on your own genomes given two files per genome, the FASTA and its GFF3.
[gffread](https://github.com/gpertea/gffread) translates each CDS and prints the
transcript-to-gene map alongside, so the proteome and the gene rows come from
one parse of one file, and reference names and lengths come from the FASTA index
it writes.

Column 2 also takes a proteome, which saves translating one Ensembl already
publishes. Its headers then carry a `gene:<id>` tag that has to match the GFF3's
`ID=gene:<id>`. The run says which of the two it read, and prints the share of
ids it placed.

Name the files in a manifest, one line per genome:

```bash
cat > my_genomes.tsv <<'EOF'
# name    genome                    annotation              aliases
speciesA  data/speciesA.fa.gz       data/speciesA.gff3.gz
speciesB  https://host/B.fa.gz      https://host/B.gff3.gz  GCF_000001405.40
EOF

bash build_orthofinder_synteny.sh my_genomes.tsv
npx --yes serve orthofinder_my_genomes_build/jbrowse2  # then open the printed URL
```

Column 1 names the assembly. The file columns take a local path or a URL, and
two genomes make a valid manifest. Column 4 is optional: an INSDC assembly
accession fetches NCBI's sequence report for the submitter's chromosome names,
and anything else is read as a two-column alias table you supply.

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/mcscan_synteny_grape_peach)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/mcscanblocksadapter)

## References

- Emms and Kelly (2019).
  [OrthoFinder: phylogenetic orthology inference for comparative genomics](https://doi.org/10.1186/s13059-019-1832-y)
- Devos et al. (1995).
  [Structural evolution of wheat chromosomes 4A, 5A, and 7B and its impact on recombination](https://doi.org/10.1007/BF00220890)
- Dvorak et al. (2018).
  [Reassessment of the evolution of wheat chromosomes 4A, 5A, and 7B](https://doi.org/10.1007/s00122-018-3165-8)

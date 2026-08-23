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
- `python3`, htslib (`bgzip`, `tabix`), `wget`
- `node`, for the [JBrowse CLI](/docs/cli)
- The
  [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
  (`datasets` and `dataformat`), for the `wheat` set only
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

OrthoFinder bundles its own DIAMOND, so one install covers the first bullet:
[bioconda](https://bioconda.github.io/) has `orthofinder`, and the project
publishes a `davidemms/orthofinder` container with the same bundle. Nothing here
calls it by any path other than `orthofinder` on `PATH`, so without root that
container works too, wrapped as a shim; the
[build script](#reproduce-it-end-to-end) header has the
[Apptainer](https://apptainer.org/) version.

## Orthology where alignment runs out

OrthoFinder clusters proteins into orthogroups without reference to where those
genes sit, so a table of orthogroups is a synteny track for a human against a
zebrafish. [Pairwise minimap2](/docs/tutorials/synteny_visualization) aligns
sequence to sequence and [MCScan](/docs/tutorials/mcscan_synteny_grape_peach)
compares annotations over collinear runs of genes, and both have a divergence
past which they return nothing.

Nothing in an orthogroup asserts synteny, so any collinearity in the ribbons is
a property of the genomes.

The first set is five vertebrate genomes. Human, chicken, frog, spotted gar and
zebrafish share a common ancestor a few hundred million years back, and their
orthologs still fall into chromosome-scale blocks. The teleost genome
duplication shows up as counting: a human chromosome answers to one or two
chicken chromosomes, and to more zebrafish ones.

<Figure caption="Five vertebrate genomes stacked on OrthoFinder orthogroups: human, chicken, frog, spotted gar, zebrafish, all four bands off one vertebrates_orthogroups track. Gar against zebrafish, past the teleost duplication, is the dense band." src="/img/orthofinder_synteny/vertebrates.png" />

Every band draws one line per ortholog, so it resolves into wedges only where a
chromosome's orthologs mostly land on one chromosome of the row below; the build
script prints that share for each adjacent pair.

## Stacking the wheat lineage

The rest of this page follows one set, which the
[script](#reproduce-it-end-to-end) builds under the name `wheat`: wheat's own
polyploidy history. Aegilops tauschii (the diploid D-genome donor), bread wheat
(hexaploid, genomes A+B+D), durum (domesticated tetraploid, A+B), wild emmer
(durum's wild tetraploid ancestor), Triticum urartu (the diploid A-genome donor)
and T. timopheevii (a second, independent tetraploid that also traces to the
A-genome donor). Stacked in that order, each adjacent pair is an evolutionary
step.

Diagonalizing this stack lands on the layout wheat figures are conventionally
drawn in: each homoeologous group's chromosomes come together, so the hexaploid
row reads as groups, with nothing telling the view which chromosomes are
homoeologs.

The rows share one bp/px, which is **Show all regions - same bp per pixel** in
the view menu and `sameScale` in a session spec. A row's drawn length is then
its genome size: the diploid donors are drawn short and the hexaploid fills the
frame.

<Figure caption="Six wheat-lineage genomes stacked on OrthoFinder orthogroups, in evolutionary order. All six rows are on one genomic scale, so a row's length is its genome size: the two diploid donors against the hexaploid they built, with the tetraploids between." src="/img/orthofinder_synteny/wheat.png" />

## Reading one chromosome out of the stack

The track lists every genome in the set, so any pair of them opens as a two-row
view with no second file. This one puts Aegilops tauschii's seven chromosomes
over bread wheat 4A alone, with the palette button's **Query** painting each
link by the tauschii chromosome it leaves.

<Figure caption="Aegilops tauschii's seven D-genome chromosomes over bread wheat chromosome 4A, from the same wheat_orthogroups track. Color by → Query gives each chromosome its own color, and 4A resolves into three blocks in order along it: 4D, then 5D, then 7D." src="/img/orthofinder_synteny/wheat_4a.png" />

The middle bundle leaves the right-hand end of 5D, close by 6D's tick: 6D
reaches 4A only as scattered singletons, like the other three uninvolved
chromosomes. Those four are the control the blocks are read against.

The blocks themselves are the 4AL/5AL and 4AL/7BS translocation pair,
RFLP-mapped by Devos et al. and revisited against the reference assemblies by
Dvorak et al. Those names are A and B genome chromosomes, and a group number is
shared across the three subgenomes, so the 5D and 7D bundles in the frame are
the D-genome counterparts of the 5A and 7B they refer to. The input is
orthogroup membership and each gene's position.

## The same locus against the other donor

Bread wheat 4A is an A-genome chromosome, and the row over it so far has been
Aegilops tauschii, the D-genome donor. Triticum urartu, the A-genome donor, is
the same two-row view with one assembly swapped.

<Figure caption="Triticum urartu's seven chromosomes over bread wheat 4A, the same track and locus as the figure above. Where tauschii's three blocks came off three chromosomes, urartu's come off two." src="/img/orthofinder_synteny/wheat_4a_urartu.png" />

Urartu's chromosome 4 covers both of the first two blocks, and the distal block
is on its chromosome 7. Any of the other four assemblies in the track opens the
same way.

## The conversion

OrthoFinder takes a directory of proteomes, one FASTA per genome, and `-og`
stops it after the orthogroups, which is all this table needs:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
# -og stops after the orthogroups, skipping the gene trees and the species
# tree, which this table does not use and which are most of the runtime.
# -S diamond picks the aligner; -t is threads.
orthofinder -f proteomes -og -S diamond -t "$(getconf _NPROCESSORS_ONLN)"
```

It writes `proteomes/OrthoFinder/Results_<date>/Orthogroups/Orthogroups.tsv`,
naming the directory for the day it ran.

`Orthogroups.tsv` is already one row per orthogroup and one column per genome.
It needs the header row and the leading `Orthogroup` id column dropped, each
cell reduced to a gene id, and an empty cell marked `.`:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o tauschii.blocks \
  --bed tauschii=tauschii.bed --bed wheat=wheat.bed --bed durum=durum.bed \
  --bed emmer=emmer.bed --bed urartu=urartu.bed --bed timopheevii=timopheevii.bed
```

The table is named after one genome by convention; nothing in the file makes
that column special.

The script prints the column order it read off the header row, which is what
`blockAssemblies` has to be. A column is named after the proteome file
OrthoFinder read, with the extensions taken off, so a `--bed` key is the
assembly name only where the proteomes were named that way;
`--assembly COLUMN=NAME` renames the ones that were not, and a key matching no
column is an error.

### What to do with a duplicated gene

A cell holds every gene of that genome in the orthogroup, and a synteny link
runs from one gene to one gene, so a cell holding two genes has no single
correct answer. The five-grass set is where this decides the picture: maize
carries a whole-genome duplication the other four do not, so a rice gene
commonly has two maize orthologs.

<Figure caption="Five grass genomes stacked on OrthoFinder orthogroups: rice, sorghum, maize, brachypodium, foxtail millet. Maize's whole-genome duplication shows up as visibly more ribbons per gene in its two bands than in the non-duplicated pairs." src="/img/orthofinder_synteny/grasses.png" />

Three treatments:

| `--pick`           | A rice gene with two maize orthologs                         | Use when                                                  |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| `first`            | one ribbon, to whichever maize gene OrthoFinder listed first | you want maximum coverage and accept the arbitrary choice |
| `expand` (default) | two ribbons, one per maize copy                              | the duplication is part of what you are looking at        |
| `single`           | no ribbon                                                    | you want a strictly one-to-one table                      |

`first` is what a one-line `awk` reduction does, and its link is chosen by file
order. `expand` writes one row per copy, pairing copies by index across columns,
so an orthogroup costs rows equal to its largest cell and a gene family cannot
blow the table up. A cell with more genes than `--max-copies` is read as a
family and contributes nothing; the conversion counts those, so a threshold set
below the ploidy in the set shows up in that count.

Each of those rows carries the other genomes' genes too, so a pair that is not
duplicated is named on every one of them. The track draws a gene pair once,
however many rows name it, which keeps the extra ribbons on the band the
duplication is about.

At one locus the default's two ribbons are countable. Sorghum sits over rice
here as the control, since it shares the grasses' ancestry without maize's
duplication, and the maize row carries both of the regions the duplication left.

<Figure caption="One rice locus between sorghum and maize, off the same grasses_orthogroups track, with each genome's gene track under its row. Sorghum answers a rice gene with one ortholog and maize with two, one into each of the two maize regions, and the genes that kept only one maize copy sit among them." src="/img/orthofinder_synteny/grasses_maize_wgd.png" />

The genes with a single maize ribbon lost a copy after the duplication.

### Making the ids resolve

The table is coordinate-free. The BEDs place each gene, and column 4 must match
the table's ids byte for byte. OrthoFinder takes a sequence's id from the first
token of its FASTA header, so the ids are whatever the proteome headers led
with, while a BED built from the GFF3 is likely keyed on the gene. The build
script settles this by renaming each protein to its gene id when it prepares the
proteomes, so both sides speak gene ids.

Pass `--bed name=file` per column and the script reports what share of each
column's ids that BED places, dropping the rest from the table. Read that share
before loading anything: a column placing near none of its ids has an id
mismatch, and one placing none of them stops the conversion. A column given no
`--bed` is reported as unchecked. The same output reports how many orthogroups
held a duplicated gene and became several rows.

## Loading it

One track backs every band of the stack, the same as the
[MCScan blocks track](/docs/tutorials/multiway_synteny_grape_peach_cacao#loading-it-in-jbrowse-with-mcscanblocksadapter):

```json
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

`blockAssemblies` and `bedLocations` are positional against the table's own
columns, which follow OrthoFinder's proteome scan (alphabetical here), while the
track's `assemblyNames` is the order the stack draws them. Take the column order
from what the conversion printed; a mismatch reads another genome's BED for
every gene lookup, which the adapter reports as a track error naming both lists.

An orthogroup is a set, so any two columns filled on a row are a direct
statement about that pair, and a row with nothing in column 0 is kept like any
other. Row order in the stack is free, and any pair of the six opens as a
two-row view. A
[jcvi `.blocks` table](/docs/tutorials/multiway_synteny_grape_peach_cacao#direct-vs-transitive-pairs)
is anchored on one of its columns.

### Assemblies without sequence

A gene-level synteny view never reads a base, so each of these assemblies is a
[`ChromSizesAdapter`](/docs/config/chromsizesadapter) built from the
`##sequence-region` header of its GFF3. The wheat lineage as sequence is tens of
gigabytes to host; as names and lengths it is a few kilobytes.

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
jbrowse add-assembly wheat.chrom.sizes --name wheat --load copy
```

Ensembl lists every unplaced scaffold in that header, so the script keeps only
the sequences carrying the most genes. An ortholog on a sequence the assembly
leaves out draws nothing, so the build prints what share of each genome's genes
the kept sequences hold. Read it for a fragmented assembly, and raise `MAXSEQ`
where the sequences it would add are chromosomes.

## Reproduce it end to end

[`build_orthofinder_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_orthofinder_synteny.sh)
runs everything above. It downloads the proteomes and annotations from Ensembl,
reduces each proteome to one protein per gene, runs OrthoFinder, converts the
orthogroups, and writes a `config.json` with the assemblies, gene tracks, the
synteny track and a stacked default session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_orthofinder_synteny.sh
bash build_orthofinder_synteny.sh wheat   # or: vertebrates, grasses
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

<!-- ORTHOFINDER_SETS END -->

The two cuts it makes are environment variables, so a set with a different
karyotype or ploidy needs no edit.

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

The OrthoFinder step is the long one: it searches every proteome against every
other, so the DIAMOND count in the table above is the square of the set's size.
Everything is guarded on its output file, so a re-run picks up where it stopped.
The `wheat` set is the one that needs the NCBI datasets CLI, to name T.
timopheevii's chromosomes from its
[sequence report](/docs/config/ncbisequencereportaliasadapter).

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

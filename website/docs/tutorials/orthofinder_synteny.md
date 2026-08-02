---
title: Synteny visualization (OrthoFinder orthogroups)
sidebar_label: Synteny (OrthoFinder)
description:
  Stack genomes too diverged to align, using OrthoFinder orthogroups as the
  synteny table
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** an [OrthoFinder](https://github.com/davidemms/OrthoFinder) run groups
genes by homology and says nothing about position, so it produces a synteny
track for genomes no aligner can line up. `Orthogroups.tsv` converts to the
`.blocks` table `MCScanBlocksAdapter` reads, with one BED per genome. A
duplicated gene becomes several rows rather than one arbitrary choice, which is
what makes the polyploid case readable.

## Prerequisites

- [OrthoFinder](https://github.com/davidemms/OrthoFinder) with
  [DIAMOND](https://github.com/bbuchfink/diamond)
- `python3`, htslib (`bgzip`, `tabix`), `wget`
- `node`, for the [JBrowse CLI](/docs/cli)
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Orthology where alignment runs out

[Pairwise minimap2](/docs/tutorials/synteny_visualization) aligns sequence to
sequence, and [MCScan](/docs/tutorials/mcscan_synteny) compares annotations but
still asks for collinear runs of genes. Both have a divergence past which they
return nothing. Orthology has no such limit: OrthoFinder clusters proteins into
orthogroups without reference to where those genes sit, so a table of
orthogroups is a synteny track for a human against a zebrafish, where a
whole-genome aligner produces an empty file.

What that costs is stated plainly: nothing in an orthogroup asserts synteny. Any
collinearity you see in the ribbons is a property of the genomes rather than of
the method, which is the opposite of an MCScan track, where collinearity is what
the input file is made of.

## Two genome sets, two things to look at

The [script](#reproduce-it-end-to-end) builds either.

`vertebrates` stacks human, chicken, frog, spotted gar and zebrafish. These
share a common ancestor a few hundred million years back, and the orthologs
still fall into chromosome-scale blocks. The teleost genome duplication shows up
as a matter of counting: a human chromosome answers to one or two chicken
chromosomes, and to more zebrafish ones.

`grasses` stacks rice, sorghum, maize, brachypodium and foxtail millet. Maize
carries a whole-genome duplication the others do not, so a rice gene commonly
has two maize orthologs, and the conversion has to decide what to do about that.

## The conversion

`Orthogroups.tsv` is already one row per orthogroup and one column per genome.
It needs the header row and the leading `Orthogroup` id column dropped, each
cell reduced to a gene id, and an empty cell marked `.`:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o rice.blocks \
  --bed rice=rice.bed --bed maize=maize.bed --bed sorghum=sorghum.bed
```

The header row is the column order, so `blockAssemblies` is read off the file
rather than reconstructed from the order the proteomes were passed to
OrthoFinder. The script prints the list to paste into the track config.

### What to do with a duplicated gene

A cell holds every gene of that genome in the orthogroup, and a synteny link
runs from one gene to one gene, so a cell holding two maize genes has no single
correct answer. Three treatments, and the default is the middle column here:

| `--pick`           | A rice gene with two maize orthologs                         | Use when                                                  |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| `first`            | one ribbon, to whichever maize gene OrthoFinder listed first | you want maximum coverage and accept the arbitrary choice |
| `expand` (default) | two ribbons, one per maize copy                              | the duplication is part of what you are looking at        |
| `single`           | no ribbon                                                    | you want a strictly one-to-one table                      |

`first` is what a one-line `awk` reduction does, and it is the one to avoid: it
draws a confident link chosen by file order, and it hides duplication precisely
where a reader is looking for it. `expand` writes one row per copy, so every
direct link (the reference column against another) is in the table. Rows are
paired by index across columns rather than multiplied out, so an orthogroup
costs rows equal to its largest cell and a gene family cannot blow the table up.
A cell with more genes than `--max-copies` is a family rather than a set of
copies, and contributes nothing.

### Making the ids resolve

The table is coordinate-free. The BEDs are what place each gene, and column 4
must match the table's ids byte for byte. OrthoFinder takes a sequence's id from
the first token of its FASTA header, so the ids are whatever the proteome
headers led with, while a BED built from the GFF3 is likely keyed on the gene.
The build script settles this by renaming each protein to its gene id when it
prepares the proteomes, so both sides speak gene ids.

Pass `--bed name=file` per column and the script reports how many ids each one
resolved, and drops the rest. A table whose ids resolve nowhere loads without an
error and draws nothing, so that per-column count is the thing to read before
loading anything: a column reporting near zero is an id mismatch, not a
biological result. The same line reports how many orthogroups held a duplicated
gene and became several rows.

## Loading it

One track backs every band of the stack, the same as the
[MCScan blocks track](/docs/tutorials/multiway_synteny#loading-it-in-jbrowse-with-mcscanblocksadapter):

```json
{
  "type": "SyntenyTrack",
  "trackId": "grasses_orthogroups",
  "name": "Grasses orthogroups (OrthoFinder)",
  "assemblyNames": ["rice", "sorghum", "maize"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "rice.blocks.gz",
    "blockAssemblies": ["rice", "sorghum", "maize"],
    "bedLocations": [
      { "uri": "rice.bed.gz" },
      { "uri": "sorghum.bed.gz" },
      { "uri": "maize.bed.gz" }
    ],
    "assemblyNames": ["rice", "sorghum", "maize"]
  }
}
```

Column 0 is the reference the table is anchored on, so
[direct vs transitive pairs](/docs/tutorials/multiway_synteny#direct-vs-transitive-pairs)
applies here too: put the reference in the middle of the stack and every band is
direct.

### Assemblies without sequence

A gene-level synteny view never reads a base, so these assemblies are
[`ChromSizesAdapter`](/docs/config/chromsizesadapter) rather than a FASTA, built
from the `##sequence-region` header of each GFF3. Five vertebrate genomes as
sequence is several gigabytes to host; as names and lengths it is a few
kilobytes, and the view is the same.

```bash
jbrowse add-assembly zebrafish.chrom.sizes --name zebrafish --load copy
```

Ensembl lists every unplaced scaffold in that header, so the script keeps the
largest 30 sequences per genome. A row carrying thousands of scaffolds is not
readable, and the orthologs on them draw nothing rather than erroring.

## Reproduce it end to end

[`build_orthofinder_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_orthofinder_synteny.sh)
runs everything above. It downloads the proteomes and annotations from Ensembl,
reduces each proteome to one protein per gene, runs OrthoFinder, converts the
orthogroups, and writes a `config.json` with the assemblies, gene tracks, the
synteny track and a stacked default session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_orthofinder_synteny.sh
bash build_orthofinder_synteny.sh vertebrates   # or: grasses
npx --yes serve orthofinder_vertebrates_build/jbrowse2  # then open the printed URL
```

The OrthoFinder step is the long one: five proteomes is 25 DIAMOND searches, so
allow a while on first run. Everything is guarded on its output file, so a
re-run picks up where it stopped.

## See also

- [](/docs/tutorials/multiway_synteny) for the same adapter from a jcvi MCScan
  run
- [](/docs/tutorials/mcscan_synteny)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/user_guides/linear_synteny_view)
- [Synteny track config guide](/docs/config_guides/synteny_track)
- [MCScanBlocksAdapter config](/docs/config/mcscanblocksadapter)

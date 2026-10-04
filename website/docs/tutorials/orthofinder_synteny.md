---
title: Synteny visualization (OrthoFinder orthogroups)
sidebar_label: Synteny (OrthoFinder)
description:
  Stack genomes on OrthoFinder orthogroups, built from protein homology, as the
  synteny table
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

We build synteny tracks from OrthoFinder orthogroups, protein-homology clusters
with no positional information, converted into the `.blocks` table
`MCScanBlocksAdapter` reads. The page builds the `wheat` set step by step, from
`orthofinder` through the table to a stacked view, then opens four more sets:
vertebrates, drosophila, nightshades (`solanaceae`) and grasses.

## Prerequisites

- [OrthoFinder](https://github.com/davidemms/OrthoFinder) with
  [DIAMOND](https://github.com/bbuchfink/diamond) on `PATH` as `orthofinder`
- `python3`, htslib (`bgzip`, `tabix`), `wget`
- `node`, for the [JBrowse CLI](/docs/cli)
- [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
  (`datasets`, `dataformat`), for `wheat`, `drosophila` and `solanaceae`
- [gffread](https://github.com/gpertea/gffread), for
  [your own genomes](#your-own-genomes) only
- A running JBrowse instance ([web](/docs/quickstart_web) or
  [desktop](/docs/quickstart_desktop))

## Where the data comes from

Each set takes its protein FASTA and GFF3 files from one Ensembl division.

- **`vertebrates`**, Ensembl release 113:
  https://ftp.ensembl.org/pub/release-113/
- **`wheat`**, **`solanaceae`** and **`grasses`**, Ensembl Plants release 63:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/
- **`drosophila`**, Ensembl Metazoa release 63:
  https://ftp.ensemblgenomes.ebi.ac.uk/pub/metazoa/release-63/
- **Sequence reports**, fetched from NCBI by accession: _T. timopheevii_
  GCA_963921465.1, tomato GCA_000188115.5, and the non-melanogaster flies
  GCA_016746395.2, GCA_016746365.2, GCA_009870125.2 and GCA_030788295.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/

## Wheat: six genomes of one polyploid history {#wheat}

The `wheat` set is six genomes of wheat's polyploid history:

- **Aegilops tauschii**, diploid D donor
- **bread wheat**, hexaploid, A+B+D
- **durum**, domesticated tetraploid, A+B
- **wild emmer**, durum's wild tetraploid ancestor
- **Triticum urartu**, diploid A donor
- **T. timopheevii**, a second tetraploid also tracing to the A donor

## Producing the blocks table

The build commands here produce the `wheat` set; the other four differ only in
the proteomes used:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
# -og stops after the orthogroups, skipping the gene trees and the species
# tree, which this table does not use and which are most of the runtime.
# -S diamond picks the aligner; -t is threads.
orthofinder -f proteomes -og -S diamond -t "$(getconf _NPROCESSORS_ONLN)"
```

The run writes
`proteomes/OrthoFinder/Results_<date>/Orthogroups/Orthogroups.tsv`, which the
next command reduces to one gene id per cell:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o tauschii.blocks \
  --bed tauschii=tauschii.bed --bed wheat=wheat.bed --bed durum=durum.bed \
  --bed emmer=emmer.bed --bed urartu=urartu.bed --bed timopheevii=timopheevii.bed
```

`blockAssemblies` must match the column order the script prints.
`--assembly COLUMN=NAME` renames a column; a misspelled column there renames
nothing and raises no error, while a typo in `--bed` is an error.

### What to do with a duplicated gene

A cell holds the genes from one genome in the orthogroup, so two genes in one
cell have no single synteny link. `--pick` chooses among three treatments:

| `--pick`           | A rice gene with two maize orthologs                         | Use when                                                  |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| `first`            | one ribbon, to whichever maize gene OrthoFinder listed first | you want maximum coverage and accept the arbitrary choice |
| `expand` (default) | two ribbons, one per maize copy                              | the duplication is part of what you are looking at        |
| `single`           | no ribbon                                                    | you want a strictly one-to-one table                      |

A cell over `--max-copies` counts as a family and contributes no row.

Sorghum sits over rice as a control, since it shares the ancestry and lacks the
duplication. The `grasses` set shows both:

<Figure caption="One rice locus between sorghum and maize, off the grasses set's orthogroups track, with a gene track under each row. Sorghum has one ortholog per rice gene and maize has two, one into each of the two maize regions, and the genes that kept only one maize copy sit among them." src="/img/orthofinder_synteny/grasses_maize_wgd.png" />

### Making the ids resolve

Column 4 of each BED must match the ids in the table exactly. The build script
keeps each gene's longest protein and names it by the gene id, so OrthoFinder
sees one protein per gene under the id the BED has. `--bed name=file` reports
the share of ids placed, and the conversion stops if it places none.

## Loading the orthogroups in JBrowse

One track backs every band of the stack:

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
      "durum.bed.gz",
      "emmer.bed.gz",
      "tauschii.bed.gz",
      "timopheevii.bed.gz",
      "urartu.bed.gz",
      "wheat.bed.gz"
    ]
  }
}
```

`blockAssemblies` and `bedLocations` follow the table columns, and the track
draws every genome they name. A mismatch against the column order the conversion
printed reports a track error naming both lists.

### Assemblies from a chrom.sizes

A gene-level synteny view reads no sequence, so each assembly is a
[`ChromSizesAdapter`](/docs/config/chromsizesadapter) over a `.chrom.sizes` file
(a name and a length per line) built from the `##sequence-region` header in its
GFF3. We'll load wheat; the other genomes repeat the block under their own
names:

```json addassembly
{ "name": "wheat", "uri": "wheat.chrom.sizes" }
```

### Gene tracks for the lanes

A lane draws gene models from a gene track under its assembly name. The grasses
lane session below names a hosted one (`rice_genes`); for your own annotation,
add one per genome with a GFF3 that is bgzipped and tabix-indexed
([prep](/docs/quickstart_web)) and uses the assembly's refNames:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "wheat_genes",
  "name": "wheat genes",
  "assemblyNames": ["wheat"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "wheat.gff.gz"
  }
}
```

## Stacking the wheat genomes

**Add → Linear synteny view**, pick `wheat_orthogroups` and add the six genomes
in the order tauschii, wheat, durum, emmer, urartu, timopheevii; the
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#from-the-ui) walks the
dialog. **Show all regions - same bp per pixel** in the view menu (`sameScale`
in a session spec) puts the rows on one bp/px, so row length on screen matches
genome size. **Rows → Re-order chromosomes** sorts each row's chromosomes
against its neighbour so the links run along a diagonal (`autoDiagonalize` in a
session spec).

The same view as a session, over the hosted wheat config. It is the heaviest
stack on this page, so the bands take a while to draw:

```json session config=https://jbrowse.org/demos/orthofinder_wheat/config.json
{
  "defaultSession": {
    "name": "Wheat lineage stack",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          { "assembly": "tauschii" },
          { "assembly": "wheat" },
          { "assembly": "durum" },
          { "assembly": "emmer" },
          { "assembly": "urartu" },
          { "assembly": "timopheevii" }
        ],
        "tracks": [
          ["wheat_orthogroups"],
          ["wheat_orthogroups"],
          ["wheat_orthogroups"],
          ["wheat_orthogroups"],
          ["wheat_orthogroups"]
        ],
        "sameScale": true,
        "autoDiagonalize": true,
        "collapseEmptyRows": true,
        "opacity": 0.15
      }
    ]
  }
}
```

For your own set, name your assemblies top to bottom in `views` and your
orthogroups track once per band in `tracks`.

<Figure caption="Six wheat-lineage genomes stacked on OrthoFinder orthogroups, in evolutionary order. All six rows are on one genomic scale, so row length matches genome size: the two diploid donors against the hexaploid they built, with the tetraploids between." src="/img/orthofinder_synteny/wheat.png" />

### Reading one chromosome out of the stack

Any pair opens as a two-row view; this one puts Aegilops tauschii's seven
chromosomes over bread wheat 4A, colored by **Query** in the palette button
menu, painting each link by its tauschii chromosome.

<Figure caption="Aegilops tauschii's seven D-genome chromosomes over bread wheat chromosome 4A, from the same wheat_orthogroups track. Color by → Query gives each chromosome a distinct color, and 4A resolves into three blocks in order along it: 4D, then 5D, then 7D." src="/img/orthofinder_synteny/wheat_4a.png" />

6D and the others reach 4A only as scattered singletons. The blocks are the
4AL/5AL and 4AL/7BS translocation pair (Devos et al. 1995; Dvorak et al. 2018).

## Vertebrates: blocks that survive out to zebrafish {#vertebrates}

The other four sets build with `bash build_orthofinder_synteny.sh <set>`
([Reproduce it end to end](#reproduce-it-end-to-end)) and stack as wheat did.
The `vertebrates` set is human, chicken, frog, spotted gar and zebrafish.

<Figure caption="Five vertebrate genomes stacked on OrthoFinder orthogroups: human, chicken, frog, spotted gar, zebrafish, all four bands off one vertebrates_orthogroups track. Gar against zebrafish, past the teleost duplication, is the dense band." src="/img/orthofinder_synteny/vertebrates.png" />

### One locus, one lane per vertebrate

Open human at `2:176,090,000-176,290,000`, the _HOXD_ cluster, with the human
gene track and the orthogroups track on the
[multi-way synteny display](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates),
and the chicken, frog, gar and zebrafish lanes draw under it. The chain stops at
the cluster.

<Figure caption="The human HOXD cluster over chicken, frog, gar and zebrafish lanes from one OrthoFinder orthogroups track. Every lane draws the genes annotated in that genome across the cluster and the ribbons there are scattered slivers; the solid chains sit to the right of it, on the single-copy genes the orthogroup table could resolve." src="/img/multiway_synteny/vertebrate_hox_lanes.png" />

## Drosophila: chromosome arms that outlast gene order {#drosophila}

The `drosophila` set is _D. melanogaster_, close relatives _D. simulans_ and _D.
yakuba_, and the distant _D. pseudoobscura_ and _D. virilis_. Across these flies
the chromosome arms (Muller elements) keep their gene content, while inversions
reorder the genes inside each arm.

The stack repeats melanogaster between the other four flies, so every band sets
one fly against melanogaster, and **Reference** in the palette button menu
paints each ribbon by the melanogaster arm it leaves.

<Figure caption="simulans, yakuba, pseudoobscura and virilis stacked on OrthoFinder orthogroups with melanogaster between each pair, on one bp/px. Each ribbon takes the colour of its melanogaster arm in every band, so one colour follows one arm down the stack; the bundle from each arm stays together in every fly, and inside a bundle the ribbons cross where inversions have reordered the genes." src="/img/orthofinder_synteny/drosophila.png" />

### One locus, one lane per fly

Gene order needs a window. The same
[multi-way synteny display](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
at `3L:5,789,000-5,931,000` on melanogaster draws a lane per fly. Every fly
keeps the melanogaster genes in this window.

<Figure caption="A window on melanogaster 3L over four Drosophila lanes from one orthogroups track. simulans and yakuba draw the same genes in the same order on their 3L; pseudoobscura and virilis draw them reversed, and the pseudoobscura lane names the X." src="/img/multiway_synteny/drosophila_lanes.png" />

## Nightshades: the same genes over four times the DNA {#nightshades}

The `solanaceae` set is tomato, potato, pepper, _Nicotiana attenuata_ and
coffee. On one bp/px, row length matches genome size.

<Figure caption="Five nightshade-family genomes stacked on OrthoFinder orthogroups: tomato, potato, pepper, Nicotiana attenuata, coffee, all on one bp per pixel. Pepper's row is by far the longest while matching tomato gene for gene, and coffee's is the shortest." src="/img/orthofinder_synteny/solanaceae.png" />

## Grasses: the maize whole-genome duplication {#grasses}

The `grasses` set is rice, sorghum, maize, brachypodium and foxtail millet.

<Figure caption="Five grass genomes stacked on OrthoFinder orthogroups: rice, sorghum, maize, brachypodium, foxtail millet. The maize whole-genome duplication shows as more ribbons per gene in the two maize bands than in the other pairs." src="/img/orthofinder_synteny/grasses.png" />

The `--pick` table [above](#what-to-do-with-a-duplicated-gene) sets how many
ribbons a duplicated gene draws.

### One rice window, one lane per grass

Open the same five grasses as a
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates),
under the rice gene track:

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
            "domain": ["sorghum", "brachypodium", "setaria", "maize"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

A lane follows one refName, so the maize lane shows one of the two copies.

<Figure caption="A rice window over sorghum, brachypodium, setaria and maize lanes from one OrthoFinder orthogroups track, each lane drawing that grass's gene models. The block is syntenic in all four, and the maize lane shows whichever of the two maize copies places more of the window." src="/img/multiway_synteny/grasses_rice_lanes.png" />

The stacked view shows both maize copies at once. **Launch → Linear synteny view
(visible region)** in the lane track menu offers a full row per grass.

<Video src="/media/synteny/multiway_launch_stack.mp4" caption="The handoff from the grasses lane track: the launch entry in the track menu, the dialog printing where the row for each grass would open and offering a checkbox per row, and Replace current view swapping the lane view for the stack." />

## Reproduce it end to end

[`build_orthofinder_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_orthofinder_synteny.sh)
runs everything above and writes a `config.json` with the assemblies, gene
tracks, the synteny track and a stacked default session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_orthofinder_synteny.sh
bash build_orthofinder_synteny.sh wheat   # or: vertebrates, grasses, drosophila, solanaceae
npx --yes serve orthofinder_wheat_build/jbrowse2  # then open the printed URL
```

The sets the script accepts, and what each costs to build:

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

Three sets need the NCBI datasets CLI to name chromosomes their GFF3 gives as
INSDC accessions, each from its
[sequence report](/docs/config/ncbisequencereportaliasadapter).

## Your own genomes

A set name tells the script which Ensembl files to download. Your own genomes
need a FASTA and a GFF3 per genome.
[gffread](https://github.com/gpertea/gffread) translates each CDS into the
proteome and prints the transcript-to-gene map and FASTA index alongside.

Column 2 also takes a proteome directly (skipping translation); its headers then
need a `gene:<id>` tag matching `ID=gene:<id>` in the GFF3.

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

Column 1 names the assembly; the file columns take a local path or URL, and two
genomes make a valid manifest. Column 4 is optional: an INSDC accession fetches
NCBI's sequence report for chromosome names, or names a two-column alias table
you supply.

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/mcscan_synteny_grape_peach)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/mcscanblocksadapter)

## Citations

- Emms and Kelly (2019).
  [OrthoFinder: phylogenetic orthology inference for comparative genomics](https://doi.org/10.1186/s13059-019-1832-y)
- Devos et al. (1995).
  [Structural evolution of wheat chromosomes 4A, 5A, and 7B and its impact on recombination](https://doi.org/10.1007/BF00220890)
- Dvorak et al. (2018).
  [Reassessment of the evolution of wheat chromosomes 4A, 5A, and 7B](https://doi.org/10.1007/s00122-018-3165-8)

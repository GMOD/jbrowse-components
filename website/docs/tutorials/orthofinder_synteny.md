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
`MCScanBlocksAdapter` reads. Five sets show the pattern below; the second half
builds `wheat` from that conversion.

- **vertebrates**: human, chicken, frog, gar, zebrafish
- **wheat**: six genomes across wheat's polyploid history
- **drosophila**: five flies at increasing divergence
- **nightshades** (`solanaceae`): tomato, potato, pepper, coffee, and _Nicotiana
  attenuata_
- **grasses**: rice, sorghum, maize, brachypodium, setaria

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

Each set is one Ensembl division's protein FASTA and GFF3.

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

## Vertebrates: blocks that survive out to zebrafish {#vertebrates}

The `vertebrates` set is human, chicken, frog, spotted gar and zebrafish.

<Figure caption="Five vertebrate genomes stacked on OrthoFinder orthogroups: human, chicken, frog, spotted gar, zebrafish, all four bands off one vertebrates_orthogroups track. Gar against zebrafish, past the teleost duplication, is the dense band." src="/img/orthofinder_synteny/vertebrates.png" />

### One locus, one lane per vertebrate

For one locus, a
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
draws a lane per genome, each in its own coordinates.

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
            "domain": ["chicken", "frog", "gar", "zebrafish"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

The chain stops at the human _HOXD_ cluster.

<Figure caption="The human HOXD cluster over chicken, frog, gar and zebrafish lanes from one OrthoFinder orthogroups track. Every lane draws the genes annotated in that genome across the cluster and the ribbons there are scattered slivers; the solid chains sit to the right of it, on the single-copy genes the orthogroup table could resolve." src="/img/multiway_synteny/vertebrate_hox_lanes.png" />

## Wheat: six genomes of one polyploid history {#wheat}

The `wheat` set is six genomes of wheat's polyploid history:

- **Aegilops tauschii**, diploid D donor
- **bread wheat**, hexaploid, A+B+D
- **durum**, domesticated tetraploid, A+B
- **wild emmer**, durum's wild tetraploid ancestor
- **Triticum urartu**, diploid A donor
- **T. timopheevii**, a second tetraploid also tracing to the A donor

**Show all regions - same bp per pixel** in the view menu (`sameScale` in a
session spec) puts the rows on one bp/px, so a row's drawn length is its genome
size.

<Figure caption="Six wheat-lineage genomes stacked on OrthoFinder orthogroups, in evolutionary order. All six rows are on one genomic scale, so a row's length is its genome size: the two diploid donors against the hexaploid they built, with the tetraploids between." src="/img/orthofinder_synteny/wheat.png" />

### Reading one chromosome out of the stack

Any pair opens as a two-row view; this one puts Aegilops tauschii's seven
chromosomes over bread wheat 4A, colored by the palette button's **Query**,
painting each link by its tauschii chromosome.

<Figure caption="Aegilops tauschii's seven D-genome chromosomes over bread wheat chromosome 4A, from the same wheat_orthogroups track. Color by → Query gives each chromosome a distinct color, and 4A resolves into three blocks in order along it: 4D, then 5D, then 7D." src="/img/orthofinder_synteny/wheat_4a.png" />

6D and the others reach 4A only as scattered singletons. The blocks are the
4AL/5AL and 4AL/7BS translocation pair (Devos et al. 1995; Dvorak et al. 2018).

## Drosophila: chromosome arms that outlast gene order {#drosophila}

The `drosophila` set is _D. melanogaster_, close relatives _D. simulans_ and _D.
yakuba_, and the distant _D. pseudoobscura_ and _D. virilis_. Flies keep their
chromosome arms (Muller elements) but rewrite gene order inside them.

<Figure caption="Five Drosophila genomes stacked on OrthoFinder orthogroups: melanogaster, simulans, yakuba, pseudoobscura, virilis, on one bp/px. Each melanogaster arm's colour marks a single chromosome in every row below, and the bundles cross themselves where inversions have accumulated." src="/img/orthofinder_synteny/drosophila.png" />

### One locus, one lane per fly

Gene order needs a window. A
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
draws a lane per fly in that fly's coordinates.

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
            "domain": ["simulans", "yakuba", "pseudoobscura", "virilis"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

Every fly keeps the melanogaster genes in this 3L window.

<Figure caption="A window on melanogaster 3L over four Drosophila lanes from one orthogroups track. simulans and yakuba draw the same genes in the same order on their 3L; pseudoobscura and virilis draw them reversed, and the pseudoobscura lane names the X." src="/img/multiway_synteny/drosophila_lanes.png" />

## Nightshades: the same genes over four times the DNA {#nightshades}

The `solanaceae` set is tomato, potato, pepper, _Nicotiana attenuata_ and
coffee. On one bp/px a row's length is its genome size.

<Figure caption="Five nightshade-family genomes stacked on OrthoFinder orthogroups: tomato, potato, pepper, Nicotiana attenuata, coffee, all on one bp per pixel. Pepper's row is by far the longest while matching tomato gene for gene, and coffee's is the shortest." src="/img/orthofinder_synteny/solanaceae.png" />

### One locus, five lanes

A
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
fits each lane to the window's orthologs in its own coordinates, with the scale
printed in the header.

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
            "domain": ["potato", "pepper", "tobacco", "coffee"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

Every genome keeps the two dozen genes in this window.

<Figure caption="A tomato window over potato, pepper, Nicotiana attenuata and coffee lanes from one orthogroups track, each lane in that genome's coordinates. Every lane spans more of its genome than the anchor window to hold the same genes, the pepper and N. attenuata lanes most of all, with the multiple in each header." src="/img/multiway_synteny/solanaceae_lanes.png" />

Every lane keeps the anchor's gene order except coffee, marked `[rev]`.

## Maize whole-genome duplication {#grasses}

The `grasses` set is rice, sorghum, maize, brachypodium and foxtail millet.

<Figure caption="Five grass genomes stacked on OrthoFinder orthogroups: rice, sorghum, maize, brachypodium, foxtail millet. Maize's whole-genome duplication shows up as visibly more ribbons per gene in its two bands than in the non-duplicated pairs." src="/img/orthofinder_synteny/grasses.png" />

The ribbon count is set in
[what to do with a duplicated gene](#what-to-do-with-a-duplicated-gene).

### One rice window, one lane per grass

One window, as a
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates),
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
            "domain": ["sorghum", "brachypodium", "setaria", "maize"],
            "height": 320
          }
        ]
      }
    ]
  }
}
```

A lane has one refName, so the maize lane shows only one copy.

<Figure caption="A rice window over sorghum, brachypodium, setaria and maize lanes from one OrthoFinder orthogroups track, each lane drawing that grass's gene models. The block is syntenic in all four, and the maize lane shows whichever of maize's two duplicated copies places more of the window." src="/img/multiway_synteny/grasses_rice_lanes.png" />

The stacked view shows both maize copies at once. **Launch → Linear synteny view
(visible region)** in the lane track's menu offers a full row per grass.

<Video src="/media/synteny/multiway_launch_stack.mp4" caption="The handoff from the grasses lane track: the track menu's launch entry, the dialog printing where each grass's row would open and offering a checkbox per row, and Replace current view swapping the lane view for the stack." />

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
`--assembly COLUMN=NAME` renames a column; a typo there never fires, and a typo
in `--bed` is an error.

### What to do with a duplicated gene

A cell holds one genome's genes in the orthogroup, so two genes in one cell have
no single synteny link. Three treatments:

| `--pick`           | A rice gene with two maize orthologs                         | Use when                                                  |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| `first`            | one ribbon, to whichever maize gene OrthoFinder listed first | you want maximum coverage and accept the arbitrary choice |
| `expand` (default) | two ribbons, one per maize copy                              | the duplication is part of what you are looking at        |
| `single`           | no ribbon                                                    | you want a strictly one-to-one table                      |

A cell over `--max-copies` counts as a family and contributes no row.

Sorghum sits over rice as a control: same ancestry, no duplication.

<Figure caption="One rice locus between sorghum and maize, off the same grasses_orthogroups track, with each genome's gene track under its row. Sorghum has one ortholog per rice gene and maize has two, one into each of the two maize regions, and the genes that kept only one maize copy sit among them." src="/img/orthofinder_synteny/grasses_maize_wgd.png" />

### Making the ids resolve

Column 4 of each BED must match the table's ids exactly; the build script
renames each protein to its gene id first. `--bed name=file` reports the share
of ids placed, and none placed stops the conversion.

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

`blockAssemblies` and `bedLocations` follow the table's columns, and the track
draws every genome they name. A mismatch against the conversion's order reports
a track error naming both lists.

An orthogroup is a set, so any two filled columns are a direct statement about
that pair, and row order in the stack is free.

### Assemblies from a chrom.sizes

A gene-level synteny view never reads a base, so each assembly is a
[`ChromSizesAdapter`](/docs/config/chromsizesadapter) built from its GFF3's
`##sequence-region` header.

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
jbrowse add-assembly wheat.chrom.sizes --name wheat --load copy
```

The script keeps only the sequences carrying the most genes; raise `MAXSEQ`
where it would add whole chromosomes.

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

A set name only tells the script which Ensembl files to download; your own
genomes need a FASTA and a GFF3 per genome.
[gffread](https://github.com/gpertea/gffread) translates each CDS into the
proteome and prints the transcript-to-gene map and FASTA index alongside.

Column 2 also takes a proteome directly (skipping translation); its headers then
need a `gene:<id>` tag matching the GFF3's `ID=gene:<id>`.

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

## References

- Emms and Kelly (2019).
  [OrthoFinder: phylogenetic orthology inference for comparative genomics](https://doi.org/10.1186/s13059-019-1832-y)
- Devos et al. (1995).
  [Structural evolution of wheat chromosomes 4A, 5A, and 7B and its impact on recombination](https://doi.org/10.1007/BF00220890)
- Dvorak et al. (2018).
[Reassessment of the evolution of wheat chromosomes 4A, 5A, and 7B](https://doi.org/10.1007/s00122-018-3165-8)
</content>

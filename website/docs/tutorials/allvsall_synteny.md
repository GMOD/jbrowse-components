---
title: Synteny visualization (all-vs-all minimap2)
sidebar_label: Synteny (all-vs-all minimap2)
description: Stack strains in a linear synteny view from one all-vs-all PAF
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

Strains of one bacterial species share most of their chromosome and differ by
gene islands one strain picked up and by stretches that flipped. We align five
_E. coli_ strains against each other with minimap2, stack them in a linear
synteny view, and read where they differ: Sakai's Shiga-toxin prophage, the
phenylacetate (paa) operon three strains lack, and IAI39's inversions. The input
is one all-vs-all PAF, minimap2's alignment of every genome against every other:

- align the five strains against each other with `minimap2 -X` to build the PAF
- load it with `MultiGenomePAFAdapter` and stack the five assemblies as rows
- add a gene track per strain, then read one strain against the rest in a single
  pileup

## Prerequisites

- a JBrowse to open the files in: [Desktop](/docs/quickstart_desktop) takes a
  local file by path, [Web](/docs/quickstart_web) through **Add track**
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `minimap2`
- `samtools`
- htslib (`bgzip`, `tabix`)
- `unzip`
- `node`, for the [JBrowse CLI](/docs/cli)

## Where the data comes from

Five _E. coli_ RefSeq assemblies, each fetched by accession with the `datasets`
CLI.

- K12:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/
- Sakai:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/008/865/GCF_000008865.2_ASM886v2/
- CFT073:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/007/445/GCF_000007445.1_ASM744v1/
- NCTC86:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/002/007/705/GCF_002007705.1_ASM200770v1/
- IAI39:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/026/345/GCF_000026345.1_ASM2634v1/

- the all-vs-all PAF, rehosted:
  https://jbrowse.org/demos/ecoli_pangenome/all_vs_all.paf.gz
- the K-12 gene track, rehosted, with the other four beside it under their
  strain names: https://jbrowse.org/demos/ecoli_pangenome/K12.gff.gz
- the finished config: https://jbrowse.org/demos/ecoli_pangenome/config.json

## Producing an all-vs-all PAF

The mapping step of [PGGB](https://github.com/pangenome/pggb), the PanGenome
Graph Builder, writes an all-vs-all PAF, and so does
[minimap2](https://github.com/lh3/minimap2) aligning
[PanSN](https://github.com/pangenome/PanSN-spec)-named genomes against
themselves. PanSN names every sequence `sample#haplotype#contig`, e.g.
`K12#1#chr`.

The [script](#reproduce-it-end-to-end) downloads five RefSeq assemblies with the
NCBI `datasets` CLI, annotation included, and reduces each to one `chr` record
by dropping the plasmids and renaming the chromosome:

| Strain | RefSeq accession |
| ------ | ---------------- |
| K12    | GCF_000005845.2  |
| Sakai  | GCF_000008865.2  |
| CFT073 | GCF_000007445.1  |
| NCTC86 | GCF_002007705.1  |
| IAI39  | GCF_000026345.1  |

The five strain FASTAs become the JBrowse assemblies as-is. The PanSN names
exist only in the concatenated copy minimap2 aligns; the haplotype is `1`
throughout:

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  # '>chr' -> '>K12#1#chr'
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa

# -c: emit the base-level CIGAR the linear synteny view needs
# -X: skip self-alignments and the reciprocal half of every pair
minimap2 -c -x asm20 -X all.fa all.fa > all_vs_all.paf
```

## Setting up the five assemblies

Each strain FASTA becomes an assembly whose name matches an entry in
`assemblyNames` on the track:

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  bgzip -f "$strain.fa"
  samtools faidx "$strain.fa.gz"   # writes the .fai and .gzi JBrowse needs
  jbrowse add-assembly "$strain.fa.gz" --name "$strain" --load copy
done
```

The same step for one strain, as a config or in JBrowse Desktop:

```json addassembly
{
  "name": "K12",
  "uri": "K12.fa.gz"
}
```

An assembly whose refNames still have the PanSN prefix draws empty. The
[assemblies configuration guide](/docs/config_guides/assemblies) has more.

## Loading the PAF with MultiGenomePAFAdapter

List every assembly the file covers in `assemblyNames`; the adapter keeps only
the records whose PanSN prefixes match the pair of rows each band joins:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli pangenome (all-vs-all PAF)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
    "uri": "all_vs_all.paf",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

`MultiGenomePAFAdapter` has to be named; from a `.paf` extension JBrowse guesses
the pairwise `PAFAdapter`, which reads only two assembly names.

If an assembly name differs from its PanSN sample prefix, map it with
`assemblyNameToPanSN`, e.g. `{ "Ecoli_K12": "K12" }`. A haplotype-resolved
pangenome can map each haplotype to a separate assembly with a
`sample#haplotype` prefix; see
[PanSN depth](/docs/config_guides/synteny_track#pansn-depth-sample-or-haplotype).

## Large files: index with make-pif

`MultiGenomePAFAdapter` reads the whole PAF into memory. For many samples, index
it with `jbrowse make-pif` and switch to `MultiGenomeIndexedPAFAdapter`,
fetching only the region in view:

```bash
# produces all_vs_all.pif.gz and all_vs_all.pif.gz.tbi
jbrowse make-pif all_vs_all.paf
```

`make-pif` finishes by printing the `add-track` command for the samples it
found:

```bash
jbrowse add-track all_vs_all.pif.gz --adapterType MultiGenomeIndexedPAFAdapter \
  -a CFT073,IAI39,K12,NCTC86,Sakai --load copy
```

Only the `adapter` block differs from the un-indexed version:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava_indexed",
  "name": "E. coli all-vs-all (indexed)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "MultiGenomeIndexedPAFAdapter",
    "uri": "all_vs_all.pif.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

`make-pif` also writes a coarse copy of the alignments for zoomed-out views.
`--coarse` tunes it and `--csi` swaps the TBI index for sequences over ~512 Mb;
raise
[`coarseBpPerPxThreshold`](/docs/config/multigenomeindexedpafadapter#slot-coarsebpperpxthreshold)
on the adapter alongside it.

## Stacking the five strains {#stacking-the-genomes}

### Stacking the strains from the import form {#from-the-ui}

1. **Add → Linear synteny view** opens the form in **Quick start**.
2. Choose `ecoli_ava`. Its five assemblies each become a row.
3. Click **Launch**.

**Manual** mode builds the stack by hand: **Add row** per strain, and the
connector button between each pair to pick its track.

<Figure caption="The all-vs-all Quick start in the import form. The ecoli_ava track fills its five assemblies in as rows, and Launch opens the stack." src="/img/multiway_synteny/ecoli_import_form.png" />

### Stacking the strains in a defaultSession

A `defaultSession` holding a `LinearSyntenyView` opens the stack on load. Five
rows means four bands, so `tracks` has four entries:

```json session config=https://jbrowse.org/demos/ecoli_pangenome/config.json
{
  "defaultSession": {
    "name": "E. coli 5-strain pangenome",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          { "assembly": "K12" },
          { "assembly": "Sakai" },
          { "assembly": "CFT073" },
          { "assembly": "NCTC86" },
          { "assembly": "IAI39" }
        ],
        "tracks": [["ecoli_ava"], ["ecoli_ava"], ["ecoli_ava"], ["ecoli_ava"]],
        "minAlignmentLength": 10000,
        "collapseEmptyRows": true
      }
    ]
  }
}
```

- `tracks` is one entry per band: `tracks[0]` connects rows 0-1, `tracks[1]`
  rows 1-2, and so on
- `minAlignmentLength` hides the many short alignments minimap2 writes, leaving
  the shared backbone
- `collapseEmptyRows` gives each trackless row a bare scale bar

Row order is a free choice with an all-vs-all PAF, since the file aligns every
pair. The
[ortholog-tables tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao)
walks through the rest of the `defaultSession` structure.

<Figure caption="Five E. coli strains stacked from one minimap2 all-vs-all PAF, short alignments hidden with minAlignmentLength. The continuous ribbons are the backbone shared by all five; the bottom band crosses because IAI39 has inversions against the others." src="/img/multiway_synteny/ecoli_pangenome.png" />

The gaps between ribbons mark where the strains differ. Sakai's gaps hold its
Shiga-toxin prophage genes, and CFT073's hold its pathogenicity islands.

## Adding gene tracks to see what a gap holds

The [script](#reproduce-it-end-to-end) gives each GFF the same two adjustments
as its FASTA: it renames the seqid to `chr` and drops plasmid features.

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  jbrowse sort-gff "$strain.gff" | bgzip > "$strain.gff.gz"
  tabix "$strain.gff.gz"
  # -a "$strain": attach the track to that one assembly, so it stays with that row
  jbrowse add-track "$strain.gff.gz" -a "$strain" --name "$strain genes" --load copy
done
```

Navigate the K-12 row to `chr:1,026,000-1,126,000` and the Sakai row to
`chr:1,205,000-1,305,000`. The gap right of the ribbon holds _stx2A_ and
_stx2B_, the Shiga-toxin subunits, with no alignment to K-12.

<Figure caption="K-12 (top) and Sakai (bottom) with their gene tracks, framing the Sp5 prophage. The synteny ribbon runs out at the shared-backbone boundary, and stx2B sits in the stretch past it with no counterpart in K-12." src="/img/multiway_synteny/ecoli_stx_island.png" />

## One strain against all the others

In a plain linear genome view, with no second row to name a target assembly, the
`ecoli_ava` track draws the strain you're viewing against every other strain in
the file. Clicking an alignment can launch a synteny view against its mate, the
strain it aligns to.

Three track-menu items set the pileup up for reading strain by strain:

1. **Group by... → Mate assembly** gives each strain its own lane. Untick
   **Show... → Collapse groups to one row** to stack every lane, or expand one
   from its label.
2. **Group by... → Hide self-alignment lane** drops the lane for the strain
   you're viewing. The figures below have it ticked.
3. **Show... → Show coverage** adds a histogram of how many other strains cover
   each base.

The figure below adds a track of the pangenome graph's segments, built with
minigraph in the [E. coli pangenome tutorial](/docs/tutorials/pangenome_ecoli),
above the lanes, and the same window as a graph view under the linear view. The
shaded band is K-12's phenylacetate (paa) operon, where three strains stop at
its left edge and NCTC86 runs through.

<Figure caption="Above, one track with one lane per strain: K-12 against every other sample in the file, grouped by mate assembly. Below, the same window as a graph, where the short arm beside the ringed node is the detour the other three take." src="/img/multiway_synteny/ecoli_one_vs_all.png" />

At whole-chromosome zoom, the same lanes also fit on the K-12 row of the
five-strain stack. List IAI39 second in the session's `views`, add `ecoli_ava`
to the K-12 row from that row's track selector, and pick **Strand** from the
palette button, so an inversion is blue in both halves. A pangenome with many
samples needs the indexed file from [make-pif](#large-files-index-with-make-pif)
first.

<Figure caption="The one-vs-all lanes on the K-12 row of the five-strain stack, both drawn from the same PAF and colored by strand. White gaps are where a strain has no alignment to the K-12 backbone. IAI39 sits directly below K-12, so its blue stretches and the blue crossings under them are the same inversions." src="/img/multiway_synteny/ecoli_one_vs_all_whole_genome.png" />

### Percent identity per strain

The `ecoli_ava` track can also draw each alignment as a line at its identity,
one row per strain, the percent identity plot
[PipMaker](https://doi.org/10.1101/gr.10.4.577) drew for a pair of genomes. In
the track menu, **Display types → Marks** draws it with nothing to configure.
The config below is that plot written out, with one addition:

- `rows` splits the alignments by the strain each one aligns to, which the PAF
  adapter puts in `mate.assemblyName`
- a `rule` mark draws a line across each alignment at its `identity`, which
  comes from minimap2's `de` divergence tag
- `zero: false` fits the axis to the identities instead of running it down to 0
- `filter` drops K-12's alignments to itself, which otherwise take a row of
  their own

```json addtrack config=https://jbrowse.org/demos/ecoli_pangenome/config.json loc=chr
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava_identity",
  "name": "K-12 against each strain, identity",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/all_vs_all.paf.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "ecoli_ava_identity-LinearMarkDisplay",
      "rows": "mate.assemblyName",
      "filter": ["jexl:feature.mate.assemblyName != 'K12'"],
      "scales": { "y": { "zero": false } },
      "marks": [{ "mark": "rule", "encoding": { "y": "identity", "size": 2 } }]
    }
  ]
}
```

<Figure caption="K-12 against each other strain, one row per strain, each alignment a line at its identity. NCTC86 runs closest to K-12, and the short, less similar alignments fall at the same places in every row." src="/img/multiway_synteny/ecoli_identity_rows.png" />

### Redrawing each lane in its own strain's coordinates

On the K-12 axis, a strain with no alignment to the backbone is a white gap.
**Display types → Multi-way synteny display** redraws each lane in the
coordinates of the strain it shows, with each PAF record as one ribbon. The
[ortholog-table tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
has a figure of the display, and the
[E. coli pangenome tutorial](/docs/tutorials/pangenome_ecoli) draws the same gap
as a graph.

### Launching a stacked view at one locus

Drag-select a region on the scale bar and pick **Launch → Linear synteny view**.
A dialog lists every assembly aligning to that region as a panel, top to bottom,
with arrows to reorder them and a checkbox to drop one; **Replace current view**
or **Open in new view** launches the stack. Ribbons draw between neighbouring
rows only.

Right-clicking a single alignment offers three routes under **Launch**: **Linear
synteny view with Sakai** (or whichever strain the alignment names) opens that
one pair, **Linear synteny view, all assemblies here** opens the same
multi-strain dialog, and **Open Sakai at the matching region** opens a linear
genome view of Sakai at that region.

<Figure caption="Right-clicking one alignment in the one-vs-all lanes: the pair it describes, every strain aligning here, or a linear view of that strain, in one Launch submenu." src="/img/multiway_synteny/ecoli_alignment_menu.png" />

<Figure caption="A rubberband selection over the shared backbone, the Launch → Linear synteny view entry it raises, the dialog listing a panel per strain, and the five-row stack it opens." src="/img/multiway_synteny/ecoli_launch_from_selection.png" links="Selection=multiway_synteny/ecoli_launch_selection,Dialog=multiway_synteny/ecoli_launch_dialog,Result=multiway_synteny/ecoli_launch_result" />

<Video src="/media/synteny/allvsall_launch_from_selection.mp4" caption="From the lanes to the stack for one locus: a scale-bar selection raises Launch, the dialog lists a panel per strain that aligns to the window, and its arrows move IAI39 up under K-12 before the launch replaces the lane view with the stack." />

A launched view is a few kilobases wide, and the CIGAR `minimap2 -c` wrote draws
each insertion and deletion where it falls. **CIGAR indels** in the settings
menu switches between colored, transparent and none.

## Checking the Sakai gap against the PAF

Print the alignments between one strain and another near a gap, here Sakai
against K-12 near the stx2 island. `-X` emits each pair once in either
direction, so the coordinates come from whichever column the strain landed in.
Set `s` and `m` to the two strain prefixes and `lo` and `hi` to the window:

```bash
awk -F'\t' -v OFS='\t' -v s=Sakai -v m=K12 '
  $1 ~ "^" s "#" && $6 ~ "^" m "#" { print $3, $4; next }
  $1 ~ "^" m "#" && $6 ~ "^" s "#" { print $8, $9 }
' all_vs_all.paf | sort -n | awk -v lo=1200000 -v hi=1300000 '$1 < hi && $2 > lo'
```

```text
1207288	1207877
1210882	1246166
1251954	1252260
1274685	1275548
```

The second line is the shared backbone the ribbon draws. The third is short, and
the fourth starts at 1,274,685, so _stx2A_ and _stx2B_ fall in a stretch with no
K-12 counterpart.

## Reproduce it end to end

[`build_ecoli_pangenome_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_synteny.sh)
runs everything on this page, download and preparation included, and needs the
tools under [Prerequisites](#prerequisites):

1. Download the five RefSeq assemblies with their annotation, and keep each
   one's chromosome under the name `chr`, so the plasmids drop out and every
   strain's row reads the same name.
2. Concatenate the strains under PanSN names and align them with `minimap2 -X`,
   so each pair is aligned once and no strain aligns to itself.
3. Keep each GFF's chromosome features under the same `chr` name, so the genes
   load on that strain's row.
4. Write the config with the five assemblies, the gene tracks, the all-vs-all
   track and the five-row session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_synteny.sh
bash build_ecoli_pangenome_synteny.sh          # builds ./ecoli_pangenome_build/jbrowse2
npx --yes serve ecoli_pangenome_build/jbrowse2 # then open the printed URL
```

For a whole-genome pangenome, swap the `add-track` step for the `make-pif` +
`MultiGenomeIndexedPAFAdapter` path from
[Large files](#large-files-index-with-make-pif).

## See also

- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/user_guides/dotplot_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/multigenomepafadapter)
- [](/docs/config/multigenomeindexedpafadapter)
- [](/docs/developer_guides/pif_format)
- [](/docs/jbrowse_anywidget)
- [](/docs/jbrowser)

---
title: Synteny visualization (all-vs-all minimap2)
sidebar_label: Synteny (all-vs-all minimap2)
description: Stack strains in a linear synteny view from one all-vs-all PAF
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

A synteny track shows which stretches of DNA correspond between genomes. We
build a linear synteny view of five _E. coli_ strains from one all-vs-all PAF,
the file minimap2 writes when it aligns every genome against every other:

- align the five strains against each other with `minimap2 -X` to build the PAF
- load it with `MultiGenomePAFAdapter` and stack the five assemblies as rows
- add a gene track per strain, then read one strain against the rest in a single
  pileup

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
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

- the all-vs-all PAF, per-strain gene tracks and config, rehosted:
  https://jbrowse.org/demos/ecoli_pangenome/

## Producing an all-vs-all PAF

The [PGGB](https://github.com/pangenome/pggb) mapping step produces one, or
self-align [PanSN](https://github.com/pangenome/PanSN-spec)-named genomes with
[minimap2](https://github.com/lh3/minimap2). PanSN names every sequence
`sample#haplotype#contig`, e.g. `K12#1#chr`.

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

An assembly whose refNames still carry the PanSN prefix draws empty. The
[assemblies configuration guide](/docs/config_guides/assemblies) has the
equivalent JSON.

## Loading the PAF with MultiGenomePAFAdapter

List every assembly the file covers in `assemblyNames`; the adapter keeps only
the records whose PanSN prefixes match the pair each band draws:

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

`make-pif` emits a coarse zoomed-out tier by default. `--coarse` tunes that tier
and `--csi` swaps the TBI index for sequences over ~512 Mb; raise
[`coarseBpPerPxThreshold`](/docs/config/multigenomeindexedpafadapter#slot-coarsebpperpxthreshold)
on the adapter alongside it.

## Stacking the genomes

### From the UI

1. **Add → Linear synteny view** opens the form in **Quick start**.
2. Choose `ecoli_ava`. Its five assemblies each become a row.
3. Click **Launch**.

**Manual** mode builds the stack by hand: **Add row** per strain, and the
connector button between each pair to pick its track.

<Figure caption="The all-vs-all Quick start in the import form. The ecoli_ava track fills its five assemblies in as rows, and Launch opens the stack." src="/img/multiway_synteny/ecoli_import_form.png" />

### Declaratively with defaultSession

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
- `collapseEmptyRows` gives a ribbon-only row a bare scalebar

The
[ortholog-tables tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao)
walks through the `defaultSession` structure. Row order is a free choice here.

<Figure caption="Five E. coli strains stacked from one minimap2 all-vs-all PAF, short alignments hidden with minAlignmentLength. The continuous ribbons are the backbone shared by all five; the bottom band crosses because IAI39 is inverted against the others." src="/img/multiway_synteny/ecoli_pangenome.png" />

The gaps mark where the strains differ: Sakai carries its prophage Shiga-toxin
genes there, and CFT073 its pathogenicity islands.

## Adding gene tracks

The annotations show what a gap holds. Each GFF gets the same two adjustments as
the FASTA, in the [script](#reproduce-it-end-to-end): seqid renamed to `chr`,
plasmid features dropped.

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  jbrowse sort-gff "$strain.gff" | bgzip > "$strain.gff.gz"
  tabix "$strain.gff.gz"
  # -a "$strain": attach the track to that one assembly, so it stays with that row
  jbrowse add-track "$strain.gff.gz" -a "$strain" --name "$strain genes" --load copy
done
```

Navigate the Sakai row to `chr:1,267,000-1,268,400` and the gap holds _stx2A_
and _stx2B_, the Shiga-toxin subunits, with no alignment to K-12.

<Figure caption="K-12 (top) and Sakai (bottom) with their gene tracks, framing the Sp5 prophage. The synteny ribbon runs out at the shared-backbone boundary, and everything right of it, stx2B included, has no counterpart in K-12." src="/img/multiway_synteny/ecoli_stx_island.png" />

## One strain against all the others

With no target assembly, a plain linear genome view draws the strain you're
viewing against every other sample in the file. Clicking a feature can launch a
synteny view against its mate.

Three track-menu items separate every alignment in the pileup by strain:

1. **Group by... → Mate assembly** gives one lane per sample. Untick **Show... →
   Collapse groups to one row** to stack every lane, or expand one from its
   label.
2. **Group by... → Hide self-alignment lane** drops the lane for the strain
   you're viewing. The figures below have it ticked.
3. **Show... → Show coverage** adds a histogram of how many other strains cover
   each base.

The figure below adds the pangenome graph as a track under the lanes, the same
window [the next section](#the-same-gap-drawn-as-a-graph) draws as a graph. The
shaded band is the phenylacetate (paa) operon on K-12, where three strains stop
at its left edge and NCTC86 runs through.

<Figure caption="Above, one track with one lane per strain: K-12 against every other sample in the file, grouped by mate assembly. Below, the same window as a graph, where the short arm beside the ringed node is the detour the other three take." src="/img/multiway_synteny/ecoli_one_vs_all.png" />

Zoomed out to the whole chromosome, the lanes can sit on the K-12 row of the
stack above. For a real pangenome, index first with
[make-pif](#large-files-index-with-make-pif):

<Figure caption="The one-vs-all lanes on the K-12 row of the five-strain stack, both drawn from the same PAF and colored by strand. White gaps are where a strain has no alignment to the K-12 backbone. IAI39 sits directly below K-12, so its blue stretches and the blue crossings under them are the same inversions." src="/img/multiway_synteny/ecoli_one_vs_all_whole_genome.png" />

### Percent identity per strain

The same track can draw each alignment as a line at its identity, one row per
strain, the percent identity plot
[PipMaker](https://doi.org/10.1101/gr.10.4.577) drew for a pair of genomes. In
the track menu, **Display types → Marks** draws it with nothing to configure.
The config below is the same plot written out:

- `rows` splits the alignments by the strain each one aligns to, which the PAF
  adapter puts in `mate.assemblyName`
- a `rule` mark draws a line across each alignment at its `identity`, which
  comes from minimap2's `de` divergence tag

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
      "marks": [{ "mark": "rule", "encoding": { "y": "identity", "size": 2 } }]
    }
  ]
}
```

<Figure caption="K-12 against each other strain, one row per strain, each alignment a line at its identity." src="/img/multiway_synteny/ecoli_identity_rows.png" />

### Lanes in strain coordinates

On the K-12 axis, a strain with no alignment to the backbone is a white gap.
**Display types → Multi-way synteny display** redraws each lane in the
coordinates of the strain it shows;
[the ortholog-table tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
walks through the same reading for gene names. With no gene names:

- each PAF record draws as one ribbon, keyed by the `syntenyId` the adapter
  gives it
- the gutters carry the direct alignments between each **adjacent** pair, from
  the same file

The pggb graph-depth wiggle above the lanes comes from the
[E. coli pangenome tutorial](/docs/tutorials/pangenome_ecoli#pangenome-depth-projection-core-vs-accessory).
The `color` setting on the lanes sorts genes into the island by name, using a
jexl expression in `field`. It paints the island genes red in every lane and
adds a key naming both groups:

```json session config=https://jbrowse.org/demos/ecoli_pangenome/config.json
{
  "defaultSession": {
    "name": "E. coli all-vs-all multi-way track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "K12",
        "loc": "chr:1,436,000-1,484,000",
        "tracks": [
          { "trackId": "ecoli_pggb_depth", "height": 60 },
          {
            "trackId": "ecoli_ava",
            "type": "MultiWaySyntenyDisplay",
            "domain": ["NCTC86", "CFT073", "Sakai", "IAI39"],
            "height": 340,
            "color": {
              "field": "jexl:feature.name && (startsWith(feature.name,'paa') || startsWith(feature.name,'fea') || feature.name == 'tynA') ? 'island' : 'other'",
              "domain": ["island", "other"],
              "range": ["#d62728", "goldenrod"],
              "labels": ["feaR, tynA, paa operon", "other genes"],
              "title": "K-12 island genes"
            }
          }
        ]
      }
    ]
  }
}
```

<Figure caption="The paa operon island on K-12 with a flank on each side. Graph depth drops across the island and comes back after it. In the all-vs-all lanes below, the island genes (feaR, tynA and the paa operon) are red in every lane: K-12 and NCTC86 carry them. CFT073 annotates none and goes straight from one flank to the other. Sakai and IAI39 annotate none either, and their lanes open reversed on a stretch holding the right-hand flank but not ldhA and ydbH on the left." src="/img/multiway_synteny/ecoli_island_lanes.png" />

### The gap in the graph {#the-same-gap-drawn-as-a-graph}

In the graph, the island is a segment; the walk for each strain goes through it
or detours around it. The
[graph genome view](/docs/user_guides/graph_genome_view) plugin draws a window
of it beside the alignment. The ringed segment, `s502`, is the long node
carrying the island.

The lower band is blank across the island: each strain carries a distinct
sequence there, the phenylacetate operon and a prophage on K-12, a set of nleG
effector genes on Sakai.

<Figure caption="Above, the phenylacetate operon window with NCTC86 over K12 and Sakai under it. A shaded box marks the island in each row, and the band between them is blank across both, as a substitution appears from either side. Below, the same window as a graph on the same reference-position ramp, the two rings marking one segment in both." src="/img/pangenome/rgfa_paa_bubble.png" />

### Launching a stacked view at one locus

Drag-select a region and pick **Launch → Linear synteny view**. JBrowse finds
every assembly aligning to that region and opens a row for each, listed top to
bottom. Ribbons draw between neighbouring rows only.

Right-clicking a single alignment offers three routes under **Launch**: **Linear
synteny view with Sakai** (or whichever strain the alignment names) opens that
one pair, **Linear synteny view, all assemblies here** opens the same
multi-strain dialog, and **Open Sakai at the matching region** opens a linear
genome view of Sakai at that region.

<Figure caption="Right-clicking one alignment in the one-vs-all lanes: the pair it describes, every strain aligning here, or a linear view of that strain, in one Launch submenu." src="/img/multiway_synteny/ecoli_alignment_menu.png" />

A launched view is a few kilobases wide, and the CIGAR `minimap2 -c` wrote draws
each insertion and deletion where it falls. **CIGAR indels** in the settings
menu switches between colored, transparent and none.

<Figure caption="Rubberband-select a window of the shared backbone, then Launch → Linear synteny view." src="/img/multiway_synteny/ecoli_launch_from_selection.png" links="Selection=multiway_synteny/ecoli_launch_selection,Dialog=multiway_synteny/ecoli_launch_dialog,Result=multiway_synteny/ecoli_launch_result" />

<Video src="/media/synteny/allvsall_launch_from_selection.mp4" caption="From the lanes to the stack for one locus: a scale-bar selection raises Launch, the dialog lists a panel per strain that aligns to the window, and its arrows move IAI39 up under K-12 before the launch replaces the lane view with the stack." />

## Checking a gap against the PAF

Print the Sakai side of every Sakai/K-12 alignment near the stx2 island. `-X`
emits each pair once in either direction, so the coordinates come from whichever
column Sakai landed in:

```bash
awk -F'\t' -v OFS='\t' '
  $1 ~ /^Sakai#/ && $6 ~ /^K12#/ { print $3, $4; next }
  $1 ~ /^K12#/   && $6 ~ /^Sakai#/ { print $8, $9 }
' all_vs_all.paf | sort -n | awk '$1 < 1300000 && $2 > 1200000'
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

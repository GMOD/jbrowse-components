---
title: Synteny visualization (all-vs-all minimap2)
sidebar_label: Synteny (all-vs-all minimap2)
description: Stack strains in a linear synteny view from one all-vs-all PAF
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** a synteny track shows which stretches of DNA correspond between
genomes. We stack five _E. coli_ strains in one linear view, built from a single
all-vs-all PAF, the file minimap2 writes when every genome is aligned against
every other.

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

On Debian/Ubuntu, `apt install minimap2 samtools tabix unzip` covers most of
these. The NCBI `datasets` CLI is a single-binary download, and `node` comes
from [nodejs.org](https://nodejs.org/).

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

- the all-vs-all PAF, per-strain gene tracks and config, rehosted so the stacked
  view loads without rerunning the pipeline:
  https://jbrowse.org/demos/ecoli_pangenome/

## Many genome rows from one PAF file

A linear synteny view stacks N genome rows with a ribbon band between each
adjacent pair. For closely related genomes, the most convenient source is a
single all-vs-all PAF, every genome aligned to every other. This page builds a
five-strain _E. coli_ view from one such file.

[Synteny from ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao)
stacks cross-species comparisons from gene-level ortholog tables.

## Producing an all-vs-all PAF

The [PGGB](https://github.com/pangenome/pggb) mapping step produces one, or
concatenate [PanSN](https://github.com/pangenome/PanSN-spec)-named genomes and
self-align them with [minimap2](https://github.com/lh3/minimap2). PanSN names
every sequence `sample#haplotype#contig`, e.g. `K12#1#chr`, and the adapter uses
the `sample` prefix to classify each PAF record.

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

Those five FASTAs become the JBrowse assemblies as-is. The PanSN names exist
only inside the PAF, so the concatenated copy for minimap2 is its own file. The
haplotype is `1` throughout, since these are haploid:

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  # '>chr' -> '>K12#1#chr'
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa

minimap2 -c -x asm20 -X all.fa all.fa > all_vs_all.paf
```

`-c` emits the base-level CIGAR the linear synteny view needs. `-X` skips each
sequence's own diagonal and the reciprocal copy of each pair, leaving every
cross-strain pair once. Paralogy is untouched, which
[one-vs-all](#one-strain-against-all-the-others) mode reads as a strain's own
repeats.

## Setting up the five assemblies

Each strain FASTA becomes an assembly whose name matches an entry in the track's
`assemblyNames`:

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  bgzip -f "$strain.fa"
  samtools faidx "$strain.fa.gz"   # writes the .fai and .gzi JBrowse needs
  jbrowse add-assembly "$strain.fa.gz" --name "$strain" --load copy
done
```

The adapter strips the PanSN prefix before matching, so `K12#1#chr` in the PAF
resolves to `chr` in the `K12` assembly. An assembly whose refNames still carry
the prefix draws empty. The
[assemblies configuration guide](/docs/config_guides/assemblies) has the
equivalent JSON.

## Loading the PAF with AllVsAllPAFAdapter

One track backs every band of the stacked view. List every assembly the file
covers in `assemblyNames`; the adapter keeps only the records whose PanSN
prefixes match the pair each band draws:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli pangenome (all-vs-all PAF)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "uri": "all_vs_all.paf",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

`AllVsAllPAFAdapter` has to be named; a `.paf` guessed from its extension is the
pairwise `PAFAdapter`, which reads only the first two assembly names.

If an assembly name differs from its PanSN sample prefix, map it with
`assemblyNameToPanSN`, e.g. `{ "Ecoli_K12": "K12" }`. A name matching no sample
raises an error listing the samples the file holds.

### Haplotype-resolved genomes

Here `K12` covers everything named `K12#1#...`. A haplotype-resolved pangenome
can load each haplotype as its own assembly mapped to a `sample#haplotype`
prefix, making hap1 against hap2 a band in its own right. See
[PanSN depth](/docs/config_guides/synteny_track#pansn-depth-sample-or-haplotype).

## Large files: index with make-pif

`AllVsAllPAFAdapter` reads the whole PAF into memory. For a whole-genome
pangenome of many samples, index it with `jbrowse make-pif` and switch to
`AllVsAllIndexedPAFAdapter`, which fetches only the records overlapping the
region in view:

```bash
# produces all_vs_all.pif.gz and all_vs_all.pif.gz.tbi
jbrowse make-pif all_vs_all.paf
```

`make-pif` finishes by printing the `add-track` command for the samples it
found:

```bash
jbrowse add-track all_vs_all.pif.gz --adapterType AllVsAllIndexedPAFAdapter \
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
    "type": "AllVsAllIndexedPAFAdapter",
    "uri": "all_vs_all.pif.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

`make-pif` emits a coarse zoomed-out tier by default so whole-genome views stay
responsive. `--coarse` tunes that tier and `--csi` swaps the TBI index for
sequences longer than ~512 Mb. Raising `--coarse` means raising the adapter's
[`coarseBpPerPxThreshold`](/docs/config/allvsallindexedpafadapter#slot-coarsebpperpxthreshold)
with it, so coarse ribbons stay at zooms where their flattened indels are too
small to see.

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
- `minAlignmentLength` hides minimap2's many short alignments, leaving the
  shared backbone
- `collapseEmptyRows` gives a ribbon-only row a bare scalebar

The
[ortholog-tables tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao)
walks through the `defaultSession` structure. Row order is a free choice here,
since an all-vs-all file has a direct alignment for every pair.

<Figure caption="Five E. coli strains stacked from one minimap2 all-vs-all PAF, short alignments hidden with minAlignmentLength. The continuous ribbons are the backbone shared by all five; the bottom band crosses because IAI39 is inverted against the others." src="/img/multiway_synteny/ecoli_pangenome.png" />

The gaps are where the strains differ: Sakai's largest carry its prophage
Shiga-toxin genes, and CFT073's are its pathogenicity islands.

## Adding gene tracks

The annotations downloaded alongside each genome say what a gap holds. Each GFF
gets the same two adjustments as the FASTA, in the
[script](#reproduce-it-end-to-end): seqid renamed to `chr`, plasmid features
dropped.

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  jbrowse sort-gff "$strain.gff" | bgzip > "$strain.gff.gz"
  tabix "$strain.gff.gz"
  jbrowse add-track "$strain.gff.gz" -a "$strain" --name "$strain genes" --load copy
done
```

`-a "$strain"` adds each track to one strain's assembly, so it rides along with
that row. Navigate Sakai's row to `chr:1,267,000-1,268,400` and the gap holds
_stx2A_ and _stx2B_, the Shiga-toxin subunits, with no alignment to K-12.

<Figure caption="K-12 (top) and Sakai (bottom) with their gene tracks, framing the Sp5 prophage. The synteny ribbon runs out at the shared-backbone boundary, and everything right of it, stx2B included, has no counterpart in K-12." src="/img/multiway_synteny/ecoli_stx_island.png" />

## One strain against all the others

In a plain linear genome view, with no target assembly, the same track draws the
strain you are looking at against every other sample in the file. A mate the
track does not list still draws, labelled by its PanSN prefix, as does a
strain's own paralogy. Clicking a feature offers to launch a synteny view
against its mate, for the mates the track lists.

Every alignment lands in one pileup, so three track-menu items say which strain
a block came from:

1. **Group by... → Mate assembly** gives one labelled lane per sample, shading
   darker where several alignments cover the same base. Untick **Show... →
   Collapse groups to one row** to stack every lane, or expand one from its
   label.
2. **Group by... → Hide self-alignment lane** drops the lane for the strain you
   are viewing. `minimap2 -X` skipped each genome's own diagonal, so a K-12 lane
   filling with K-12 says the PAF was built wrong. The figures below have it
   ticked.
3. **Show... → Show coverage** adds a histogram of how many other strains cover
   each base. The rest of that menu is the one from alignments tracks.

The figure below carries a second pane, the same window in the pangenome graph,
which [the next section](#the-same-gap-drawn-as-a-graph) picks up. The shaded
band is K-12's phenylacetate (paa) operon: Sakai, CFT073 and IAI39 stop at its
left edge where NCTC86 runs through.

<Figure caption="Above, one track with one lane per strain: K-12 against every other sample in the file, grouped by mate assembly. Below, the same window as a graph, where the short arm beside the ringed node is the detour the other three take." src="/img/multiway_synteny/ecoli_one_vs_all.png" />

Zoomed out to the whole chromosome, the lanes give a per-strain overview, and
they can sit on the K-12 row of the stack above since a synteny view's rows are
ordinary linear genome views. For a real pangenome, index first with
[make-pif](#large-files-index-with-make-pif):

<Figure caption="The one-vs-all lanes on the K-12 row of the five-strain stack, both drawn from the same PAF and colored by strand. White gaps are where a strain breaks from the K-12 backbone. IAI39 sits directly below K-12, so its blue stretches and the blue crossings under them are the same inversions." src="/img/multiway_synteny/ecoli_one_vs_all_whole_genome.png" />

### Each strain's lane in its own coordinates

On K-12's axis a strain leaving the backbone is a white gap, and the lane cannot
say what that strain carries instead. **Display types → Multi-way synteny
display** redraws the track with each strain's lane in its own coordinates, the
reading
[the ortholog-table tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
walks through on gene names. With no gene names:

- each PAF record is its own ribbon, keyed by the adapter's `syntenyId`
- the gutters carry each **adjacent** pair's direct alignments from the same
  file

Above the lanes sits the pggb graph-depth wiggle the
[E. coli pangenome tutorial](/docs/tutorials/pangenome_ecoli#pangenome-depth-projection-core-vs-accessory)
builds from these same strains.

```json session config=https://jbrowse.org/demos/ecoli_pangenome/config.json
{
  "defaultSession": {
    "name": "E. coli all-vs-all multi-way track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "K12",
        "loc": "chr:1,443,000-1,466,000",
        "tracks": [
          { "trackId": "ecoli_pggb_depth", "height": 60 },
          {
            "trackId": "ecoli_ava",
            "type": "MultiWaySyntenyDisplay",
            "rowOrder": ["NCTC86", "CFT073", "Sakai", "IAI39"],
            "height": 340
          }
        ]
      }
    ]
  }
}
```

<Figure caption="The paa operon island on K-12, read twice: the pangenome graph-depth wiggle steps down where fewer genomes carry the sequence, and the all-vs-all lanes below name them. K-12 and NCTC86 carry the island, and the white wedges in the ribbon bands are the strains whose alignment skips it." src="/img/multiway_synteny/ecoli_island_lanes.png" />

### The gap in the graph genome view {#the-same-gap-drawn-as-a-graph}

Sequence absent from the alignment is absent from the PAF; in the graph the
island is a segment, and each strain's walk goes through it or detours around
it. The E. coli tutorials build that minigraph graph, and the
[graph genome view](/docs/user_guides/graph_genome_view) plugin opens a window
of it beside the alignment. The ringed segment, `s502`, is the long node
carrying the island.

The lower band is blank across the island, which is a substitution: each strain
carries an island of its own there, the phenylacetate operon and a prophage on
K-12, a set of nleG effector genes on Sakai.

<Figure caption="Above, the phenylacetate operon window with NCTC86 over K12 and Sakai under it. Each strain's own island is shaded in its own row and the band between them is blank across both, which is what a substitution looks like from either side. Below, the same window as a graph on the same reference-position ramp, the two rings marking one segment in both." src="/img/pangenome/rgfa_paa_bubble.png" />

### Launching a stacked view at one locus

Drag-select a region and pick **Launch → Linear synteny view**. With the
all-vs-all track as the dialog's dataset, JBrowse finds every assembly aligning
to that region and opens a row for each. The dialog lists them top to bottom and
lets you reorder them; ribbons are drawn between neighbouring rows only, which
is why IAI39 sits directly below K-12 in the figure above.

Right-clicking a single alignment offers three routes. **Linear synteny view
with Sakai** (or whichever strain the alignment names) opens the one pair that
alignment describes. **Linear synteny view, all assemblies here** is the same
multi-strain dialog. **Open Sakai at the matching region** opens that strain on
its own coordinates at the matching stretch, which is also what a
[graph node](/docs/user_guides/graph_genome_view#from-a-node-back-to-a-genome)
offers.

<Figure caption="Right-clicking one alignment in the one-vs-all lanes: the pair it describes, every strain aligning here, or that strain on its own, under one Launch heading." src="/img/multiway_synteny/ecoli_alignment_menu.png" />

A launched view is a few kilobases wide, where the CIGAR `minimap2 -c` wrote
matters: each insertion and deletion is drawn where it falls. **Show color
legend** on the palette button names the colors, and **CIGAR indels** in the
settings menu switches between colored, transparent and none.

<Figure caption="Rubberband-select a window of the shared backbone, then Launch → Linear synteny view." src="/img/multiway_synteny/ecoli_launch_from_selection.png" links="Selection=multiway_synteny/ecoli_launch_selection,Dialog=multiway_synteny/ecoli_launch_dialog,Result=multiway_synteny/ecoli_launch_result" />

<Video src="/media/synteny/allvsall_launch_from_selection.mp4" caption="From the lanes to the stack for one locus: a scale-bar selection raises Launch, the dialog lists a panel per strain that aligns to the window, and its arrows move IAI39 up under K-12 before the launch replaces the lane view with the stack." />

## Checking a gap against the PAF

Print the Sakai side of every Sakai/K-12 alignment near the stx2 island, taking
the coordinates from whichever column Sakai landed in, since `-X` emits each
pair once in either direction:

```bash
awk -F'\t' -v OFS='\t' '
  $1 ~ /^Sakai#/ && $6 ~ /^K12#/ { print $3, $4; next }
  $1 ~ /^K12#/   && $6 ~ /^Sakai#/ { print $8, $9 }
' all_vs_all.paf | sort -n | awk '$1 < 1300000 && $2 > 1200000'
```

```
1207288	1207877
1210882	1246166
1251954	1252260
1274685	1275548
```

The second line is the shared backbone the ribbon draws. Past a short scrap
nothing aligns again until the fourth, so _stx2A_ and _stx2B_ fall in a stretch
with no K-12 counterpart.

## Reproduce it end to end

[`build_ecoli_pangenome_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_synteny.sh)
runs everything on this page, download and preparation included:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_synteny.sh
bash build_ecoli_pangenome_synteny.sh          # builds ./ecoli_pangenome_build/jbrowse2
npx --yes serve ecoli_pangenome_build/jbrowse2 # then open the printed URL
```

It writes a `config.json` with the five assemblies, the gene tracks, the synteny
track, and a default session opening the stacked view. It needs the tools under
[Prerequisites](#prerequisites).

For a whole-genome pangenome, swap the `add-track` step for the `make-pif` +
`AllVsAllIndexedPAFAdapter` path from
[Large files](#large-files-index-with-make-pif).

## See also

- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/user_guides/dotplot_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/allvsallpafadapter)
- [](/docs/config/allvsallindexedpafadapter)
- [](/docs/developer_guides/pif_format)
- [](/docs/jbrowse_anywidget)
- [](/docs/jbrowser)

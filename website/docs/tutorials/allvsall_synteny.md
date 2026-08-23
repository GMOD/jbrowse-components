---
title: Synteny visualization (all-vs-all minimap2)
sidebar_label: Synteny (all-vs-all minimap2)
description: Stack strains in a linear synteny view from one all-vs-all PAF
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** stack N genome rows in one linear synteny view from a single
all-vs-all PAF, using `AllVsAllPAFAdapter` (or `AllVsAllIndexedPAFAdapter` for
large files).

## Prerequisites

- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `minimap2`, `samtools`, htslib (`bgzip`, `tabix`), `unzip`
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install minimap2 samtools tabix unzip` covers most of
these. The NCBI `datasets` CLI is a single-binary download, and `node` comes
from [nodejs.org](https://nodejs.org/).

## Many genome rows from one PAF file

A linear synteny view can stack more than two genomes: N genome rows with a
synteny "ribbon" band between each adjacent pair. When the genomes are closely
related (strains or accessions of one species), the most convenient source is a
single all-vs-all PAF, with every genome aligned to every other. This tutorial
builds a five-strain _E. coli_ pangenome view from one such file.

[Synteny from ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao)
stacks cross-species comparisons from gene-level ortholog tables.

## Producing an all-vs-all PAF

An all-vs-all PAF is what the [PGGB](https://github.com/pangenome/pggb) mapping
step produces, but you can also make one yourself: concatenate
[PanSN](https://github.com/pangenome/PanSN-spec)-named genomes and self-align
them with [minimap2](https://github.com/lh3/minimap2). PanSN (Pangenome Sequence
Naming) names every sequence `sample#haplotype#contig`, e.g. `K12#1#chr`. It's
how pangenome tools tell which genome a sequence belongs to, and later on the
adapter uses that `sample` prefix to classify each PAF record.

First obtain each strain's genome FASTA. This example uses five complete NCBI
RefSeq assemblies, which the [script](#reproduce-it-end-to-end) downloads with
the NCBI `datasets` CLI, annotation included, and reduces to one `chr` record
apiece by dropping the plasmids and renaming the chromosome:

| Strain | RefSeq accession |
| ------ | ---------------- |
| K12    | GCF_000005845.2  |
| Sakai  | GCF_000008865.2  |
| CFT073 | GCF_000007445.1  |
| NCTC86 | GCF_002007705.1  |
| IAI39  | GCF_000026345.1  |

Naming every chromosome `chr` is what each strain row reads in the view, and the
annotations that come down in the same call are what
[gene tracks](#adding-gene-tracks) use further below.

Those five FASTAs become the JBrowse assemblies as-is. The PanSN names exist
only inside the PAF, so the concatenated copy for minimap2 is its own file. The
haplotype is always `1` here, since these are haploid bacterial assemblies:

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  # '>chr' -> '>K12#1#chr'
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa

minimap2 -c -x asm20 -X all.fa all.fa > all_vs_all.paf
```

`-c` emits the base-level CIGAR the linear synteny view needs.

`-X` is required: it skips each sequence's own diagonal and the reciprocal copy
of each pair, leaving every cross-strain pair once. Paralogy is untouched, which
the [one-vs-all](#one-strain-against-all-the-others) mode below reads as a
strain's own repeats (rRNA operons, IS elements).

## Setting up the five assemblies

The stacked view has one row per strain, so each strain FASTA must be a JBrowse
assembly whose name matches an entry in the track's `assemblyNames`. Compress
and index each one, then load it:

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  bgzip -f "$strain.fa"
  samtools faidx "$strain.fa.gz"   # writes the .fai and .gzi JBrowse needs
  jbrowse add-assembly "$strain.fa.gz" --name "$strain" --load copy
done
```

Each assembly's reference sequence name is the plain `chr` from its FASTA: the
adapter strips the PanSN prefix before matching, so `K12#1#chr` in the PAF
resolves to `chr` in the `K12` assembly. An assembly whose refNames still carry
the prefix draws an empty view. The
[assemblies configuration guide](/docs/config_guides/assemblies) has the
equivalent JSON.

## Loading the PAF with AllVsAllPAFAdapter

Since the file already holds every pairwise comparison, a single track can back
every band of the stacked view. List every assembly the file covers in
`assemblyNames`. The synteny view then tells the adapter which pair each band
draws, and the adapter keeps only the records whose PanSN prefixes match that
pair:

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

If a JBrowse assembly name differs from its PanSN sample prefix, map it with the
`assemblyNameToPanSN` slot (e.g. if you named the assembly `Ecoli_K12` but its
PanSN prefix is `K12`, use `{ "Ecoli_K12": "K12" }`). A name matching no sample
in the file raises an error listing the samples the file does hold, so the
mapping can be written from what the error reports.

The CLI tab on the block above adds the same track. It spells the adapter out
with `--adapterType`, because a `.paf` extension on its own is inferred as the
pairwise `PAFAdapter`, which reads only the first two assembly names. One
`--assemblyNames` fills in both the track's and the adapter's, in any order: it
is the full set of assemblies the file covers.

### Haplotype-resolved genomes

These five strains are haploid, so each PanSN prefix is a whole sample and `K12`
covers everything named `K12#1#...`. A haplotype-resolved pangenome can load
each haplotype as its own assembly and map it to a `sample#haplotype` prefix,
which turns hap1 against hap2 into a synteny band in its own right. The depth is
a per-track choice: the
[synteny track config guide](/docs/config_guides/synteny_track#pansn-depth-sample-or-haplotype)
has the mapping and what changes between them.

## Large files: index with make-pif

`AllVsAllPAFAdapter` reads the whole PAF into memory, which is fine for strains
of one species but does not scale to a whole-genome pangenome of many samples.
For those, index the file once with `jbrowse make-pif` and switch the adapter to
`AllVsAllIndexedPAFAdapter`. A tabix range query then fetches only the records
overlapping the region in view:

```bash
# produces all_vs_all.pif.gz and all_vs_all.pif.gz.tbi
jbrowse make-pif all_vs_all.paf
```

`make-pif` reads the PanSN names as it goes and finishes by printing the exact
`add-track` command for the samples it found, so you can paste it straight back:

```bash
jbrowse add-track all_vs_all.pif.gz --adapterType AllVsAllIndexedPAFAdapter \
  -a CFT073,IAI39,K12,NCTC86,Sakai --load copy
```

Everything else about the track is unchanged, only the `adapter` block differs
from the un-indexed version above:

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

`assemblyNames`, `assemblyNameToPanSN`, and stacking the rows all work as above.
The `.pif.gz` keeps its PanSN sequence names, and `make-pif` emits a coarse
zoomed-out tier by default so whole-genome views stay responsive. `--coarse`
tunes that tier and `--csi` swaps the TBI index for sequences longer than ~512
Mb. Raising `--coarse` means raising the adapter's
[`coarseBpPerPxThreshold`](/docs/config/allvsallindexedpafadapter#slot-coarsebpperpxthreshold)
with it, which keeps the coarse ribbons at the zooms where the indels they draw
straight across are too small to see.

## Stacking the genomes

With the track in your config, you can stack the five strains from the UI, or
declaratively so the view opens on load.

### From the UI

The import form is one pass, whatever the row count:

1. **Add → Linear synteny view** opens it in **Quick start**, which launches
   straight from a pre-configured synteny track.
2. Choose `ecoli_ava`. It lists all five assemblies, so each becomes a row, one
   per strain, and that one track backs every band.
3. Click **Launch**.

**Manual** mode builds the stack by hand (**Add row** per strain, the connector
button between each pair to pick its track), starting from whatever Quick start
had selected.

<Figure caption="The all-vs-all Quick start in the import form. The ecoli_ava track fills its five assemblies in as rows, and Launch opens the stack." src="/img/multiway_synteny/ecoli_import_form.png" />

### Declaratively with defaultSession

To open the stacked view automatically on load, add a top-level `defaultSession`
key to your `config.json` holding a `LinearSyntenyView` snapshot. Five rows
means four bands, so `tracks` has four entries, all served by the same track:

```json session config=https://jbrowse.org/demos/ecoli_pangenome/config.json
{
  "defaultSession": {
    "name": "E. coli 5-strain pangenome",
    "views": [
      {
        "type": "LinearSyntenyView",
        "init": {
          "views": [
            { "assembly": "K12" },
            { "assembly": "Sakai" },
            { "assembly": "CFT073" },
            { "assembly": "NCTC86" },
            { "assembly": "IAI39" }
          ],
          "tracks": [
            ["ecoli_ava"],
            ["ecoli_ava"],
            ["ecoli_ava"],
            ["ecoli_ava"]
          ],
          "minAlignmentLength": 10000,
          "collapseEmptyRows": true
        }
      }
    ]
  }
}
```

The CLI tab writes the same session into an existing `config.json`. It carries
the value of `defaultSession`, which is what `set-default-session` takes. The
URL tab opens it against the hosted copy of this dataset.

Three keys there are worth reading, and each is a one-time load setting that
goes under `init`:

- `tracks` is one entry per band: `tracks[0]` connects rows 0-1, `tracks[1]`
  rows 1-2, and so on to `tracks[3]` for rows 3-4, all served by `ecoli_ava`.
- `minAlignmentLength` hides minimap2's many short alignments, leaving the
  shared backbone. Tune it to taste.
- `collapseEmptyRows` gives a ribbon-only row a bare scalebar, which is every
  row here, since none of the five carries a track of its own.

See the
[ortholog-tables tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao)
for a fuller walk-through of the `defaultSession` structure.

The row order here is a free choice: an all-vs-all file is a complete graph, so
every adjacent pair is a direct alignment.

<Figure caption="Five E. coli strains stacked from one minimap2 all-vs-all PAF, short alignments hidden with minAlignmentLength. The continuous ribbons are the backbone shared by all five; the bottom band crosses because IAI39 is inverted against the others." src="/img/multiway_synteny/ecoli_pangenome.png" />

The gaps in those ribbons are where the strains differ. Sakai's largest carry
its prophage Shiga-toxin genes, and CFT073's are its own pathogenicity islands.

## Adding gene tracks

A gap says the strains differ without saying what by, and the annotations
downloaded alongside each genome answer that. Each GFF needs the same two
adjustments the FASTA got, both done by the [script](#reproduce-it-end-to-end):
its seqid becomes `chr` to match the assembly, and its plasmid features are
dropped, since the assembly kept only the chromosome.

<!-- from: scripts/build_ecoli_pangenome_synteny.sh -->

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  jbrowse sort-gff "$strain.gff" | bgzip > "$strain.gff.gz"
  tabix "$strain.gff.gz"
  jbrowse add-track "$strain.gff.gz" -a "$strain" --name "$strain genes" --load copy
done
```

`-a "$strain"` is what matters here: each track is added to one strain's
assembly, so it rides along with that strain's row in the stacked view.

With genes loaded the gaps become readable. Navigate Sakai's row to
`chr:1,267,000-1,268,400` and the gap holds _stx2A_ and _stx2B_, the Shiga-toxin
subunits, in a region with no alignment to K-12.

<Figure caption="K-12 (top) and Sakai (bottom) with their gene tracks, framing the Sp5 prophage. The synteny ribbon runs out at the shared-backbone boundary, and everything right of it, stx2B included, has no counterpart in K-12." src="/img/multiway_synteny/ecoli_stx_island.png" />

## One strain against all the others

The same track also works in a plain linear genome view. With no second row and
so no target assembly, it draws the strain you are looking at against every
other sample in the file at once.

A mate the track does not list still draws, labelled by its bare PanSN prefix,
so a plain view of K12 shows all four other strains without loading them as
assemblies. A strain's own paralogy draws as well. Clicking a feature offers to
launch a synteny view against its mate, for the mates the track lists, since
that view needs a real assembly to open a row for.

Every alignment lands in one pileup, so nothing says which strain a block came
from. Three items on the track menu sort that out:

1. **Group by... → Mate assembly** gives one labelled lane per sample. A lane is
   a single row, shading darker where several alignments cover the same base.
   Untick **Show... → Collapse groups to one row** to stack every lane instead,
   or expand one from its label.
2. **Group by... → Hide self-alignment lane** drops the lane for the strain you
   are viewing. It is this run's built-in control: `minimap2 -X` skipped each
   genome's own diagonal, so a K-12 lane filling with K-12 says the PAF was
   built wrong. The figures below have it ticked.
3. **Show... → Show coverage** adds a histogram of how many other strains cover
   each base. A synteny track in a plain view renders through the same display
   as a read pileup, so the rest of that menu is the one you already know from
   alignments.

The figure below carries a second pane, the same window in the pangenome graph
of these strains, which [the next section](#the-same-gap-drawn-as-a-graph) picks
up. The shaded band is K-12's phenylacetate (paa) operon: Sakai, CFT073 and
IAI39 all stop at its left edge where NCTC86 runs through.

<Figure caption="Above, one track with one lane per strain: K-12 against every other sample in the file, grouped by mate assembly. Below, the same window as a graph, where the short arm beside the ringed node is the detour the other three take." src="/img/multiway_synteny/ecoli_one_vs_all.png" />

The same mode zoomed out to the whole chromosome gives a per-strain overview. A
synteny view's rows are ordinary linear genome views, so the lanes can sit on
the K-12 row of the stack above and both readings of the same PAF share one
axis. At this size the whole PAF is in memory on every pan; for a real
pangenome, index it first with [make-pif](#large-files-index-with-make-pif):

<Figure caption="The one-vs-all lanes on the K-12 row of the five-strain stack, both drawn from the same PAF and colored by strand. White gaps are where a strain breaks from the K-12 backbone. IAI39 sits directly below K-12, so its blue stretches and the blue crossings under them are the same inversions." src="/img/multiway_synteny/ecoli_one_vs_all_whole_genome.png" />

### The gap in the graph genome view {#the-same-gap-drawn-as-a-graph}

Sequence absent from the alignment is absent from the PAF, so what the strains
that stop there carry is in the graph: the island is a segment, and each
strain's walk either goes through that segment or takes a detour around it.

The E. coli tutorials build that minigraph graph of the same five strains, and
the [graph genome view](/docs/user_guides/graph_genome_view) plugin opens a
window of it beside the alignment. The ringed segment, `s502`, is a block in
K-12's segments lane and the long node carrying the island.

The lower band is blank across the island, which is a substitution: Sakai's
alignment to K-12 stops before the island and resumes past it, and its own
window over the same flanks comes out longer. Each strain carries an island of
its own there, the phenylacetate operon and a prophage on K-12, a set of nleG
effector genes on Sakai.

<Figure caption="Above, the phenylacetate operon window with NCTC86 over K12 and Sakai under it. Each strain's own island is shaded in its own row and the band between them is blank across both, which is what a substitution looks like from either side. Below, the same window as a graph on the same reference-position ramp, the two rings marking one segment in both." src="/img/pangenome/rgfa_paa_bubble.png" />

### Launching a stacked view at one locus

The lanes say where a strain breaks from the backbone. The stacked view says
what the break looks like on both sides of it. To go from one to the other,
drag-select a region and pick **Launch → Linear synteny view**: with the
all-vs-all track as the dialog's dataset, JBrowse reads that region back out of
the same PAF. It finds every assembly aligning to it, and opens a row for each
with a ribbon band in between. Selecting the paa operon window above gives the
five-strain stack for that locus alone.

The dialog lists the assemblies it found plus the one you selected in, top to
bottom, and lets you reorder them before launching. Ribbons are drawn between
neighbouring rows only, so the order determines which comparisons the view can
show. That is why IAI39 sits directly below K-12 in the figure above.

Clicking a single alignment instead of selecting a region still offers **Launch
synteny view for this position**, which opens the one pair that alignment
describes.

A launched view is a few kilobases wide, which is where the alignment's own
CIGAR starts to matter. `minimap2 -c` wrote one for every record in this PAF, so
each insertion and deletion is drawn where it falls; the palette button's **Show
color legend** names the colors, and **CIGAR indels** in the settings menu
switches between colored indels, transparent ones, and none.

<Figure caption="Rubberband-select a window of the shared backbone, then Launch → Linear synteny view." src="/img/multiway_synteny/ecoli_launch_from_selection.png" links="Selection=multiway_synteny/ecoli_launch_selection,Dialog=multiway_synteny/ecoli_launch_dialog,Result=multiway_synteny/ecoli_launch_result" />

<Video src="/media/synteny/allvsall_launch_from_selection.mp4" caption="From the lanes to the stack for one locus: a scale-bar selection raises Launch, the dialog lists a panel per strain that aligns to the window, and its arrows move IAI39 up under K-12 before the launch replaces the lane view with the stack." />

## Checking a gap against the PAF

Every coordinate above is read off `all_vs_all.paf`, so the file can be asked
directly. Print the Sakai side of every Sakai/K-12 alignment near the stx2
island, taking the coordinates from whichever column Sakai landed in, since `-X`
emits each pair once and in either direction:

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

The block on the second line is the shared backbone the ribbon in the figure
draws, and it ends at 1,246,166. Past a short scrap nothing aligns again until
1,274,685, so _stx2A_ and _stx2B_ fall in a stretch of Sakai with no K-12
counterpart.

## Reproduce it end to end

One script runs everything on this page, including the download and preparation
steps described above but not pasted,
[`build_ecoli_pangenome_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_synteny.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_synteny.sh
bash build_ecoli_pangenome_synteny.sh          # builds ./ecoli_pangenome_build/jbrowse2
npx --yes serve ecoli_pangenome_build/jbrowse2 # then open the printed URL
```

It downloads the five RefSeq genomes, self-aligns them into the all-vs-all PAF,
downloads JBrowse, and writes a `config.json` with the five assemblies, the
per-strain gene tracks, the all-vs-all synteny track, and a default session that
opens on the stacked view. It needs everything under
[Prerequisites](#prerequisites) on your `PATH`.

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

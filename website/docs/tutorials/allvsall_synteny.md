---
title: Synteny all-vs-all
description:
  Stack strains or accessions in a linear synteny view from a single all-vs-all
  PAF
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

A linear synteny view can stack more than two genomes: N genome rows with a
synteny "ribbon" band between each adjacent pair. When the genomes are closely
related (strains or accessions of one species), the most convenient source is a
single **all-vs-all** PAF, with every genome aligned to every other. This
tutorial builds a four-strain _E. coli_ pangenome view from one such file.

Every figure below links to the live session that produced it. Open the finished
stacked view from its caption to explore it yourself.

For cross-species comparisons built from gene-level ortholog tables instead, see
[Synteny from ortholog tables](/docs/tutorials/multiway_synteny).

## Producing an all-vs-all PAF

An all-vs-all PAF is what the [PGGB](https://github.com/pangenome/pggb) mapping
step produces, and you can make one directly by concatenating
[PanSN](https://github.com/pangenome/PanSN-spec)-named genomes and self-aligning
with [minimap2](https://github.com/lh3/minimap2). **PanSN** (Pangenome Sequence
Naming) names every sequence `sample#haplotype#contig`, e.g.
`K12#1#NC_000913.3`; it is how pangenome tools tell which genome a sequence
belongs to, and the adapter later classifies each PAF record by its `sample`
prefix.

First obtain each strain's genome FASTA. This example uses four complete NCBI
RefSeq assemblies, fetched with the NCBI
[`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
CLI (a `strain accession` table keeps the short names we use throughout):

```bash
while read -r strain acc; do
  datasets download genome accession "$acc" --include genome --filename "$strain.zip"
  unzip -o "$strain.zip" -d "$strain"
  cat "$strain"/ncbi_dataset/data/*/*.fna > "$strain.raw.fa"
done <<'EOF'
K12     GCF_000005845.2
Sakai   GCF_000008865.2
CFT073  GCF_000007445.1
NCTC86  GCF_003697165.2
EOF
```

(`GCF_000005845.2` is K-12 MG1655, `GCF_000008865.2` is O157:H7 Sakai,
`GCF_000007445.1` is the uropathogenic CFT073, and `GCF_003697165.2` is the _E.
coli_ type strain NCTC 86 / ATCC 11775.) Downloaded genomes have ordinary
headers (`>NC_000913.3 …`), so first rewrite each to PanSN (the haplotype is
always `1` since these are haploid bacterial assemblies), then concatenate and
self-align:

```bash
for strain in K12 Sakai CFT073 NCTC86; do
  # '>NC_000913.3 Escherichia…' -> '>K12#1#NC_000913.3'
  awk -v s="$strain" '/^>/{sub(/^>/, ">" s "#1#"); print $1; next} {print}' \
    "$strain.raw.fa" > "$strain.fa"
done

cat K12.fa Sakai.fa CFT073.fa NCTC86.fa > all.fa
minimap2 -c -x asm20 -X all.fa all.fa > all_vs_all.paf
```

`-c` emits the base-level CIGAR the linear synteny view needs, `-X` skips self-
and dual-mappings (a sequence against itself, and the redundant reverse of each
pair, since the adapter draws both directions from one record), and the PanSN
prefixes let the adapter tell which record belongs to which pair.

## Set up the four assemblies

The stacked view has one row per strain, so each strain FASTA must be a JBrowse
assembly whose name matches an entry in the track's `assemblyNames`. Load each
one with the CLI:

```bash
for strain in K12 Sakai CFT073 NCTC86; do
  jbrowse add-assembly $strain.fa --name $strain --load copy
done
```

Each assembly's reference sequence names are the PanSN headers from its FASTA
(`K12#1#NC_000913.3`, …), which is what the synteny rows and the adapter's PanSN
classification both use. See the
[assemblies configuration guide](/docs/config_guides/assemblies) for the
equivalent JSON and indexing options.

## Loading it with AllVsAllPAFAdapter

Because the file already contains every pairwise comparison,
`AllVsAllPAFAdapter` lets **one track back every band** of the stacked view,
with no per-pair alignment step and no duplicate tracks. List every assembly the
file covers in `assemblyNames`. The synteny view tells the adapter which pair
each band draws, and the adapter keeps only those records (classified by PanSN
prefix):

```json
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli pangenome (all-vs-all PAF)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"],
  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "pafLocation": { "uri": "all_vs_all.paf" },
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
  }
}
```

If a JBrowse assembly name differs from its PanSN sample prefix, map it with the
`assemblyNameToPanSN` slot (e.g. if you named the assembly `Ecoli_K12` but its
PanSN prefix is `K12`, use `{ "Ecoli_K12": "K12" }`).

To add the track from the command line instead of editing the config by hand,
pass `--adapterType` explicitly, since the `.paf` extension alone would
otherwise be read as a pairwise `PAFAdapter`:

```bash
jbrowse add-track all_vs_all.paf --adapterType AllVsAllPAFAdapter \
  -a K12,Sakai,CFT073,NCTC86 --load copy
```

Both the track and the adapter get the four `assemblyNames`; edit the adapter
afterward to add `assemblyNameToPanSN` if your assembly names differ from the
PanSN prefixes.

## Large files: index with make-pif

`AllVsAllPAFAdapter` reads the whole PAF into memory, which is fine for strains
of one species but does not scale to a whole-genome pangenome of many samples.
For those, index the file once with `jbrowse make-pif` and switch the adapter to
`AllVsAllIndexedPAFAdapter`. A tabix range query then fetches only the records
overlapping the region in view instead of loading the entire file:

```bash
# produces all_vs_all.pif.gz and all_vs_all.pif.gz.tbi
jbrowse make-pif all_vs_all.paf
```

```json
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli pangenome (indexed all-vs-all PIF)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "pifGzLocation": { "uri": "all_vs_all.pif.gz" },
    "index": { "location": { "uri": "all_vs_all.pif.gz.tbi" } },
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
  }
}
```

Everything else (`assemblyNames`, `assemblyNameToPanSN`, stacking the rows) is
identical to the un-indexed adapter above. Only the `adapter` block differs. The
`.pif.gz` keeps its PanSN sequence names, and `make-pif` also emits a coarse
zoomed-out tier so whole-genome views stay responsive.

The CLI adds this one too, and the `.pif.gz` index is picked up automatically:

```bash
jbrowse add-track all_vs_all.pif.gz --adapterType AllVsAllIndexedPAFAdapter \
  -a K12,Sakai,CFT073,NCTC86 --load copy
```

## Stacking the genomes

With the track in your config, there are two ways to open the four strains as a
stacked synteny view: interactively from the UI, or declaratively so it opens on
load.

### From the UI

Open a linear synteny view (**Add → Linear synteny view**) to reach the import
form. Because `ecoli_ava` lists all four assemblies, you don't have to build the
rows by hand: open **Quick start from a synteny track** and choose it. Every
assembly in the track's `assemblyNames` becomes a row (one per strain), and that
single track is wired to back every adjacent band. Click **Launch** to open the
stacked view.

You can still build the stack manually (**Add row** adds a strain, and the
connector button between each pair picks its synteny track), but for an
all-vs-all track Quick start does it in one step.

<Figure caption="Stacking all four strains from the UI with the all-vs-all quick start. (1) Open 'Quick start from a synteny track' and pick the ecoli_ava track. (2) Every assembly it lists becomes a row, and the one track backs every band. (3) Launch the stacked view." src="/img/multiway_synteny/ecoli_import_form.png" />

### Declaratively with defaultSession

To open the stacked view automatically on load, add a top-level `defaultSession`
key to your `config.json` holding a `LinearSyntenyView` snapshot. Four rows
means three bands, so `tracks` has three entries, all served by the same track:

```json
{
  "defaultSession": {
    "name": "E. coli 4-strain pangenome",
    "views": [
      {
        "type": "LinearSyntenyView",
        "init": {
          "views": [
            { "assembly": "K12" },
            { "assembly": "Sakai" },
            { "assembly": "CFT073" },
            { "assembly": "NCTC86" }
          ],
          "tracks": [["ecoli_ava"], ["ecoli_ava"], ["ecoli_ava"]],
          "drawCurves": true,
          "minAlignmentLength": 10000
        }
      }
    ]
  }
}
```

`tracks` is one entry per band: `tracks[0]` connects rows 0–1, `tracks[1]` rows
1–2, and `tracks[2]` rows 2–3, all served by the same `ecoli_ava` track, which
lists every assembly in `assemblyNames` so it can back any pair.
`minAlignmentLength` hides the short minimap2 alignments so the shared backbone
reads as clean ribbons instead of a dense noise band. Raise or lower it as
needed. The one-time load settings (row order, tracks, `drawCurves`,
`minAlignmentLength`) go under `init`. See the
[ortholog-tables tutorial](/docs/tutorials/multiway_synteny) for a fuller
walk-through of the `defaultSession` structure.

<Figure caption="Four E. coli strains (K-12, Sakai, CFT073, NCTC86) stacked from one minimap2 all-vs-all PAF (short alignments hidden with minAlignmentLength). The continuous ribbons are the ~4 Mb backbone shared by all four strains; the gaps are strain-specific islands." src="/img/multiway_synteny/ecoli_pangenome.png" />

Unlike a reference-anchored `.blocks` table, an all-vs-all file is a **complete
graph**: every adjacent band is a real, direct alignment, so you can stack the
genomes in any order without worrying about transitive links. This makes it the
most convenient source when you have it.

## Backbone and islands

The four strains share a ~4 Mb collinear **backbone** (the continuous ribbons),
and each carries its own **islands** in the gaps, such as the Sakai prophage
S-loops carrying the Shiga-toxin genes
([Hayashi et al. 2001](https://academic.oup.com/dnaresearch/article/8/1/11/466363))
and CFT073's pathogenicity islands
([Welch et al. 2002](https://www.pnas.org/doi/10.1073/pnas.252529799)).

## See also

- [Synteny from ortholog tables](/docs/tutorials/multiway_synteny) - the
  cross-species, gene-based `.blocks` workflow
- [Synteny visualization](/docs/tutorials/synteny_visualization) - pairwise
  dotplot and linear synteny basics
- [AllVsAllPAFAdapter config](/docs/config/allvsallpafadapter) - full schema for
  the un-indexed adapter used above
- [AllVsAllIndexedPAFAdapter config](/docs/config/allvsallindexedpafadapter) -
  the tabix-backed adapter for whole-genome pangenomes
- [LGVSyntenyDisplay config](/docs/config/lgvsyntenydisplay) - the display that
  draws the one-vs-all view in a plain linear genome view
- [PIF format](/docs/developer_guides/pif_format) - the indexed alignment format
  `make-pif` produces
- [Multi-way synteny in an embedded app](https://jbrowse.org/storybook/app/multiway-synteny-example/)
  - this same four-strain all-vs-all view running live in `@jbrowse/react-app2`

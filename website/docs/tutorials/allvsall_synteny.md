---
title: Synteny all-vs-all
description:
  Stack strains or accessions in a linear synteny view from a single all-vs-all PAF
guide_category: Tutorials
---

A linear synteny view can stack more than two genomes: N genome rows with a
synteny "ribbon" band between each adjacent pair. When the genomes are closely
related — strains or accessions of one species — the most convenient source is a
single **all-vs-all** PAF, with every genome aligned to every other. This
tutorial builds a four-strain _E. coli_ pangenome view from one such file.

Open the finished demo:
[E. coli 4-strain pangenome](https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/ecoli_pangenome/config.json).

For cross-species comparisons built from gene-level ortholog tables instead, see
[Synteny from ortholog tables](/docs/tutorials/multiway_synteny).

## Producing an all-vs-all PAF

An all-vs-all PAF is what the [PGGB](https://github.com/pangenome/pggb) mapping
step produces, and you can make one directly by concatenating
[PanSN](https://github.com/pangenome/PanSN-spec)-named genomes and self-aligning
with [minimap2](https://github.com/lh3/minimap2):

```bash
# PanSN names each sequence sample#haplotype#contig, e.g. K12#1#chr
cat K12.fa Sakai.fa CFT073.fa NCTC86.fa > all.fa
minimap2 -c -x asm20 -X all.fa all.fa > all_vs_all.paf
```

`-c` emits the base-level CIGAR the linear synteny view needs, `-X` skips a
genome's self-hits, and the PanSN prefixes let the adapter tell which record
belongs to which pair.

## Loading it with AllVsAllPAFAdapter

Because the file already contains every pairwise comparison,
`AllVsAllPAFAdapter` lets **one track back every band** of the stacked view — no
per-pair alignment step and no duplicate tracks. List every assembly the file
covers in `assemblyNames`; the synteny view tells the adapter which pair each
band draws, and the adapter keeps only those records (classified by PanSN
prefix):

```json
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli pangenome (all-vs-all PAF)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"],
  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "pafLocation": { "uri": "all_vs_all.paf.gz" },
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
  }
}
```

If a JBrowse assembly name differs from its PanSN sample prefix, map it with the
`assemblyNameToPanSN` slot (e.g. `{ "grape": "Vitis_vinifera" }`).

## Stacking the genomes

With the track in your config, there are two ways to open the four strains as a
stacked synteny view: interactively from the UI, or declaratively so it opens on
load.

### From the UI

From the JBrowse start screen, click **Linear synteny view**. The import form
starts with two rows; click **Add row** until you have one row per strain and set
each row's assembly. Between each adjacent pair, click the connector button and
choose the `ecoli_ava` track — the same track configures every pair, since it
lists all four assemblies in `assemblyNames`. Click **Launch** to open the view,
then pick **Re-order chromosomes** from the view menu to line the ribbons up
along the diagonal.

<Figure caption="The linear synteny import form. It opens with two rows; Add row adds one per strain, and each row's assembly comes from its dropdown. The connector button between a pair selects which pair the right-hand panel configures — here the single E. coli pangenome (all-vs-all PAF) track backs every pair, since it lists all four assemblies. Launch opens the stacked view." src="/img/multiway_synteny/ecoli_import_form.png" link="https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/ecoli_pangenome/config.json" />

### Declaratively with defaultSession

To open the stacked view automatically on load, put a `LinearSyntenyView`
snapshot in the config's `defaultSession`. Four rows means three bands, so
`tracks` has three entries — all served by the same track:

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
          "autoDiagonalize": true
        }
      }
    ]
  }
}
```

`tracks` is one entry per band: `tracks[0]` connects rows 0–1, `tracks[1]` rows
1–2, and `tracks[2]` rows 2–3 — all the same `ecoli_ava` track, which lists
every assembly in `assemblyNames` so it can back any pair. `autoDiagonalize`
reorders and flips each row's chromosomes on load so the ribbons run along the
diagonal instead of crossing into a hairball. The one-time load settings (row
order, tracks, `drawCurves`, `autoDiagonalize`) go under `init`; see the
[ortholog-tables tutorial](/docs/tutorials/multiway_synteny) for a fuller
walk-through of the `defaultSession` structure.

<Figure caption="Four E. coli strains (K-12, Sakai, CFT073, NCTC86) stacked from a single minimap2 all-vs-all PAF. Every adjacent band is a direct alignment because an all-vs-all file is a complete graph; the ribbons trace the shared chromosomal backbone with strain-specific rearrangements." src="/img/multiway_synteny/ecoli_pangenome.png" link="https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/ecoli_pangenome/config.json" />

Unlike a reference-anchored `.blocks` table, an all-vs-all file is a **complete
graph** — every adjacent band is a real, direct alignment, so you can stack the
genomes in any order without worrying about transitive links. This makes it the
most convenient source when you have it.

## See also

- [Synteny from ortholog tables](/docs/tutorials/multiway_synteny) — the
  cross-species, gene-based `.blocks` workflow.
- [Synteny visualization](/docs/tutorials/synteny_visualization) — pairwise
  dotplot and linear synteny basics.
- [AllVsAllPAFAdapter config](/docs/config/allvsallpafadapter)

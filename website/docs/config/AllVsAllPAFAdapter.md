---
id: allvsallpafadapter
title: AllVsAllPAFAdapter
sidebar_label: Adapter -> AllVsAllPAFAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `comparative-adapters` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/AllVsAllPAFAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach', 'cacao'],
  adapter: {
    type: 'AllVsAllPAFAdapter',
    uri: 'all_vs_all.paf.gz',
    assemblyNames: ['grape', 'peach', 'cacao'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Loads a single "all-vs-all" PAF (e.g. `minimap2 all.fa all.fa`, or the PGGB
mapping step) where every sequence name is PanSN-prefixed with its assembly
(`sample#haplotype#contig`). Because such a file contains every pairwise
alignment, one file (and one track) backs every synteny band of a multi-way
view: the synteny view tells the adapter which pair a given band draws, and
the adapter keeps only those records, stripping the PanSN prefix to recover
each assembly's own refName. In a plain LGV (LGVSyntenyDisplay) there is no
band to isolate, so the track draws its assembly against every OTHER sample
in the file — "one vs all" — including samples not listed in `assemblyNames`
(those mates are labelled by their PanSN prefix). `assemblyNames` therefore
only needs to list the assemblies you actually load into JBrowse and want the
track to appear on.

A reference-anchored alignment is not this — HPRC publishes 465 haplotypes
against GRCh38 alongside its complete all-vs-all — and read as all-vs-all it
draws an empty band for every pair not involving that reference. Order the
synteny rows so the reference sits between the others, use a complete
all-vs-all if the project publishes one, or view a larger cohort as a multiple
alignment (MAF) rather than a stack of pairwise bands.

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
- **Display:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "AllVsAllPAFAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | The assemblies this track appears on and can back synteny bands for — list the assemblies you load into JBrowse. Each entry must resolve to a PanSN sample (`grape`) or haplotype (`grape#1`) prefix present in the file. In a plain LGV the track still draws its assembly against every other sample in the file, so mates need not be listed here (unlisted mates are labelled by their PanSN prefix). |
| <span id="slot-paflocation">**pafLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.paf', locationType: 'UriLocation' }</code> | can be optionally gzipped |
| <span id="slot-assemblynametopansn">**assemblyNameToPanSN**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | Maps a JBrowse assembly name to its PanSN prefix in the PAF, for when they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need `{ grape: 'Vitis_vinifera' }`). The prefix may name a sample (`grape`, matching all of its haplotypes) or one haplotype (`grape#1`), so a haplotype-resolved pangenome that loads each haplotype as its own assembly maps `{ grape_hap1: 'grape#1', grape_hap2: 'grape#2' }`. Defaults to identity: the assembly name is assumed to be the PanSN sample name. |

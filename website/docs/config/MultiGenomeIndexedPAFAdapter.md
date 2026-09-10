---
id: multigenomeindexedpafadapter
title: MultiGenomeIndexedPAFAdapter
sidebar_label: Adapter -> MultiGenomeIndexedPAFAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `comparative-adapters` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MultiGenomeIndexedPAFAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach', 'cacao'],
  adapter: {
    type: 'MultiGenomeIndexedPAFAdapter',
    uri: 'all_vs_all.pif.gz',
    assemblyNames: ['grape', 'peach', 'cacao'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

The tabix-indexed (PIF) form of the `MultiGenomePAFAdapter`. Run
`jbrowse make-pif all_vs_all.paf` on a multi-genome PAF whose sequence names
are PanSN-prefixed (`sample#haplotype#contig`) and point this adapter at the
resulting `.pif.gz`. Because PIF double-emits each record keyed on both of its
PanSN sequence names, a region query resolves to a tabix range lookup on the
anchor's PanSN seqid(s) instead of scanning the whole file — so it scales to
whole-genome pangenome alignments that do not fit in memory. Semantics match
`MultiGenomePAFAdapter`: the file may state any set of pairs (a complete
all-vs-all or a star against one reference), one-vs-all in a plain LGV,
single-pair when the synteny view supplies a `targetAssemblyName`.

Registered before 2026-09 as `AllVsAllIndexedPAFAdapter`, which a config may
still say.

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [ChordSyntenyDisplay](../chordsyntenydisplay)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
- **Display:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "MultiGenomeIndexedPAFAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `csi` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | The assemblies this track appears on and can back synteny bands for — list the assemblies you load into JBrowse. Each entry must resolve to a PanSN sample (`grape`) or haplotype (`grape#1`) prefix present in the file. In a plain LGV the track still draws its assembly against every other sample in the file, so mates need not be listed here (unlisted mates are labelled by their PanSN prefix). |
| <span id="slot-pifgzlocation">**pifGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/all_vs_all.pif.gz', locationType: 'UriLocation…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/all_vs_all.pif.gz', locationType: 'UriLocation' }</code></pre></dialog></span> | location of the multi-genome tabix indexed PAF (pif) |
| <span id="slot-assemblynametopansn">**assemblyNameToPanSN**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | Maps a JBrowse assembly name to its PanSN prefix in the PAF, for when they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need `{ grape: 'Vitis_vinifera' }`). The prefix may name a sample (`grape`, matching all of its haplotypes) or one haplotype (`grape#1`), so a haplotype-resolved pangenome that loads each haplotype as its own assembly maps `{ grape_hap1: 'grape#1', grape_hap2: 'grape#2' }`. Defaults to identity: the assembly name is assumed to be the PanSN sample name. |
| <span id="slot-coarsebpperpxthreshold">**coarseBpPerPxThreshold**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10000</code> | bpPerPx threshold at which a view on "Level of detail: automatic" switches from the per-row CIGAR tier (lowercase t/q prefix) to the coarse tier (uppercase T/Q prefix), whose CIGAR is folded to its large indels. The file has the last word: one with no coarse tier (make-pif --no-coarse) serves the fine tier at every zoom, and a threshold below the `--coarse` bound its `#pif` header states is raised to that bound, since below it the coarse tier is served at zooms where the indels it folded away are wide enough to see.<br>_advanced_ |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | `TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gz.tbi', locationType: 'UriLocation' }</code> | location of the tabix index. Only needed when it is not named `<file>.tbi`, which is what the `uri` shorthand assumes — a `.csi` beside the file is reached with `csi: true` rather than by spelling this out. |

---
id: mcscansimpleanchorsadapter
title: MCScanSimpleAnchorsAdapter
sidebar_label: Adapter -> MCScanSimpleAnchorsAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `comparative-adapters` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanSimpleAnchorsAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'MCScanSimpleAnchorsAdapter',
    uri: 'https://example.com/data.anchors.simple',
    bed1: 'https://example.com/query.bed',
    bed2: 'https://example.com/target.bed',
    assemblyNames: ['hg19', 'hg38'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

:::caution Gotcha

A block row names four genes, the first and last on each side, and all four are placed by matching column 4 of a BED byte for byte. A row with any of the four missing is dropped, so a partial mismatch draws fewer blocks than the file holds rather than erroring, and only a file where no row resolves fails the track. Ids get mangled by isoform suffixes and by jcvi stripping suffixes unless run with `--no_strip_names`. BED column 1 has to match the assembly's reference sequence names too, and a name the assembly does not have draws nothing at all.

:::

used to load MCScan (jcvi) `.anchors.simple` files with their two BED files

See the [MCScan anchors tutorial](/docs/tutorials/mcscan_synteny_grape_peach), which
also covers converting an MCScanX run into these files.

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
- **Display:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "MCScanSimpleAnchorsAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `bed1`, `bed2`, `chromSizes`, `csi`, `htsgetBase`, `nhUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-mcscansimpleanchorslocation">**mcscanSimpleAnchorsLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/mcscan.anchors.simple', locationType: 'UriLoca…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/mcscan.anchors.simple', locationType: 'UriLocation' }</code></pre></dialog></span> | location of the `.anchors.simple` file from `python -m jcvi.compara.synteny screen --simple`: one line per synteny block, giving only the first and last gene of the block in each genome. That draws whole blocks rather than the per-gene links a full `.anchors` file gives. |
| <span id="slot-bed1location">**bed1Location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.bed', locationType: 'UriLocation' }</code> | BED giving coordinates for the query assembly's gene names — the first two columns of each block line. Written by `python -m jcvi.formats.gff bed`. |
| <span id="slot-bed2location">**bed2Location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.bed', locationType: 'UriLocation' }</code> | BED giving coordinates for the target assembly's gene names — the third and fourth columns of each block line. |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | `[query, target]` — the assembly `bed1Location` describes, then the one `bed2Location` describes. Getting the order backwards draws every block against the wrong genome rather than erroring. |

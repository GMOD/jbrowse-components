---
id: bedgraphtabixadapter
title: BedGraphTabixAdapter
sidebar_label: Adapter -> BedGraphTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphTabixAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphTabixAdapter',
    uri: 'https://example.com/signal.bedGraph.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load bgzip-compressed, tabix-indexed bedGraph signal files

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "BedGraphTabixAdapter", ... }`. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bedgraphgzlocation">**bedGraphGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bedgraph', locationType: 'UriLocation' }</code> |  |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> |  |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/my.bedgraph.gz.tbi', locationType: 'UriLocatio…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/my.bedgraph.gz.tbi', locationType: 'UriLocation' }</code></pre></dialog></span> |  |
| <span id="slot-columnnames">**columnNames**</span><br>`stringArray` = <code>[]</code> | List of column names |

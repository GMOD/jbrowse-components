---
id: linearmultirowfeaturedisplay
title: LinearMultiRowFeatureDisplay
description: "Paints interval features as colored blocks on stacked rows partitioned by a feature attribute (\"chromosome / ancestry painting\")."
sidebar_label: Display -> LinearMultiRowFeatureDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/configSchema.ts).

Paints interval features as colored blocks on stacked rows partitioned by a
feature attribute ("chromosome / ancestry painting").

## Example usage

A custom BED with a column naming each row, its columns named by a
`#`-prefixed header line (tab-separated, shown space-aligned):

```text
#chrom  start    end      name  sample
chr1    0        2000000  seg1  HG00096
chr1    2000000  5500000  seg2  HG00096
chr1    0        3500000  seg3  HG00097
```

Paint one row per `sample`, coloring each row from `rowColor` and fixing
HG00097 above HG00096 regardless of file order:

```js
{
  type: 'FeatureTrack',
  trackId: 'ancestry_painting',
  name: 'Ancestry painting',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: 'https://example.com/painting.bed.gz',
  },
  displays: [
    {
      type: 'LinearMultiRowFeatureDisplay',
      displayId: 'ancestry_painting-LinearMultiRowFeatureDisplay',
      rows: { field: 'sample', sort: ['HG00097', 'HG00096'] },
      rowColor: {
        scale: {
          domain: ['HG00096', 'HG00097'],
          range: ['#4e79a7', '#f28e2b'],
        },
      },
    },
  ],
}
```

Omit `rowColor` entirely and the blocks paint in the default block color.
A row `rowColor` does not name paints the same way, unless `scale.unknown`
gives unnamed rows a color. A feature's `itemRgb` colors it with no
configuration at all, and `encoding.color.scale.type: 'identity'` names it
in the key. To color per feature off some other attribute, set
`encoding.color.value` to a `jexl:` expression reading it.
Omit `rows.sort` and the rows sort by value.

## Related links

- **Adapter:** [BedAdapter](../bedadapter)
- **Adapter:** [BedTabixAdapter](../bedtabixadapter)
- **Adapter:** [BigBedAdapter](../bigbedadapter)
- **Adapter:** [CrisprGuideAdapter](../crisprguideadapter)
- **Adapter:** [FromConfigAdapter](../fromconfigadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)
- **Adapter:** [NCListAdapter](../nclistadapter)
- **Adapter:** [SequenceSearchAdapter](../sequencesearchadapter)
- **Adapter:** [SPARQLAdapter](../sparqladapter)
- **State model:** [runtime API](../../models/linearmultirowfeaturedisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearMultiRowFeatureDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-rows">**rows**</span><br>[Rows](../rows) | One row per value of a feature attribute, and the arrangement a reader gives the rows. `field` names the attribute, or a `jexl:` expression derives one; empty, the default, picks one off the data (`repClass` where the features have it, else `name`). `sort` is the row order: the values it lists lead, and the rest sort, digits by magnitude, with the row of features with no value last. `labels`, `tree`, `treeProvenance` and `kept` are what the arrangement dialog, a clustering run and a focus write, each as a session edit to this object.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rows: 'sample' }</code></pre><pre><code>{ rows: { field: 'sample', sort: ['HG00097', 'HG00096'] } }</code></pre><pre><code>{ rows: "jexl:split(split(feature.name,'#')[1],'/')[0]" }</code></pre></dialog></span> |
| <span id="slot-clusterfield">**clusterField**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'auto'</code> | Feature attribute whose value each row is clustered on, and which "Sort rows by ... here" orders by at a column; `auto` (the default) takes the attribute `encoding.color` reads, else `name`, and an empty string compares presence alone — which bins each row covers. A `jexl:` expression derives the value.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ clusterField: 'state' }</code></pre></dialog></span> |
| <span id="slot-encoding">**encoding**</span><br>[FeatureEncoding](../featureencoding) | The blocks' channels: `encoding.color`, each block's fill, the FeatureColor channel: a CSS color or `jexl:` callback in `value`, or a field whose values each take a color through `scale`, with a key. Unset, a feature's itemRgb paints it if it has one, else `rowColor` paints its row's blocks, else the default block color does. `scale.type: 'identity'` keeps each feature's color and names the `scale.domain` colors in the key, which is how a file's itemRgb states get their names.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;encoding: {&#10;&#160;&#160;&#160;&#160;color: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;field: 'segmean',&#10;&#160;&#160;&#160;&#160;&#160;&#160;scale: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;type: 'threshold',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;domain: [-1, -0.3, 0.3, 1],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;range: ['#2166ac', '#92c5de', '#f7f7f7', '#f4a582', '#b2182b'],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;names: ['Deep loss', 'Loss', 'Balanced', 'Gain', 'Amplification'],&#10;&#160;&#160;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;},&#10;}</code></pre><pre><code>{&#10;&#160;&#160;encoding: {&#10;&#160;&#160;&#160;&#160;color: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;scale: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;type: 'identity',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;domain: ['rgb(227,26,28)', 'rgb(31,120,180)', 'rgb(170,170,170)'],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;names: ['Maternal', 'Paternal', 'Unknown'],&#10;&#160;&#160;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;},&#10;}</code></pre></dialog></span> |
| <span id="slot-rowcolor">**rowColor**</span><br>[RowColor](../rowcolor) | A color per row, by value, as `scale.domain`/`scale.range` pairs: the bar beside the row's label, and the row's blocks while no `encoding.color` or itemRgb colors them. The arrangement dialog writes it.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ rowColor: { scale: { domain: ['HG00096'], range: ['#4e79a7'] } } }</code></pre></dialog></span> |
| <span id="slot-rowproportion">**rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Fraction of the row height each block fills (1 = full, leaving no gap between rows).<br>_advanced_ |
| <span id="slot-legend">**legend**</span><br>[Legend](../legend) | The color key, which appears only while a field paints the blocks — elsewhere the sidebar labels are already the key. |
| <span id="slot-rowgroups">**rowGroups**</span><br>[RowGroup](../rowgroup) | An array of `{ match, group }` tagging each row with the `group` of the first entry whose regex its name matches, an attribute like any other: `facet: 'group'` stacks the groups in bands, and `rowColor: { field: 'group' }` colors them. A row no entry matches has no group, and takes no color from the deal.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>rowGroups: [&#10;&#160;&#160;{ match: '^CLUP', group: 'Wolf' },&#10;&#160;&#160;{ match: '^CLAT', group: 'Coyote' },&#10;],&#10;rowColor: {&#10;&#160;&#160;field: 'group',&#10;&#160;&#160;scale: {&#10;&#160;&#160;&#160;&#160;domain: ['Wolf', 'Coyote'],&#10;&#160;&#160;&#160;&#160;range: ['rgb(27,120,55)', 'rgb(224,130,20)'],&#10;&#160;&#160;},&#10;},</code></pre></dialog></span> |
| <span id="slot-facet">**facet**</span><br>[Facet](../facet) | Stacks the rows in labelled bands: `group` bands them by their `rowGroups` group, the groups in the order `rowGroups` declares them unless `sort` lists some first, and the rows no entry matches last. Each band keeps the rows' arranged order and, where the cluster tree holds a clade of exactly its rows, draws that clade; a clustering run clusters each band apart.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ facet: 'group' }</code></pre></dialog></span> |
| <span id="slot-axis">**axis**</span><br>[RowAxisWithGrid](../rowaxiswithgrid) | The guide down the left of the rows: the cluster tree, each row's name and the lines between rows. |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5000000</code> | The byte axis is the only gate this display has: it paints into fixed lanes, so it composes no density axis to fall through to.<br>_advanced_ |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `maxFeatureScreenDensity` | ignored |
| `maxDisplayedBpPerPx` | ignored |
| `mouseover` | ignored |
| `jexlFilters` | moved into a current slot |
| `color` | moved into a current slot |
| `showTree` | moved into a current slot |
| `showBranchLength` | moved into a current slot |
| `showRowLabels` | moved into a current slot |
| `treeAreaWidth` | moved into a current slot |
| `showRowSeparators` | moved into a current slot |

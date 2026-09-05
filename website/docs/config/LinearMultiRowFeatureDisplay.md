---
id: linearmultirowfeaturedisplay
title: LinearMultiRowFeatureDisplay
sidebar_label: Display -> LinearMultiRowFeatureDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/configSchema.ts).

## Example usage

A custom BED with a column naming each row, its columns named by a
`#`-prefixed header line (tab-separated, shown space-aligned):

```
#chrom  start    end      name  sample
chr1    0        2000000  seg1  HG00096
chr1    2000000  5500000  seg2  HG00096
chr1    0        3500000  seg3  HG00097
```

Paint one row per `sample`, coloring each row from `sampleColorMap`:

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
      partitionField: 'sample',
      sampleColorMap: { HG00096: '#4e79a7', HG00097: '#f28e2b' },
    },
  ],
}
```

Omit `sampleColorMap` entirely and each row is auto-assigned a distinct
palette color — unless the features carry an `itemRgb`, which is honored as
the per-feature color with no configuration at all. To color per feature off
some other attribute, set the `color` slot to a `jexl:` expression reading it.

_See the **Config slots** section below for all available configuration fields._

Paints interval features as colored blocks on stacked rows partitioned by a
feature attribute ("chromosome / ancestry painting").

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

These slots go on a display entry: `"displays": [{ "type": "LinearMultiRowFeatureDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-partitionfield">**partitionField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Feature attribute whose value assigns each feature to a row; empty (the default) picks one off the data, and a `jexl:` expression derives one.<br>_callback args:_ `feature`<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ partitionField: "jexl:split(split(feature.name,'#')[1],'/')[0]" }</code></pre></dialog></span> |
| <span id="slot-lengthfield">**lengthField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Feature attribute holding a signed bp length change against the reference, which turns on indel glyphs over the blocks; empty (the default) leaves the display a plain block painter.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><p>A pangenome-graph path BED, where `delta` is each haplotype's bp gained or lost at that bubble:</p><pre><code>{ partitionField: 'strain', lengthField: 'delta' }</code></pre></dialog></span> |
| <span id="slot-color">**color**</span><br>`maybeColor` | Per-block fill: a CSS color, or a `jexl:` expression for per-feature coloring (e.g. ``jexl:`rgb(${get(feature,'ancestryRgb')})` ``).<br>_callback args:_ `feature` |
| <span id="slot-samplecolormap">**sampleColorMap**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | Optional map of `partitionField` value to color, e.g. `{ HG00096: '#4e79a7' }`, overriding the `color` slot where it matches. |
| <span id="slot-roworder">**rowOrder**</span><br>`stringArray` = <code>[]</code> | Optional explicit row order; rows listed here come first, remaining partition values are appended sorted. |
| <span id="slot-rowproportion">**rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Fraction of the row height each block fills (1 = full, leaving no gap between rows).<br>_advanced_ |
| <span id="slot-colorrowlabels">**colorRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Tint each sidebar label box with the color that row's blocks are painted in; `rowGroups` and a dialog-set color both win over it, and per-feature color mode leaves no one row color to tint with. |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Show the categorical color key, which appears only in per-feature color mode — elsewhere the sidebar labels are already the key. |
| <span id="slot-legend">**legend**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | Explicit color key, for a category encoded only in the block color and so unavailable to the auto-derived legend this overrides.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>legend: [&#10;&#160;&#160;{ label: 'Maternal', color: 'rgb(227,26,28)' },&#10;&#160;&#160;{ label: 'Paternal', color: 'rgb(31,120,180)' },&#10;&#160;&#160;{ label: 'Unknown', color: 'rgb(170,170,170)' },&#10;]</code></pre></dialog></span> |
| <span id="slot-rowgroups">**rowGroups**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | An array of `{ match, group, color }` tagging rows by a regex on their name, pulling matched rows into contiguous blocks (except under a cluster tree, which already owns the row order) and tinting their sidebar swatch — never their blocks.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>rowGroups: [&#10;&#160;&#160;{ match: '^CLUP', group: 'Wolf', color: 'rgb(27,120,55)' },&#10;&#160;&#160;{ match: '^CLAT', group: 'Coyote', color: 'rgb(224,130,20)' },&#10;]</code></pre></dialog></span> |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | The byte axis is the only gate this display has: it paints into fixed lanes, so it composes no density axis to fall through to.<br>_advanced_ |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | fixed row height in px; 0 (the default) auto-fits all rows to the display height, so adding rows shrinks them instead of growing the track |
| <span id="slot-showrowseparators">**showRowSeparators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a hairline between adjacent rows; off by default, because a painting whose neighbouring rows differ in color already separates itself and the line only earns its pixel where they do not — a run of same-colored rows reads as one block without it, with no way to recover the row count by eye. Drawn only once rows are at least 4px tall: below that the line is as thick as the row it borders, turning a dense painting into a grid of hairlines with a little color between them |
| <span id="slot-densitytier">**densityTier**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, features, density) = <code>'auto'</code> | when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)<br>_advanced_ |
| <span id="slot-densitytierbpperpx">**densityTierBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone<br>_advanced_ |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the cluster tree sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the row name over the left of each row |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

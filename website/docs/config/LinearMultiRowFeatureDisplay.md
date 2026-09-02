---
id: linearmultirowfeaturedisplay
title: LinearMultiRowFeatureDisplay
sidebar_label: Display -> LinearMultiRowFeatureDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/configSchema.ts).

## Example usage

The data is a custom BED with a column naming each row (`partitionField`).
Name the columns with a `#`-prefixed header line so the adapter picks them up
(tab-separated, shown space-aligned):

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

Paints interval features as colored blocks on stacked rows ("chromosome /
ancestry painting"). Rows are partitioned by a feature attribute
(`partitionField`). Block color comes from `sampleColorMap` (keyed by the
partition value) when set, else a customized per-feature `color` slot, else an
automatically-assigned per-row color from a categorical palette. A row color
picked interactively in the "Edit colors/arrangement..." track-menu dialog
overrides all of these for that row (applied at render time, no refetch).

These are display-level slots. This is not a `FeatureTrack`'s default display,
so configure it with an explicit `displays` entry (rather than the
`displayDefaults` shorthand, whose `color` would also reach the default
`LinearBasicDisplay`).

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
| <span id="slot-partitionfield">**partitionField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Feature attribute whose value assigns each feature to a row (e.g. a BED column name). Features sharing a value stack into the same row.<br><br>Nothing declares the rows: they are discovered from the values present in the loaded regions, so a file that gains a category needs no config change. `rowOrder` and `sampleColorMap` are how a row's position and color are held fixed while that set changes underfoot.<br><br>**Empty (the default) picks the attribute off the data**: a file carrying `repClass` is partitioned by repeat class, and anything else falls back to `name`. RepeatMasker is why — `name` there is the repeat instance, so the display used to open as tens of thousands of single-feature rows and the twenty-row view the track is actually read for was one unadvertised track-menu click away. Set this explicitly to pin a column and opt out.<br><br>A `jexl:` expression works here too, for a file that carries the category without carrying a column for it. UCSC's `bigRmskBed` is the case this was added for: the repeat class is a suffix on the name (`L1HS#LINE/L1`), so the attribute form can only partition on the full repeat name, which is thousands of rows instead of twenty.<br>_callback args:_ `feature`<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ partitionField: "jexl:split(split(feature.name,'#')[1],'/')[0]" }</code></pre></dialog></span> |
| <span id="slot-lengthfield">**lengthField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Feature attribute holding a **signed bp length change** against the reference, which turns on alignment-style indel glyphs over the blocks: a positive value draws the insertion marker `plugins/alignments` and `plugins/maf` draw (a bar whose width follows the length, with the bp count when the row is tall enough), a negative one draws a deletion line across the block, and 0 draws nothing.<br><br>This exists because a block's own width can only ever show how much *reference* a feature covers. An insertion covers almost none of it, so a 113 kb allele and a 1 bp one draw identically without this — the length has to come from a separate attribute.<br><br>Empty (the default) leaves the display a plain block painter.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><p>A pangenome-graph path BED, where `delta` is each haplotype's bp gained or lost at that bubble (`scripts/build_minigraph_paths.sh`):</p><pre><code>{ partitionField: 'strain', lengthField: 'delta' }</code></pre></dialog></span> |
| <span id="slot-color">**color**</span><br>`maybeColor` | Per-block fill: a CSS color, or a `jexl:` expression for per-feature coloring (e.g. ``jexl:`rgb(${get(feature,'ancestryRgb')})` ``). Unset, a feature's own `itemRgb` is used if it has one, and otherwise each row gets a distinct color from a categorical palette.<br>_callback args:_ `feature` |
| <span id="slot-samplecolormap">**sampleColorMap**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | Optional map of `partitionField` value to color, e.g. `{ HG00096: '#4e79a7' }`. When a feature's partition value has an entry here it overrides the `color` slot, so whole rows can be colored without a per-feature color column. |
| <span id="slot-roworder">**rowOrder**</span><br>`stringArray` = <code>[]</code> | Optional explicit row order. Rows listed here come first in this order; any remaining partition values are appended in sorted order. Empty = fully auto (sorted). |
| <span id="slot-rowproportion">**rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Fraction of the row height each block fills (1 = full, leaving no gap between rows).<br>_advanced_ |
| <span id="slot-colorrowlabels">**colorRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Tint each sidebar label box with the color that row's blocks are painted in, so a row can be found by color at a glance instead of by reading down a column of similar names.<br><br>Off by default, and a toggle rather than a rule, because the label box is a scarce surface: `rowGroups` already spends it on a grouping the painting does not show, and a color set in the "Edit colors/arrangement" dialog spends it too. Both of those win over this, being asked for by name where this is derived.<br><br>Nothing happens in per-feature color mode (an `itemRgb` painting, or a `jexl:` `color` slot): there is no one color the row is painted in, so there is nothing honest to tint the label with. |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Show the categorical color key (swatch + label per distinct per-feature color). Only appears in per-feature color mode; in per-row palette / sampleColorMap mode the sidebar labels are already the key, so nothing shows regardless. The entries come from `legend` when set, else are auto-derived from named, categorical features (e.g. chromHMM states). |
| <span id="slot-legend">**legend**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | Explicit color key: an array of `{ label, color }`. Use this when the category is encoded only in the block color (e.g. an `itemRgb` ancestry painting) so there's no feature attribute to auto-derive a legend from — the mapping is a semantic the data doesn't carry, so the config declares it. `color` is any CSS color and should match what `color` paints. Overrides the auto-derived legend when non-empty.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>legend: [&#10;&#160;&#160;{ label: 'Maternal', color: 'rgb(227,26,28)' },&#10;&#160;&#160;{ label: 'Paternal', color: 'rgb(31,120,180)' },&#10;&#160;&#160;{ label: 'Unknown', color: 'rgb(170,170,170)' },&#10;]</code></pre></dialog></span> |
| <span id="slot-rowgroups">**rowGroups**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | Group and mark rows: an array of `{ match, group, color }` where `match` is a regex tested against the row name (the partition value). The first matching entry wins, its `color` becomes that row's sidebar swatch, and matched rows are pulled into contiguous blocks in the order the entries are declared, ahead of everything unmatched.<br><br>It groups as well as marks because marking alone does not survive a large cohort: rows spread through a couple of thousand sorted neighbours land as a few specks that read as noise, where the same rows in one block read as a group whose colors can be compared against the rest. Within a block the incoming order is kept, so a `sortRowsBy` still orders each block by the value it sorted on.<br><br>**Except under a cluster tree, where it marks without grouping.** Clustering already owns the row order, so partitioning on top of it used to trade the dendrogram away silently (the tree stops describing the rows, and `StaleTreeHint` replaces it). That is also the case where a stripe is worth most: the groups are an axis the clustering never saw, so reading them down the blocks it did find is what says whether the two agree. Both together now means both.<br><br>Use this when the row identity encodes a grouping the painting does not — cohort IDs whose prefix names a population, say — and the cohort is far too large to enumerate in `layout`. The color tints the swatch only, never the blocks, so it composes with an `itemRgb` painting instead of overwriting it.<br><br>**Below a pixel a row, mark the small group and not the big one.** The swatch is floored to a whole pixel so it survives at all, which makes every mark taller than the row it points at, so the stripe is a marker rather than a proportional encoding: 307 of 1,987 rows (15%) came out as 48% of the stripe's ink, which reads as a majority, where 63 wolves out of the same 1,987 cost 10% and read correctly as sparse ticks.<br><br>The floor is the whole of that caveat, so it stops applying once a row clears a pixel. 127 Roadmap epigenomes in 480px is 3.7px a row, and there every one of the 19 published tissue groups can be declared and the stripe stays proportional. Check the row height before deciding how much to mark.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>rowGroups: [&#10;&#160;&#160;{ match: '^CLUP', group: 'Wolf', color: 'rgb(27,120,55)' },&#10;&#160;&#160;{ match: '^CLAT', group: 'Coyote', color: 'rgb(224,130,20)' },&#10;]</code></pre></dialog></span> |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | The same 5 Mb `LinearBasicDisplay` uses, raised from the base display's conservative 1 Mb, and for the reason that slot gives: this display reads the same BED/BigBed/tabix files, none of whose adapters declare a limit of their own, and the index estimate is block-granular — a single region still pulls whole BGZF blocks, so a tighter gate banners a view that is not actually large.<br><br>It matters more here than there. The byte axis is the *only* gate this display has: multi-row paints into fixed lanes, so it composes no density axis and has no second backstop to fall through to.<br>_advanced_ |
| <span id="slot-rowheight">**rowHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | fixed row height in px; 0 (the default) auto-fits all rows to the display height, so adding rows shrinks them instead of growing the track |
| <span id="slot-showrowseparators">**showRowSeparators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a hairline between adjacent rows; off by default, because a painting whose neighbouring rows differ in color already separates itself and the line only earns its pixel where they do not — a run of same-colored rows reads as one block without it, with no way to recover the row count by eye. Drawn only once rows are at least 4px tall: below that the line is as thick as the row it borders, turning a dense painting into a grid of hairlines with a little color between them |
| <span id="slot-densitytier">**densityTier**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, features, density) = <code>'auto'</code> | when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)<br>_advanced_ |
| <span id="slot-densitytierbpperpx">**densityTierBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone<br>_advanced_ |
| <span id="slot-showtree">**showTree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the cluster tree sidebar |
| <span id="slot-showbranchlength">**showBranchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-showrowlabels">**showRowLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the row name over the left of each row |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

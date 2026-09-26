---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts).

## Example usage

Minimal `GWASTrack` config. See the
[GWAS track guide](/docs/config_guides/gwas_track) for all options:

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
  },
}
```

Taller track, LocusZoom-style coloring: `color: { field: 'ld' }` colors
each point by its r² to the index SNP read from the adapter's `ldAdapter`
sub-adapter. The LD data is a second source on `GWASAdapter` (mirroring
MAF's `annotationAdapter`), so it nests under `adapter`, while display-only
options like `height`/`color` go in `displayDefaults` — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
    ldAdapter: {
      type: 'PlinkLDTabixAdapter',
      uri: 'https://example.com/plink.ld.gz',
    },
  },
  displayDefaults: {
    height: 400,
    color: { field: 'ld' },
  },
}
```

A selection scan as a plain `FeatureTrack`: the plot reads the file's `fst`
column through `scoreField` and colors each point by its `population`
column, with the color key derived from the values it meets:

```js
{
  type: 'FeatureTrack',
  trackId: 'fst_scan',
  name: 'Fst scan',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: 'https://example.com/fst.bed.gz',
  },
  displays: [
    {
      type: 'LinearManhattanDisplay',
      scoreField: 'fst',
      color: { field: 'population' },
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

configuration for the Manhattan plot display: the default display of a GWAS
track, and one a FeatureTrack can switch to, plotting any numeric feature
field as a scored scatter

## Related links

- **Adapter:** [GWASAdapter](../gwasadapter)
- **State model:** [runtime API](../../models/linearmanhattandisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearManhattanDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[ManhattanColor](../manhattancolor) | `"goldenrod"` or a `jexl:` callback paints every point; `{ field: "population" }` gives each value a palette colour with a key; `{ field: "ld" }` colours by r² to the index SNP. |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The y scale: `domainMin`, `domainMax` and `rules`. -log10 p values are pre-transformed, so `type` admits `linear` only and the plot's domain is plain min/max over the loaded regions with no autoscale mode to consult — the track menu draws neither radio, because the scale declares neither.<br><br>A threshold a scan is read against — genome-wide significance on a GWAS, an empirical outlier cutoff on a differentiation scan — is a `scales.y.rules` entry, on the plot's own scale, so it is a `-log10(p)` where the points are and an Fst where `scoreColumn` names an Fst column. A scan read against two thresholds, suggestive and genome-wide, names both. The axis widens to reach a rule, so a window where nothing clears the threshold still shows it. |
| <span id="slot-size">**size**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>4</code> | Manhattan point diameter in px (adjustable from the track menu). Larger default than wiggle's since Manhattan points are the primary glyph. |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the color key: the r² ramp under LD coloring, the value table under field coloring. Nothing under the plain single-color scheme, which has no key to draw. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-scorefield">**scoreField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'score'</code> | Feature field plotted on the score axis, read natively off each feature. The default `score` is the field every adapter serves — including the value a BED adapter's `scoreColumn` rewrote it to — so an explicit name here reaches a raw column the adapter left alone (a BED extra column, a GFF attribute) and takes precedence over that adapter-tier rewrite. The Manhattan plot skips a feature with no finite value in the field; the wiggle renderings plot it at 0 |

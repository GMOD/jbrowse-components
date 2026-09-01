---
id: linearhicdisplay
title: LinearHicDisplay
sidebar_label: Display -> LinearHicDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/configSchema.ts).

## Example usage

A minimal `HicTrack` config. See the
[Hi-C track guide](/docs/config_guides/hic_track) for all options:

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
}
```

With log scale and a coarser resolution (`resolutionBias` nudges the
auto-picked binsize; negative = finer, positive = coarser). The
`displayDefaults` object shorthand applies settings to whichever display uses
them — equivalent to a full `displays: [{ type, displayId, ... }]` array. See
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
  displayDefaults: { useLogScale: true, resolutionBias: 1 },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [HicAdapter](../hicadapter)
- **State model:** [runtime API](../../models/linearhicdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearHicDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>300</code> | default height for the Hi-C track |
| <span id="slot-colorscheme">**colorScheme**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (juicebox, fall, viridis) = <code>'juicebox'</code> | color ramp used to render contact intensity |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | show the color scale legend. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track |
| <span id="slot-resolutionbias">**resolutionBias**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Signed integer offset from the zoom-derived auto-picked binsize. `0` means pure auto; `-1` is one step finer, `+1` one step coarser. Tracking the offset (not an absolute binsize) keeps the intent valid across zoom. |
| <span id="slot-uselogscale">**useLogScale**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | map contact counts to color on a log2 scale |
| <span id="slot-usecolorpercentile">**useColorPercentile**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | false → maxScore/20 (linear) or maxScore (log); true → 95th percentile of counts, so off-diagonal contacts read more strongly. |
| <span id="slot-showresolutioncontrols">**showResolutionControls**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | show the on-figure resolution dropdown in the overlay |
| <span id="slot-selectednormalization">**selectedNormalization**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'KR'</code> | The user's chosen matrix normalization scheme (e.g. KR, SCALE, VC, NONE). Resolved at runtime against what the `.hic` file actually provides — see the model's `activeNormalization` getter. |
| <span id="slot-squashtoheight">**squashToHeight**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | squash the triangle vertically to fit the display height instead of drawing square bins |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

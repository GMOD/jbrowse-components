---
id: featurecolor
title: FeatureColor
sidebar_label: Display -> FeatureColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/colorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearBasicDisplay', color: 'goldenrod' }
```

```js
{
  type: 'LinearBasicDisplay',
  color: { field: 'gene_biotype', range: ['#1f77b4', '#ff7f0e'] },
}
```

```js
{
  type: 'LinearBasicDisplay',
  color: {
    field: 'score',
    scale: 'threshold',
    domain: ['0.5', '0.9'],
    range: ['#c6dbef', '#6baed6', '#08519c'],
  },
}
```

```js
{
  type: 'LinearBasicDisplay',
  color: { field: 'score', scheme: 'viridis', domainMin: 0 },
}
```

_See the **Config slots** section below for all available configuration fields._

The canvas feature displays' `color` setting: a CSS colour or `jexl:`
callback in `value`, or a field whose values each take a range colour,
whose numbers each take the colour of the interval between cut points they
fall in, or whose numbers run along a colour ramp, with a key. A string is
the constant; the object binds the field, and `scale: "none"` beside a
field paints the constant while keeping the field for the way back.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "FeatureColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-title">**title**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>export const colorTitleSlot = { title: { type: 'maybeString', d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>export const colorTitleSlot = {&#10;&#160;&#160;title: {&#10;&#160;&#160;&#160;&#160;type: 'maybeString',&#10;&#160;&#160;&#160;&#160;description: 'key title; unset follows field, "" draws none',&#10;&#160;&#160;},&#10;} as const</code></pre></dialog></span> | The heading of the key this scale draws, naming what the colour measures. Three states: unset, the key is titled with `field`; some text is that text; `""` is a key with no title, and the only spelling of one. `null` reads as unset, as it does in every slot. |
| <span id="slot-title">**title**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>colorTitleSlot = { title: { type: 'maybeString', description: '…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>colorTitleSlot = {&#10;&#160;&#160;title: {&#10;&#160;&#160;&#160;&#160;type: 'maybeString',&#10;&#160;&#160;&#160;&#160;description: 'key title; unset follows field, "" draws none',&#10;&#160;&#160;},&#10;} as const</code></pre></dialog></span> | The heading of the key this scale draws, naming what the colour measures. Three states: unset, the key is titled with `field`; some text is that text; `""` is a key with no title, and the only spelling of one. `null` reads as unset, as it does in every slot. |
| <span id="slot-value">**value**</span><br>`maybeColor` | A CSS colour, or a jexl callback over `feature` returning one. Writing `color: "red"` or `color: "jexl:…"` lands here. Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a feature field, or a jexl expression over feature, whose values each paint one range colour with a key; a transcript and its parts paint the transcript's value, or its gene's where the transcript has none; strand paints forward tomato and reverse cornflowerblue unless domain or range says otherwise |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points in domain; linear or log a colour along a ramp from domainMin to domainMax; unset is linear for score and categorical for any other field |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the values that take the range first, in order; a value left out keeps a colour derived from itself that no listed value paints, so every region agrees on it. Under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts; under linear or log the ramp's stops, winning over scheme |
| <span id="slot-labels">**labels**</span><br>`stringArray` = <code>[]</code> | what the key names each domain value, one each in order, or under threshold each interval from the lowest; one past the list keeps its own name |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange) | a named ramp for a linear or log scale; range's colours, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain; unset, the stops are evenly spaced across it |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a linear or log scale's domain; unset follows the loaded values |

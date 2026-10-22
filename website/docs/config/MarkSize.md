---
id: marksize
title: MarkSize
description: "A mark's width in px, as color is its color: a point's size, its diameter, or a stroked mark's strokeWidth, a rule's or a line's thickness or a link's stroke."
sidebar_label: Display -> MarkSize
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markSizeConfigSchema.ts).

A mark's width in px, as `color` is its color: a point's `size`, its
diameter, or a stroked mark's `strokeWidth`, a rule's or a line's
thickness or a link's stroke. A number is the constant every instance
takes, and is written to `value`; a string is a feature field, and is
written to `field`, which a link's `strokeWidth` reads through `scale`, a
linear or log scale into a px range, so a score becomes a width the way a
ramp makes it a color.

## Example usage

```js
{ mark: 'point', encoding: { y: 'score', size: 7 } }
```

```js
{
  mark: 'link',
  encoding: {
    strokeWidth: { field: 'score', scale: { type: 'log', range: [1, 8] } },
  },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The px every instance takes: a point's diameter, a rule's or a line's thickness, a link's stroke where it reads no `field`. Unset is the mark's own, 4 for a point or a rule, 1 for a line and 2 for a link. Writing `size: 7` lands here. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field a link's stroke width reads, or a jexl expression over `feature`. Empty draws every instance at `value`. Writing `strokeWidth: "score"` lands here. |
| <span id="slot-scale">**scale**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'MarkSizeScale', { type: { type: 'stringEn…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'MarkSizeScale',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;type: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'stringEnum',&#10;&#160;&#160;&#160;&#160;&#160;&#160;model: types.enumeration('SizeScale', [...SIZE_SCALES]),&#10;&#160;&#160;&#160;&#160;&#160;&#160;defaultValue: 'linear',&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'linear or log',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;domainMin: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'maybeNumber',&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'value at the thinnest width; unset follows the regions',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;domainMax: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'maybeNumber',&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'value at the widest width; unset follows the regions',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;range: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'stringArray',&#10;&#160;&#160;&#160;&#160;&#160;&#160;defaultValue: [],&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'px at each end of the domain',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;},&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;closed: true,&#10;&#160;&#160;&#160;&#160;preProcessSnapshot: (snap: Record&lt;string, unknown&gt; = {}) =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;Array.isArray(snap.range)&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;? { ...snap, range: snap.range.map(String) }&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;: snap,&#10;&#160;&#160;},&#10;)</code></pre></dialog></span> | How the field's values map to widths, Vega-Lite's scale object. |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | `linear` or `log` between `domainMin` and `domainMax`. |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value the thinnest width stands at; unset, the loaded regions' own least. |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value the widest width stands at; unset, the loaded regions' own greatest. |
| <span id="slot-range">**range**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The px at each end of the domain, thinnest first. Empty is 1 to 6. |

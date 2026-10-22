---
id: syntenyopacity
title: SyntenyOpacity
description: "The synteny views' encoding.opacity, as encoding.color is their color: one opacity for every alignment, or a field of each alignment read into opacities."
sidebar_label: View -> SyntenyOpacity
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyOpacityConfigSchema.ts).

The synteny views' `encoding.opacity`, as `encoding.color` is their color:
one opacity for every alignment, or a field of each alignment read into
opacities. A number is the constant and is written to `value`; a string is
the field and is written to `field`. Under a field, `scale.range` holds the
opacities themselves, so a field that fades a dense view keeps it dim by
writing a low range.

## Example usage

```js
{ type: 'LinearSyntenyView', encoding: { opacity: 0.3 } }
```

```js
{
  type: 'LinearSyntenyView',
  encoding: { opacity: { field: 'identity', scale: { range: [0.1, 0.6] } } },
}
```

```js
{
  type: 'LinearSyntenyView',
  encoding: {
    opacity: {
      field: 'break_FET',
      scale: { type: 'threshold', domain: [0.05], range: [0.8, 0.15] },
    },
  },
}
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The opacity of every alignment, 0 to 1, while no field fades them. Unset is the view's own default. Writing `opacity: 0.3` lands here. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The field that fades each alignment: a measurement (`identity`, `mapq`, `dnds`) or a column the tracks declare in `attributeColumns`. Empty draws every alignment at `value`. Writing `opacity: "identity"` sets it. |
| <span id="slot-scale">**scale**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'SyntenyOpacityScale', { ...colorScaleType…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'SyntenyOpacityScale',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;...colorScaleTypeSlot({&#10;&#160;&#160;&#160;&#160;&#160;&#160;scales: SYNTENY_OPACITY_SCALES,&#10;&#160;&#160;&#160;&#160;&#160;&#160;scaleName: 'SyntenyOpacityScaleType',&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'threshold, or unset to follow the field',&#10;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;...colorDomainSlot({ domain: 'labels, or threshold cut points' }),&#10;&#160;&#160;&#160;&#160;range: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'stringArray',&#10;&#160;&#160;&#160;&#160;&#160;&#160;defaultValue: [],&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'opacities along the domain',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;domainMin: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'maybeNumber',&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'value at the faintest end; unset follows the field',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;domainMax: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'maybeNumber',&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'value at the most opaque end; unset follows the field',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;},&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;closed: true,&#10;&#160;&#160;&#160;&#160;preProcessSnapshot: (snap: Record&lt;string, unknown&gt; = {}) =&gt; {&#10;&#160;&#160;&#160;&#160;&#160;&#160;const out = normalizeChannel(snap, 'encoding.opacity.scale')&#10;&#160;&#160;&#160;&#160;&#160;&#160;return Array.isArray(out.range)&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;? { ...out, range: out.range.map(String) }&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;: out&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;},&#10;)</code></pre></dialog></span> | How the field's values map to opacities. |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (threshold) | `threshold` reads `domain` as cut points, a value on a cut taking the interval above it. Unset, a number column fades linearly from `domainMin` to `domainMax` and a text column takes one opacity per label. |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | A text column's labels, which take `range` in order; under `threshold`, the cut points. |
| <span id="slot-range">**range**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The opacities, 0 to 1: a number column's at `domainMin` and `domainMax`, a text column's per `domain` label, a threshold's per interval, one more than the cuts. Empty fades a number column from 0.3 to 1; a label or interval past the list draws opaque. |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value a number column is faintest at; unset, the measurement's own floor or the least value seen. |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value a number column is most opaque at; unset, the measurement's own ceiling or the greatest value seen. |

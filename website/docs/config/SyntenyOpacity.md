---
id: syntenyopacity
title: SyntenyOpacity
sidebar_label: View -> SyntenyOpacity
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyOpacityConfigSchema.ts).

## Example usage

```js
{ type: 'LinearSyntenyView', opacity: 0.3 }
```

```js
{ type: 'LinearSyntenyView', opacity: { field: 'identity', range: [0.1, 0.6] } }
```

```js
{
  type: 'LinearSyntenyView',
  opacity: {
    field: 'break_FET',
    scale: 'threshold',
    domain: [0.05],
    range: [0.8, 0.15],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

The synteny views' `opacity` setting, as `color` is their colour: one
opacity for every alignment, or a field each alignment carries read into
opacities. A number is the constant and lands in `value`; a string is the
field and lands in `field`. Under a field, `range` holds the opacities
themselves, so a field that fades a dense view keeps it dim by writing a
low range.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The opacity of every alignment, 0 to 1, while no field fades them. Unset is the view's own default. Writing `opacity: 0.3` lands here. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | What fades an alignment: a measurement (`identity`, `mapq`, `dnds`) or a column the tracks declare in `attributeColumns`. Empty draws every alignment at `value`. Writing `opacity: "identity"` lands here. |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, threshold) | `none` draws `value` and keeps the field for a switch back; `threshold` reads `domain` as cut points, a value on a cut taking the interval above it. Unset, a number column fades linearly from `domainMin` to `domainMax` and a text column takes one opacity per label. |
| <span id="slot-domain">**domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | A text column's labels, which take `range` in order; under `threshold`, the cut points. |
| <span id="slot-range">**range**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The opacities, 0 to 1: a number column's at `domainMin` and `domainMax`, a text column's per `domain` label, a threshold's per interval, one more than the cuts. Empty fades a number column from 0.3 to 1; a label or interval past the list draws opaque. |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value a number column is faintest at; unset, the measurement's own floor or the least value seen. |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value a number column is most opaque at; unset, the measurement's own ceiling or the greatest value seen. |

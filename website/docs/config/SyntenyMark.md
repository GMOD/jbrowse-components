---
id: syntenymark
title: SyntenyMark
description: "The linear synteny view's mark: how each ribbon draws between its two rows."
sidebar_label: View -> SyntenyMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyMarkConfigSchema.ts).

The linear synteny view's `mark`: how each ribbon draws between its two
rows. Straight sides read a ribbon's slant as the offset between the rows;
the bump curve reads a dense whole-genome stack more calmly.

## Example usage

```js
{ type: 'LinearSyntenyView', mark: { interpolate: 'bump' } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-interpolate">**interpolate**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, bump) = <code>'linear'</code> | the curve of each ribbon side: linear is straight, bump the S-curve that leaves and meets each row square |

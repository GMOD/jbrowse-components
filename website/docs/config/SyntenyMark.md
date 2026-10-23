---
id: syntenymark
title: SyntenyMark
description: "How each synteny ribbon draws between its two rows: the linear synteny view's mark and the multi-way display's ribbons.mark."
sidebar_label: View -> SyntenyMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyMarkConfigSchema.ts).

How each synteny ribbon draws between its two rows: the linear synteny
view's `mark` and the multi-way display's `ribbons.mark`. Straight sides read a ribbon's slant as the offset between the rows;
the bump curve reads a dense whole-genome stack more calmly.

## Example usage

```js
{ type: 'LinearSyntenyView', mark: { interpolate: 'bump' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-interpolate">**interpolate**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, bump) = <code>'linear'</code> | the curve of each ribbon side: linear is straight, bump the S-curve that leaves and meets each row square |

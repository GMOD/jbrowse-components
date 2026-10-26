---
id: mafy
title: MafY
description: "The MAF display's encoding.y: the value a row's bar height shows. Its only value scale is the coverage band's coverage.encoding.y."
sidebar_label: Display setting -> MafY
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafYConfigSchema.ts).

The MAF display's `encoding.y`: the value a row's bar height shows. Its
only value scale is the coverage band's `coverage.encoding.y`.

## Example usage

```js
{ type: 'LinearMafDisplay', encoding: { y: 'identity' } }
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (identity) | Unset, each row is one band of cells. `identity` draws each row as a bar chart of its identity to the reference, the bars painted by `encoding.color` where it is `identity` and in one color otherwise. |

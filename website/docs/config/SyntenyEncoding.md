---
id: syntenyencoding
title: SyntenyEncoding
description: "The linear synteny, dotplot and circular views' encoding: the channels every track in the view paints its alignments through."
sidebar_label: View -> SyntenyEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyEncodingConfigSchema.ts).

The linear synteny, dotplot and circular views' `encoding`: the channels
every track in the view paints its alignments through.

## Example usage

```js
{ type: 'LinearSyntenyView', encoding: { color: 'query', opacity: 0.4 } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[SyntenyColor](../syntenycolor) | Each alignment's color: `{ value }`, or a field and the `scale` its values map through, with a key. |
| <span id="slot-opacity">**opacity**</span><br>[SyntenyOpacity](../syntenyopacity) | Each alignment's opacity: a number, or a field read into opacities. |

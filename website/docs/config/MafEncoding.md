---
id: mafencoding
title: MafEncoding
description: "The MAF display's encoding, the channels its aligned cells paint through."
sidebar_label: Display -> MafEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafEncodingConfigSchema.ts).

The MAF display's `encoding`, the channels its aligned cells paint through.

## Example usage

```js
{ type: 'LinearMafDisplay', encoding: { color: 'identity' }, y: 'identity' }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[MafColor](../mafcolor) | What each aligned cell paints: `mismatch`, `base`, `identity`, `chromosome` or `codon`, and the scale its values map through. |

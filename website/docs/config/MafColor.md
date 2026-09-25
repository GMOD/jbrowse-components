---
id: mafcolor
title: MafColor
sidebar_label: Display -> MafColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearMafDisplay', color: 'identity' }
```

```js
{ type: 'LinearMafDisplay', color: 'identity', y: 'identity' }
```

_See the **Config slots** section below for all available configuration fields._

The MAF display's `color`: what colours each species row's aligned cells.
`mismatch` paints a base only where it differs from the reference,
`base` every base, `identity` the mean identity to the reference on a
red-to-blue ramp, `chromosome` each block by the rank of its source
chromosome within the row, and `codon` each codon by its amino-acid change,
given an `annotationAdapter`. A string is the field.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MafColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (mismatch, base, identity, chromosome, codon) = <code>'mismatch'</code> | what colours a cell: mismatch, base, identity, chromosome or codon |

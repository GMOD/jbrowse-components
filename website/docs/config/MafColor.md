---
id: mafcolor
title: MafColor
description: "The MAF display's encoding.color colors each species row's aligned cells by one field. mismatch paints a base only where it differs from the reference, base every base, identity the mean identity to…"
sidebar_label: Display -> MafColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafColorConfigSchema.ts).

The MAF display's `encoding.color` colors each species row's aligned cells
by one field.
`mismatch` paints a base only where it differs from the reference,
`base` every base, `identity` the mean identity to the reference along a
ramp, `chromosome` each block by the rank of its source chromosome within
the row, and `codon` each codon by its amino-acid change, given an
`framesAdapter`. A string is the field. Each field has one scale:
`identity` runs from `scale.domainMin` 0 to `scale.domainMax` 1 along the
`redgreyblue` scheme, as every display's identity does, and the others are
ordinal. The bases and the codons paint the theme's colors. The slots are
the shared color channel's, so `jbrowse validate` and "Edit plot..." judge
them as they judge any other display's.

## Example usage

```js
{ type: 'LinearMafDisplay', encoding: { color: 'identity' } }
```

```js
{
  type: 'LinearMafDisplay',
  encoding: {
    color: { field: 'identity', scale: { domainMin: 0.7, scheme: 'viridis' } },
  },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (mismatch, base, identity, chromosome, codon) = <code>'mismatch'</code> | field to color each cell by: mismatch, base, identity, chromosome or codon |
| <span id="slot-scale">**scale**</span><br>[MafColorScale sub-schema](#slot-scalescheme) | How the field's values map to colors, Vega-Lite's scale object. Each field has one scale type, so the object names none. |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | the named ramp identity runs along; unset is redgreyblue, and range's colors, where it lists any, win over it |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the identity ramp round, so its last color paints the low end; unset runs as written |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the identity the ramp's low end paints, 0 to 1; unset is 0, and 0.7 spreads the ramp over close relatives |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the identity the ramp's high end paints; unset is 1 |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-legend">**legend**</span><br>[MafColorLegend sub-schema](#slot-legendtitle) | The key this channel draws; an unset `title` is the field's own heading. |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the values the key lists, in order: under chromosome each rank from 0, the main source chromosome; under codon nonsyn, syn and stop |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors: under chromosome one per rank from the main source chromosome, the last painting every rank past it; under identity the ramp's stops, winning over scheme; the bases and the codons paint the theme's colors |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |

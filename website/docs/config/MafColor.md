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

```js
{
  type: 'LinearMafDisplay',
  color: { field: 'identity', domainMin: 0.7, scheme: 'viridis' },
}
```

_See the **Config slots** section below for all available configuration fields._

The MAF display's `color`: what colours each species row's aligned cells.
`mismatch` paints a base only where it differs from the reference,
`base` every base, `identity` the mean identity to the reference along a
ramp, `chromosome` each block by the rank of its source chromosome within
the row, and `codon` each codon by its amino-acid change, given an
`annotationAdapter`. A string is the field. Each field has one scale:
`identity` runs from `domainMin` 0 to `domainMax` 1 along the
`redgreyblue` scheme, and the others are categorical. The bases and the
codons paint the theme's colours. The slots are the shared colour object's,
so `jbrowse validate` and "Edit plot..." judge them as they judge any other
display's.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (mismatch, base, identity, chromosome, codon) = <code>'mismatch'</code> | what colours a cell: mismatch, base, identity, chromosome or codon |
| <span id="slot-domain">**domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the values the key lists, in order: under chromosome each rank from 0, the main source chromosome; under codon nonsyn, syn and stop |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours: under chromosome one per rank from the main source chromosome, the last painting every rank past it; under identity the ramp's stops, winning over scheme; the bases and the codons paint the theme's colours |
| <span id="slot-labels">**labels**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | what the key names each domain value, one each in order; one past the list keeps its own name |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset is the field's own heading, "" draws none |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue) | the named ramp identity runs along; unset is redgreyblue, and range's colours, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns the identity ramp round, so its last colour paints the low end |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the identity the ramp's low end paints, 0 to 1; unset is 0, and 0.7 spreads the ramp over close relatives |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the identity the ramp's high end paints; unset is 1 |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end colour and equal distances from the middle take equal colours; unset, the stops are evenly spaced across it |

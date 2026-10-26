---
id: mafbases
title: MafBases
description: "The MAF display's alignments.bases layer, a cell per position over the rows, as alignments' pileup.bases: show turns it on and encoding.color names what it paints. base paints every base in its color…"
sidebar_label: Display setting -> MafBases
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafBasesConfigSchema.ts).

The MAF display's `alignments.bases` layer, a cell per position over the
rows, as alignments' `pileup.bases`: `show` turns it on and
`encoding.color` names what it paints. `base` paints every base in its
color with its letter. `codon` paints each codon by its amino-acid change
against the reference, with the amino acid's letter, from the reading
frames of the MAF adapter's `framesAdapter`, at base level. The mismatches
do not draw while the layer does.

## Example usage

```js
{ type: 'LinearMafDisplay', alignments: { bases: { show: true } } }
```

```js
{
  type: 'LinearMafDisplay',
  alignments: { bases: { show: true, encoding: { color: 'codon' } } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the per-position layer over the rows |
| <span id="slot-encoding">**encoding**</span><br>[MafBasesEncoding sub-schema](#slot-encodingcolor) | The layer's channels: `encoding.color`, the per-position variable. |
| <span id="slot-encodingcolor">**encoding.color**</span><br>[MafBasesColor sub-schema](#slot-encodingcolorfield) | The per-position variable the layer paints: `base` or `codon`. |
| <span id="slot-encodingcolorfield">**encoding.color.field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (base, codon) = <code>'base'</code> | the per-position variable: base, every base in its color, or codon, each codon by its amino-acid change |

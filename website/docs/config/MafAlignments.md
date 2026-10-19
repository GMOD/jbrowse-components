---
id: mafalignments
title: MafAlignments
description: "The MAF display's alignments setting: the per-species rows, the band that takes the height the bands above it leave, and what each row draws."
sidebar_label: Display -> MafAlignments
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafAlignmentsConfigSchema.ts).

The MAF display's `alignments` setting: the per-species rows, the band
that takes the height the bands above it leave, and what each row draws.

## Example usage

```js
{ type: 'LinearMafDisplay', alignments: { showAllLetters: true } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAlignments</code> | When off, only the bands above the rows render. |
| <span id="slot-rowproportion">**rowProportion**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>DEFAULTS.rowProportion</code> | fraction of the row height each glyph fills |
| <span id="slot-showallletters">**showAllLetters**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAllLetters</code> | draw every base's letter, not only the mismatches' |
| <span id="slot-showasuppercase">**showAsUpperCase**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAsUpperCase</code> | uppercase all base letters |
| <span id="slot-showinversions">**showInversions**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showInversions</code> | Inverted blocks get a diagonal hatch. |
| <span id="slot-showannotations">**showAnnotations**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>DEFAULTS.showAnnotations</code> | The per-species CDS reading frames from the MAF adapter's `annotationAdapter` (UCSC `mafFrames`). No effect without one. |

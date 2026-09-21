---
id: marktransform
title: MarkTransform
sidebar_label: Display -> MarkTransform
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markTransformConfigSchema.ts).

## Example usage

Count features per bin that follows the zoom:

```js
transform: [
  { type: 'bin', step: 'auto' },
  { type: 'aggregate', ops: [{ op: 'count' }] },
]
```

_See the **Config slots** section below for all available configuration fields._

One step of a `transform` list, which runs over the region's features in
order, each step reading what the one before it answered. A step names its
`type` and takes that step's own settings; a key belonging to another step
is refused at load.

`filter` keeps the features an expression admits; `formula` writes an
expression's value into a field; `bin` snaps each feature to a
genome-aligned bin; `aggregate` folds each group into one feature carrying
its summaries; `coverage` replaces the features with runs of how many
overlap each stretch; `flatten` fans out an array field; `pileup` writes
each feature's row in a greedy first-fit packing.

## Config slots

A MarkTransform is one of the types its rows begin with, named by its `type`, and takes only that type's rows: `filter.expr` is written `{ "type": "filter", "expr": ... }`, and a key belonging to another type is refused where the config is read. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-filterexpr">**filter.expr**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | A jexl callback over `feature`. The features it admits are kept and the rest dropped before the steps behind it run.<br>_callback args:_ `feature` |
| <span id="slot-formulaexpr">**formula.expr**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | A jexl callback over `feature` whose value is written into `as`.<br>_callback args:_ `feature` |
| <span id="slot-formulaas">**formula.as**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'value'</code> | The field the value is written to. |
| <span id="slot-binstep">**bin.step**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10000</code> | The bin width in bp, aligned to the genome, or `"auto"` for a width that follows the view's zoom — the target of four pixels per bin, snapped up to the next 1/2/5 rung, resolved before the fetch and keyed into it. |
| <span id="slot-binfield">**bin.field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'start'</code> | The field placing a feature in a bin: a name, or a dotted path into a structured field (`INFO.END`). A `formula` step in front computes one. |
| <span id="slot-binas">**bin.as**</span><br>`stringArray` = <code>DEFAULT_BIN_AS</code> | The two fields the bin's edges are written to. An `aggregate` behind the bin that names no `groupby` groups by these. |
| <span id="slot-aggregateopsop">**aggregate.ops.op**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (count, sum, mean, min, max) = <code>'count'</code> | `count` needs no field; `sum`, `mean`, `min` and `max` read one. |
| <span id="slot-aggregateopsfield">**aggregate.ops.field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The feature field the op reads, for every op but `count`. |
| <span id="slot-aggregateopsas">**aggregate.ops.as**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The output field. Empty is `count`, or `<op>_<field>`. |
| <span id="slot-aggregategroupby">**aggregate.groupby**</span><br>`stringArray` = <code>[]</code> | The fields whose distinct value sets make the groups. Empty takes the edges a `bin` in front wrote, so binning and counting needs no restatement; with no `bin` in front it folds the whole region into one feature. |
| <span id="slot-aggregateops">**aggregate.ops**</span><br><code>types.array(aggregateOpSchema)</code> | The summaries each group carries. |
| <span id="slot-coverageas">**coverage.as**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'coverage'</code> | The field each run's depth is written to. |
| <span id="slot-flattenfield">**flatten.field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'subfeatures'</code> | The array field fanned out, one feature per element: a name or a dotted path. |
| <span id="slot-flattenindex">**flatten.index**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The field each element's position in its array is written to. Empty writes none. |
| <span id="slot-flattenkeepempty">**flatten.keepEmpty**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Keep a feature whose array field holds nothing, which is otherwise dropped. |
| <span id="slot-pileupas">**pileup.as**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'row'</code> | The field each feature's row is written to, which a `span` encoding `row` then reads. |
| <span id="slot-pileupfields">**pileup.fields**</span><br>`stringArray` = <code>DEFAULT_PILEUP_FIELDS</code> | The two fields giving the interval it packs. |
| <span id="slot-pileuppadding">**pileup.padding**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | bp of clearance kept between two features sharing a row, so a pileup does not butt its reads together. |

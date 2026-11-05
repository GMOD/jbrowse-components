---
id: rowpredicate
title: RowPredicate
description: "One entry of rows.filter: a FieldPredicate over a row attribute, a samplesTsv column on the variant display, a subtrack field on wiggle, group on the mark displays."
sidebar_label: Display setting -> RowPredicate
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowPredicateConfigSchema.ts).

One entry of `rows.filter`: a [FieldPredicate](../fieldpredicate) over a
row attribute, a samplesTsv column on the variant display, a subtrack field
on wiggle, `group` on the mark displays. A row's name, its sample, its
source, its haplotype, its label and its colors are refused, since they
name a row rather than describe it: a row's name goes in `rows.kept`. So is
a `jexl:` field, which a row has no record to compute over. A row missing
the attribute (absent or empty) fails every test but `valid: false`, which
selects exactly those rows.

## Example usage

```js
{ type: 'LinearVariantDisplay', rows: { filter: [{ field: 'population', oneOf: ['EUR', 'AFR'] }] } }
```

## Related links

- **Base config:** [FieldPredicate](../fieldpredicate)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span class="slot-group">Inherited from [FieldPredicate](../fieldpredicate)</span> | <span class="slot-group-count">9 slots</span> |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | the field tested, as the display names its fields, or a jexl: expression computed per feature |
| <span id="slot-equal">**equal**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | the value must equal this |
| <span id="slot-lt">**lt**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value must be below this |
| <span id="slot-lte">**lte**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value must be at most this |
| <span id="slot-gt">**gt**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value must be above this |
| <span id="slot-gte">**gte**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value must be at least this |
| <span id="slot-oneof">**oneOf**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | the value must be one of these |
| <span id="slot-range">**range**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | Vega-Lite's [min, max], both ends included and a null end open; it loads as gte and lte, the tighter bound winning where either is also written |
| <span id="slot-valid">**valid**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | true admits only records with a value for the field, false only those without |

---
id: fieldpredicate
title: FieldPredicate
description: "One entry of a filter list, Vega-Lite's field predicate: the field of each record and the tests its value must pass, every one given. A filter list admits a record that passes every entry."
sidebar_label: Display -> FieldPredicate
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/fieldPredicateConfigSchema.ts).

One entry of a `filter` list, Vega-Lite's field predicate: the `field` of
each record and the tests its value must pass, every one given. A `filter`
list admits a record that passes every entry. A comparison on a missing
value is false, and `valid: false` selects the missing values.

## Example usage

```js
filter: [{ field: 'length', gte: 10000 }, { field: 'identity', gte: 0.9 }]
```

```js
filter: [{ field: 'query', oneOf: ['chr1', 'chr2'] }]
```

```js
filter: [{ field: 'gene_group', valid: true }]
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the field tested, as the display names its fields |
| <span id="slot-equal">**equal**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | the value must equal this |
| <span id="slot-lt">**lt**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value must be below this |
| <span id="slot-lte">**lte**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value must be at most this |
| <span id="slot-gt">**gt**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value must be above this |
| <span id="slot-gte">**gte**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value must be at least this |
| <span id="slot-oneof">**oneOf**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | the value must be one of these |
| <span id="slot-valid">**valid**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | true admits only records with a value for the field, false only those without |

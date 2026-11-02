---
id: rowpredicate
title: RowPredicate
description: "One entry of rows.filter: a FieldPredicate over a row attribute, a samplesTsv column on the variant display, a subtrack field on wiggle, group on the mark displays."
sidebar_label: Display setting -> RowPredicate
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowPredicateConfigSchema.ts).

One entry of `rows.filter`: a [FieldPredicate](../fieldpredicate) over a
row attribute, a samplesTsv column on the variant display, a subtrack field
on wiggle, `group` on the mark displays. A row's name, its sample, its
haplotype, its label and its color are refused, since they name a row
rather than describe it: a row's name goes in `rows.kept`. A row missing
the attribute (absent or empty) fails every test but `valid: false`, which
selects exactly those rows.

## Example usage

```js
{ type: 'LinearVariantDisplay', rows: { filter: [{ field: 'population', oneOf: ['EUR', 'AFR'] }] } }
```

---
id: readtooltip
title: ReadTooltip
description: "The alignments displays' tooltip: the field the read hover's first line reads, spelt as encoding.color and facet spell one — a field, a path (mate.name), a tag (tags.HP) or a jexl: expression over…"
sidebar_label: Display setting -> ReadTooltip
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readTooltipConfigSchema.ts).

The alignments displays' `tooltip`: the `field` the read hover's first line
reads, spelt as `encoding.color` and `facet` spell one — a field, a path
(`mate.name`), a tag (`tags.HP`) or a `jexl:` expression over `feature`. A
bare string is the field. Unset, the first line is the read's name; a read
the field reads nothing on, or throws on, keeps its name too. Whenever the
first line is not the read's name, the hover adds a `Name:` line. The other
hovers (a mismatch inside a read, coverage, arcs, junctions) are unaffected.
The worker reads the field once per drawn read on each fetch, so a `jexl:`
expression on a deep BAM costs a little on every fetch.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', tooltip: 'tags.HP' }
```

```js
{
  type: 'LGVSyntenyDisplay',
  tooltip: "jexl:get(feature,'mate').name",
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | the field the read hover's first line reads, such as `tags.HP` or `mate.name`, or a `jexl:` expression over `feature`; unset, the read's name |

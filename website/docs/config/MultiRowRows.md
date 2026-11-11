---
id: multirowrows
title: MultiRowRows
description: "The multi-row display's rows: a MarkRows whose field declares type as its default, so a track with nothing written draws a row per kind of feature."
sidebar_label: Display setting -> MultiRowRows
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMultiRowFeatureDisplay/multiRowRowsConfigSchema.ts).

The multi-row display's `rows`: a [MarkRows](../markrows) whose `field`
declares `type` as its default, so a track with nothing written draws a row
per kind of feature. A field written overrides it, as the shorthand string
or the object, and `''` written is one row. The shared
[Rows](../rows) keeps `''`, no rows, for every other display. A write
changing the field in force, the default included, drops the arrangement
members naming its rows (ADR-257).

## Example usage

```js
{ type: 'LinearMultiRowFeatureDisplay', rows: 'sample' }
```

```js
{ type: 'LinearMultiRowFeatureDisplay', rows: { field: 'sample', sort: ['mom', 'dad'] } }
```

```js
{ type: 'LinearMultiRowFeatureDisplay', rows: '' }
```

## Related links

- **Base config:** [MarkRows](../markrows)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. One that changes `field` first clears `sort`, `labels`, `colors`, `tree`, `kept`, which name the old values, except those it states. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'type'</code> | The field whose values each take a row: `type` unless written, `''` for one row. |
| <span class="slot-group">Inherited from [MarkRows](../markrows)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-groups">**groups**</span><br>[list of RowGroup entries](../rowgroup) | A list of [RowGroup](../rowgroup) `{ match, group }` entries tagging each row with the `group` of the first entry whose regex its name matches, ggplot2's `group`: `facet: 'group'` stacks the groups in bands, and `rows.color: 'group'` colors them. A row no entry matches has no group. Unlike `sort` or `labels`, it names no row by its value, so a write changing `field` keeps it. |
| <span class="slot-group">Inherited from [RowsWithStep](../rowswithstep)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-step">**step**</span><br>[`number`](/docs/config_guides/slot_types#number) or <code>'fit'</code> = <code>'fit'</code> | Row height in px: the px from one row's top to the next, the rows that do not fit scrolling; or `"fit"`, the default, dividing the track's `height` between the rows, as `heightMode: "fit"` does on a feature track. The track never grows to hold its rows. Vega-Lite's word for a band's size, as in `height: { step }`. |
| <span class="slot-group">Inherited from [Rows](../rows)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-filter">**filter**</span><br>[RowPredicate](../rowpredicate) | The rows shown by attribute: a list of [RowPredicate](../rowpredicate) entries over a row attribute, each one a row must pass: a samplesTsv column on the variant display (`[{ field: 'population', oneOf: ['EUR', 'AFR'] }]`), a subtrack's field such as `group` on wiggle, and `group`, which `rows.groups` derives, on the mark displays. A row missing the attribute fails every test but `valid: false`. It narrows the rows before `kept`, and a write changing `field` keeps it, since it names no row by its value; a row's name goes in `kept`. |
| <span id="slot-annotations">**annotations**</span><br>[RowAnnotation](../rowannotation) | Extra color columns beside the row labels, one per row attribute, as ggtree's `gheatmap` and ComplexHeatmap's row annotation draw them: a list of [RowAnnotation](../rowannotation) entries, each a field or `{ field, scale: { domain, range, unknown }, legend: { title } }`, drawn in the order listed after the row's own color. Categorical only: each value of the field takes a color the way `rows.color` deals one, a row with no value leaves a gap, a field no row carries draws nothing, and each column gets a key titled `legend.title`, else the field. An entry with no field, or on `name`, is refused, and one on the `rows.color` field draws no column of its own, since the row color is that column. Where the row color paints no mark and shows only beside the label (the variant display, and wiggle while a score gradient paints), it is the first column, the one whose key focuses rows and whose colors `rows.colors` pins. It reorders no row, so under one tree several attributes read against the same clusters. Like `filter` it names no row: "Reset row order" and a write changing `field` keep it. |
| <span id="slot-axis">**axis**</span><br>[RowAxisWithGrid](../rowaxiswithgrid) | The guide down the left of the rows, a [RowAxisWithGrid](../rowaxiswithgrid): whether the tree and the row names draw, the sidebar's width, and a line between rows. What it draws is `rows.tree` and `rows.labels`. |
| <span class="slot-group">Inherited from [RowArrangement](../rowarrangement)</span> | <span class="slot-group-count">6 slots</span> |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in this order, and none is dropped. The rest keep the order their source lists them in (a VCF's samples, a multi-BigWig's subtracks), or sort, digits by magnitude, where the rows are values found on features. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn beside a row in place of its name, by name. Whether any label draws is `rows.axis.labels`. |
| <span id="slot-tree">**tree**</span><br>[RowTree](../rowtree) | The dendrogram beside the rows, a [RowTree](../rowtree): newick, or `{ newick, provenance }` where a clustering run wrote it beside the order it produced. A reorder that moves a row drops it. Whether it draws is `rows.axis.tree`. The rows follow the tree's leaves, then `rows.sort` for any rows the tree lacks; a supplied tree rotates towards `rows.sort`, so a `sort` also decides which way each clade faces. |
| <span id="slot-colors">**colors**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A color pinned on a row, by name, over whatever `rows.color` maps it to, as `labels` pins its text: ggplot2's `scale_*_manual(values = c(name = ...))`. The arrangement dialog's row swatches write it. A row with none takes `rows.color`, else the file's own color (MAF's `samples[].color`, a listed source's color), else the palette where the rows share one panel. |
| <span id="slot-color">**color**</span><br>[RowColor](../rowcolor) | The rows colored by an attribute: a [RowColor](../rowcolor) channel from a row field through a scale, `name` (each row) by default. Per-row colors are `rows.colors`, which win over it. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. It narrows the rows to those it names, after `filter` where the display declares one; empty shows every row, and a list naming no current row shows none, with a notice. Keyed: a write changing `field` clears it. |

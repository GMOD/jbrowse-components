---
id: lanerows
title: LaneRows
description: "The multi-way synteny display's rows: a lane per genome, or with field: 'refName' a lane per copy of the anchor window a genome holds."
sidebar_label: Display setting -> LaneRows
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/laneRowsConfigSchema.ts).

The multi-way synteny display's `rows`: a lane per genome, or with `field:
'refName'` a lane per copy of the anchor window a genome holds. It is the
arrangement a reader gives the lanes, by name, and writing it changes only
the members stated. `sort` lists the lanes that stack first, in order, the
rest following densest-first so a ribbon chain through adjacent lanes is
cut as late as possible; among copy lanes the anchor's assembly named in
it stacks the anchor at that place, where otherwise it stacks first. `kept` names the
lanes drawn, empty drawing the track's lanes or every lane. Haplotype lanes
read off a graph follow by structure instead, below any lanes `sort` pins,
so lanes whose deletions and insertions against the anchor match sit
together, in an order worked out once per window. Lanes take no tree. A
string is the field.

## Example usage

```js
{
  type: 'MultiWaySyntenyDisplay',
  rows: {
    sort: ['GCF_000346465.2', 'poplar'],
    kept: ['GCF_000346465.2', 'poplar', 'citrus'],
    colors: { poplar: '#1b9e77' },
  },
}
```

```js
{
  type: 'MultiWaySyntenyDisplay',
  rows: { field: 'refName', sort: ['{grape}chr9', 'peach', '{grape}chr11'] },
}
```

```js
{ type: 'MultiWaySyntenyDisplay', rows: 'refName' }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) ('auto', 'assembly', 'refName', 'piece') = <code>'auto'</code> | What one lane is: `assembly`, a lane per genome drawing the contig that best explains the window, or `refName`, a lane per contig of a genome holding a copy of the window, a polyploid's homoeologs or an old duplication's ohnologs, each read against the anchor alone. A copy lane is named as a locstring names a contig with its assembly, `{grape}chr9`, and answers to its genome's name: a `labels` or `colors` entry naming the genome reaches each of its copies, a `kept` one keeps each copy unless `kept` names one of them, and a `sort` one places the copies no other entry names. With genome lanes a copy named in `kept` or `sort` stands for its genome, so switching keeps both. A contig holding under a tenth of its genome's heaviest contig's evidence draws no lane unless `kept` names it. The anchor's own contig draws no lane; its genome's other contigs draw as copies. `piece` draws a lane per stretch of a contig the window places, stretches a window apart drawn apart and one record's never, with no floor, so a haplotype in several pieces draws every one; a piece lane is named after its contig with its place in contig order, `{HG00097.1}CM094061.1@2`, and answers to its genome's name as a copy lane does. `auto` draws piece lanes where the source's header declares haplotype lanes, copy lanes where the track's `assemblyNames` name at most one genome besides the anchor, and genome lanes across more. |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The lanes that stack first, by name, in this order; the rest follow densest-first, or each beside the lane most alike where the source joins neighbouring lanes. Among copy lanes, the anchor's assembly named here stacks the anchor at that place. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn for a lane in place of its name, by lane name. Where the lane labels draw is `labels.lanes`. |
| <span id="slot-colors">**colors**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A color pinned on a lane, by lane name, the anchor's included, over the color its source declares for it: ggplot2's `scale_*_manual(values = c(name = ...))`. It draws as a bar beside the lane's label; a lane with neither draws none. A lane menu's Color... writes it. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The lanes drawn, by lane name: it selects rather than narrows, replacing the track's lanes and able to add a lane the track does not configure. Empty draws the track's lanes, or every lane where it configures none. |

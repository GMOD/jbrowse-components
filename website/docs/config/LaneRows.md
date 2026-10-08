---
id: lanerows
title: LaneRows
description: "The multi-way synteny display's rows: one lane per assembly below the anchor, so assembly is the one field, and the object is the arrangement a reader gives the lanes, written whole as every…"
sidebar_label: Display -> LaneRows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/laneRowsConfigSchema.ts).

## Example usage

```js
{
  type: 'MultiWaySyntenyDisplay',
  rows: { domain: ['GCF_000346465.2', 'poplar'], kept: ['GCF_000346465.2', 'poplar', 'citrus'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The multi-way synteny display's `rows`: one lane per assembly below the
anchor, so `assembly` is the one field, and the object is the arrangement a
reader gives the lanes, written whole as every display's `rows` is. `domain`
lists the lanes that stack first, in order, the rest following densest-first
so a ribbon chain through adjacent lanes is cut as late as possible; `kept`
names the lanes drawn, empty drawing the track's lanes or every lane.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (assembly) = <code>'assembly'</code> | `assembly`, the one field a lane can be. |

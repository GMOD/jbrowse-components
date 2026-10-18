---
id: junctionfilter
title: JunctionFilter
description: "The splice junctions the alignments display draws, its filter.junctions: a supporting-read floor, and the non-canonical junctions as a category, only, exclude or unset for unfiltered, as a read…"
sidebar_label: Display -> JunctionFilter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/junctionFilterConfigSchema.ts).

The splice junctions the alignments display draws, its `filter.junctions`:
a supporting-read floor, and the non-canonical junctions as a category,
`only`, `exclude` or unset for unfiltered, as a read category is. Every
part that draws junctions reads it: the sashimi arcs, their read counts and
the tables engine's junctions.

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-minreads">**minReads**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | a junction draws only with at least this many supporting reads; 1 draws every junction |
| <span id="slot-noncanonical">**nonCanonical**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | `only`, `exclude`, or unset for unfiltered: junctions whose splice motif is none of GT-AG, GC-AG or AT-AC. The motif is read off the reference, so filtering needs a sequence adapter, and a junction whose motif could not be read counts as canonical |

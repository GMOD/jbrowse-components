---
id: readconnectionsfilter
title: ReadConnectionsFilter
description: "The connections the arcs and the read cloud draw, the alignments display's readConnections.filter: two connection categories, each only, exclude or unset for unfiltered, as a read category is in…"
sidebar_label: Display -> ReadConnectionsFilter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readConnectionsFilterConfigSchema.ts).

The connections the arcs and the read cloud draw, the alignments display's
`readConnections.filter`: two connection categories, each `only`,
`exclude` or unset for unfiltered, as a read category is in `filter`, and
the reads an inter-chromosomal breakpoint must gather. Which pairs are
ordinary is each mark's own test, so `showOrdinaryPairs` sits beside
`mark` rather than here.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-interchrom">**interchrom**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | only, exclude, or unset for unfiltered: connections to a mate or split segment on another chromosome, an arc where both chromosomes are displayed and a tick at each breakpoint otherwise |
| <span id="slot-offscreenmates">**offscreenMates**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | only, exclude, or unset for unfiltered: connections to a mate or split segment elsewhere on the same chromosome and outside the loaded window, drawn as vertical lines |
| <span id="slot-mininterchromreads">**minInterchromReads**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | an inter-chromosomal connection draws only with at least this many reads clustered at its breakpoint, counted over one fragment length on both sides; 1 draws every one, and a split read is exempt |

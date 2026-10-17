---
id: connectionfilter
title: ConnectionFilter
description: "The connections between mates and split segments the alignments display draws, its filter.connections: two connection categories, each only, exclude or unset for unfiltered, as a read category is,…"
sidebar_label: Display -> ConnectionFilter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/connectionFilterConfigSchema.ts).

The connections between mates and split segments the alignments display
draws, its `filter.connections`: two connection categories, each `only`,
`exclude` or unset for unfiltered, as a read category is, and the reads an
inter-chromosomal breakpoint must gather. Every part that draws connections
reads it: the arcs, the read cloud, the connectors over the pileup
(`pileup.showConnectors`) and the tables engine's arcs. Which pairs are
ordinary is each mark's own test, so `readConnections.showOrdinaryPairs`
sits with the band.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-interchrom">**interchrom**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | only, exclude, or unset for unfiltered: connections to a mate or split segment on another chromosome, an arc or a connector where both chromosomes are displayed and a tick at each breakpoint otherwise |
| <span id="slot-offscreenmates">**offscreenMates**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (only, exclude) | only, exclude, or unset for unfiltered: connections to a mate or split segment elsewhere on the same chromosome and outside the loaded window, drawn as vertical lines. A connector joins two laid-out reads, so it is never one |
| <span id="slot-mininterchromreads">**minInterchromReads**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | an inter-chromosomal connection draws only with at least this many reads clustered at its breakpoint, counted over one fragment length on both sides; 1 draws every one, and a split read is exempt |

---
status: Accepted
summary: "The multi-way synteny display's lane order and lane choice are its `rows`, `LaneRows`: the shared `Rows` object with `assembly` as its one field, `domain` the lanes that stack first and `kept` the lanes drawn, where a top-level `domain` slot and a `laneFilter` session property held them. A lane the menu hides stays the session's (`hiddenLaneNames`), as the multi-row display's hidden legend categories do. The lane choice now reaches a share link, Edit plot and `displayDefaults` as every row display's does; `domain` and `laneFilter` were beta spellings and get no lift"
---

# ADR-219: A multi-way lane order and choice are its `rows`

## Status

Accepted (2026-10-07). Settles call 4 of the 2026-10-07 grammar audit and
extends [ADR-157](adr-157-a-row-displays-arrangement-is-the-rows-config-object.md)
to the one row display it did not reach.

## Context

Every row display spells its order as `rows.domain` and the rows it keeps as
`rows.kept`, written whole (ADR-215). The multi-way display, whose rows are
lanes, spelt the order as a top-level `domain` slot, landed six days before
ADR-157 moved the word into `rows`, and held the lane choice as a `laneFilter`
session property with an `only` list beside an `except` list. Edit plot could
not write the lane order (`liftPlot` refused `domain`), a share link carried
the choice as display state rather than a track delta, and the vocabulary had
two spellings of one idea.

## Decision

- **`rows` is `LaneRows`**
  (`plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/laneRowsConfigSchema.ts`),
  the shared `Rows` with `assembly` as its one field, as `SampleRows` and
  `QuantitativeRows` are built. `rows.domain` is the order the Lanes menu and
  a header drag write; `rows.kept` is the lanes the picker chose, empty
  drawing the track's lanes or every lane.
- **A hidden lane stays the session's**, as `hiddenLaneNames`: a hide-set shows
  a lane discovered later, which a show-set cannot, and the display's menu
  owns it, as the multi-row display's hidden legend categories are its own.
- **No lift**: `domain` and `laneFilter` were spellings only v5 betas wrote.
  The in-tree configs, figure specs and the tutorial move by hand.

## Consequences

- `rows` appears in Edit plot and the agent's `plot` for a multi-way track,
  and a share link or `displayDefaults` can name the lane order and choice.
- `laneSelection.ts` reads a kept list and a hidden list rather than a filter
  object; `lanesInForce(kept, configured)` is the one rule for which lanes a
  choice leaves in force.
- A spec that wrote `laneFilter: { only: lanes }, domain: lanes` writes
  `rows: { domain: lanes, kept: lanes }`.

## Rejected alternatives

- **`rows.hidden` beside `rows.kept`.** A hide-set is interaction state the
  menu undoes, and no other row display carries one in config.
- **Leaving `domain` as the lane order.** One word for the row order
  everywhere is the audit's point, and the plot vocabulary already has it.

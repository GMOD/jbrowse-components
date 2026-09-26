---
status: Accepted
summary: "`LinearGCContentDisplay` is retired onto `LinearWiggleDisplay`, which registers for `GCContentTrack` beside the two quantitative tracks. The window, the step and the mode are the `GCContentAdapter`'s alone, where the display used to write its own over them; the track model's menu carries GC parameters and GC skew and writes the adapter, and the fetch key already holds the adapter config. The adapter declares the domain its values lie in (`getValueDomain`, [0, 1] for content, none for skew), which the wiggle display's unpinned ends stand at. A v4 config's settings on the display or `displayDefaults` land on the adapter, a bare sequence adapter is wrapped, and a reference sequence track's GC display is dropped: GC is a track of its own"
---

# ADR-176: GC content is a track the wiggle display draws

## Status

Accepted (2026-09-26). Colin chose "GC → wiggle", asking that the window stay
easy to set. The same shape as
[ADR-143](adr-143-one-quantitative-display-and-facet-is-the-layout.md)'s
multi-wiggle retirement.

## Context

The GC display was the wiggle display's model, schema and component plus
three settings, `windowSize`, `windowDelta` and `gcMode`, which
`GCContentAdapter` declared too. The display always wrote its own over the
adapter's, defaults included, so an adapter config spelling `gcMode: 'skew'`,
as the user guide said to, drew content. It also pinned a content axis to
[0, 1] through an override only it had.

## Decision

- **The adapter holds the three settings**, since it computes from them. The
  `GCContentTrack` model answers `windowSize`, `windowDelta` and `gcMode` off
  it, and its `trackMenuItems` add GC parameters (the window and step sliders)
  and GC skew beside the wiggle display's own items. Writing the adapter
  refetches through `settingsFetchInputs`, which holds the adapter config.
- **The data says its bounds.** `BaseFeatureDataAdapter.getValueDomain` is the
  interval an adapter's values lie in by definition, `undefined` by default;
  the wiggle executor carries it on each region's result and
  `defaultScoreDomain` reads it, so config bounds still win. The GC adapter
  answers [0, 1] for content.
- **`GCContentTrack` holds a scoped wiggle schema** defaulting
  `summaryScoreMode` to `avg`, as ADR-172's multi track does.
- **v4 configs load**: the wiggle display retires both GC display names, and
  the GC plugin's `Core-preProcessTrackConfig` handler (`liftGCSettings`) moves
  the settings off the display entry and `displayDefaults` onto the adapter.

## Consequences

- GC is no longer a display of the reference sequence track; its "Add GC
  content track" makes the track. The eight test configs that hosted one drop
  the entry, and a session that showed the reference track in GC mode opens
  it as the sequence display.
- Zoom inside a loaded region still refetches nothing, since the GC adapter
  declares no zoom range (ADR-125).
- The browser suite's two GC captures read `test_data/volvox/config_gc.json`,
  whose tracks carry the 500 bp window on their adapters.

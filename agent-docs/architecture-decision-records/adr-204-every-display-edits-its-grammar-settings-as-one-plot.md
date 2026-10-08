---
status: Accepted
summary: "Every display's grammar settings are one object, its `plot`: the slots from one vocabulary (`PLOT_VOCABULARY`: marks, transform, facet, rows, rowColor, color, baseColor, arcColor, ribbonColor, laneLayers, scales, filter, filterBy) that its config declares, read off the config snapshot with defaults left off and a shorthand folded back. `BaseDisplay` carries `plotKeys`, `plot`, `liftPlot`, `plotProblems`, `plotWrites` and `applyPlot`, which writes each setting whose lifted value moved, whole; the config schema is the only parser and refuses a key outside the plot before anything is written. display-kit's `PlotDialog` is the one text box, under Advanced → \"Edit plot...\" in every display's track menu and behind the color and grouping dialogs' buttons, with the display type's `plotExamples` as buttons and links to its config reference and the guide. `ChannelSpec`, its parser and dialog, and the mark display's `MarkPlot` box go. The runtime `filterSetting` override goes too: the `filter` slot is the one filter, \"Clear all filters\" writes back what the track's config declares, and a v4 `jexlFiltersSetting` is retired state lifted into it"
---

# ADR-204: Every display edits its grammar settings as one plot

## Status

Accepted (2026-10-01). Step 1 of the grammar-unity handoff's order of work.
Supersedes the JSON-box halves of
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md) (`parseChannelSpec`
over `preProcessConfigSnapshot`) and
[ADR-144](adr-144-one-color-object-on-the-quantitative-display.md)'s amended
"the box is the escape".

Amended 2026-10-07: LD declares a plot since `86fa244e40` (2026-10-04), when
its metric became `color.field` on an `LDColor` object, so its track menu
offers the box with `color` in it. The reference sequence, linear synteny,
dotplot and chord synteny displays still declare none.

## Context

Two JSON boxes existed. `ChannelSpec` (canvas, the single-sample variant
display, wiggle) held `facet`, `rows`, `color` and `filter` through ~250 lines
of hand parsing that restated the schema's checks, showed `rows` as
`{ field, domain }` and wrote it back through a display hook so the members it
hid survived. `MarkPlot` (the mark display, Manhattan) held `marks`,
`transform`, `facet`, `rows` and `scales` and had no parser: it merged a draft
over the declared snapshot and let the config schema lift and refuse it. Seven
displays with grammar settings had neither, and no display offered a box from
its track menu.

A filter had two tiers: the `filter` config slot and a `filterSetting`
display property that replaced it when set. A filter written through
`applyDisplaySettings` landed in the slot, reported `applied`, and changed
nothing while the dialog's override stood.

## Decision

- **A display's plot is its grammar slots by name.** `PLOT_VOCABULARY`
  (`core/configuration/plot.ts`) is the one hand list, each slot name with the
  line the dialog shows for it; `plotKeysOf` is it
  intersected with the slots the display's config declares, so no display
  lists its own keys and LD, the reference sequence and the synteny views,
  which declare none, offer nothing. `plotOf` reads them off the config
  snapshot, defaults left off, a one-member object folded back to its
  shorthand (`facet: "strand"`), and a list at a non-empty default shown, so
  Manhattan's default marks appear.
- **The schema is the parser.** `liftPlot` merges a draft over the plot and
  creates the display's config schema from it, which refuses what a config
  file is refused for, a key outside the plot included; a display reads its
  typed members off the detached node (`markPlotSettingsOf`). Creating one
  costs 0.1-0.5 ms.
- **`plotWrites` is what applying writes**: each setting whose lifted value
  differs from the plot, as the lifted value, so a setting spelled another way
  but meaning the same writes nothing. `applyPlot` writes those whole, through
  `setConf`, after the lift has passed, so a refused draft writes nothing; a
  member left out of an object returns to its default and `null` resets the
  setting, a namespace such as `scales` included, where `applyDisplaySettings`
  merges member by member. The dialog's "Sets ... Resets ..." line reads the
  same writes. `rows` is shown and written whole, tree, labels and
  focus included, so no display hook keeps what the box hid.
- **`BaseDisplay` carries the plot** (`plotKeys`, `plot`, `liftPlot`,
  `plotProblems`, `plotWrites`, `applyPlot`), so the agent reads and writes every display
  one way. `plotProblems` defaults to the schema's refusals; the mark display
  answers its rule list and canvas a `jexl:` compile check.
- **One box, under Advanced.** display-kit's `PlotDialog` is the text box,
  and `editPlotMenuItems` an Advanced submenu holding "Edit plot...", at
  priority -999 so it sits just above "Display types" wherever a display
  places it. The Group by, Color by attribute and color/arrangement dialogs
  keep a button that opens the box on their unapplied draft, and the mark
  display's form calls it "Edit as text...".
- **A display type declares its examples** (`DisplayType.plotExamples`), which
  the box shows as buttons, each filling the text with its example laid over
  the current plot. They live on the type rather than the model so a test over
  every registered display holds each to its schema (`PlotExamples.test.ts`).
  The box also links the display's page in the config reference
  (`configDocsUrl`, off the schema's name) and the "Editing a track's plot as
  text" guide.
- **The `filter` slot is the one filter.** `filterSetting`, `FilterSetting`,
  `activeJexlFilters` and `liftRetiredFilterSetting` go. The dialog, a
  feature's filter actions and the box write the slot, which the session keeps
  as a track setting; `baseJexlFilters` reads what the track's config declares,
  which "Clear all filters" writes back and the narrowing count compares
  against. A v4 `jexlFiltersSetting` is `retiredFilterState` on the canvas and
  single-sample variant displays (ADR-168). `baseDisplayConfig` moves to core.

## Consequences

- Hi-C, MAF, alignments, LGV synteny, multi-row, the multi-sample variant
  display and multi-way synteny gain a box with no per-display code.
- "Reset track settings" now resets a filter with the rest, and a filter
  written by a session spec, a share link or an agent takes effect.
- In a session that keeps no base track config (an embedded product), "Clear
  all filters" empties the slot, and a config's own filters count as narrowed.
- A beta session's `filterSetting` is dropped (beta-only state, no migration).
- The box's problem list is strings; the mark display's form keeps its
  per-slot problem index.
- A filter is a track-config edit, so it applies in every view showing the
  track.
- A v4 `jexlFiltersSetting` on a session track lifts into the `sessionTracks`
  entry itself, which is that track's base, so "Clear all filters" returns to
  the v4 filter.
- `ChordVariantDisplay` has a plot (`color`) and examples but no track menu,
  so it offers no row; the agent reaches it through `plot`.

## Rejected alternatives

- **The `ChannelSpec` parser kept and widened.** It restated the schema's
  checks per channel and fell behind them (a `rows` field the wiggle schema
  refuses, a color member a display does not declare); the lift refuses the
  same things in the schema's words.
- **The row added once in `BaseTrackModel.trackMenuItems`.** That assembly
  lives in core, which cannot open a display-kit dialog, and the Advanced
  submenu's priority already puts it in one place on every display.
- **The row beside each display's Color by and Group by rows.** Built first,
  then moved under Advanced: the box is for what the menus cannot say, and a
  top-level row in every track menu put a technical tool beside the everyday
  ones.
- **A per-display key list.** Two lists drifted already (`CHANNELS`,
  `MARK_PLOT_KEYS`); the intersection reaches a new display or slot with no
  edit.

---
status: Accepted
summary: "On the mark display, `rowProportion` moves from a display slot onto the mark, `marks[].rowProportion`, since a span alone reads it: Vega-Lite spells it `height: {band}` on a rect mark and ggplot2 `geom_tile(height)`, it applies to a span in any band (a pileup's, a facet's or a row's) rather than to the rows, and two spans can now differ. The Row height presets and dialog write every span's through `setRowProportion`, as Point size writes every point's, and a display with no span answers no `rowProportion`, so the dialog asks for none. `rowHeight` stays a flat display slot on all four row displays, beside `height`: it is Vega-Lite's `height: {step}`, a property of the view rather than of the encoding or the scale, and inside `rows`, a channel a settings bag replaces whole, pinning a height through a session spec or an agent call would erase the arrangement on three displays. The `0` fit sentinel stays, since leaving the slot out already fits and 0 px has no other reading. MAF and the multi-row feature display keep a display-level `rowProportion`: each draws one glyph family, so the display is its one mark"
---

# ADR-194: A span's row proportion is the mark's, and row height stays the display's

## Status

Accepted (2026-09-28). Follows `9b74cc729e`, which gave the mark display
`RowHeightMixin`'s `rowHeight` and a display-level `rowProportion`. Colin asked
whether the two fit the display's grammar vocabulary: `marks[].encoding`,
`transform`, `facet`, `rows` and `scales`.

## Context

`9b74cc729e` spelt both settings the way MAF, the multi-row feature display and
the multi-sample variant displays spell them: flat slots beside the rest, read
through `RowHeightMixin`, the shared **Row height** submenu and its
**Custom...** dialog. On the mark display each is narrower than the display:

- `rowHeight` pins a row only under `rows`. A facet's sections and the density
  sidecar's band always fit (`effectiveRowHeight`, ROW_HEIGHT_AND_FIT.md).
- `rowProportion` is read by the span alone. Bars, points, lines, rules, text
  and links keep the whole band, so on a display of bars the slot and the
  presets' write to it do nothing.

Two moves were on the table: fold both into `rows`, as `rows.step` (fit when
unset) and `rows.padding` (Vega-Lite's `scale.paddingInner`) on every row
display; or place each where the grammar libraries do.

## Decision

**`rowProportion` is a mark's slot.** `marks[].rowProportion`, default 1
(`DEFAULT_ROW_PROPORTION`), sits beside `interpolate` and `linkShape`, the
other settings one mark type alone reads, and `markProblems` reports it on a
mark that is not a span (`unread-row-proportion`), as it reports those two.
The render state carries `rowProportions`, one per mark as `markSizes` is, so
a change re-renders without rebuilding the mark list. The model's
`rowProportion` is the first span's, undefined without a span, and
`setRowProportion` writes every span's. That is the pair `rowHeightMenuItem`
and `SetRowHeightDialog` already read as optional, so the presets reach every
span and the dialog shows a proportion field only where a span reads it.

This is where Vega-Lite (`"mark": {"type": "rect", "height": {"band": 0.8}}`)
and ggplot2 (`geom_tile(height = 0.8)`) put a band fraction. A span fills that
fraction of whatever band it stands in, a pileup's lane and a facet's row as
much as a row under `rows`, so the setting describes the mark and not the row
axis. On the mark, two spans over the same rows can differ, one thick and one
thin.

**`rowHeight` stays a flat display slot**, on the mark display and the other
three:

- **It is the view's step, not the encoding's.** Vega-Lite writes
  `"height": {"step": 20}` on the view, beside `encoding`, and not on
  `encoding.y` or its scale. Here the view's two numbers are `height`, the
  track's viewport, and `rowHeight`, the step the rows scroll behind it.
  Vega-Lite needs one because its view grows to the steps; this display
  scrolls.
- **`rows` is a channel a settings bag replaces whole.** On the mark,
  quantitative and multi-row feature displays `rows` has a string shorthand,
  and `applyConfSettings` writes such a member whole (`writeConfMember`). A
  session spec or an agent's `applyDisplaySettings` that wrote
  `rows: { step: 20 }` there would erase the field, the order, the labels, the
  tree and the focus. On MAF and the variant displays, whose `rows` has no
  shorthand, the same bag would merge. One spelling would mean two things.
- **`rows` is the arrangement** (ADR-157): what the rows are and how a reader
  ordered, labelled and focused them. **Reset row order** and
  `rowArrangementIsCustom` compare its members, and a pitch is not one of them.
- **The mark display's narrower reach is a behaviour, not a placement.** A
  facet's sections fit because they are as deep as their packing, and the
  slot's description says it pins rows under `rows`.

**The `0` sentinel stays.** Leaving the slot out already fits, which is
Vega-Lite's "no step". Writing `0` is a second spelling of that, and 0 px has
no other reading. `maybeNumber` with unset meaning fit would change what an
author can write by that one spelling.

**MAF and the multi-row feature display keep a display-level `rowProportion`.**
Each draws one glyph family into the band, so the display is its one mark. A
MAF config on the mark display ([maf-on-the-mark-display](../ideas/collections/maf-on-the-mark-display.md)) puts the
proportion on its span, the word unchanged.

## Consequences

- A mark display config that wrote `rowProportion` beside `marks` loses it
  with no report (v5 breaks configs, and only v5 betas wrote it). In-repo, no
  config did.
- The track menu's Normal and Compact presets still pair a height with a
  proportion, and now write it to every span, not to a display slot a bar
  display ignored.
- A mark display of bars or points opens a one-field **Custom...** dialog, as
  the variant displays do.
- `rowHeight`, `setRowHeight`, `setFitToHeight` and the shared menu stay as
  ROW_HEIGHT_AND_FIT.md describes them.

## Rejected alternatives

- **`rows: { field, step, padding }` on every row display.** Replacing the
  arrangement whole on a bag write is the cost above. `padding` would also
  reach every mark, and a bar or point under `rows` is one xyplot per row,
  whose gap is a facet's spacing, drawn by separating the row pitch from the
  band in the value shapes (`rowHeight` is both today) across every backend.
  Nobody asked for that picture, so the shader work has no user yet.
- **`rows.padding` as the span's inset alone.** It would sit on the row axis
  and still be read by spans alone, including spans in a pileup's lanes, where
  `rows` names nothing.
- **Keeping `rowProportion` as a display slot documented "spans only".** The
  display's other one-type settings are on the mark, and a display slot cannot
  give two spans two proportions.
- **`encoding.size` as the span's thickness.** Size is px everywhere else, and a
  fit row's height changes with the track, so a px thickness would not follow
  it the way a fraction does.

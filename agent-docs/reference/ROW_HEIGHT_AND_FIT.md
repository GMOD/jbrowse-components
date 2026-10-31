---
name: row-height-and-fit
description: The two-valued row-height convention every multi-row display implements — the `rowHeight` slot whose `0` means fit, the `effectiveRowHeight` getter that is a cross-plugin ABI, and `RowHeightMixin`. Read before adding a row-height or fit-to-height setting.
kind: spec
---

# Row height and fit-to-display-height

Every multi-row display has a **raw per-row height in px**, where `0` is a
sentinel meaning "fit the rows to the display height", and a **resolved height**
that consumers divide by and draw with.

This page covers the fit sentinel. The annotation track's fit heuristic, where a
gene gives up descriptions, then isoforms, then label room until it fits, is the
fit ladder in
[FEATURE_TRACK_DECISION_TREE](FEATURE_TRACK_DECISION_TREE.md#how-much-fits).

## The convention

`rowHeight` is the raw setting (a **config slot**, `type: 'number'`,
`defaultValue: 0`); `autoRowHeight` is the fit height (rows-viewport ÷ `nrow`);
`effectiveRowHeight` is the resolved px height, never `0`, never `undefined`;
`setFitToHeight()` writes `rowHeight = 0` and `setRowHeight(n)` pins one. The
menu row is `'Squeeze to fit view'`, a radio mutually exclusive with the fixed
presets. Fit is the default everywhere.

**No multi-row display sizes its height from its row count.** The track keeps
its `height` slot, and more rows shrink the rows. A pinned `rowHeight` (the
variant display, the mark display under `rows`) scrolls the rows that do not
fit inside that height rather than growing it.

`rowHeightConfigSchemaFields()` and `RowHeightMixin()`, both in
`packages/tree-sidebar/src/rowHeight/`, are the shared spelling. A display
composes both halves or neither. It owes the mixin `autoRowHeight` and may
override `effectiveRowHeight`. The same directory holds `rowHeightMenuItem(model,
presets)` and the one `SetRowHeightDialog`. `rowProportion` is the optional
second axis: a display that exposes `rowProportion` / `setRowProportion` gets a
second dialog field.

`effectiveRowHeight` is the cross-plugin ABI. `applyRowResizeWheel.ts` (core)
and `TreeDrawingModel` (tree-sidebar `types.ts`) read it by that name off a model
they were handed, so the duck types stay even though the mixin declares the
getter. `wiggle/LinearWiggleDisplay` and `maf/LinearMafDisplay` are always-fit
and expose `effectiveRowHeight` with no `rowHeight`, so neither composes the
mixin or offers the Row height menu. `RowsPanel` gives `shift`+wheel row
resizing only to a model with `setRowHeight`; over MAF the wheel stays the
view's. `marks/LinearMultiRowFeatureDisplay`
is a mark display subtype and takes the mark display's `rowHeight`, pinned only
under `rows`. `alignments/LinearAlignmentsDisplay`'s `rowHeight` is a per-read
pitch, an unrelated concept.

### Always-fit MAF

MAF dropped its pinned `rowHeight` (and the Row height menu, its Normal and
Compact presets, `setFitToHeight` and `shift`+wheel resizing) because a pinned
height was the only way its rows scrolled, and per-track scrolling is the
pattern the app is moving off. A reader wanting taller rows drags the track
taller or focuses a clade. The retired key loads and is dropped (`retired` on
the config schema), so an old config or share link still opens, fitted. The
glyph proportion the presets paired with it stays the
`alignments.mark.height.band` slot. The variant and mark displays keep the
pinned mode for now; if always-fit holds up on MAF they are the next to go,
so the three stay one shape.

### Against `heightMode`

`rowHeight` and the single-lane displays' `heightMode`
(`packages/display-kit/src/heightMode.ts`) answer the same two questions: is
the item's height pinned, and is the track's?

| Track height | Item height pinned           | Item height derived |
| ------------ | ---------------------------- | ------------------- |
| pinned       | `fixed`, or `rowHeight: N`   | `fit`, or `rowHeight: 0` |
| derived      | `grow` (single-lane only)    | none                |

- `mark.height` sizes a glyph in a packed lane, whose row
  pitch follows from it. `rowHeight` sizes a labelled row's band, and the mark
  display sizes its glyph inside that band (`mark.height.band`).
- Single-lane `fit` shrinks glyphs down from `mark.height` and never enlarges
  them, so the mode and the size stay two slots there. Multi-row fit divides
  the plot with no ceiling, so one slot with a `0` sentinel holds both states.
- jbrowse-img's `heightMode:` and `featureHeight:` warn and write nothing on a
  multi-row display; `rowHeight=N` and `height:N` are the writes there.
- Multi-row displays get no `grow`: a multi-row display never sizes its height
  from its row count. If one ever gains `grow`, or a ceiling for fit, the
  sentinel can no longer hold its states and `heightMode` becomes the slot.

### Sub-pixel fit heights are legitimate

Fit mode must not floor at 1px. A cohort with more rows than pixels has a
fractional row height, and flooring it makes the content taller than the height
it was asked to fit, so the track re-grows and fit mode reports a scroll it never
has. The floor belongs only in `effectiveRowHeight`, guarding a **non-positive**
value (consumers divide by it), and in drawing code widening a sub-pixel band
(`rowBand` in plugin-features). Nothing caps or warns about rows past the pixels.
`packages/core/src/util/resolveRowHeight.ts` resolves the sentinel and applies
the floor, called once from `RowHeightMixin`; `RowHeightMixin.test.ts` is the one
set of assertions.

### Drag-resize leaves a fixed height alone

Resizing the track writes `height` and nothing else. In fit mode the rows
restretch; with a fixed `rowHeight` they keep their size and the drag reveals
more of them. Rescaling `rowHeight` by the drag ratio locks content to viewport,
so a taller track could never show an extra row.

The mark display overrides `effectiveRowHeight` because its bands are rows only
under `rows`.


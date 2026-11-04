---
name: row-height-and-fit
description: How does a scrolling row display size its rows? `rows.step` (px or "fit"), the `effectiveRowHeight` getter that is a cross-plugin ABI, and `RowHeightMixin`. Read before adding a row-height or fit-to-height setting.
kind: spec
---

# Row height and fit-to-display-height

Every scrolling row display has a **row height**, `rows.step`: px, or `"fit"` to
fit the rows to the track's height, and a **resolved height** that consumers
divide by and draw with.

This page covers row fit. The annotation track's fit heuristic (a gene gives up
descriptions, then isoforms, then label room) is the fit ladder in
[FEATURE_TRACK_DECISION_TREE](FEATURE_TRACK_DECISION_TREE.md#how-much-fits).

## The convention

- `rows.step` is a config slot on `RowsWithStep`: a number or `"fit"`, default
  `"fit"`; `0` is refused.
- `rowStep` reads it as written, px or `"fit"`: no `0` stands for fit below
  the config. The menu and the Custom dialog read it; a dialog opened in fit
  mode starts empty.
- `autoRowHeight` is the fit height (rows viewport ÷ `nrow`), supplied by each
  display.
- `effectiveRowHeight` is the resolved px height, never `0`, never `undefined`.
- `setFitToHeight()` writes `"fit"`; `setRowHeight(px)` pins one, the slot
  refusing a px at or below 0. Both are the mixin's.
- The menu row is `'Fit to track height'`, a radio exclusive with the fixed
  presets. `heightMode: 'fit'` says the same of a display's bands (ADR-257).

No multi-row display sizes its height from its row count. The track keeps its
`height` slot and more rows shrink the rows. A pinned `rows.step` (the variant
display, the mark display under a rows field) scrolls the rows that do not fit
inside that height.

`RowsWithStep` (`packages/display-kit`) and `RowHeightMixin()`
(`packages/tree-sidebar/src/rowHeight/`) are the shared spelling. A display
composes both halves or neither. It owes the mixin `autoRowHeight` and may
override `effectiveRowHeight`. The same directory holds `rowHeightMenuItem(model,
presets)` and the one `SetRowHeightDialog`. A display that exposes
`rowProportion` / `setRowProportion` gets a second dialog field.

`effectiveRowHeight` is the cross-plugin ABI. `applyRowResizeWheel.ts` (core)
and `TreeDrawingModel` (tree-sidebar `types.ts`) read it by that name off a model
they were handed, so the duck types stay though the mixin declares the getter.

- `wiggle/LinearWiggleDisplay` and `maf/LinearMafDisplay` are always-fit: they
  expose `effectiveRowHeight` with no `rows.step`, compose no mixin and offer no
  Row height menu.
- `RowsPanel` gives `shift`+wheel row resizing only to a model with
  `setRowHeight`; over MAF the wheel stays the view's.
- `marks/LinearMultiRowFeatureDisplay` is a mark display subtype and takes the
  mark display's `rows.step`, pinned only under a rows field.
- `alignments/LinearAlignmentsDisplay`'s `rowHeight` getter is a per-read pitch,
  an unrelated concept.

### Always-fit MAF

MAF has no `rows.step`, no Row height menu and no `shift`+wheel
resizing. A pinned height was the only way its rows scrolled, and per-track
scrolling is the pattern the app is moving off. A reader wanting taller rows
drags the track taller or focuses a clade. The retired key loads and is dropped
(`retired` on the config schema), so an old config or share link opens, fitted.
The glyph proportion stays the `alignments.mark.height.band` slot.

The cost is the rows canvas cap (`MAX_CANVAS_DIM_PX`, 8192 device px, so
4096 CSS px at dpr 2). Bases draw from a 5 px glyph (`MIN_HEIGHT_FOR_TEXT`), a
~6.3 px row at MAF's 0.8 proportion, so a fitted track can show bases on about
650 rows at dpr 2 and 1300 at dpr 1. Every common MAF (the 100-, 241-, 447- and
470-ways, Cactus's 600-way) is under that; a larger one reads its bases through
a clade focus. **The variant display keeps its pinned mode for that reason:** a
cohort of thousands of samples (1000 Genomes is 2504) is common there, and fit
would cap its rows near a pixel, so pinned rows behind the track's scroll are
the only way to read single genotypes. Whether the mark display follows MAF is
open.

### Against `heightMode`

`rows.step` and the single-lane displays' `heightMode`
(`packages/display-kit/src/heightMode.ts`) answer the same two questions: is
the item's height pinned, and is the track's?

| Track height | Item height pinned           | Item height derived |
| ------------ | ---------------------------- | ------------------- |
| pinned       | `fixed`, or `rows.step: N`   | `fit`, or `rows.step: 'fit'` |
| derived      | `grow` (single-lane only)    | none                |

- `mark.height` sizes a glyph in a packed lane, whose row pitch follows from it.
  `rows.step` sizes a labelled row's band, and the mark display sizes its glyph
  inside that band (`mark.height.band`).
- Single-lane `fit` shrinks glyphs down from `mark.height` and never enlarges
  them, so mode and size are two slots there. Multi-row fit divides the plot
  with no ceiling, so one slot, a number or `'fit'`, holds both states.
- jbrowse-img's `heightMode:` and `featureHeight:` warn and write nothing on a
  multi-row display; `rows.step=N` and `height:N` are the writes there.
- Multi-row displays get no `grow`. If one gains `grow`, or a ceiling for fit,
  one slot can no longer hold its states and `heightMode` becomes the slot
  (ADR-257's Rejected table holds that version).

### Sub-pixel fit heights are legitimate

Fit mode must not floor at 1px. A cohort with more rows than pixels has a
fractional row height; flooring it makes the content taller than the height it
was asked to fit, so the track re-grows and fit mode reports a scroll it never
has. The floor belongs only in `effectiveRowHeight`, guarding a **non-positive**
value (consumers divide by it), and in drawing code widening a sub-pixel band
(`drawnRowHeightPx`, `drawnCellHeightPx`). Nothing caps or warns about rows past the
pixels. `packages/core/src/util/resolveRowHeight.ts` resolves `"fit"` (it holds
`FIT_ROWS`, which display-kit re-exports) and applies the floor, called once from `RowHeightMixin`; `RowHeightMixin.test.ts` is
the one set of assertions.

### Drag-resize leaves a fixed height alone

Resizing the track writes `height` and nothing else. In fit mode the rows
restretch; with a fixed `rows.step` they keep their size and the drag reveals
more of them. Rescaling `rows.step` by the drag ratio locks content to viewport,
so a taller track could never show an extra row.

The mark display overrides `effectiveRowHeight` because its bands are rows only
under `rows`.

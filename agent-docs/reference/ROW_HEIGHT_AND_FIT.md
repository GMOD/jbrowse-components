---
name: row-height-and-fit
description: The two-valued row-height convention every multi-row display implements — the `rowHeight` slot whose `0` means fit, the `effectiveRowHeight` getter that is a cross-plugin ABI, and `RowHeightMixin`. Read before adding a row-height or fit-to-height setting.
kind: spec
---

# Row height and fit-to-display-height

Every multi-row display has a **raw per-row height in px**, where `0` is a
sentinel meaning "fit the rows to the display height", and a **resolved height**
that consumers divide by and draw with.

## The convention

`rowHeight` is the raw setting (a **config slot**, `type: 'number'`,
`defaultValue: 0`); `autoRowHeight` is the fit height (rows-viewport ÷ `nrow`);
`effectiveRowHeight` is the resolved px height, never `0`, never `undefined`;
`setFitToHeight()` writes `rowHeight = 0` and `setRowHeight(n)` pins one. The
menu row is `'Squeeze to fit view'`, a radio mutually exclusive with the fixed
presets. Fit is the default everywhere.

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
getter. `wiggle/LinearWiggleDisplay` is always-fit and exposes
`effectiveRowHeight` with no `rowHeight`; `alignments/LinearAlignmentsDisplay`'s
`rowHeight` is a per-read pitch, an unrelated concept.

### Sub-pixel fit heights are legitimate

Fit mode must not floor at 1px. A cohort with more rows than pixels has a
fractional row height, and flooring it makes the content taller than the height
it was asked to fit, so the track re-grows and fit mode reports a scroll it never
has. The floor belongs only in `effectiveRowHeight`, guarding a **non-positive**
value (consumers divide by it), and in drawing code widening a sub-pixel band
(`rowBand` in canvas). Nothing caps or warns about rows past the pixels.
`packages/core/src/util/resolveRowHeight.ts` resolves the sentinel and applies
the floor, called once from `RowHeightMixin`; `RowHeightMixin.test.ts` is the one
set of assertions.

### Drag-resize leaves a fixed height alone

Resizing the track writes `height` and nothing else. In fit mode the rows
restretch; with a fixed `rowHeight` they keep their size and the drag reveals
more of them. Rescaling `rowHeight` by the drag ratio locks content to viewport,
so a taller track could never show an extra row.

**Canvas is the structural exception.** Its `height` getter is derived
(`nrow * effectiveRowHeight`), so a fixed-mode drag has nothing to write but the
row height, and `setHeight` re-fixes it at `newHeight / nrow`. Canvas overrides
`effectiveRowHeight` so the `maxCanvasHeight / nrow` cap lands on the resolved
height, keeping the `resolveRowHeight` call inside the override. The mark display
overrides it because its bands are rows only under `rows`.


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

| role | name | notes |
| --- | --- | --- |
| raw setting, `0` = fit | `rowHeight` | a **config slot**, `type: 'number'`, `defaultValue: 0` |
| the fit height | `autoRowHeight` | rows-viewport ÷ `nrow` |
| resolved px height | `effectiveRowHeight` | what every consumer reads; never `0`, never `undefined` |
| enter fit mode | `setFitToHeight(): void` | writes `rowHeight = 0` |
| pin a height | `setRowHeight(n: number)` | |
| menu row | `'Squeeze to fit view'`, radio | mutually exclusive with the fixed presets |

Fit is the default everywhere. "Pinned" means the user chose a px height.

`rowHeightConfigSchemaFields()` and `RowHeightMixin()`, both in
`packages/tree-sidebar/src/rowHeight/`, are the shared spelling. A display
composes both halves or neither. It owes the mixin `autoRowHeight` and may
override `effectiveRowHeight`. The same directory holds `rowHeightMenuItem(model,
presets)` and the one `SetRowHeightDialog`: a display passes its own preset table
and gets fit, presets and Custom as one radio group. `rowProportion` is the
optional second axis: a display that exposes `rowProportion` /
`setRowProportion` gets a second dialog field, and one that answers `undefined`
or omits it gets one field.

**`sources` is the row list and is a resolved array on every row display**,
never `undefined`. An empty `sources` means "no rows to draw"; "no fetch has
landed" is `sourcesKnown` / `loadedRegions` / `displayPhase`.

`effectiveRowHeight` is the cross-plugin ABI. Two helpers read it by that name:
`packages/core/src/util/applyRowResizeWheel.ts` and `TreeDrawingModel` in
`packages/tree-sidebar/src/types.ts`. Both take a model they were handed, so the
duck types stay even though the mixin declares the getter.

Implementers: `variants/MultiSampleVariantBaseModel` (regular and matrix),
`maf/LinearMafDisplay`, `canvas/LinearMultiRowFeatureDisplay`,
`marks/LinearMarkDisplay`. `wiggle/LinearWiggleDisplay` is always-fit, has no
`rowHeight`, and exposes `effectiveRowHeight`. `alignments/LinearAlignmentsDisplay`'s
`rowHeight` is a per-read pitch, an unrelated concept.

### Sub-pixel fit heights are legitimate

Fit mode must not floor at 1px. A cohort with more rows than pixels has a
fractional row height, and flooring it makes the content taller than the height
it was asked to fit, so the track re-grows and fit mode reports a scroll it never
has. The floor belongs only in `effectiveRowHeight`, guarding a **non-positive**
value (consumers divide by it), and in drawing code widening a sub-pixel band
(`rowBand` in canvas). Nothing caps or warns about rows past the pixels; a dense
stack such as 2,504 samples in 400 px is the picture the reader asked for.

`packages/core/src/util/resolveRowHeight.ts` resolves the sentinel and applies
the non-positive floor, called once from `RowHeightMixin`.
`packages/tree-sidebar/src/rowHeight/RowHeightMixin.test.ts` is the one set of
assertions; the per-display `rowHeightResolution.test.ts` and
`trackHeightFloor.test.ts` cover only some displays, and maf covers neither.

### `setFitToHeight` seeds the height slot only where `height` is derived

maf (`setConf(self, 'height', Math.max(self.height, MIN_DISPLAY_HEIGHT))`) and
canvas (`setConf(self, 'height', self.height)`) re-seed the `height` slot on
entering fit; variants does not. maf and canvas **override the `height` getter**
to a content-derived value, so in fixed mode `self.height` is not what the slot
holds, and skipping the re-seed drops the rows onto a stale value. Variants
leaves `height` to `TrackHeightMixin`, where the getter is the slot.

Ask which `height` the display has, not which neighbour it resembles. That is why
`setFitToHeight` stays per display while `setRowHeight` lives on the mixin.

### Drag-resize leaves a fixed height alone

Resizing the track writes `height` and nothing else. In fit mode the rows
restretch; with a fixed `rowHeight` they keep their size and the drag reveals
more of them. Rescaling `rowHeight` by the drag ratio locks content to viewport,
so a taller track could never show an extra row.

**Canvas is the structural exception.** Its `height` getter is derived
(`nrow * effectiveRowHeight`), so it grows to its content with no viewport/content
split. A fixed-mode drag has nothing to write but the row height, and
`setHeight` re-fixes it at `newHeight / nrow`. Following the rule would mean
giving canvas a scroll viewport. For the same reason canvas overrides
`effectiveRowHeight` so the `maxCanvasHeight / nrow` cap lands on the resolved
height, keeping the `resolveRowHeight` call inside the override.

The mark display overrides `effectiveRowHeight` because its bands are rows only
under `rows`; a facet's rows and the density sidecar's single band resolve to the
fit whatever `rowHeight` holds.

### The rows viewport has a name per display

`autoRowHeight` divides the height available to rows, and each display subtracts
different chrome:

- canvas: `fitTargetHeight`, the `height` config slot
- maf: `rowsHeight`, track height minus the stacked coverage/conservation bands,
  bounded by `maxRowsHeight`
- variants: `availableHeight`, `height - lineZoneHeight`
- marks: `scrollViewportHeight`, the plot box `axisPlotBox(height)` leaves

## `squashToHeight` is a different concept

`hic/LinearHicDisplay` and `variants/LDDisplay` have a **boolean**
`squashToHeight` slot that squashes a triangle vertically to the display height.
No rows are involved. Both use `squashToHeightCheckboxItem` in display-kit's
`TriangleMatrixMixin.ts`. The name differs from `setFitToHeight()` on purpose:
the two once shared a name with different arity and meaning.

## Why a flat slot, not a member of `rows`

`rowHeight` is Vega-Lite's `height: {step}`, a property of the view beside
`height`, not of the row encoding. `rows` is a channel a settings bag replaces
whole on three displays, so a `rows.step` written through a session spec or agent
call would erase the order, labels, tree and focus.
[ADR-194](../architecture-decision-records/adr-194-a-spans-row-proportion-is-the-marks-and-row-height-stays-the-displays.md)
records the call.

## Why one number with a sentinel, not a mode enum

Track height uses a `heightMode` enum (`fixed` / `grow` / `fit`) behind
`HeightModeMixin`; row height uses one number with `0` as fit. An enum would not
remove `effectiveRowHeight` (fit still computes from the rows viewport) or the
`resolveRowHeight` floor (that viewport can be 0px). It would buy a third mode
and one vocabulary for both axes. Not planned; migrating is one mixin and one
fields helper.

## Where the values live

`rowHeight` is a config slot, not a display-instance prop, so a fixed height
survives unticking and reticking the track, like `height` and `lineZoneHeight`.
`plugins/variants/src/shared/rowHeightResolution.test.ts` pins that the value
lands on `configuration.rowHeight` and not in the display snapshot. Read it with
plain `getConf` / `readConfObject`.

`CONFIG_PATTERN.md` lists a fit-to-height sentinel as state for a bespoke prop.
That guidance concerns the **naming** half (a sentinel-bearing value needs a
distinct resolved getter), not avoiding the config node.

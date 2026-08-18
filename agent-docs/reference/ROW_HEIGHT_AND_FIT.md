---
name: row-height-and-fit
description: The shared two-valued row-height convention every multi-row display implements — the `rowHeight` slot whose `0` means fit-to-height, the resolved `effectiveRowHeight` getter that is a cross-plugin ABI, `RowHeightMixin` and the shared menu row and dialog in tree-sidebar, and the two places a display legitimately differs. Read before adding a row-height setting or a fit-to-height mode.
---

# Row height and fit-to-display-height

Every multi-row display has the same two-valued setting: a **raw per-row height
in px**, where `0` is a sentinel meaning "fit the rows to the display height",
and a **resolved height** that consumers divide by and draw with. This file is
the shared spelling, and the two places a display legitimately differs.

## The convention

| role | name | notes |
| --- | --- | --- |
| raw setting, `0` = fit | `rowHeight` | a **config slot**, `type: 'number'`, `defaultValue: 0` |
| the fit height | `autoRowHeight` | rows-viewport ÷ `nrow` |
| resolved px height | `effectiveRowHeight` | what every consumer reads; never `0`, never `undefined` |
| enter fit mode | `setFitToHeight(): void` | writes `rowHeight = 0` |
| pin a height | `setRowHeight(n: number)` | |
| menu row | `'Squeeze to fit view'`, radio | mutually exclusive with the pinned presets |

Fit-to-height is the default everywhere — the slot ships at `0`.

**"Pinned" means the user chose a px height**, and it is the whole opposite of
fit: a pinned row keeps the height it was given when the track is dragged, and
the drag reveals more rows instead of restretching the ones on screen.

The slot and the three members over it are **one mixin**, not a per-display
spelling: `rowHeightConfigSchemaFields()` and `RowHeightMixin()`, both in
`packages/tree-sidebar/src/rowHeight/` beside the menu and dialog that read
them. A display composes both halves or neither. What it still owes the mixin is
`autoRowHeight`; what it may still override is `effectiveRowHeight`, and one
display does (below).

The menu row and the "Custom..." dialog are **shared**, not per display:
`packages/tree-sidebar/src/rowHeight/` holds `rowHeightMenuItem(model, presets)`
and the one `SetRowHeightDialog`. A display passes its own preset table (maf's
Normal is 15px, the multi-row painting's is 14) and gets fit + presets + Custom
as one radio group. `rowProportion` is the optional second axis, and only maf
has it: expose the `rowProportion` / `setRowProportion` pair and the dialog
grows a second field, omit it and the dialog is one field. That optionality is
the whole reason the three copies existed, and the copies had drifted — variants
offered no presets and its dialog seeded from `effectiveRowHeight`, so
"Custom..." in fit mode pinned the computed fractional height on submit.

**`sources` is the row list, and it is a resolved array on every row display** —
never `undefined`, so the count these heights divide is always readable. maf and
the multi-sample variant displays used to answer `T[] | undefined`; nothing
consumed the distinction (every reader collapsed it with `?.length` or `?? []`),
and the two maf consumers that did were asking a different question, which is
now `sourcesKnown`. An empty `sources` therefore means "no rows to draw" and
nothing else — "no fetch has landed" is `sourcesKnown` / `loadedRegions` /
`displayPhase`.

`effectiveRowHeight` is not a style preference, it is the cross-plugin ABI. Two
shared helpers in `packages/` read the resolved value under that name, and every
row display has to satisfy them:

- `packages/core/src/util/applyRowResizeWheel.ts`
- `packages/tree-sidebar/src/types.ts` (`TreeDrawingModel`)

Satisfying them is now structural rather than conventional — the mixin declares
the getter — but the duck types stay, because both take a model they were handed
rather than one they compose.

Displays implementing this: `variants/MultiSampleVariantBaseModel` (both the
regular and matrix multi-sample variant displays), `maf/LinearMafDisplay`,
`canvas/LinearMultiRowFeatureDisplay`. `wiggle/MultiLinearWiggleDisplay` is
always-fit — it has no pinned-height setting and therefore no `rowHeight`
sentinel — but exposes `effectiveRowHeight` under the same name.
`alignments/LinearAlignmentsDisplay`'s `rowHeight` is a per-read pitch, an
unrelated concept; don't treat it as precedent.

### Sub-pixel fit heights are legitimate

Fit mode must not floor at 1px. A cohort with more rows than the display has
pixels has a genuinely fractional row height, and flooring it makes the content
taller than the height it was asked to fit inside — which re-grows the track and
makes fit mode report a scroll it is documented never to have. The floor belongs
in two other places only: `effectiveRowHeight` guarding against a **non-positive**
value (consumers divide by it), and the drawing code widening a sub-pixel band
(`rowBand` in canvas) without changing how many rows fit.

Both halves of that — resolving the `0` sentinel and flooring only a
non-positive result — are `packages/core/src/util/resolveRowHeight.ts`, called
once from `RowHeightMixin`. Each display used to spell it out individually and
canvas's copy had lost the floor, which is exactly the drift a
two-rules-pulling-opposite-ways invariant invites.

Per-display coverage of those two rules was uneven, measured by sabotage: drop
the floor and only the multi-sample variants' `rowHeightResolution.test.ts`
fails; floor the sub-pixel case as well and that one plus canvas's
`trackHeightFloor.test.ts` fail. maf pinned neither.
`packages/tree-sidebar/src/rowHeight/RowHeightMixin.test.ts` is where one
implementation gets one set of assertions.

### `setFitToHeight` seeds the height slot only where `height` is derived

maf and canvas open `setFitToHeight` with
`setConf(self, 'height', Math.max(self.height, MIN_DISPLAY_HEIGHT))`; variants
does not, and that asymmetry is required rather than left over. Both of the
first two **override the `height` getter** to a content-derived value (maf's
`totalHeight`, canvas's `nrow * effectiveRowHeight`), so in fixed mode
`self.height` is not what the `height` slot holds — entering fit mode without
re-seeding drops the rows back onto a stale slot value and the track jumps.
Variants leaves `height` to `TrackHeightMixin`, where the getter *is* the slot,
so the same line would write it back to itself.

**So the question to ask before copying either version is which `height` the
display has**, not which neighbour it resembles. That is why `setFitToHeight`
stays per display while `setRowHeight` moved onto the mixin — the two look like
a pair and only one of them is display-independent.

### Drag-resize leaves a pinned height alone

Resizing the track writes `height` and nothing else. In fit mode the rows
restretch to the new height; with a pinned `rowHeight` the rows keep the size
the user pinned and the drag reveals more of them. Scaling the pin by the same
ratio instead keeps content and viewport locked together, so dragging a track
taller cannot show one extra row — that was maf's bug before it stopped
rescaling, and variants' before this convention landed.

**Canvas is the exception, for a structural reason.** Its `height` getter is
derived (`nrow * effectiveRowHeight`): the display grows to its content instead
of scrolling a fixed viewport, so there is no viewport/content split for a drag
to change the ratio of. A fixed-mode drag there has nothing to write but the row
height, and `setHeight` re-pins `newHeight / nrow` deliberately. Adopting the
rule above would mean giving canvas a scroll viewport, which is a different
change.

The same structure is why canvas is the one display overriding
`RowHeightMixin`'s `effectiveRowHeight`: nothing downstream bounds a stack that
sizes its own canvas, so the `maxCanvasHeight / nrow` cap has to land on the
resolved row height. The mixin's `resolveRowHeight` call stays inside the
override.

### The rows viewport has three names

`autoRowHeight` divides the height actually available to rows, and each display
subtracts different chrome to get it:

- canvas — `fitTargetHeight`, the `height` config slot; no bands to subtract
- maf — `rowsHeight`, the track height minus the stacked coverage/conservation
  bands, bounded by `maxRowsHeight`
- variants — `availableHeight`, `height - lineZoneHeight` (the matrix display's
  connector zone)

These are genuinely different quantities, so they keep separate names, and
`autoRowHeight` is exactly the member each display still owes the mixin.

## `squashToHeight` is a different concept

The triangular contact-matrix displays — `hic/LinearHicDisplay` and
`variants/LDDisplay` — have a **boolean** `squashToHeight` config slot meaning
"squash the triangle vertically to fill the display height". There are no rows
involved, so it shares nothing with the row-height machinery above but the
user-facing idea. Both go through one menu helper,
`linear-genome-view/…/squashToHeightMenuItem.ts`, labelled `'Fit to display
height'`.

It is named for the squash rather than the fit so that `setSquashToHeight(bool)`
can't be confused with the row displays' `setFitToHeight()` — those were both
called `setFitToHeight` at one point, same name, different arity, different
concept.

## Why one number with a sentinel, and not a mode enum

The repo spells this same fixed-versus-fit choice two ways. Track height uses a
`heightMode` enum (`fixed` / `grow` / `fit`) plus a separate height, behind
`HeightModeMixin`. Row height uses one number where `0` is the fit sentinel.

The sentinel is the older of the two — it lands in `56bc6ad7a0` (2026-06-28),
the `heightMode` enum in `b51403f9f0` (2026-07-08) — and it is what is in
shipped configs and saved sessions, so replacing it is a migration rather than a
rename. It also
buys less than it looks like: an enum removes the sentinel but not
`effectiveRowHeight`, because fit mode still has to compute a height from the
rows viewport, and the `resolveRowHeight` floor still has to exist for the case
where that viewport is 0px. What the enum would genuinely buy is a third mode —
canvas's grow-to-content behaviour is a mode today only in the sense that its
`height` getter is derived — and one vocabulary for both axes.

**Not currently planned.** If it is taken up, it is one mixin and one fields
helper to migrate, which it was not before this convention was consolidated.

## Where the values live

`rowHeight` is a config slot, not a display-instance MST prop, for the same
reason `height` and `lineZoneHeight` are: the config node outlives the display
instance, so a pinned height survives unticking and reticking the track.
Pinned by a test in `plugins/variants/src/shared/rowHeightResolution.test.ts`
asserting the value lands on `configuration.rowHeight` and not in the display
snapshot.

Read it with plain `getConf` / `readConfObject` — this slot is deliberately not
promotable. Session-wide promotion is a separate decision from where the value
lives, and nothing needs it today.

Note that `agent-docs/reference/CONFIG_PATTERN.md` lists a fit-to-height
sentinel as an example of state belonging on a bespoke MST prop. That guidance
is about the **naming** half — a sentinel-bearing value needs a distinct
resolved getter — not about avoiding the config node. A sentinel is a fact about
the value, and sits on a slot perfectly well.

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

`effectiveRowHeight` is not a style preference, it is the cross-plugin ABI. Two
shared helpers in `packages/` read the resolved value under that name, and every
row display has to satisfy them:

- `packages/core/src/util/applyRowResizeWheel.ts`
- `packages/tree-sidebar/src/types.ts` (`TreeDrawingModel`)

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
non-positive result — are `packages/core/src/util/resolveRowHeight.ts`, which
maf, variants and canvas each call from their `effectiveRowHeight`. They used to
spell it out individually and canvas's copy had lost the floor, which is exactly
the drift a two-rules-pulling-opposite-ways invariant invites.

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

### The rows viewport has three names

`autoRowHeight` divides the height actually available to rows, and each display
subtracts different chrome to get it:

- canvas — `fitTargetHeight`, the `height` config slot; no bands to subtract
- maf — `rowsHeight`, the track height minus the stacked coverage/conservation
  bands, bounded by `maxRowsHeight`
- variants — `availableHeight`, `height - lineZoneHeight` (the matrix display's
  connector zone)

These are genuinely different quantities, so they keep separate names; only the
`autoRowHeight` / `effectiveRowHeight` pair derived from them is shared.

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

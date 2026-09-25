---
status: Accepted
summary: "The quantitative display's six colour spellings — `color`, `posColor`, `negColor`, `useBicolor`, `bicolorPivot`, `densityColorRamp` and the `colorImpliesSolid` preprocessor that inferred one from another — become one `color` object, declared through display-kit's `colorChannelSlots` + `colorPaletteSlot` + `colorRampSlot` the way `markColorSchema` is: a CSS string, or a field through `none | categorical | linear | log | threshold`. `score` through `threshold` is the bicolor plot and through `linear`/`log` the density ramp; `source` through `categorical` is a palette entry per subtrack. `bicolorPivot` becomes `origin`, the mark display's slot with the mark display's meaning, and `domainMid` is new on the shared ramp slot. The layout's default lives in a resolved getter, `effectiveColor`, not in a `defaultValue` that cannot move with a layout. `ChannelSpecDialog` replaces the display's own colour dialog, and the channel spec carries the whole object. No migration. ADR-151 spells `palette` and `ramp` as `range` and `scheme`, from `colorRangeSlot` and `colorRampSlots`"
---

# ADR-144: One colour object on the quantitative display

## Status

Accepted (2026-09-19). Follows [ADR-142](adr-142-one-value-scale-object.md) and
[ADR-143](adr-143-one-quantitative-display-and-facet-is-the-layout.md). Applies
[ADR-135](adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md)'s
shared colour shape to the display that had not taken it, and finishes
superseding [ADR-016](adr-016-bicolorpivot-stays-in-worker.md).
[plugins/wiggle/src/CLAUDE.md](../../plugins/wiggle/src/CLAUDE.md) is the
operational doc. Amended 2026-09-25: `domainMid` keeps both sides of the middle
on one scale, the farther end of the domain reaching its end stop, as the white
fade already did and as ggplot2's `scale_fill_gradient2` does, where it had
stretched each side to its own end; core's `buildColorRampLut` and the shader's
`densityRampT` share the rule.
[ADR-151](adr-151-a-channels-scale-is-spelt-as-scales-y-spells-one.md)
supersedes the `palette` and `ramp` members this record declares, which it
spells `range` and `scheme`, and the `colorPaletteSlot` and `colorRampSlot`
pieces, which are `colorRangeSlot` and `colorRampSlots`; the wiggle's colour
object and its layout default stand.

## Context

Every other display spells colour as one object: a string, or
`{ field, scale, domain, palette | ramp }`. The quantitative display spelled
it six ways.

`posColor` and `negColor` were the two sides of a cut. `bicolorPivot` was
where the cut sat — and also where the bars grew from, which is a different
idea wearing the same slot. `useBicolor` switched the pair off in favour of
`color`, a seventh slot the density rendering then ignored, always drawing
from `posColor`. `densityColorRamp` was a wiggle-only enum of two members
beside a `ramp` slot every other display already had. And
`colorImpliesSolid`, a `preProcessSnapshot`, inferred `useBicolor: false`
from a bare `color`, because a config naming one colour and nothing else
otherwise rendered in the pair and silently ignored what it named.

A wiggle is a mark whose colour is a function of its score, and the grammar
already had the words for that. What it lacked was a `threshold` scale, which
package B1 added to `COLOR_SCALES`, and a main-thread sign split, which B1
moved off the worker so no colour setting is a fetch key.

## Decision

**`color` is the one colour setting**, declared as `WiggleColor` through
`colorChannelSlots({ scales: COLOR_SCALES, … })` + ~~`colorPaletteSlot` +
`colorRampSlot`~~ (`colorDomainSlot`, `colorRangeSlot` and `colorRampSlots`
since ADR-151) + `colorChannelOptions('color')`, with `value` a `maybeColor`
so "nothing written" is a state the display can read.

| the picture                       | the object                                                            |
| --------------------------------- | --------------------------------------------------------------------- |
| bicolor xyplot, line, scatter     | ~~`{ field: 'score', scale: 'threshold', domain: [], palette: [neg, pos] }`~~ `{ field: 'score', scale: 'threshold', domain: [], range: [neg, pos] }` (ADR-151) |
| one solid colour                  | `'#…'`, a string                                                      |
| density, the white-centred fade   | the same threshold pair, which density reads as its two fade ends      |
| density, a named or stopped ramp  | ~~`{ field: 'score', scale: 'linear', ramp: ['viridis'] }`~~ `{ field: 'score', scale: 'linear', scheme: 'viridis' }` (ADR-151) |
| a colour per source               | `{ field: 'source', scale: 'categorical' }`                           |

An empty threshold `domain` cuts at the `origin`. ~~A ramp with no
`domainMid` fades from it.~~ A ramp with no `domainMid` runs straight across
the y domain, and one with no `range` or `scheme` is viridis, as every other
display's ramp is; ~~a one-colour `range` is the white-centred fade~~ a
one-colour `range` runs from white to that colour, so no ramp reads `origin`.

**`bicolorPivot` becomes `origin`**, a `number` defaulting to 0, the mark
display's slot with the mark display's doc sentence: the value bars grow from,
and what a colour scale reads where its own domain says nothing. One word for
one idea, across the two displays that have it.

**`domainMid` is new on ~~`colorRampSlot`~~ `colorRampSlots` (ADR-151)**
(`maybeNumber`, Vega-Lite's name): the value the ramp's middle stop sits at.
`buildColorRampLut` bakes the warp into the table rather than warping per read,
so the shader, the Canvas2D fillStyle table and the legend bar all sample one
evenly spaced LUT and cannot disagree about it. The mark display gets a
diverging ramp on any mark out of the same slot.

**`effectiveColor` is where the layout decides.** Several sources in one plot
box default to `{ field: 'source' }`, because overlaid plots need a colour each
to be told apart; a row per source, and a lone plot in the box, default to the
threshold pair. That is a resolved getter and not a `defaultValue`, because a
slot default cannot move with the layout. `sourcesLogic.ts`'s three-mode
`RowColorMode` table is what it replaces: `perSource` is the question that
table was asking, and `labelColor` stays the sidebar's identity channel under
density, which is the one rule in it that was not about the facet.

**The encode reads the resolved object, and nothing crosses the wire.**
`resolveWiggleColor` answers `{ posColor, negColor, pivot, rampLut, perSource }`
— the pair `makeSummaryLayers` and `bandColorsAbgr` already partition by, the
value they part at, the density LUT, and whether a source paints its own colour
on both sides. `WiggleGpuProps` carries that object in place of
`posColor`/`negColor`/`bicolorPivot`, and the render state carries the resolved
LUT bytes in place of a ramp name.

**`ChannelSpecDialog` is the colour UI.** The display's own dialog described a
radio and a pivot field that no longer exist; `Edit color...` now opens the
shared JSON box on the same object a config file holds, so a colour a session
spec can carry is a colour the dialog can write. `ChannelSpec` and `parseColor`
carry `scale`, ~~`ramp`~~ `scheme` and `domainMid` alongside `field`, `domain`
and ~~`palette`~~ `range` (ADR-151), and hold a spec to the display's own
`scale` enum (`colorScaleChoicesOf`, off the slot) rather than to FeatureColor's
five members. The tree-sidebar per-row dialog stays where it was: it edits
adapter row metadata under the facet, not the channel.

**The key follows the scale**: the ramp for `linear`/`log` on bars, points and
density, a row per source for `categorical`, a row per interval for a
`threshold` whose cut the config declared, and none for a string. A line under
`linear`/`log` still parts in the ramp's two end colours, so it draws no ramp
and the display says so in its corner notice.

## Consequences

- `posColor`, `negColor`, `useBicolor`, `bicolorPivot` and `densityColorRamp`
  stop loading, in a config, a session or an `applyDisplaySettings` bag. No
  migration: v5 breaks compat. `setPosColor`, `setNegColor`, `setUseBicolor`
  and `setBicolorPivot` are `setColor` and `setOrigin`.
- `colorImpliesSolid.ts` and its test are deleted. A string is solid by
  construction, so there is nothing left to infer.
- jbrowse-img's `color:` writes the constant directly, and its `useBicolor`
  JSON escape hatch goes with the slot. `--autoscale`/`--minmax`/`--scaletype`
  are untouched.
- gccontent extends the quantitative display's schema, so `color` and `origin`
  arrive with it and its two displays lose five slots from their config pages.
- A threshold with a declared cut now draws a key that was not there before.
  One cutting at the origin does not, because the axis already shows where the
  origin is, and neither does density, where the ramp is the key.
- A CSS-stop ramp is a new capability on the density rendering: the stops build
  a LUT the same way a named ramp does, so a track can fade through colours the
  inline white→colour lerp cannot express. The default stays that lerp, which
  is what a per-row colour needs and one LUT cannot encode.
- The colour a wiggle draws is still no fetch key. B1 moved the sign split to
  the main thread; this package only changes where the two colours come from.

## Rejected alternatives

- **Keeping `posColor`/`negColor` as named slots beside the object.** Two
  spellings for one setting is the defect, and the pair is a two-entry
  `palette` under a threshold scale — the same thing Manhattan's LD bins are,
  and the same thing the mark display already writes.
- **A `bicolor` boolean.** `useBicolor` under a new name. Whether the colour is
  a scale or a constant is what a scale of `none` says on every other display,
  and a boolean cannot also say `categorical`.
- **`bicolorPivot` inside the colour object.** It is also the value the bars
  grow from, which no colour setting decides. It is the plot's `origin`, and
  the colour reads it where its own domain is empty.
- **A wiggle-only `densityColorRamp` enum beside `ramp`.** Two members, one of
  which meant "no ramp". `ramp: ['viridis']` says it with the slot every other
  display's ramp uses, and an empty `ramp` is the fade.
- **Refusing a threshold `domain` longer than one cut.** ~~The encoder
  partitions into two sides, so a second cut point is not painted.~~ Every cut
  paints now, up to eight, each band in its own `range` colour, on the bars,
  lines, whiskers band and key alike
  ([ADR-153](adr-153-every-display-resolves-its-colour-through-one-function.md)).

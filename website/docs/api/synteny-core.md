---
id: synteny-core
title: "@jbrowse/synteny-core"
description: "Shared utilities for synteny and dotplot rendering"
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## assignTrackColors

Map each overlaid track to the color it draws in under the `track` field.

Two passes so an automatic slot never duplicates a color the user pinned by
hand: pass one reserves every explicit color, pass two hands each remaining
track the next palette entry that isn't reserved. Past the end of the palette
it wraps rather than falling back to a hash — a hashed color collides ~20% of
the time at four tracks, and distinguishability is the whole point.

Positional, so colors reshuffle when tracks are added, hidden, or reordered.
That is intended: this is a within-view distinguishability aid, not a stable
identity. Anything worth keeping gets pinned.

```js
// type signature
(tracks: readonly PalettableTrack[]) => Map<string, string>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/trackColors.ts)

## attributeOf

The per-feature attribute a field reads: `mapq` is the comparative
adapters' `mappingQual`, which they omit for MAPQ 255, so it paints and
keys as no value; any other field uses its name.

```js
// type signature
(field: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorRamps.ts)

## BAND_GROUND_COLOR

The color a comparative band is painted on, for every surface that has to
agree about it: the two backends' clear, the pre-blended indel wedges, every
mark, tick, label halo and outline (`getContrastText` of it), the legend
chips and the SVG export.

Light in every theme. The ribbons are translucent color that reads as tint
over a light ground and as murk over a dark one, so a dark theme's paper made
a whole-genome band nearly unreadable. The band is the one sheet in the app
with a fixed light ground. The dotplot's plot area is the same sheet, since
it paints the same color schemes, whose default is black.

```js
// type signature
"#fff"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/bandGround.ts)

## bandInk

The inks a band draws in, from the band's ground rather than the page theme, at
the light theme's weights: a dark theme's text and dividers are white and
vanish on the band.

```js
// type signature
() => { text: string; divider: string; gridline: string; stripe: string; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/bandGround.ts)

## bandPalette

The light palette, whose paper is `BAND_GROUND_COLOR`. Chrome on the band
with a palette token, such as the dotplot's gridlines and region boundaries,
takes it from this palette and so matches the light theme in either mode.

```js
// type signature
JBrowsePalette
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/bandGround.ts)

## blendOverGround

Composite a CSS color over `ground` by `a`, returning an opaque `rgb(...)`.
The synteny canvas draws every ribbon at the view's global alpha over the
band's ground (shadeFill in syntenyTypes.slang / resolveInstanceFill in the
Canvas2D renderer), so a full-saturation legend swatch reads wrong — a red
match ribbon shows as salmon over a white band, a blue deletion as pale blue.
Blend the legend chip the same way, over the ground the renderers cleared to
rather than an assumed white, so the key matches what is on screen.

```js
// type signature
(color: string, a: number, ground: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## carriedSyntenySettings

What a view holding `SyntenyColorsMixin` hands the view it opens on the same
alignments: the `encoding.color` it paints by, which a view on its default
scheme leaves to the new view's default, the pinned track colors and the
`filter`. `encoding.opacity` keeps each view's default, since a linear
ribbon, a dotplot point and a circle's ribbon draw at different densities.

```js
// type signature
(view: SyntenyColorsModel) => { trackColors: IKeyValueMap<string>; filter: ModelSnapshotType<Record<string, any>>[]; encoding?: { color: ModelSnapshotType<Record<string, any>>; } | undefined; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyColorsMixin.ts)

## colorByMenuItems

The color-by menu shared by the dotplot and linear-synteny palette buttons
and the multi-way synteny track's Color by: the structural modes the
surface paints, the measurements one hop in, the text-column rows while one
is painting, and the per-track swatches once more than one track overlays.

```js
// type signature
(target: ColorByMenuTarget) => MenuItem[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuItems.tsx)

## colorByMenuTargetFor

Project a view with `TrackColorsMixin` onto the menu builder's input.
`track` is offered once two tracks overlay, and `reference` where the view
has a reference to anchor on.

```js
// type signature
(model: TrackColorsModel) => ColorByMenuTarget
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuTarget.ts)

## colorByScales

The active mode's key as color scales — what a view's `colorScales` lists,
and so what `ChromeLegend` and `SvgLegend` draw. A ramp takes its end
labels (identity's `0%` and `100%`, dN/dS's `≥2`) from `format`, and a
no-value row follows it once a row has no value; chips are blended
over the band's ground by the view's alpha, so the key matches the
on-screen composited ribbon colors, subject to `legendChipColor`'s
legibility floor; a mode with no fixed key (a color per sequence name) is a
note row saying so. A threshold keys its bins as chips. `title` is
`legend.title` as written: unset keeps the field's own heading, `''` draws
none.

```js
// type signature
(field: string | undefined, { alpha, title, ...opts }?: { pointBased?: boolean | undefined; cigarOps?: number | undefined; trackChips?: ColorChip[] | undefined; attributeRanges?: Record<string, AttributeRange> | undefined; hideUnlabelled?: boolean | undefined; missingColor?: string | undefined; names?: readonly string[] | undefined; descending?: boolean | undefined; paint?: SyntenyColorPaint | undefined; } & { alpha?: number | undefined; title?: string | undefined; }) => ColorScale[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorLegend.ts)

## ColorBySelector

The palette button both comparative headers render, over the view's
`TrackColorsMixin`: what the view draws and whether it has a reference to
anchor on are the view's own hooks, so the button takes nothing else.

```js
// type signature
({ model, }: { model: TrackColorsModel; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/ColorBySelector.tsx)

## colorByShortLabel

Short human-readable title for the floating legend header: a measurement's
preset title, and a column's own name, which is the point of it — the
reader named it.

```js
// type signature
(field: string | undefined) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorLegend.ts)

## ComparativeTrackModel

The slice of a track model a comparative view reads off its track list.

Annotated at every site that walks a synteny view's `levels[].tracks` or a
dotplot's `tracks`, because those arrays type out as `any`: the level model is
deliberately `IAnyModelType` to break a real type cycle, and `any` propagates
through the array and switches off checking on everything read from it. The
`any` let `getConf(t.configuration, ...)` compile where getConf wants the
MODEL, and the call threw at runtime reading
`configuration.configuration.adapter`. With this interface the compiler checks
those calls again.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/lodTier.ts)

## createOpacityFunction

Each feature's fade, 0 to 1, as a share of `opacityLevel`; undefined while
`encoding.opacity` draws its constant. A feature with no value for the field draws
at the level.

`viewRanges` is the domain a number column fades across, the view's
accumulated one as the color ramp's is, and `fetchRanges` the fetch's own,
whose label lists a text column's values index.

```js
// type signature
({ setting, attributes, viewRanges, fetchRanges }: { setting: SyntenyOpacitySnapshot; attributes: Record<string, Float32Array>; viewRanges: Record<string, AttributeRange>; fetchRanges: Record<string, AttributeRange>; }) => ((index: number) => number) | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/opacityChannel.ts)

## featureColorInputs

The lanes `createComparativeColorFunction` reads, built from features a
display holds on the main thread rather than from a worker's payload. `ends`
answers a feature's two refNames in the order the color modes read them:
`query` paints by the first and `target` by the second.

```js
// type signature
(features: readonly Feature[], ends: (feature: Feature, i: number) => readonly [string, string], channelNames: readonly string[]) => ColorFunctionInputs
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/featureColorInputs.ts)

## identityFadeMenuItem

The Identity fade toggle of a view with `SyntenyViewMixin`: `opacity`
read from `identity`, or back to the constant.

```js
// type signature
(model: { opacityField: string | undefined; setOpacityField: (field: string | undefined) => void; }) => MenuItem
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/settingsMenuItems.ts)

## isMeasureField

Whether `field` is a preset measurement. An own-property lookup: a field
spelled `toString` is a column nobody declared, not `Object`'s method.

```js
// type signature
(field: string | undefined) => field is "dnds" | "identity" | "mapq" | "syntenicDepth"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorRamps.ts)

## LEGEND_CHIP_ALPHA_FLOOR

The alpha a legend chip is blended at however faint the ribbons are.

Matching the chip to the composited ribbon is right down to a point and then
inverts: the linear-synteny default alpha is 0.25, and at that value every
chip washes to within a few percent of white, so a key meant to say "blue is
this track, orange is that one" identifies nothing. Below the floor the chip
gives up exactness for the one job it has. The ribbons themselves still draw
at the real alpha.

```js
// type signature
0.45
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## legendChipColor

blendOverGround for a legend chip, floored at
LEGEND_CHIP_ALPHA_FLOOR.

```js
// type signature
(color: string, alpha: number, ground: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## LIFTED_DISPLAY_KEYS

The display keys `liftSyntenyViewSettings` moves onto the view, by display
type, for a validator reading a v4.3.0 session.

```js
// type signature
Record<string, readonly string[]>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/liftSyntenyViewSettings.ts)

## LIFTED_VIEW_KEYS

The view keys `liftSyntenyViewSettings` converts, which the linear synteny
and dotplot views name as their launch keys' `passThrough` so a validator
accepts them.

```js
// type signature
readonly ["colorBy", "alpha", "color", "cigarMode", "drawCigar"]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/liftSyntenyViewSettings.ts)

## liftSyntenyViewSettings

A linear synteny or dotplot view snapshot's v4.3.0 settings, lifted onto the
view: `colorBy` (a mode string), `alpha` and `minAlignmentLength` sat on each
synteny display, and land as `encoding.color`, `encoding.opacity` and a
`filter` predicate on `length`.
An older genomes-portal launch link puts the mode string on the view
itself, which lifts the same way, and a jb2hubs desktop link writes the
view's `color`, which lands as `encoding.color`. The view's own
`cigarMode` and `drawCigar` land as the `indels` part.

```js
// type signature
(snap: Snap | undefined) => Snap | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/liftSyntenyViewSettings.ts)

## minIdentityMenuItem

The Min identity row of a view with `SyntenyFilterMixin`: the `filter`'s
lower bound on `identity`. A filter on identity drops an alignment that
reports none, so the row is disabled while no loaded alignment reports one.

```js
// type signature
(model: FilterRowModel & { attributeRanges: Record<string, unknown>; }) => MenuItem
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/settingsMenuItems.ts)

## minLengthMenuItem

The Min length row of a view with `SyntenyFilterMixin`: the `filter`'s
lower bound on `length`.

```js
// type signature
(model: FilterRowModel) => MenuItem
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/settingsMenuItems.ts)

## nameColorCss

One name's chromosome-painting color, resolved against an assembly's refName
list and handed back as CSS — what a Canvas2D overlay needs, where the
renderers want packed ABGR.

The single-name form of the LUT above, because a second reader has turned up
that is not painting features: the off-screen mate marks stand for alignments
to a contig the facing row is not showing, and a mark colored like the ribbons
to that contig shows that a ribbon moved rather than vanished. Two palettes
would color a mark and its ribbons differently, which this module prevents;
see the header.

```js
// type signature
(refName: string, namePosition: RefNamePosition | undefined) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorFunctions.ts)

## opacityFadeOf

The part of `encoding.opacity` the color pass reads: undefined for the
constant, else the mapping with `scale.range` as shares of its most opaque entry, so a
mapping scaled alike at both ends answers the same.

```js
// type signature
(setting: SyntenyOpacitySnapshot) => SyntenyOpacitySnapshot | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/opacityChannel.ts)

## opacityLevel

The opacity every alignment is drawn at before the fade: the constant,
`defaultValue` while it is unset, or under a field the most opaque value
its range reaches.

```js
// type signature
(setting: SyntenyOpacitySnapshot, defaultValue: number, ranges?: Record<string, AttributeRange> | undefined) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/opacityChannel.ts)

## opacityMenuItem

The Opacity row of a view with `SyntenyViewMixin`, reset to that view's
default. Under a field it moves the field's most opaque end.

```js
// type signature
(model: { opacityLevel: number; defaultOpacity: number; setOpacity: (value: number) => void; colorSurface: () => SyntenyColorSurface; }) => MenuItem
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/settingsMenuItems.ts)

## opacityRangeAt

`scale.range` rescaled so the mapping's most opaque end equals `value`,
keeping each entry's share of it. A threshold or a text column with no
range written draws every bin at the level, so it gets one `value` per bin
rather than the number column's default fade.

```js
// type signature
(setting: SyntenyOpacitySnapshot, value: number, ranges?: Record<string, AttributeRange> | undefined) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/opacityChannel.ts)

## paintedField

The field a synteny color channel paints by, or undefined while it names
none. Read through the one resolver every display's color channel goes
through.

```js
// type signature
({ value, scale, field, }: SyntenyColorSnapshot) => string | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyColorBy.ts)

## paintRange

The colors an ordinal paint deals in domain order: its `range`, else its
`scheme`, reversed under `reverse`, sampled once per domain value.

```js
// type signature
({ domain, range, scheme, reverse, }: SyntenyColorPaint) => readonly string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorRamps.ts)

## refNamePositionFor

The `RefNamePosition` a chromosome-painting field hands its palette out by:
`query` reads the first of the alignment's two assemblies, `target` the
second. Undefined for any other field, and while that assembly loads.

```js
// type signature
(field: string | undefined, [queryAssembly, targetAssembly]: readonly (string | undefined)[], assemblyManager: { get: (name: string) => { getRefNamePosition: RefNamePosition; } | undefined; }) => RefNamePosition | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorFunctions.ts)

## reorderChromosomesMenuItem

The Re-order chromosomes row every comparative view offers; `open` queues
that view's own dialog.

```js
// type signature
(open: () => void) => MenuItem
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/settingsMenuItems.ts)

## resolveNumericMode

How a numeric field paints under `paint`: a preset measurement through its
preset, and a column a track declares on a viridis ramp over the span seen,
labelled with the actual numbers, the honest reading when nothing declares
what the column's range is supposed to be. A written `scale.type` names a ramp
or a threshold's bins either way. Undefined for the constant, a structural
field and a text column.

```js
// type signature
(field: string | undefined, ranges?: Record<string, AttributeRange>, paint?: SyntenyColorPaint) => NumericMode | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorRamps.ts)

## strandLevels

Each strand's color under `paint`, forward then reverse: the universal
strand preset's, or `range`'s in `domain` order where the channel writes
them, and the name `names` gives it, if any.

```js
// type signature
({ domain, range }: SyntenyColorPaint, names?: readonly string[]) => { value: "-1" | "1"; color: string; label: string | undefined; }[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorRamps.ts)

## SYNTENY_FIELD_PRESETS

The fields every comparative view paints through a preset: core's
measurements, so `identity` and `mapq` paint here as they do on the MAF and
alignments displays.

```js
// type signature
{ readonly mapq: {…}; readonly identity: {…}; readonly dnds: { readonly scale: {…}; readonly legend: { readonly title: "dN/dS"; }; }; readonly syntenicDepth: { readonly scale: { readonly type: "threshold"; readonly domain: readonly ["2", "3"]; readonly range: readonly ["#bdbdbd", "#fdae6b", "#e6550d"]; readonly names: readonly ["One-to-one", "Shared by 2 genes", "Shared by 3 or more"]; }; readonly legend: { readonly title: "Syntenic depth"; }; }; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorRamps.ts)

## syntenyColorFor

The color channel that paints by `field`, written over `current`, undefined
clearing the field: display-kit's `colorForField`, the rule every display's
Color by pick writes by.

```js
// type signature
(field: string | undefined, current: SyntenyColorSnapshot) => ColorSlots
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyColorBy.ts)

## trackSubMenuItem

One track's menu as a submenu named for the track: the session's track
actions (About track, Settings) beside the track's own items; the menu orders
them by priority. A linear view attaches this to the track label; a view that draws no label
puts it in the view's menu. `view` is whatever shows and launches the track.

```js
// type signature
(view: TrackActionView & IAnyStateTreeNode, track: MenuTrack) => MenuItem
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/trackSubMenuItem.ts)

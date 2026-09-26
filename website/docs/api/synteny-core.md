---
id: synteny-core
title: synteny-core
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

## BAND_GROUND_COLOR

The colour a comparative band is painted on, for every surface that has to
agree about it: the two backends' clear, the pre-blended indel wedges, every
mark, tick, label halo and outline (`getContrastText` of it), the legend
chips and the SVG export.

Light in every theme. The ribbons are translucent colour that reads as tint
over a light ground and as murk over a dark one, so a dark theme's paper made
a whole-genome band nearly unreadable. The band is the one sheet in the app
that keeps its own ground. The dotplot's plot area is the same sheet, since
it paints the same colour schemes, whose default is black.

```js
// type signature
"#fff"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/bandGround.ts)

## bandInk

The inks a band draws in, off its own ground rather than the page theme, at
the light theme's weights: a dark theme's text and dividers are white and
vanish on the band.

```js
// type signature
() => { text: string; divider: string; gridline: string; stripe: string; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/bandGround.ts)

## bandPalette

The light palette, whose paper is `BAND_GROUND_COLOR`. Chrome on the band
that has a palette token of its own, such as the dotplot's gridlines and
region boundaries, reads it here and so matches the light theme in either
mode.

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
Blending the legend chip the same way keeps the key matched to what's actually
on screen, which means blending it over the SAME ground the renderers cleared
to rather than over an assumed white.

```js
// type signature
(color: string, a: number, ground: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## carriedSyntenySettings

What a view holding `SyntenyColorsMixin` hands the view it opens on the same
alignments: the colour object, the pinned track colours, the unlabelled
filter and the length filter. Opacity stays each view's own default, since a
linear ribbon, a dotplot point and a circle's ribbon draw at densities of
their own.

```js
// type signature
(view: SyntenyColorsModel) => { color: ModelSnapshotType<Record<string, any>>; trackColors: IKeyValueMap<string>; hideUnlabelled: boolean; minAlignmentLength: number; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyColorsMixin.ts)

## colorByMenuItems

The color-by menu shared by the dotplot and linear-synteny palette buttons
and the multi-way synteny track's Color by...: the structural modes the
surface paints, the measurements one hop in, the text-column rows while one
is painting, and the per-track swatches once more than one track overlays.

```js
// type signature
(target: ColorByMenuTarget) => MenuItem[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuItems.tsx)

## colorByMenuTargetFor

Project a view carrying `TrackColorsMixin` onto the menu builder's input.
`track` is offered once two tracks overlay, and `reference` where the view
says it has a reference to anchor on.

```js
// type signature
(model: TrackColorsModel) => ColorByMenuTarget
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuTarget.ts)

## colorByScales

The active mode's key as color scales — what a view's `colorScales` lists,
and so what `ChromeLegend` and `SvgLegend` draw. A ramp keeps its own end
labels (identity's `0%` and `100%`, dN/dS's `≥2`) through `format`, and is
followed by a no-value row once a row carried no value; chips are blended
over the band's ground by the view's alpha, so the key matches the
on-screen composited ribbon colors, subject to `legendChipColor`'s
legibility floor; a mode with no fixed key (a color per sequence name) is a
note row saying so.

```js
// type signature
(field: string, {…}?: {…} & { ...; }) => ColorScale[]
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

Short human-readable title for the floating legend header. A column has no
title but its own name, which is the point of it — the reader named it.

```js
// type signature
(field: string) => string
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

## featureColorInputs

The lanes `createComparativeColorFunction` reads, built from features a
display holds on the main thread rather than from a worker's payload. `ends`
answers a feature's two refNames in the order the colour modes read them:
`query` paints by the first and `target` by the second.

```js
// type signature
(features: readonly Feature[], ends: (feature: Feature) => readonly [string, string], channelNames: readonly string[]) => ColorFunctionInputs
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/featureColorInputs.ts)

## LEGEND_CHIP_ALPHA_FLOOR

The alpha a legend chip is blended at however faint the ribbons are.

Matching the chip to the composited ribbon is right down to a point and then
inverts: the linear-synteny default alpha is 0.2, and at that value every
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

The view keys `liftSyntenyViewSettings` converts, which the two views name
as their launch keys' `passThrough` so a validator accepts them.

```js
// type signature
readonly ["colorBy"]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/liftSyntenyViewSettings.ts)

## liftSyntenyViewSettings

A linear synteny or dotplot view snapshot's v4.3.0 settings, lifted onto the
view: `colorBy` (a mode string), `alpha` and `minAlignmentLength` sat on each
synteny display, and `colorBy` lands as `color`. Launch links the genomes
portal handed out carry the mode string on the view itself, which lifts the
same way.

```js
// type signature
(snap: Snap | undefined) => Snap | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/liftSyntenyViewSettings.ts)

## minLengthMenuItem

The Min length row of a view carrying `SyntenyViewMixin`.

```js
// type signature
(model: { minAlignmentLength: number; setMinAlignmentLength: (value: number) => void; }) => MenuItem
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/settingsMenuItems.ts)

## nameColorCss

One name's chromosome-painting color, resolved against an assembly's refName
list and handed back as CSS — what a Canvas2D overlay needs, where the
renderers want packed ABGR.

The single-name form of the LUT above, because a second reader has turned up
that is not painting features: the off-screen mate marks stand for alignments
to a contig the facing row is not showing, and a mark colored like the ribbons
to that contig is what says a ribbon did not vanish, it moved. Two palettes
would put a mark and its ribbons in different colors, which is exactly the
drift this module exists to prevent — see the header.

```js
// type signature
(refName: string, namePosition: RefNamePosition | undefined) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorFunctions.ts)

## opacityMenuItem

The Opacity row of a view carrying `SyntenyViewMixin`, reset to that view's
own default.

```js
// type signature
(model: { alpha: number; defaultAlpha: number; setAlpha: (value: number) => void; colorSurface: () => SyntenyColorSurface; }) => MenuItem
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/settingsMenuItems.ts)

## paintedField

The field a synteny colour object paints by, or `''` while it paints its
constant: `scale: 'none'`, or no field named. Read through the one resolver
every display's colour object goes through.

```js
// type signature
({ value, scale, field, domain, }: SyntenyColorSnapshot) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyColorBy.ts)

## presetRamp

The preset ramp a field names, if it names one. An own-property lookup: a
field spelled `toString` is a column nobody declared, not `Object`'s method.

```js
// type signature
(field: string) => ContinuousMode | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorRamps.ts)

## refNamePositionFor

The `RefNamePosition` a chromosome-painting field hands its palette out by:
`query` reads the first of the alignment's two assemblies, `target` the
second. Undefined for any other field, and while that assembly loads.

```js
// type signature
(field: string, [queryAssembly, targetAssembly]: readonly (string | undefined)[], assemblyManager: { get: (name: string) => {…} | undefined; }) => RefNamePosition | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorFunctions.ts)

## syntenyColorFor

The colour object that paints by `field`, written over `current`: display-kit's
`colorForField`, the rule every display's Color by pick writes by.

```js
// type signature
(field: string, current: SyntenyColorSnapshot) => SyntenyColorSnapshot
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyColorBy.ts)

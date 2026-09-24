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
that keeps its own ground.

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
`track` is offered once two tracks overlay, and `reference` only across a
stack of two or more levels, since below that it degenerates to query or
target.

```js
// type signature
(model: TrackColorsModel, { pointBased, showReference, }: { pointBased: boolean; showReference: boolean; }) => ColorByMenuTarget
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuTarget.ts)

## colorByScale

The active mode's key as one color scale — what a view's `colorScales`
lists, and so what `ChromeLegend` and `SvgLegend` draw. A ramp keeps its
own end labels (identity's `0%` and `100%`, dN/dS's `≥2`) through `format`;
chips are blended over the band's ground by the view's alpha, so the key
matches the on-screen composited ribbon colors, subject to
`legendChipColor`'s legibility floor; a mode with no fixed key (a color per
sequence name) is a note row saying so.

```js
// type signature
(field: string, {…}?: {…} & { ...; }) => ColorScale
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorLegend.ts)

## ColorBySelector

The palette button both comparative headers render. The menu it opens was
already shared (`colorByMenuItems` over the structural `TrackColorsModel`), and
what was left in each plugin was the same button around it — which had already
drifted: only the synteny one said what mode it was currently in.

The two flags are the whole of the difference, and each is a fact about the
view rather than a preference, so the caller states it:

- `pointBased` picks the point-based wording for the modes whose help text
  describes a ribbon (a dotplot's Default is black, synteny's is red).
- `showReference` is whether there is a shared reference to anchor on: 'reference'
  coloring only carries meaning across a stack of two or more levels, and
  degenerates to query/target below that — a two-genome dotplot never has one.

```js
// type signature
({ model, pointBased, showReference, }: { model: TrackColorsModel; pointBased: boolean; showReference: boolean; }) => Element
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

## syntenyColorFor

The colour object that paints by `field`, written over `current`: display-kit's
`colorForField`, the rule every display's Color by pick writes by.

```js
// type signature
(field: string, current: SyntenyColorSnapshot) => SyntenyColorSnapshot
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyColorBy.ts)

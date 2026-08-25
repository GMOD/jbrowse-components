---
id: synteny-core
title: synteny-core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## assignTrackColors

Map each overlaid track to the color it draws in under `colorBy: 'track'`.

Two passes so an automatic slot never duplicates a color the user pinned by
hand: pass one reserves every explicit color, pass two hands each remaining
track the next palette entry that isn't reserved. Past the end of the palette it
wraps rather than falling back to a hash — a hashed color collides ~20% of the
time at four tracks, and distinguishability is the whole point.

Positional, so colors reshuffle when tracks are added, hidden, or reordered.
That is intended: this is a within-view distinguishability aid, not a stable
identity. Anything worth keeping gets pinned.

```js
// type signature
(tracks: readonly PalettableTrack[]) => Map<string, string>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/trackColors.ts)

## attributeColorBy

The colorBy string that paints a named feature attribute.

```js
// type signature
(attribute: string) => SyntenyColorBy
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## blendOverWhite

Composite a CSS color over white by `a`, returning an opaque `rgb(...)`. The
synteny canvas draws every ribbon at the view's global alpha over the white page
(shadeFill in syntenyTypes.slang / resolveInstanceFill in the Canvas2D
renderer), so a full-saturation legend swatch reads wrong — a red match ribbon
shows as salmon, a blue deletion as pale blue. Blending the legend chip the same
way keeps the key matched to what's actually on screen.

```js
// type signature
(color: string, a: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## coerceColorBy

Coerce a persisted colorBy string (stored as plain `types.string` for
snapshot-compat) to a valid `SyntenyColorBy`. Unknown values fall back to
'default'; the retired 'identityDiverging' mode maps to 'identity' so old saved
sessions keep rendering instead of hitting an unhandled switch case.

```js
// type signature
(value: string | undefined) => SyntenyColorBy
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## colorByAttributeName

The attribute a colorBy names, or undefined for a named preset. `attribute:`
with nothing after it never reaches here — coerceColorBy rejects it.

```js
// type signature
(colorBy: SyntenyColorBy) => string | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## colorByMenuItems

The palette-button menu shared by the dotplot and linear-synteny headers: the
view-wide mode radios, a per-track section once more than one track is overlaid,
and the legend toggle.

```js
// type signature
(target: ColorByMenuTarget) => MenuItem[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuItems.tsx)

## colorByMenuTargetFor

Project a view carrying `TrackColorsMixin` onto the menu builder's input. Both
palette menus were building this by hand, walking the model's tracks a third
time (after `colorableTracks` and the legend) and repeating the same five setter
lambdas.

```js
// type signature
(model: TrackColorsModel, { pointBased, showReference, }: { pointBased: boolean; showReference: boolean; }) => ColorByMenuTarget
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuItems.tsx)

## ColorBySelector

The palette button both comparative headers render. The menu it opens was
already shared (`colorByMenuItems` over the structural `TrackColorsModel`), and
what was left in each plugin was the same button around it — which had already
drifted: only the synteny one said what mode it was currently in.

The two flags are the whole of the difference, and each is a fact about the view
rather than a preference, so the caller states it:

- `pointBased` picks the point-based wording for the modes whose help text
  describes a ribbon (a dotplot's Default is black, synteny's is red).
- `showReference` is whether there is a shared reference to anchor on:
  'reference' coloring only carries meaning across a stack of two or more
  levels, and degenerates to query/target below that — a two-genome dotplot
  never has one.

```js
// type signature
({ model, pointBased, showReference, }: { model: TrackColorsModel; pointBased: boolean; showReference: boolean; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/ColorBySelector.tsx)

## colorByShortLabel

Short human-readable title for the floating legend header. An `attribute:<name>`
mode has no title but the column's own name, which is the point of it — the
reader named that column.

```js
// type signature
(colorBy: SyntenyColorBy) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorLegend.ts)

## ComparativeTrackModel

The slice of a track model a comparative view reads off its track list.

Annotated at every site that walks a synteny view's `levels[].tracks` or a
dotplot's `tracks`, because those arrays type out as `any`: the level model is
deliberately `IAnyModelType` to break a real type cycle, and `any` propagates
through the array and switches off checking on everything read from it. That is
not theoretical — it let `getConf(t.configuration, ...)` compile where getConf
wants the MODEL, and it threw at runtime reading
`configuration.configuration.adapter`. Naming the shape is what makes the
compiler check those calls again.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/lodTier.ts)

## LEGEND_CHIP_ALPHA_FLOOR

The alpha a legend chip is blended at however faint the ribbons are.

Matching the chip to the composited ribbon is right down to a point and then
inverts: the linear-synteny default alpha is 0.2, and at that value every chip
washes to within a few percent of white, so a key meant to say "blue is this
track, orange is that one" identifies nothing. Below the floor the chip gives up
exactness for the one job it has. The ribbons themselves still draw at the real
alpha.

```js
// type signature
0.45
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## legendChipColor

blendOverWhite for a legend chip, floored at LEGEND_CHIP_ALPHA_FLOOR.

```js
// type signature
(color: string, alpha: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

## nameColorCss

One name's chromosome-painting color, resolved against an assembly's refName
list and handed back as CSS — what a Canvas2D overlay needs, where the renderers
want packed ABGR.

The single-name form of the LUT above, because a second reader has turned up
that is not painting features: the off-screen mate marks stand for alignments to
a contig the facing row is not showing, and a mark colored like the ribbons to
that contig is what says a ribbon did not vanish, it moved. Two palettes would
put a mark and its ribbons in different colors, which is exactly the drift this
module exists to prevent — see the header.

```js
// type signature
(refName: string, nameOrder: readonly string[] | undefined) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorFunctions.ts)

## trackLegendChips

The legend rows that name the overlaid tracks. Two cases produce them, and both
views build them the same way so the on-screen and exported legends can't
diverge:

- every track on `'track'`: one chip per track, its palette color and name.
- tracks on different modes: one row per track naming its mode, with a swatch
  only where the track has a single color to show (a track on an identity ramp
  has none).

Any other uniform mode has a fixed legend of its own and returns nothing.

```js
// type signature
(tracks: readonly { name: string; colorBy: SyntenyColorBy; trackColor: string; }[], uniformColorBy: SyntenyColorBy | undefined) => ColorChip[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorLegend.ts)

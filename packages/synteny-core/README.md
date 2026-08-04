# @jbrowse/synteny-core

Shared utilities for synteny and dotplot rendering

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### assignTrackColors

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

### coerceColorBy

Coerce a persisted colorBy string (stored as plain `types.string` for
snapshot-compat) to a valid `SyntenyColorBy`. Unknown values fall back to
'default'; the retired 'identityDiverging' mode maps to 'identity' so old saved
sessions keep rendering instead of hitting an unhandled switch case.

```js
// type signature
(value: string | undefined) => "track" | "default" | "strand" | "query" | "target" | "reference" | "identity" | "meanQueryIdentity" | "mappingQuality"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

### colorByMenuItems

The palette-button menu shared by the dotplot and linear-synteny headers: the
view-wide mode radios, a per-track section once more than one track is overlaid,
and the legend toggle.

```js
// type signature
(target: ColorByMenuTarget) => MenuItem[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuItems.tsx)

### colorByMenuTargetFor

Project a view carrying `TrackColorsMixin` onto the menu builder's input. Both
palette menus were building this by hand, walking the model's tracks a third
time (after `colorableTracks` and the legend) and repeating the same five setter
lambdas.

```js
// type signature
(model: TrackColorsModel, { pointBased, showReference, }: { pointBased: boolean; showReference: boolean; }) => ColorByMenuTarget
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorByMenuItems.tsx)

### LEGEND_CHIP_ALPHA_FLOOR

Composite a CSS color over white by `a`, returning an opaque `rgb(...)`. The
synteny canvas draws every ribbon at the view's global alpha over the white page
(shadeFill in syntenyTypes.slang / resolveInstanceFill in the Canvas2D
renderer), so a full-saturation legend swatch reads wrong — a red match ribbon
shows as salmon, a blue deletion as pale blue. Blending the legend chip the same
way keeps the key matched to what's actually on screen. `blendOverWhite` for a
legend chip, with a floor on the alpha.

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

### trackLegendChips

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
(tracks: readonly {…}[], uniformColorBy: "track" | ... 8 more ... | undefined) => ColorChip[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorLegend.ts)

<!-- API_DOCS_END -->

# jbrowse-core

[![NPM version](https://img.shields.io/npm/v/@jbrowse/core.svg?style=flat-square)](https://npmjs.org/package/@jbrowse/core)

Core JBrowse libraries used by most JBrowse plugins.

## Documentation

See [docs](docs/README.md)

## Academic Use

This package was written with funding from the [NHGRI](http://genome.gov) as
part of the [JBrowse](http://jbrowse.org) project. If you use it in an academic
project that you publish, please cite the most recent JBrowse paper, which will
be linked from [jbrowse.org](http://jbrowse.org).

## License

Apache-2.0 © Evolutionary Software Foundation

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### AggregateOp

One summary over a group: `count` needs no field; `sum`, `mean`, `min` and `max`
read one, skipping values that are not numbers. The output field is `as`, else
`count` or `<op>_<field>`.

`weight` names a field each row counts by: `count` is then the sum of the
weights, `sum` the sum of value times weight, and `mean` that over the sum of
the weights. A row whose weight is not a number counts for nothing. A weight
moves no minimum or maximum, so `min` and `max` read none.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### AggregateStep

One feature per distinct `groupby` value set (one for the whole region with
none), spanning its members' extent, with the group's fields and every `ops`
entry.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### applyConfSettings

Write a settings bag — a session spec's track entry, a share link, an agent call
— onto a config. Each key names a member: a slot or a channel is written whole,
as `setConf` writes it, so `null` resets it (ADR-146); a namespace's object
names members inside it, at any depth, and the ones it leaves out keep their
values. The config's own lift and checks run over the bag first, and each
namespace's over its part, so a shorthand or a legacy key reads the same here as
in `config.json`. A key the config does not declare is reported for the caller
to route or refuse, and a declared key whose write throws costs that key alone.

```js
import { applyConfSettings } from '@jbrowse/core/configuration'

// type signature
(target: AnyConfigurationModel | { configuration: AnyConfigurationModel; }, settings: Record<string, unknown>) => ConfSettingsReport
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### arraySlotUnion

The `ConfigurationSchemaUnion` an array slot's entries answer to, read off the
slot's MST type, or undefined for any other slot.

```js
import { arraySlotUnion } from '@jbrowse/core/configuration'

// type signature
(slotType: IAnyType) => ConfigurationSchemaUnionMetadata | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchemaUnion.ts)

### asTable

A table over a feature list, or the table itself.

```js
import { asTable } from '@jbrowse/core/util/featureTable'

// type signature
(input: readonly Feature[] | FeatureTable) => FeatureTable
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### Band

One band of a display's vertical stack — a coverage histogram, an arc strip, a
conservation row, a variant lane. The contract is the pair: `active` is whether
the band exists right now (the display pre-ANDs its settings half, `showX`, with
its data half, "some lane has ink"), and `height` is the stated height when it
does. Consumers read pixels through reservedPx or stackBands, never by
re-combining the pair — the re-combination is where the reserver and the painter
historically drifted.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### baseDisplayConfig

The base's entry for this display, hydrated, which a reset returns to and "is
this the reader's" compares against: the config.json's, or the one a track the
session owns was added with; empty in a session that keeps no base.

```js
import { baseDisplayConfig } from '@jbrowse/core/util/baseDisplayConfig'

// type signature
(self: object) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/baseDisplayConfig.ts)

### BinStep

Place every feature in a genome-aligned bin of `step` bp, writing the bin's
edges over the fields `as` names — `start` and `end` by default, so an
`aggregate` grouped by those counts per bin and the bar spans the bin.

With `field` (`start` by default) a feature is placed in the one bin that field
falls in. With `fields`, an interval's start and end, it is cut at the bin edges
into one piece per bin it overlaps, each piece writing `overlap`, the bases of
the interval inside its bin; a zero-length interval (an insertion) is one piece
of overlap 0 in the bin holding its position, and one whose ends are not numbers
is none. A piece is its feature with those fields beside it, so its id and hover
are the feature's, and an `aggregate` over the pieces weighted by `overlap` is a
mean per base.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### boundBandHeight

Bound a band height to its legal range — a config value, a menu choice, or a
slider position, i.e. anywhere the number is being _stated_ rather than dragged.

The **floor** keeps the band operable at its smallest: for a drag-resized band
that means keeping the handle grabbable, for a menu-sized one it is the height
below which its content stops reading. The **ceiling** stops a band from
swallowing the plot it sits over — every display floors its plot area at 0, so
an unbounded band takes the rows to zero height rather than to a scrollbar, and
takes the band's own handle off-screen with them.

The bounds differ per band and the rule does not, which is why this takes them
rather than each band re-deriving the reasoning — that is how the two
`clampBandHeight`s in this repo drifted apart, each ending up with one half of
this rule and a doc comment claiming to be the whole of it.

```js
import { boundBandHeight } from '@jbrowse/core/util/bandHeight'

// type signature
(n: number, { min, max }?: BandBounds) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandHeight.ts)

### breakendKeepsDirections

Which way the sequence each end of a breakend KEEPS runs from its breakpoint, as
`+1 = right` / `-1 = left` — the convention `StarFusionAdapter`'s
`tickDirection` states and the one every producer in the tree emits.

The two halves read their strings with opposite polarity, so one function states
both. `Join: 'right'` means the mate piece is joined to the right of the ref
base, so this end keeps the sequence to its left: negated.
`MateDirection: 'right'` means the mate's piece extends to the right of the mate
position, which is already the direction it keeps: taken as is. So
`N[chr2:2000[` is `{ joinDirection: -1, mateDirection: 1 }`, the same pair
`StarFusionAdapter` emits for the fusion it describes: the donor keeps the
sequence below its breakpoint (-1) and the acceptor the sequence above its
breakpoint (+1).

Split out of `parseSvAlt` because a consumer holding an already-parsed
`Breakend` was re-deriving it by hand, in two adjacent ternaries of opposite
polarity — the shape that produced 78bb7b84f9.

```js
import { breakendKeepsDirections } from '@jbrowse/core/util/svAlt'

// type signature
(bnd: Breakend) => { mateDirection: number; joinDirection: number; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### buildColorRampLut

An RGBA lookup table over sampleColorRamp, laid out as the Nx1 texture both GPU
backends upload and the Canvas2D twins index — entry `i` is the color at
`t = i / (N - 1)`. N comes off the shader that samples it, so the table and
`rampColor`'s texel mapping cannot disagree.

The table is always straight. A diverging ramp whose middle belongs at a value
off the centre of the domain reads it through `rampMidT`, the shader's rule and
its generated twin, so the middle follows a moving domain without a new table.

```js
import { buildColorRampLut } from '@jbrowse/core/util/colorRamp'

// type signature
(stops: readonly ColorRampStop[]) => Uint8Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### canonicalizeViewRefName

Resolve user-authored refName text against the assembly of the view containing
`node`, resolving aliases and casing together. Falls back to the input when the
assembly is absent or its aliases have not loaded.

Uses the view's assembly, not the track's, because displayed regions, loaded
regions and blocks all use the refNames the view laid out.

Call it wherever a refName a _person_ wrote is about to be compared against
regions, features or blocks, which use the assembly's canonical name. A refName
a display copied off a region is already canonical. One from a session spec, a
config slot or a URL is whatever the author typed.

Without it, matching depends on the assembly: `chr12` matches on an assembly
canonicalized `chr12` and matches nothing on one canonicalized `12`. The same
spec key works on one config and does nothing on the next, with no error.

Resolves through `getCanonicalRefName2`, which falls back to the input instead
of throwing when a spec is read before the alias file has loaded. The getters
that read user specs run from the first render.

Takes a refName, not a spec that might hold one. The resolver calls
`refName.toLowerCase()`, so any other value throws once the aliases have loaded,
and a caller reading an untyped `frozen` slot must first check that the value is
a refName.

```js
import { canonicalizeViewRefName } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode, refName: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### categoricalField

`labels` names the `domain`'s values in a key, one each in order, where a config
spells them for a reader rather than as the data does. `held` deals each key the
domain does not list a color when the key first appears (`categoricalScale`);
the caller keeps it for as long as the colors should hold. `unknown` paints
every such key one color instead, `''` the no-value grey, and `invalid` paints
the no-value key, `''` or a preset's missing level (strand's `0`), which keeps
the grey or the level's own color while unset.

```js
import { categoricalField } from '@jbrowse/core/util/categoricalField'

// type signature
(field: string, { domain, range, labels, held, reserved, unknown, invalid }?: { domain?: readonly string[]; range?: readonly string[]; labels?: readonly string[]; held?: HeldSlots; reserved?: readonly string[]; unknown?: string; invalid?: string; }) => CategoricalField
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### CategoricalField

One categorical field as every channel reads it — a facet's sections, a color's
range entries, a key's rows. `key` files a value, `compare` orders keys (the
`domain` first, the rest by `compareGroupKeys`, `''` after them), `label` names
a key in a legend, `sectionLabel` on a chip, and `color` paints it. A key's
color depends only on the key and the declaration, so every region agrees on it,
except that a field dealing its colors (`categoricalField`'s `held`) also steps
a key off the colors of the keys met before it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### CategoricalRef

A field bound to an ordinal scale: each distinct value takes one entry of the
channel's `range` — a color for `color`, a shape name for `shape`. Every value
derives its entry from itself (an integer takes the slot it names, anything else
hashes in), so every region agrees on a value it shares with another at the cost
of an occasional collision. A `domain` spends the range deliberately: the listed
values take it in order, and a value the domain leaves out never takes a listed
value's entry. The domain orders and spends; it never adds a value the data
lacks.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### CellsStep

Replace each aligned row with its cells against the reference: one feature per
run of columns in one `state` — `match`, `mismatch` or `gap` — on the row's
reference span, a mismatch run with its `base` and a match or mismatch run
`match` as 1 or 0, and one interbase feature per `insertion`, standing at the
reference base it precedes with the inserted bases in `base` and their count in
`length`. The row's `field` (`seq`) is the aligned text, and the reference's is
the same field on the feature the row was fanned out of, so a `flatten` over a
MAF block's `alignments` stands in front. A gap run reaching either end of the
row is no cell, and a feature with no parent answers none.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### ChannelReader

A channel read per feature: the compiled form of a FieldRef, and what a
display's own worker method hands the encoder for a channel no field name can
say — a join against a second adapter, a lookup table, a rule over two fields.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### clampBandHeight

Clamp one _resize_ of a drag-resizable band: boundBandHeight, plus the one rule
a resize needs that a stated height does not.

The floor becomes `min(bounds.min, current)`, never the bare bound: a band whose
config declares it smaller than the floor must stay where it is. Taking the bare
floor instead made the _first_ drag on such a band jump it up to the floor
before honoring the delta. A band at or above the floor is unaffected, one below
it can still be dragged but never smaller than it already is, and one dragged
back past the floor regains it.

The ceiling is not relaxed the same way — a band already over its ceiling is the
state the user is trying to escape, so a resize brings it back inside.

`ResizeHandle` emits one delta per animation frame, so callers driving a drag
pass `current + distance` as the target and read `current` inside the action — a
component computing the target from a rendered height drops every tick that
lands before React re-renders.

```js
import { clampBandHeight } from '@jbrowse/core/util/bandHeight'

// type signature
(current: number, target: number, bounds?: BandBounds) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandHeight.ts)

### clipQuantileOf

The quantile a clip toggle writes: a scale's declared default where that clips,
below 1, else DEFAULT_CLIP_QUANTILE.

```js
import { clipQuantileOf } from '@jbrowse/core/util/quantileExtent'

// type signature
(declaredDefault: unknown) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/quantileExtent.ts)

### CodeLane

Codes into a list of labels, one per row.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### COLOR_SCHEMES

The named ramps a continuous color scale's `scheme` takes, each one a stop table
in `colorRamp.ts` that every ramp baker reads, so no display can name a scheme
nothing bakes. `viridis`, `magma`, `inferno` and `cividis` are matplotlib's
perceptual ramps, dark at the low end; `juicebox` fades from transparent to red,
as Juicebox paints contacts; `fall` runs white through yellow and red to black,
as HiGlass does; `reds` and `blues` are ColorBrewer's, from white; `redblue` and
`purpleorange` diverge through white, ColorBrewer's RdBu and PuOr; `redgreyblue`
diverges through a grey middle, which stays visible on a white page where a
white middle would not, as `identity` paints; `redyellowblue` is ColorBrewer's
RdYlBu through a pale yellow middle, Vega's name and direction; `dnds` turns it
round so low reads cool and high hot.

```js
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'

// type signature
readonly[
  ('viridis',
  'magma',
  'inferno',
  'cividis',
  'juicebox',
  'fall',
  'reds',
  'blues',
  'redblue',
  'purpleorange',
  'redgreyblue',
  'redyellowblue')
]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorSchemes.ts)

### colorAt

The packed color instance `i` of `channels` paints: `color[i]`, or `color`
itself where the color is a constant and so shipped as one number.

```js
import { colorAt } from '@jbrowse/core/util/markEncoding'

// type signature
(channels: Pick<EncodedChannels, "color">, i: number) => number | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### colorDifference

The CIEDE2000 difference between two CSS colors, in CIELAB as CSS `lab()` reads
it. About 2 is a just noticeable difference between large patches side by side;
small marks matched to a key's swatches need far more.

```js
import { colorDifference } from '@jbrowse/core/ui/colors'

// type signature
(a: string, b: string) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/colors.ts)

### ColorEncoding

How a mark's `color` channel resolves. A CSS color or a `jexl:` expression
returning one paints per feature with no scale; the object forms bind a field to
a scale, which a legend can describe, and share the config's member names.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### colorEvaluator

A CSS color or `jexl:` color expression as a per-feature packed ABGR — the
unscaled arm of ColorEncoding, used by a display that has a plain `color` slot.

```js
import { colorEvaluator } from '@jbrowse/core/util/markEncoding'

// type signature
(color: string, jexl: JexlInstance | undefined) => (feature: Feature) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### colorRampStops

The stops a continuous color scale samples: `range`'s CSS colors where it lists
any, else the named `scheme`, viridis while that is unset, turned round under
`reverse`.

```js
import { colorRampStops } from '@jbrowse/core/util/colorRamp'

// type signature
({ range, scheme, reverse, }: RampDeclaration) => readonly ColorRampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### ColorScaleTable

The scale a color channel was resolved through, as the legend reads it — the
same table the colors in the payload came from, so the key cannot disagree with
the painting.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### ColorSchemeName

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorSchemes.ts)

### Column

A field's values over a table's rows, resolved once per step so the loop reading
it is chosen before the loop runs: a lane a step wrote, codes into labels, a
field read off the parser's own features, text or lists an adapter holds typed,
or a value a step computes per row. `at` is the row each of the table's rows
reads, where the lane or the features belong to a table this one stands on.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### ColumnTable

A table an adapter answers from the typed arrays it already holds, where
`getFeaturesArray` would make an object per row: a column per field, and each
row's id. A row's hover JSON is every field it holds.

```js
import { ColumnTable } from '@jbrowse/core/util/featureTable'

// type signature
typeof ColumnTable
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### ConfigurationSchemaUnion

A list entry that is one of several configuration schemas, each keyed by the
`type` it answers to:
`types.array(ConfigurationSchemaUnion('Step', { filter, bin }))`. The keys are
the vocabulary, the snapshot's `type` picks the member, and a `type` naming no
member is refused in every build — where a bare `types.union` would load it as
its first member. Each member is an `explicitlyTyped`, `closed` schema named by
its key, so a key belonging to another member is named on a load and refused on
a write rather than dropped; one that is not throws here.

```js
import { ConfigurationSchemaUnion } from '@jbrowse/core/configuration'

// type signature
<const MEMBERS extends Record<string, AnyConfigurationSchemaType>>(name: string, members: MEMBERS) => ConfigurationSchemaUnionType<MEMBERS>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchemaUnion.ts)

### continuousColorScale

A continuous color scale over `extent`, the values it met: the domain its
declared ends and the extent make, the straight table its stops bake to and
where its middle stop sits, and the packed color a value paints through them: an
infinity the end on its side, as a threshold places it, and NaN, text that is no
number, the misconfiguration grey. The encoder and every display painting a ramp
itself read it, so a value takes one color whoever paints it.

```js
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'

// type signature
(encoding: ContinuousRef, extent: readonly [number, number]) => { domain: [number, number]; lut: Uint8Array<ArrayBufferLike>; midNorm: number; colorOf: (value: number) => number; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### ContinuousRef

A numeric field read through a linear, log or symlog scale into a ramp.
`domainMin` or `domainMax` pins each end of the domain, which otherwise takes
the region's extreme, so pinning both keeps colors consistent across a whole
view. The ramp is `range`'s CSS colors, evenly spaced, where it lists any, else
the named `scheme`; `reverse` turns it round.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### CoverageStep

Replace the features with runs of constant depth: how many of them overlap each
stretch of the region, in a field `as` (`coverage` by default), with the
stretches nothing overlaps left out. A read counts across its whole span,
deletions and introns included; gap-aware depth stays the alignments display's
(ADR-118).

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### darkAtLowEnd

Whether a named ramp is a sequential one running dark at its low end: viridis,
magma, inferno and cividis. Juicebox, fall, reds and blues run light to dark,
and a diverging ramp is light in its middle.

```js
import { darkAtLowEnd } from '@jbrowse/core/util/colorRamp'

// type signature
(scheme: "blues" | "cividis" | "fall" | "inferno" | "juicebox" | "magma" | "purpleorange" | "redblue" | "redgreyblue" | "reds" | "redyellowblue" | "viridis") => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### dealKeyColors

Deals `keys` their colors in `field.compare` order, so the colors a set of keys
first seen together takes do not depend on the order they arrive in. Each new
key avoids every color the session has dealt, so regions dealing keys separately
never repeat a color. A no-op for a field that deals nothing.

```js
import { dealKeyColors } from '@jbrowse/core/util/categoricalField'

// type signature
(field: CategoricalField, keys: Iterable<string>) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### dealShownKeyColors

`dealKeyColors` for `keys` that are every value a display shows: each new key
avoids only these keys' colors, so the values a session met elsewhere do not use
up the palette for the ones on screen. Dealing one region of several this way
can put a value on the color of one in the region beside it.

```js
import { dealShownKeyColors } from '@jbrowse/core/util/categoricalField'

// type signature
(field: CategoricalField, keys: Iterable<string>) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### declaredSnapshot

A snapshot as `type` lifts it, without the keys it does not declare: the config
half of an entry that also holds its owner's keys, as a `MultiWiggleAdapter`
subadapter holds its row's `name` and `color`.

```js
import { declaredSnapshot } from '@jbrowse/core/configuration'

// type signature
(type: IAnyType, snapshot: Record<string, unknown>) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/snapshotPreprocess.ts)

### DEFAULT_COLOR_SCHEME

The ramp a continuous scale samples while it names no `range` and no `scheme`,
so a declaration spelling it out and one leaving it unset resolve alike.

```js
import { DEFAULT_COLOR_SCHEME } from '@jbrowse/core/util/colorSchemes'

// type signature
;'blues' |
  'cividis' |
  'fall' |
  'inferno' |
  'juicebox' |
  'magma' |
  'purpleorange' |
  'redblue' |
  'redgreyblue' |
  'reds' |
  'redyellowblue' |
  'viridis'
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorSchemes.ts)

### EncodeContext

What surrounds an encode: the jexl instance a `jexl:` channel compiles against —
a caller whose channels are all readers or field names passes none — and a
progress reporter.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### Encoded

EncodedChannels with the lanes in `L` present — what `encodeFeatures` answers a
caller that named them.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### EncodedChannels

One encoding's channels over one region's features, dense and index-aligned:
instance `i` of every array is the same feature, and `featureIndex[i]` is its
index in the input list, and the array is absent where instance `i` is feature
`i` (featureIndexAt). A lane is present when the caller asked for it (LaneName);
Encoded is this type with a known lane set required.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### encodedChannelTransferables

The buffers an EncodedChannels owns, for `rpcResult`'s transfer list.

```js
import { encodedChannelTransferables } from '@jbrowse/core/util/markEncoding'

// type signature
(c: EncodedChannels) => ArrayBufferLike[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### EncodedLayersResult

What `CoreGetEncodedLayers` answers for one region: `layers[i]` is the request's
`layers[i]` over the region's features, so a display's mark list indexes
straight into it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### encodeFeatures

Evaluate one encoding over a feature list into dense channel arrays for the
lanes named, the scale table each scaled channel came from, the `y` extremes and
— when `index` is among the lanes — a hit index.

A feature whose `x`, `x2` or (declared and asked-for) `y` is not finite is
skipped and counted in `skipped`, so every array stays index-aligned with the
Flatbush. Pure: the RPC around it owns the adapter, the filters and the
transferables.

Columnar: one pass admits the rows over `x`, `x2` and `y` alone, and none runs
where all three are lanes of whole numbers; every other lane is then filled in a
separate loop over the admitted rows, a lane straight off a typed column and a
categorical over a `category` column per label.

```js
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'

// type signature
<L extends LaneName>(input: readonly Feature[] | FeatureTable, encoding: MarkEncodingInput, lanes: readonly L[], ctx?: EncodeContext) => Encoded<L>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### evaluateForFeature

A config value as `feature` reads it: a `jexl:` callback evaluated against the
feature, anything else as written.

```js
import { evaluateForFeature } from '@jbrowse/core/configuration'

// type signature
(value: unknown, feature: Feature, jexl: JexlInstance) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

### FacetedLayer

One layer of a faceted request: its rows in section order, and the stacked row
of each, index for index.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

### facetLayers

A faceted request's layers: the rows split on the facet's field, the facet's own
steps and then each layer's run over each section alone, and the sections
stacked — a section's rows start where the one above it ends, and it is as tall
as the tallest layer packed it. Every layer's rows come back in section order
beside their stacked rows, so a faceted display is the unfaceted one drawn once
per section, and a row is handed on as its steps left it. A layer naming no
`row` field stands on each section's first row, the answer the unfaceted encoder
gives it.

The split is a counting sort into section order rather than a list per section:
every step runs once over the ordered rows, keeping section order, and one that
groups rows groups within a section.

```js
import { facetLayers } from '@jbrowse/core/util/featureTransforms'

// type signature
(input: readonly Feature[] | FeatureTable, facet: FacetSpec, layers: readonly { transform?: readonly TransformStep[]; row?: FieldRef; }[], jexl?: JexlInstance | undefined) => { layers: FacetedLayer[]; sections: FacetSection[]; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

### FacetSection

One faceted section as the worker stacked it: its key, the row it starts on and
how many rows it holds.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### FacetSpec

A row facet: split the features on `field`'s value, run `transform` and then
every layer's own steps over each section alone, and stack the sections, each
starting on the row after the one above it ends.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### featureIndexAt

The input feature instance `i` of `channels` was: `featureIndex[i]`, or `i`
itself where the encoder skipped none and so shipped no index.

```js
import { featureIndexAt } from '@jbrowse/core/util/markEncoding'

// type signature
(channels: Pick<EncodedChannels, "featureIndex">, i: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### FeatureTable

The rows one step of a mark's declaration hands the next: a column per field and
a view of one row as a `Feature`, for a `jexl:` expression, a channel reader and
the hover.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### fenceOutliers

Where a value axis's open ends stand below a `fenceQuantile` of 1: at the
`extremes`, unless one would stretch the axis past twice the span the
quantileExtent ends `quantiles` draw, 0 included where the axis reaches it
(`zero`); that end stops at the fence. So a plot with no spike shows every value
and cuts none, and a spike leaves the values under it at least half the axis.
When the quantiles meet, the span is their magnitude, as a flat domain widens in
`getNiceDomain`.

```js
import { fenceOutliers } from '@jbrowse/core/util/quantileExtent'

// type signature
({ extremes, quantiles, zero, }: { extremes: readonly [number, number]; quantiles: readonly [number, number]; zero: boolean; }) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/quantileExtent.ts)

### fieldReader

What a channel reads off a feature: a field by name, a dotted path into a
structured field where no field has the whole name (`INFO.SVTYPE` on a VCF
record), or a `jexl:` expression over `feature`. A jexl expression that does not
compile throws here, once, rather than on every feature.

```js
import { fieldReader } from '@jbrowse/core/util/fieldReader'

// type signature
(ref: string, jexl: JexlInstance | undefined) => (feature: Feature) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/fieldReader.ts)

### FieldRef

Where a channel's value comes from: a feature field name, read natively
(`feature.get(name)`), or a `jexl:` expression over `feature` — the opt-in
escape, measured at 1.5x to 2.0x native per feature (MARK_ENCODING.md "The jexl
channel, measured").

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### FilterStep

Keep the features a `jexl:` expression over `feature` admits, or the ones that
pass every field predicate of `predicates` (ADR-238), Vega-Lite's two forms of
its `filter` transform.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### finiteExtremes

The least and greatest finite values of `values[0, count)`,
`[Infinity, -Infinity]` where none is finite.

```js
import { finiteExtremes } from '@jbrowse/core/util/quantileExtent'

// type signature
(values: ArrayLike<number>, count: number) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/quantileExtent.ts)

### FlattenStep

Fan each feature out into one feature per element of an array-valued field —
`subfeatures`, so a gene answers its transcripts and a transcript its exons — or
per entry of a record keyed by name, so a VCF record answers one feature per
sample and a MAF block one per species, each with its key in `key`. Each answer
reads the element's own fields first and the feature it came from for everything
else, so an exon still knows its gene's name and strand and a species row its
block's reference span. A feature whose field holds no array and no record drops
out unless `keepEmpty` is true.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### FormulaStep

Write a `jexl:` expression's value over `feature` into the field `as` of every
feature.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### getAssemblyHost

The host's assembly manager, for a module that resolves names and nothing else.

Unlike the accessors in `sessionServices.ts` this one gives the caller no
smaller type graph — an `AssemblyManager` is an MST model a `PluginManager`
built, so naming it costs what naming a session costs. It is here to say which
service is wanted, and because that cost is the finding: the assembly manager is
the one thing on `AbstractSessionModel` a third-party host cannot simply
implement.

```js
import { getAssemblyHost } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => AssemblyHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getBreakendMateLocString

The mate locString ("chr2:100") of a parsed breakend, or undefined when it names
no navigable position. Two ALT forms reach here without one: a single breakend
(`.A` / `G.`) has no mate at all, and the symbolic-mate forms (`G<DEL>`,
`<DEL>G`) get a placeholder `<DEL>:1` from parseBreakend, which puts a symbolic
allele id where a contig name belongs. Callers that navigate or split-view a
mate must drop both rather than treat `<DEL>` as a refName.

```js
import { getBreakendMateLocString } from '@jbrowse/core/util/svAlt'

// type signature
(breakend?: Breakend | undefined) => string | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### getConf

Reads a configuration value from a track or display state model: exactly
`readConfObject(model.configuration, path)`, with the same slot-name check.

```js
import { getConf } from '@jbrowse/core/configuration'

// type signature
(model: { configuration: AnyConfigurationModel; }) => AnyConfigurationSnapshot
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### getContainingDisplay

Returns the display model that contains the given node. Throws if the node has
no containing display.

```js
import { getContainingDisplay } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => AbstractDisplayModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getContainingTrack

Returns the track model that contains the given node. Throws if the node has no
containing track.

```js
import { getContainingTrack } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => AbstractTrackModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getContainingView

Returns the view model that contains the given node. Throws if the node has no
containing view.

```js
import { getContainingView } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => AbstractViewModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getDialogHost

Where a display puts a dialog it cannot mount itself.

```js
import { getDialogHost } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => DialogHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getEnv

Returns the MST environment for a node, which holds the `pluginManager`.

```js
import { getEnv } from '@jbrowse/core/util'

// type signature
(obj: IAnyStateTreeNode) => { pluginManager: PluginManager; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getNotificationSink

Where a display puts a message it cannot draw itself.

```js
import { getNotificationSink } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => NotificationSink
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getPaletteHost

The colors to draw with, and the args that rebuild them in a worker.

```js
import { getPaletteHost } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => PaletteHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getRenderingServices

Everything a display needs of its host in order to draw a region: the
assemblies, the RPC entry point and the colors.

```js
import { getRenderingServices } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => RenderingServices
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getRpcHost

The host's RPC entry point, for a module that issues RPCs and nothing else.

```js
import { getRpcHost } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => RpcHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getSession

Returns the JBrowse session model for any node in the state tree. Throws if the
node has no session ancestor.

```js
import { getSession } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => AbstractSessionModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getSessionServices

The services a session offers that need no application-specific type to name.
Prefer one of the narrower accessors below, which say which of them the calling
module actually uses.

```js
import { getSessionServices } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => SessionServices
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### heldSlotsOf

The `HeldSlots` `owner` keeps under `key`, made empty on first ask. Lives as
long as `owner` and is never persisted, so a reload deals afresh.

```js
import { heldSlotsOf } from '@jbrowse/core/util/categoricalField'

// type signature
(owner: object, key: string) => HeldSlots
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### HitIndexed

An encoded payload as a display stores it: the hit index the worker built with
hitIndexOf, wrapped once where the payload lands.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### hitIndexOf

The hit index over `count` instances: each a box from `x` to `x2` at its `y`, or
at 0 for a mark with no value.

```js
import { hitIndexOf } from '@jbrowse/core/util/markEncoding'

// type signature
(x: Uint32Array<ArrayBufferLike>, x2: Uint32Array<ArrayBufferLike>, y: Float32Array<ArrayBufferLike> | undefined, count?: number) => Flatbush
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### hydrateTrackConfig

Hydrate a plain track config, such as a `session.tracks` entry, into a live
config node, dispatching on its `type` to find the schema. A plain entry holds
only what was authored: a slot at its default is absent and `preProcessSnapshot`
has not run.

Returns **undefined** when no plugin registered the type or `create` rejects the
config, which has never been validated; callers fall back to the plain object.
Hydrating one entry twice returns one node. A shown track resolves to the
session's working copy instead (ADR-032), which has the same content.

```js
import { hydrateTrackConfig } from '@jbrowse/core/configuration'

// type signature
(pluginManager: PluginManager, config: Record<string, unknown>) => AnyConfigurationModel | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchema.ts)

### IdentityRef

Each feature's own color, off the BED color column under whichever name the file
gives it: ADR-166's identity scale. The encoder keys each feature by the `r,g,b`
its color parses to, `''` where it carries none.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### isBreakend

Breakend notation, without parsing it: bracket forms (`G[chr2:100[`), single
breakends (`.A` / `G.`), and the symbolic-mate form (`G<DEL>`, an angle bracket
past position 0; a leading `<` is a plain symbolic allele).

```js
import { isBreakend } from '@jbrowse/core/util/svAlt'

// type signature
(alt: string) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### isConstantJexl

Whether a `jexl:` ref answers the same for every feature: it reads no variable
and calls no function, as `jexl:'red'` does.

```js
import { isConstantJexl } from '@jbrowse/core/util/fieldReader'

// type signature
(ref: string) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/fieldReader.ts)

### isMissing

Whether a field has no value: absent, empty, or a VCF's `AF=.`, which arrives as
`[undefined]`. Text that fails to parse still counts as a value.

```js
import { isMissing } from '@jbrowse/core/util/groupKeys'

// type signature
(value: unknown) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/groupKeys.ts)

### isPlainFieldRef

Whether a field ref is a bare name that `feature.get` reads directly, with no
path to walk and no expression to evaluate. A loop over a plain name keeps the
direct call, and only a config that writes a path pays for one.

```js
import { isPlainFieldRef } from '@jbrowse/core/util/fieldReader'

// type signature
(ref: string) => ref is never
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/fieldReader.ts)

### junctionEnds

Where a paired record's junction is at each of its two ends, and which side of
it each end keeps — the one answer every launcher, the row menu and the chain
walk take, whether the record is a VCF breakend, a symbolic SV or a paired
adapter's row (BEDPE, STAR-Fusion). Refnames are as the record spells them.
`undefined` for a record naming no other end. A VCF record is read through
`alt`, its first ALT unless the caller names another.

A VCF end's junction is its position. A paired adapter's end is a block, and the
junction is the block's edge on the side the end keeps: stated by
`mateDirection` where the adapter knows it, read off the strands where the
record states one for each end as BEDPE does, and with neither the two blocks
face each other. A PAF row's strand is the query's orientation and states none
for the target, so it names no side.

```js
import { junctionEnds } from '@jbrowse/core/util/svAlt'

// type signature
(feature: Feature, alt?: string | undefined, alleleIndex?: number | undefined) => { own: JunctionEnd; mate: JunctionEnd; } | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### keyNames

The display name of each of `keys`, from a color object's `labels`: one each in
order, and the key itself where an entry is empty or missing. Every key that
takes `labels` reads them through this, so a config means one thing by them
everywhere.

```js
import { keyNames } from '@jbrowse/core/util/categoricalField'

// type signature
(keys: readonly unknown[], labels?: readonly string[]) => ReadonlyMap<string, string>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### LaneName

The lanes a caller asks the encoder to fill, beyond `x` and `x2`, which every
payload has, and `featureIndex`, which a payload has where a feature was
skipped: a mark's channels, and `index` for the Flatbush a hover reads. A lane
not asked for is neither allocated nor transferred, and a caller that never
hovers declines the index, which is most of the encoder's cost after the walk.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### launchOrReplaceView

`addOrReplaceView` for view types whose state model may be lazily loaded; the
synchronous `addOrReplaceView` requires it loaded already.

```js
import { launchOrReplaceView } from '@jbrowse/core/util'

// type signature
(args: { session: AbstractViewContainer; typeName: string; initialState?: Record<string, unknown>; replacing?: AbstractViewModel; }) => Promise<AbstractViewModel>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### LayerRequest

One layer of a `CoreGetEncodedLayers` request: the encoding to evaluate and the
lanes the display's mark reads.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### layerTables

A layered request's rows: the shared steps, the facet's split where it names
one, and each layer's own steps, with the row each layer's rows stand in — the
field it names, or under a facet each row's stacked row. The split comes as
early as it can: after the last shared step that must see every row, so the
steps that follow it read the rows already in section order.

```js
import { layerTables } from '@jbrowse/core/util/featureTransforms'

// type signature
(input: readonly Feature[] | FeatureTable, request: { transform?: readonly TransformStep[]; facet?: FacetSpec; layers: readonly { transform?: readonly TransformStep[]; row?: FieldRef; }[]; }, jexl?: JexlInstance | undefined) => { layers: { table: FeatureTable; row: string | Uint32Array<ArrayBufferLike> | undefined; }[]; sections: FacetSection[] | undefined; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

### liftPlot

A draft as the display's config would hold it, through the schema's own lift and
checks: a shorthand becomes its object, a default falls off, and what a config
file is refused for throws, a key outside the plot included. The draft writes
over the plot as a settings bag does: a setting it leaves out stays, `null`
resets one, an object declaring `writes: 'whole'` replaces the setting, and any
other object takes the members it names, a `null` member resetting that member.
Under `whole` the draft is the plot entire. The node is never attached, so
nothing on the display is touched; a display reads its typed members off it. The
draft is copied first, since MST freezes what it creates from.

```js
import { liftPlot } from '@jbrowse/core/configuration'

// type signature
(conf: AnyConfigurationModel, draft: Plot, options?: PlotWriteOptions) => AnyConfigurationModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### ListColumn

A list of rows per row: row `i`'s entries are the rows of `entries` from
`start[i]` up to `start[i + 1]`, and `keys`, where the list is a record keyed by
name, the name of each entry.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### ListedRowSource

One row an adapter lists: `name` is a value of the listing's field, and `label`
and `color` are what the adapter names and colors that row with.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/BaseAdapter/rowSources.ts)

### listsRowSources

Whether an adapter implements RowSourceLister.

```js
import { listsRowSources } from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'

// type signature
(adapter: object) => adapter is RowSourceLister
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/BaseAdapter/rowSources.ts)

### LocusRef

A position that may lie on another sequence: the field holding its refName and
the field holding its 0-based coordinate, as a paired record states its mate
(`{ refName: 'mate.refName', pos: 'mate.start' }`).

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### MadeRows

A table whose rows a step made, which answers each row's identity, its hover
JSON and the feature it hangs from.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### MarkColorEncoding

What a mark's `color` crosses the wire as.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### MarkEncoding

The declared mapping from a feature's fields to a mark's channels. Every
positional channel is a field. `x` defaults to `start` and `x2` to `end`; a mark
that plots no value leaves `y` off; the scale `y` is read through belongs to the
display rather than to the encoding. `shape` is read by the `point` mark alone,
`row` — an integer field, 0 where missing — by every mark, which stands a
feature in the band it names.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### MarkEncodingInput

What `encodeFeatures` takes: a MarkEncoding, any channel of which may be a
ChannelReader in place of its declared form, and `row` the values themselves,
one per input feature, where the caller computed them — a facet's stacked rows.
The declared form is what crosses the wire; a reader or a value list is built in
the worker.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### matedBy

How a record states its other end, or undefined where it states none: the `mate`
a paired adapter fills (BEDPE, STAR-Fusion), an `ALT` the breakend and
symbolic-SV readers resolve, or a read's `next_ref` and `next_pos`. The `mate`
step admits exactly the features this names one for, so a caller deciding
whether links are the picture a track wants asks here rather than re-reading the
fields.

```js
import { matedBy } from '@jbrowse/core/util/featureTransforms'

// type signature
(f: Feature) => "alt" | "mate" | "pair" | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

### MateStep

One feature per other end a record states: the `mate` a paired adapter fills in
(BEDPE, STAR-Fusion), or each VCF `ALT` naming a locus, a breakend's mate or a
symbolic allele's `END` on `CHR2` or on the record's sequence. Each answer has
`mate` (`refName`, `start`, `end`, 0-based and half-open, and the far end's
`mateDirection`), `mateDirection` for its own end, the `alt` it came from and
`svType`, the structural class the allele states (`svClassOfAlt`). A record
naming no other end drops out, and two records or alleles stating one pair of
ends answer once.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### mergeConfSettings

Two settings bags for one schema as one, `over` written after `under` the way
`applyConfSettings` writes a bag: a namespace's object merges member by member
at any depth, a bare value its shorthand lifts included, and a slot or a channel
takes `over`'s value whole. Each side's retired spellings lift first, at every
depth, so a bag's own retired name still beats the other's current one; `over`'s
namespace members lift against `under` as their base, so they replace only the
entries they name in a list `under` writes. For combining snapshots before any
config node exists, as a track's `displayDefaults` folds into its `displays`.

```js
import { mergeConfSettings } from '@jbrowse/core/configuration'

// type signature
(schema: unknown, under: Record<string, unknown>, over: Record<string, unknown>) => { [x: string]: unknown; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### MISCONFIGURED_ABGR

The misconfiguration grey packed as the encoder paints it: a `jexl:` color that
answered no string, a ramp value that is no number, text a threshold cannot
read.

```js
import { MISCONFIGURED_ABGR } from '@jbrowse/core/util/markEncoding'

// type signature
number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### NO_VALUE_ABGR

The no-value grey packed as the encoder paints it: a feature with nothing in the
field a threshold reads.

```js
import { NO_VALUE_ABGR } from '@jbrowse/core/util/markEncoding'

// type signature
number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### NO_VALUE_LABEL

The row a feature with no categorical value is placed on, so a key says why a
mark is grey rather than listing a blank value.

```js
import { NO_VALUE_LABEL } from '@jbrowse/core/util/markEncoding'

// type signature
;('(no value)')
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### NOT_A_NUMBER_LABEL

The key a value holding text that is no number files under on a threshold scale,
painted the misconfiguration grey rather than passing for a missing value.

```js
import { NOT_A_NUMBER_LABEL } from '@jbrowse/core/util/thresholdScale'

// type signature
;('(not a number)')
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### NumberLane

A typed lane a step wrote, one number per row.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### numberReaderOf

readerOf as the number a quantitative channel or step reads, `NaN` where a row
holds none, by `numericValue`'s rules.

```js
import { numberReaderOf } from '@jbrowse/core/util/featureTable'

// type signature
(column: Column) => (i: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### numericDomain

A domain written as strings — the shared `domain` slot is a `stringArray` — read
back as the numbers it names. A member that is not a number reads NaN, which
every comparison against it declines.

```js
import { numericDomain } from '@jbrowse/core/util/thresholdScale'

// type signature
(domain: readonly (string | number)[]) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### OTHER_VALUES_LABEL

The key's row for the values a color's `domain` leaves out, which its `unknown`
paints one color.

```js
import { OTHER_VALUES_LABEL } from '@jbrowse/core/util/categoricalField'

// type signature
;('Other')
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### parsePlot

Parses the text as a plot and throws on a key the display's plot lacks. The
schema parses the values after that.

```js
import { parsePlot } from '@jbrowse/core/configuration'

// type signature
(text: string, keys: readonly string[]) => Plot
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### parseSvAlt

Parse raw (non-assembly-resolved) mate coordinates from a VCF SV feature+alt.
Returns undefined when no mate coordinate info is found. `alleleIndex` is the
alt's place in `ALT`, which a record repeating one symbolic allele with several
lengths needs; it defaults to the first place `alt` appears.

```js
import { parseSvAlt } from '@jbrowse/core/util/svAlt'

// type signature
(feature: Feature, alt?: string | undefined, alleleIndex?: number) => { mateRefName: string; matePos: number; mateDirection?: number; joinDirection?: number; } | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### pathSeries

A path layer's table in series order, as PathSpec defines a series, with each
row's series beside it and the stretch past which a series breaks. `steps` are
every step the layer's rows went through, which a `window` among them reads the
default break from.

```js
// type signature
(table: FeatureTable, row: RowEncoding, path: PathSpec, steps: readonly TransformStep[], jexl?: JexlInstance | undefined) => { table: FeatureTable; row: RowEncoding; series: Uint32Array<ArrayBuffer>; gapBp: number | undefined; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/pathSeries.ts)

### PathSpec

A path's series, as Vega-Lite draws a line: one per row and, within a row, one
per distinct value of `by`, a categorical color's field, each in start order.
`gapBp` breaks a series where the next instance's middle lies further on than
that; absent, a `window` step among the layer's steps sets it to the bases a
frame spans at the median row, and with none a series is one run.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### persistTrackConfigNow

Write the containing track's config to the session now, not after its 400 ms
wait, so an edit is one undo step the moment it lands: every writer of a row
arrangement, a lane choice or an axis setting calls it (ADR-157). Does nothing
for a node outside a track.

```js
import { persistTrackConfigNow } from '@jbrowse/core/util'

// type signature
(node: IAnyStateTreeNode) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### PileupStep

Assign every feature the lowest row on which it overlaps nothing already there —
greedy first fit in start order, the packing a pileup is — and write it to the
field `as` (`row`). `fields` names the interval read (`start`, `end`); `padding`
is bp of clearance kept between two features sharing a row. The answer is the
input in start order, so a `span` encoding `row` stacks it. Under a facet it
packs each section separately.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### plainFieldName

The field a ref reads by name: a plain ref itself, or the one field a `jexl:`
ref reads as `feature.score`, `feature['score']` or `get(feature, 'score')` do,
so such an expression takes a plain name's columnar path.

```js
import { plainFieldName } from '@jbrowse/core/util/fieldReader'

// type signature
(ref: string) => string | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/fieldReader.ts)

### Plot

A display's plot settings as written: a key left out is left alone, and `null`
resets that setting. Untyped, since a value may be a shorthand the schema lifts,
and the schema is what judges it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### PlotExample

A worked example of a display's plot: the text it fills the editor with, and
what it does.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### plotKeysOf

A display's plot settings, what "Edit plot..." edits and an agent reads as its
`plot`: every slot, sub-schema and list its config declares with `plot`, in the
order it declares them.

```js
import { plotKeysOf } from '@jbrowse/core/configuration'

// type signature
(conf: AnyConfigurationModel) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### plotList

Marks a list of sub-schemas as a plot setting, as `plot: true` marks a slot or a
sub-schema; an MST array type has no options in which to set the flag.

```js
import { plotList } from '@jbrowse/core/configuration'

// type signature
<T extends IAnyType>(type: T) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### plotOf

A display's plot as declared, defaults left off. A list sitting at a default it
shares with no other display, a default plot's marks, shows its entries, since
they are what is drawn.

```js
import { plotOf } from '@jbrowse/core/configuration'

// type signature
(conf: AnyConfigurationModel) => Plot
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### PlotWriteOptions

How a draft is written to the plot. By default it patches, as a settings bag
does; `whole` takes it for the whole plot, as the "Edit plot..." text is.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### plotWrites

What applying a draft writes: each setting whose lifted value differs from the
plot, as the lifted value, and `null` for one it resets. A value spelled another
way but lifting to the same setting writes nothing, and a retired spelling
writes the settings it lifts into. Under `whole`, a setting the draft leaves out
writes its reset. Throws a refusal before anything is written.

```js
import { plotWrites } from '@jbrowse/core/configuration'

// type signature
(conf: AnyConfigurationModel, draft: Plot, options?: PlotWriteOptions) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

### preProcessConfigSnapshot

A snapshot as a write to `type` admits it: the lift and checks `setConf`
applies, so a dialog or a validator rejects what an edit would reject, an
undeclared key included. Throws what the schema's `preProcessSnapshot` throws.

```js
import { preProcessConfigSnapshot } from '@jbrowse/core/configuration'

// type signature
(type: IAnyType, snapshot: unknown) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/snapshotPreprocess.ts)

### quantileExtent

What the open ends of a scale follow over `values[0, count)`: at a `quantile` of
1 their finite extremes, and below it each end clipped at that quantile of the
values on its side of 0, so one spike takes neither the axis nor the ramp, and a
sparse tail of the other sign keeps its extreme. An axis that starts at 0 adds
it itself. Under 0.5 reads as 0.5, where the ends meet rather than cross. A y
scale's `fenceQuantile` and a color's `domainQuantile` both name it.
`[Infinity, -Infinity]` where nothing is finite.

Nearest rank keeps ties: where one value holds the rank, as on a segmented
copy-number track, a ramp clipped below 1 paints nearly every value one color. A
value axis fences instead (fenceOutliers); a ramp takes the same fence once a
color default below 1 meets tied data.

```js
import { quantileExtent } from '@jbrowse/core/util/quantileExtent'

// type signature
(values: ArrayLike<number>, count: number, quantile?: number) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/quantileExtent.ts)

### quantileOf

The nearest-rank `quantile` of `a[0, n)`: the smallest value at least that share
of them sit at or below, so a handful of values clips at their maximum. Permutes
`a`; 0 where `n` is.

```js
import { quantileOf } from '@jbrowse/core/util/quantileExtent'

// type signature
(a: Float32Array<ArrayBufferLike>, n: number, quantile: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/quantileExtent.ts)

### RampDeclaration

A continuous color scale's ramp as a config declares it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### rampDomain

The domain a continuous color scale spans: each end `min` or `max` pins, else
the extent's, ascending, since a span has no direction and `reverse` is the
ramp's. An open end stops at a pinned one rather than crossing it, and an extent
holding no value (`[Infinity, -Infinity]`) spans [0, 1].

```js
import { rampDomain } from '@jbrowse/core/util/colorRamp'

// type signature
(min: number | undefined, max: number | undefined, extent: readonly [number, number]) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### rampGapScales

The rows a ramp's key lists beside its bar once a feature painted one: the
not-a-number and no-value rows a threshold's key ends with. Empty while neither
painted.

```js
import { rampGapScales } from '@jbrowse/core/util/thresholdScale'

// type signature
(id: string, met: { missing?: boolean; notNumber?: boolean; }) => CategoricalScale[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### rampLutOf

The buildColorRampLut table a ramp declaration asks for, the same `Uint8Array`
for the same declaration, since a GPU backend re-uploads its ramp texture when
the identity changes and a render state is rebuilt far more often than its ramp.

```js
import { rampLutOf } from '@jbrowse/core/util/colorRamp'

// type signature
(ramp: RampDeclaration) => Uint8Array<ArrayBufferLike>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### rampOverExtent

A ramp table over `extent`, the union a display took across the regions it
loaded: each open end of the domain moved to the union's, the pinned ends kept.
The table stays straight and `domainMid` a value, so the middle stop follows the
widened domain with no table baked again.

```js
import { rampOverExtent } from '@jbrowse/core/util/markEncoding'

// type signature
(table: Extract<ColorScaleTable, { kind: 'ramp'; }>, extent: [number, number]) => Extract<ColorScaleTable, { kind: 'ramp'; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### readConfObject

Read the value at a path of a live config node, such as a track's
`configuration`, evaluating a `jexl:` callback with `args`.

The types reject a snapshot, because a snapshot omits a slot at its default. A
`session.tracks` entry is one (`TrackConfigEntry`): read its `trackId` and
`type` directly, and a slot through a helper that supplies the default, such as
`getConfAssemblyNamesOrNone`.

```js
import { readConfObject } from '@jbrowse/core/configuration'

// type signature
(confObject: AnyConfigurationModel) => AnyConfigurationSnapshot
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

### readerOf

A reader of a column's values by row, its kind resolved here once. A `number`
lane with no index reads straight off the lane.

```js
import { readerOf } from '@jbrowse/core/util/featureTable'

// type signature
(column: Column) => (i: number) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### READS_REFERENCE

The `adapterCapabilities` entry of an adapter that reads the reference sequence
of the assembly it is displayed against: BAM and SAM for mismatches without an
MD tag, CRAM to rebuild bases, GC content and the reference scans for everything
they answer. Such an adapter is built with that reference and keyed on it as
well as on its config, so one config shown on two genomes is two instances, each
reading the reference of its genome, and an instance never changes reference for
its life. Every other adapter keys on its config alone: a synteny adapter is
fetched from each of its assemblies and reads no reference.

```js
import { READS_REFERENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'

// type signature
;('readsReference')
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/dataAdapterCache.ts)

### refusingUndeclaredKeys

Runs `write` as a write: a `closed` schema created inside it refuses a key it
does not declare, at any depth, where a config loading only names the key on the
console. `setConf`, a settings bag and a plot draft write this way, so a typo in
an edit is an error and a config written for another version still draws.

```js
import { refusingUndeclaredKeys } from '@jbrowse/core/configuration'

// type signature
<T>(write: () => T) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/snapshotPreprocess.ts)

### relight

Move a color's OKLCH lightness by `lightnessShift` and scale its chroma, holding
its hue.

For extending a categorical palette past its length. Cycling a nine-color list
over a 24-chromosome karyotype repeats the color outright; cycling it with a
lightness shift per lap gives the hue back as a variant still told apart from
the original — tab20's construction, which pairs a light and a dark of each hue.

SHIFT rather than a fixed lightness, and SCALE rather than a fixed chroma,
because a categorical palette is uneven on purpose: category10's brown and its
red are 5 degrees apart in hue and are told apart by chroma alone, so
re-lighting both to one (lightness, chroma) makes them the same color. Each
color keeps its relative chroma, so brown stays brown.

In OKLCH rather than through `lighten`/`darken`, which work in sRGB, where the
same coefficient moves a yellow and a blue by visibly different amounts: a lap
has to read as one tone across the whole palette or it reads as noise.

```js
import { relight } from '@jbrowse/core/util/color'

// type signature
(color: string, lightnessShift: number, chromaScale?: number, maxLightness?: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/color/index.ts)

### requirementProblems

The `requires` entries of a configuration schema that `snapshot` does not meet,
as a config file or `getSnapshot` spells it: a slot left off reads as its
default, so a `when` value that is the default fires for an absent slot, which
is what the generated JSON Schema's `if` does.

```js
import { requirementProblems } from '@jbrowse/core/configuration'

// type signature
(type: IAnyType, snapshot: Record<string, unknown>) => RequirementProblem[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/requirements.ts)

### reservedPx

The pixels a band takes from the plot below it: 0 when off, the (optionally
bound) stated height when on. This is the single spelling of "off spends 0 px".

```js
import { reservedPx } from '@jbrowse/core/util/bandLayout'

// type signature
(band: Band) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### RowSourceLister

An adapter that lists its rows without reading a region: a multi-BigWig its
files, a MAF its species.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/BaseAdapter/rowSources.ts)

### RowSourceListing

Every row an adapter has, in the adapter's order, whatever the loaded regions
hold, so a row display gives a row with nothing in view its place, label and
color.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/BaseAdapter/rowSources.ts)

### runLazyAfterAttach

Run a display's `afterAttach` body from a module loaded on demand, so the
autorun installers stay out of the display's eager bundle.

One policy for the gap the `await` opens: a node torn down before the module
lands installs nothing, and a module that fails to load is reported where the
user can see it rather than onto the display's own error slot — that slot is
what `reload()` clears, and nothing would re-run the install behind it. Three
displays hand-rolled this IIFE and each drew the lines differently.

```js
import { runLazyAfterAttach } from '@jbrowse/core/util/lazyAfterAttach'

// type signature
<Self extends IStateTreeNode>(self: Self, load: () => Promise<(self: Self) => void>) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/lazyAfterAttach.ts)

### runTransforms

Run the transform steps over a feature list or a table, in order, in the worker.
The table a step answers is what the next one reads, and the last one is what
the encoder walks.

```js
import { runTransforms } from '@jbrowse/core/util/featureTransforms'

// type signature
(input: readonly Feature[] | FeatureTable, steps: readonly TransformStep[], jexl?: JexlInstance | undefined) => FeatureTable
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

### safeParseBreakend

parseBreakend, which returns undefined for a malformed breakend. Kept under this
name for plugins written when

```js
import { safeParseBreakend } from '@jbrowse/core/util/svAlt'

// type signature
(alt: string) => Breakend | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### sampleColorRamp

The color at `t` in `[0, 1]` across a list of EVENLY SPACED stops, linearly
interpolated per channel. `t` is clamped, so the ends are the end stops rather
than an extrapolation past them, and a one-stop ramp is that stop everywhere.

```js
import { sampleColorRamp } from '@jbrowse/core/util/colorRamp'

// type signature
(stops: readonly ColorRampStop[], t: number) => ColorRampStop
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### scaleBandHeights

Heights after growing or shrinking a stack of bands by `distance` px in all: the
one rule every whole-stack resize uses. Each band takes its share of the height
it has above `floor`, so the tall bands give and take the most, and none goes
below `floor`, or below its current height if it already sits under it (the
clampBandHeight rule). Whole pixels, rounded by largest remainder, so the stack
moves by exactly the rounded distance.

```js
import { scaleBandHeights } from '@jbrowse/core/util/bandHeight'

// type signature
(heights: number[], distance: number, floor?: number) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandHeight.ts)

### scaleExtent

quantileExtent as a scale's open ends read it: over every finite value on a
linear scale, and on a log scale over the positive ones, since a 0 or a negative
met there would floor the domain at 1 and fold a domain below 1 flat.
`[Infinity, -Infinity]` where the scale reads nothing.

```js
import { scaleExtent } from '@jbrowse/core/util/quantileExtent'

// type signature
(values: ArrayLike<number>, count: number, scale: string, quantile?: number) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/quantileExtent.ts)

### ScaleTable

The table behind a channel a key is drawn from: a color's, whose `kind` names
the scale it resolved through, or a shape's. A `size` channel's (SizeScaleTable)
draws no key and stands outside.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### selectEncodedFeature

Open the feature widget on the feature behind one instance of a
`CoreGetEncodedLayers` answer. A display holds channels, not records, so it
sends `CoreGetEncodedFeature` the request the instance's region came back under,
and the worker answers the entry of `layer`'s list that the instance's
`featureIndex` names: the record as the adapter wrote it, or the bin or run the
steps made. A second click aborts the first.

```js
import { selectEncodedFeature } from '@jbrowse/core/util/selectEncodedFeature'

// type signature
(self: IStateTreeNode<IAnyType>, rotation: { begin(): ActiveFetch; cancel: () => void; dispose(): void; }, args: Omit<CoreGetEncodedLayersArgs, "byteLimit"> & { layer: number; featureIndex: number; }) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/selectEncodedFeature.ts)

### selectNth

The `k`th smallest of `a[0, n)`, permuting `a` in place. Exact, where a
histogram collapses skewed contact counts into its bottom bucket, and O(n) where
a sort of 4.5M counts measured ~1s. Median-of-three because Hi-C contacts arrive
nearly sorted.

```js
import { selectNth } from '@jbrowse/core/util/quantileExtent'

// type signature
(a: Float32Array<ArrayBufferLike>, n: number, k: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/quantileExtent.ts)

### selectRows

The table's rows `rows` names, in that order: over an adapter's features, a
source table over those features again, so every field still reads straight off
them; over rows a step made, a table standing on them.

```js
import { selectRows } from '@jbrowse/core/util/featureTable'

// type signature
(table: FeatureTable, rows: Uint32Array<ArrayBufferLike>) => FeatureTable
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### SessionPaletteProvider

Make JBrowse follow the host's light/dark state — the whole of it, in one mount:

```tsx
<SessionPaletteProvider session={session} mode={myAppIsDark ? 'dark' : 'light'}>
  {tracks}
</SessionPaletteProvider>
```

`mode` is optional. Left out, JBrowse follows the page's declared `color-scheme`
— so a host whose dark-mode toggle sets it, as most do, mounts this with a
session and nothing else. A page that declares `light dark` follows the OS, and
a page that declares nothing stays light.

A component rather than a documented pair of calls because the pair has a half
that can be left out with nothing to show for it. `PaletteProvider` is the name
a host reaches for, and it colors the React side alone; the session write is
what reaches the RPC worker, which bakes feature labels into the rendered image.
So a host that mounts only the provider gets light-mode labels on a dark page,
from a canvas whose every other pixel is right, and nothing errors. See
useSessionPalette for the mechanism.

The session is the only thing that resolves a palette here, so a host with its
own palette mounts `PaletteProvider` directly instead.

```js
import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'

// type signature
({ session, mode, children, }: { session: ThemeModeSession; mode?: "dark" | "light" | undefined; children: ReactNode; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/PaletteContext.tsx)

### setConf

Write counterpart to `getConf`, and it takes the same path: a slot name, or an
array naming a sub-schema's member at any depth —
`setConf(self, ['encoding', 'y', 'scale', 'domainMin'], 5)`. Takes the display
or track model, or a config node directly.

A path ending on a slot writes that slot; one ending on a sub-schema replaces
the whole object, so a channel's members (a facet's field and its domain) move
together. On a concrete schema an unknown slot name is a compile error, and
`setSlot` refuses one at runtime (ADR-052). A wrong value type throws at
runtime; `null` or `undefined` resets the slot to its default (ADR-146).

```js
import { setConf } from '@jbrowse/core/configuration'

// type signature
<CONFMODEL extends AnyConfigurationModel, const SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | ConfigurationSlotPath<ConfigurationSchemaForModel<CONFMODEL>> = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(target: CONFMODEL | { configuration: CONFMODEL; }, slotPath: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### SHAPE_CODES

The `point` mark's painter code for each shape an encoding can name.

```js
import { SHAPE_CODES } from '@jbrowse/core/util/shapeNames'

// type signature
Record<"circle" | "diamond" | "square" | "triangle-down", number>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/shapeNames.ts)

### ShapeEncoding

A ShapeName, a `jexl:` expression over `feature` returning one, or a field bound
to a categorical scale whose `range` lists the shape names handed out —
`DEFAULT_SHAPE_RANGE` when absent.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### ShapeScaleTable

The scale a shape channel was resolved through: which shape each value of the
field took.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### SizeEncoding

How a mark's `size` channel resolves: a number is a constant width in CSS px for
every instance, a field name is `{ field }` with the defaults, and the object
binds the field to a scale.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### SizeRef

A numeric field read through a linear or log scale into a width in CSS px:
`range` is the px at each end of the domain (1 to 6 unset), and `domainMin` or
`domainMax` pins each end of the domain, which otherwise follows the loaded
regions' extremes, as a color ramp's does. A feature holding no number takes the
range's first px.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### SizeScaleTable

The scale a size channel is read through: the `size` lane holds the raw values
and the shape maps them to px through this, so a display unions `extent` over
its loaded regions into the open ends of `domain` and every region strokes the
same value at the same width.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### stackBands

Fold an ordered set of bands into tops and a bottom. The order is the argument,
so a display states its band order exactly once. Reserve, paint and pick all
call this function, so the reserved and painted positions cannot disagree.

Only the fold is shared; the rest stays in each display. Per-lane iteration runs
this once per lane, sticky-vs-scrolling is a property of how the result is
projected to the screen, and a band drawn outside its reservation (an overlay)
has a separate draw rect beside the stack.

```js
import { stackBands } from '@jbrowse/core/util/bandLayout'

// type signature
<K extends string>(order: readonly K[], bands: Record<K, Band>) => BandStack<K>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### stopsFromRampLut

`n` evenly spaced legend stops read straight out of a buildColorRampLut byte
table — the same 256×1 RGBA array `uploadColorRampLut` hands the GPU and the
Canvas2D fillStyle LUTs index — as the stops of a `RampScale`. It holds one
claim by construction: the swatch at bar fraction `t` is byte-identical to the
ramp entry both backends read at `t`, through the ramp's middle stop at
`midNorm` (`rampMidT`). Alpha rides `opacity` (the juicebox fade), never baked
into the color string.

```js
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

// type signature
(lut: Uint8Array<ArrayBufferLike>, n: number, midNorm?: number) => RampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### STRAND_FIELD

```js
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'

// type signature
;('strand')
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### SV_MIN_LENGTH

The conventional size floor for calling a sequence indel structural.

```js
import { SV_MIN_LENGTH } from '@jbrowse/core/util/svAlt'

// type signature
50
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### SV_TYPE_FIELD

The structural-variant class `svClassOf` names. A VCF record and a BEDPE row
have it, and the mark display's `mate` step writes it per allele.

```js
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'

// type signature
;('svType')
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### svClassOf

The structural-variant class of a VCF record as a whole: the one class its
alleles state, CNV where they are losses and gains of one segment, OTHER where
they otherwise disagree, and `''` for a record with no structural allele.

```js
import { svClassOf } from '@jbrowse/core/util/svAlt'

// type signature
(feature: Feature) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### svClassOfAlt

The structural-variant class one ALT allele states, `''` for one that is not
structural. The id of a symbolic allele decides first. Otherwise VCF 4.4's
`EVENTTYPE` decides; then a breakend takes the class its `SVTYPE` declares where
that says more than BND, and a sequence allele is an insertion or deletion by
its length against REF, else takes its `SVTYPE`'s class.

```js
import { svClassOfAlt } from '@jbrowse/core/util/svAlt'

// type signature
(alt: string, { ref, info, alleleIndex }?: { ref?: string; info?: Record<string, unknown>; alleleIndex?: number; }) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### svClassOfToken

The class a symbolic allele id, `SVTYPE` or `EVENTTYPE` names. A subtype folds
into its first level (`DEL:ME:ALU` is DEL, `DUP:TANDEM` DUP), except the tandem
repeats VCF 4.4 spells `CNV:TR` and ExpansionHunter `STRn`, and the inverted
duplication `INV:DUP`. 1000 Genomes' `CNn` counts one haplotype's copies, so
none is a deletion and two or more a duplication. `''` for an empty or missing
token.

```js
import { svClassOfToken } from '@jbrowse/core/util/svAlt'

// type signature
(raw: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### TextColumn

Text held as bytes, one per character: row `i`'s is `length[i]` bytes of `bytes`
from `offset[i]`, so many rows share one buffer, as an adapter's arena holds
them.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### thresholdCuts

A threshold scale's cut points as thresholdIndex walks them: the numbers the
domain names, ascending. Cuts written high to low, as p-value thresholds often
are, left the middle interval unreachable, the walk stopping at the first cut a
value is under.

```js
import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'

// type signature
(domain: readonly (string | number)[]) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdField

A threshold scale read the way every categorical channel reads its field: a
value files under the label of the bin it falls in, a feature with no value
under `''`, and text that is no number under NOT_A_NUMBER_LABEL. The bins are
the whole domain, so a key lists each one. `labels` names the bins in a key, one
each from the lowest, where a config spells them for a reader; a bin's key stays
its interval.

```js
import { thresholdField } from '@jbrowse/core/util/thresholdScale'

// type signature
(field: string, { domain, range, labels: names }?: { domain?: readonly string[]; range?: readonly string[]; labels?: readonly string[]; }) => CategoricalField
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdIndex

The bin a value falls in: how many of the ascending cut points it is at or past,
so a palette with one more entry than the domain paints it as
`palette[thresholdIndex(value, domain)]`. A value that is not a number is in no
bin and answers -1; an infinite one takes the end bin on its side, as d3's
threshold scale places it, so a `-log10` of a zero p-value falls in the top bin.

```js
import { thresholdIndex } from '@jbrowse/core/util/thresholdScale'

// type signature
(value: unknown, domain: readonly number[]) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdKeyEntries

A threshold key's rows: every interval, painted or not, since the bins are the
whole domain, then the not-a-number and no-value rows where a feature took one,
in the order `thresholdField` sorts them.

```js
import { thresholdKeyEntries } from '@jbrowse/core/util/thresholdScale'

// type signature
(cuts: readonly number[], range: readonly string[] | undefined, met: { missing?: boolean; notNumber?: boolean; }, names?: readonly string[]) => { value: string; label: string; color: string; missing?: true | undefined; }[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdLabels

What a threshold scale's bins are called in a key, one label per palette entry:
`< a` below the first cut, `a – b` between two, `≥ b` past the last.

```js
import { thresholdLabels } from '@jbrowse/core/util/thresholdScale'

// type signature
(domain: readonly number[]) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdPalette

The color of each interval, in order: the declared palette, and where it runs
out the interval's evenly spaced sample of the default ramp, since the intervals
are ordered and a categorical deck would say they are not.

```js
import { thresholdPalette } from '@jbrowse/core/util/thresholdScale'

// type signature
(bins: number, palette?: readonly string[]) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### ThresholdRef

A numeric field cut into intervals: `domain` is the ascending cut points and
`range` holds one color more, so a value paints the entry for the number of cut
points it is at or past. A value that is not a number belongs to no interval.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### TransformStep

One step over the features before a layer is encoded, named by `type` the way
GenomeSpy spells a transform; every step runs in order and the next reads what
the last answered.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### valueAt

A column's value at a row, whatever its kind: for a loop that reads few rows.

```js
import { valueAt } from '@jbrowse/core/util/featureTable'

// type signature
(column: Column, i: number) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### VIRIDIS_STOPS

The 256 viridis stops, fully opaque. Feed them to buildColorRampLut for the
texture/fillStyle form, or to sampleColorRamp for legend stops.

```js
import { VIRIDIS_STOPS } from '@jbrowse/core/util/colorRamp'

// type signature
readonly ColorRampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### WindowStep

Every row kept, each written with `ops` summarized over the rows of its group
around it, Vega-Lite's window transform: a group is a distinct `groupby` value
set within a section, its rows taken in `start` order, and `frame` counts rows
before and after the current one, `null` running to the group's end.
`[-10, 10]`, the default, is a moving average over 21 rows, whatever bases they
span; `[null, 0]` a running total. A frame cut off at a group's end summarizes
the rows it has. The rows come out grouped, each group in `start` order, so a
`line` walks one group at a time.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### withAdapterId

`conf` with an `adapterId` hashed from all of it. Code that builds an inline
config (a FromConfigAdapter's `features`) calls this: `adapterConfigCacheKey`
hashes only a prefix, so two such configs differing past it would share an
adapter.

```js
import { withAdapterId } from '@jbrowse/core/data_adapters/dataAdapterCache'

// type signature
<T extends Record<string, unknown>>(conf: T) => T & { adapterId: string; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/dataAdapterCache.ts)

### withColumns

The table's rows with `written` beside them, in the order `rows` names where it
names one.

```js
import { withColumns } from '@jbrowse/core/util/featureTable'

// type signature
(table: FeatureTable, written: ReadonlyMap<string, Column>, rows?: Uint32Array<ArrayBufferLike> | undefined) => FeatureTable
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTable.ts)

### withHitIndex

HitIndexed over what the worker shipped.

```js
import { withHitIndex } from '@jbrowse/core/util/markEncoding'

// type signature
<T extends EncodedChannels>(channels: T) => HitIndexed<T>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### writesWholeAt

Whether `schema` writes the object at `path` whole: a channel, which declares
`writes: 'whole'`, where a namespace merges member by member. False for a path
the schema does not declare.

```js
import { writesWholeAt } from '@jbrowse/core/configuration'

// type signature
(schema: unknown, path: readonly string[]) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### ZoomRange

The bp/px interval, `[minBpPerPx, maxBpPerPx)`, over which an adapter with zoom
levels answers a fetch from the same level it answered `opts.bpPerPx` from. A
display holding the answer refetches when the view leaves it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/BaseAdapter/zoomRange.ts)

<!-- API_DOCS_END -->

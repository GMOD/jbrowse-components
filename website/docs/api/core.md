---
id: core
title: core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## AggregateOp

One summary over a group: `count` needs no field; `sum`, `mean`, `min` and
`max` read one, skipping values that are not numbers. The output field is
`as`, else `count` or `<op>_<field>`.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## AggregateStep

One feature per distinct `groupby` value set (one for the whole region
with none), spanning its members' extent, carrying the group's fields and
every `ops` entry.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## BinStep

Snap every feature to the genome-aligned bin of `step` bp its `field`
(`start` by default) falls in, writing the bin's edges over the fields
`as` names — `start` and `end` by default, so an `aggregate` grouped by
those counts per bin and the bar spans the bin.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## buildColorRampLut

An RGBA lookup table over sampleColorRamp, laid out as the Nx1
texture both GPU backends upload and the Canvas2D twins index — entry `i` is
the color at `t = i / (N - 1)`. N comes off the shader that samples it, so
the table and `rampColor`'s texel mapping cannot disagree.

`mid` is where the stop list's own midpoint lands in the table, so a
diverging ramp whose middle colour belongs at a value off the centre of the
domain is baked into the bytes. Every reader — the shader, the Canvas2D
fillStyle table, the legend bar — then samples one evenly spaced table and
cannot disagree about the warp.

```js
// type signature
(stops: readonly ColorRampStop[], mid?: number) => Uint8Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

## categoricalField

```js
// type signature
(field: string, { domain, palette, }?: { domain?: readonly string[] | undefined; palette?: readonly string[] | undefined; }) => CategoricalField
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

## CategoricalField

One categorical field as every channel reads it — a facet's sections, a
color's palette entries, a key's rows. `key` files a value, `compare`
orders keys (the `domain` first, the rest by `compareGroupKeys`, `''`
after them), `label` names a key in a legend, `sectionLabel` on a chip, and
`color` paints it. A key's color depends only on the key and the
declaration, so every region agrees on it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

## CategoricalRef

A field bound to a categorical scale: each distinct value takes one entry
of the channel's range — a palette entry for `color`, a glyph name for
`glyph`. Every value derives its entry from itself (an integer takes the
slot it names, anything else hashes in), so every region agrees on a value
it shares with another at the cost of an occasional collision. A `domain`
spends the range deliberately: the listed values take it in order, and a
value the domain leaves out never takes a listed value's entry. The domain
orders and spends; it never adds a value the data lacks.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## ChannelReader

A channel read per feature: the compiled form of a FieldRef, and
what a display's own worker method hands the encoder for a channel no
field name can say — a join against a second adapter, a lookup table, a
rule over two fields.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## ColorEncoding

How a mark's `color` channel resolves. A CSS colour or a `jexl:` expression
returning one paints per feature with no scale; the two object forms bind a
field to a scale, which a legend can describe. A continuous scale maps the
field through `domain` (the region's minimum and maximum when absent) into
`ramp`; list a `domain` to keep colors consistent across a whole view.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## colorEvaluator

A CSS colour or `jexl:` colour expression as a per-feature packed ABGR —
the unscaled arm of ColorEncoding, on its own for a display that
carries a plain `color` slot.

```js
// type signature
(color: string, jexl: JexlInstance | undefined) => (feature: Feature) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## ColorScaleTable

The scale a colour channel was resolved through, as the legend reads it —
the same table the colours in the payload came from, so the key cannot
disagree with the painting.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## CoverageStep

Replace the features with runs of constant depth: how many of them overlap
each stretch of the region, in a field `as` (`coverage` by default), with
the stretches nothing overlaps left out.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## EncodeContext

What surrounds an encode: the jexl instance a `jexl:` channel compiles
against — a caller whose channels are all readers or field names passes
none — and a progress reporter.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## Encoded

EncodedChannels with the lanes in `L` present — what
`encodeFeatures` answers a caller that named them.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## EncodedChannels

One encoding's channels over one region's features, dense and
index-aligned: instance `i` of every array is the same feature, and
`featureIndex[i]` says which one of the input list it was. A lane is
present when the caller asked for it (LaneName); Encoded
is this type with a known lane set required.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## encodedChannelTransferables

The buffers an EncodedChannels owns, for `rpcResult`'s transfer
list.

```js
// type signature
(c: EncodedChannels) => ArrayBufferLike[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## EncodedFeaturesResult

What `CoreEncodeFeatures` answers for one region: `layers[i]` is the
request's `layers[i]` over the region's features, so a display's mark
list indexes straight into it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## encodeFeatures

Evaluate one encoding over a feature list into dense channel arrays for
the lanes named, the scale table each scaled channel came from, the `y`
extremes and — when `index` is among the lanes — a hit index.

A feature whose `x`, `x2` or (declared and asked-for) `y` is not finite is
skipped and counted in `skipped`, so every array stays index-aligned with
the Flatbush. Pure: the RPC around it owns the adapter, the filters and the
transferables.

```js
// type signature
<L extends LaneName>(features: readonly Feature[], encoding: MarkEncodingInput, lanes: readonly L[], ctx?: EncodeContext) => Encoded<L>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## FACET_ROW

The field a faceted layer's features carry their stacked row in.

```js
// type signature
"\0row"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

## facetLayers

A faceted request's layers: the features split on `field`'s key, each
layer's own steps run over each section alone, and the sections stacked —
a section's rows start where the one above it ends, and it is as tall as
the tallest layer packed it. Every layer's features come back in section
order carrying their stacked row in `FACET_ROW`, so a faceted display is
the unfaceted one drawn once per section.

```js
// type signature
(features: readonly Feature[], field: string, layers: readonly {…}[], jexl?: JexlInstance | undefined) => { ...; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

## FacetSection

One faceted section as the worker stacked it: its key, the row it starts on
and how many rows it holds.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## FacetSpec

A row facet: split the features on `field`'s value, run every layer's own
steps over each section alone, and stack the sections, each starting on the
row after the one above it ends.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## fieldReader

What a channel reads off a feature: a field by name, a dotted path into a
structured field where no field carries the whole name (`INFO.SVTYPE` on a
VCF record), or a `jexl:` expression over `feature`. A jexl expression that
does not compile throws here, once, rather than on every feature.

```js
// type signature
(ref: string, jexl: JexlInstance | undefined) => (feature: Feature) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/fieldReader.ts)

## FieldRef

Where a channel's value comes from: a feature field name, read natively
(`feature.get(name)`), or a `jexl:` expression over `feature` — the opt-in
escape, measured at 1.5x to 2.0x native per feature (MARK_ENCODING.md
"The jexl channel, measured").

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## FilterStep

Keep the features a `jexl:` expression over `feature` admits.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## FlattenStep

Fan each feature out into one feature per element of an array-valued field
— `subfeatures`, so a gene answers its transcripts and a transcript its
exons. Each answer reads the element's own fields first and the feature it
came from for everything else, so an exon still knows its gene's name and
strand. A feature whose field holds no array drops out unless `keepEmpty`
says otherwise.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## FormulaStep

Write a `jexl:` expression's value over `feature` into the field `as` of
every feature.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## GLYPH_CODES

The `point` shape's glyph code for each name an encoding can say.

```js
// type signature
Record<GlyphName, number>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/glyphNames.ts)

## GlyphEncoding

A GlyphName, a `jexl:` expression over `feature` returning one, or
a field bound to a categorical scale whose `range` lists the glyph names
handed out — the three glyphs, in order, when absent.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## GlyphScaleTable

The scale a glyph channel was resolved through: which glyph each value of
the field took.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## hitIndexOf

The hit index over `count` instances: each a box from `x` to `x2` at its
`y`, or at 0 for a mark with no value.

```js
// type signature
(x: Uint32Array<ArrayBufferLike>, x2: Uint32Array<ArrayBufferLike>, y: Float32Array<ArrayBufferLike> | undefined, count?: number) => Flatbush
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## isPlainFieldRef

Whether a field ref is a bare name: what `feature.get` answers on its own,
with no path to walk and no expression to evaluate. A loop over a plain name
keeps the direct call, and only a config that writes a path pays for one.

```js
// type signature
(ref: string) => ref is never
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/fieldReader.ts)

## LaneName

The lanes a caller asks the encoder to fill, beyond `x`, `x2` and
`featureIndex`, which every payload carries: a shape's channels, and
`index` for the Flatbush a hover reads. A lane not asked for is neither
allocated nor transferred, and a caller that never hovers declines the
index, which is most of the encoder's cost after the walk.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## LayerRequest

One layer of a `CoreEncodeFeatures` request: the encoding to evaluate and
the lanes the display's shape reads.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## MarkEncoding

The declared mapping from a feature's fields to a mark's channels. Every
positional channel is a field: `x` defaults to `start` and `x2` to `end`, a
mark that plots no value leaves `y` off, and the scale `y` is read through
belongs to the display rather than to the encoding. `glyph` is read by the
`point` shape alone, `row` — an integer field, 0 where missing — by every
shape, which stands a feature in the band it names.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## MarkEncodingInput

What `encodeFeatures` takes: a MarkEncoding, any channel of which
may be a ChannelReader in place of its declared form. The declared
form is what crosses the wire; a reader is built in the worker.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## NO_VALUE_LABEL

The row a feature with nothing in a categorical field lands on, so a key
says why a mark is grey rather than listing a blank value.

```js
// type signature
"(no value)"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

## numericDomain

A domain written as strings — the shared `domain` slot is a `stringArray` —
read back as the numbers it names. A member that is not a number reads NaN,
which every comparison against it declines.

```js
// type signature
(domain: readonly (string | number)[]) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

## rampOverExtent

An unpinned ramp table over `extent`, the union a display took across the
regions it loaded: the domain the shapes read as a uniform, and the table
baked again where a `domainMid` places its middle stop by that domain. Each
region baked its own, so keeping the first region's put the middle colour
at a value none of them declared.

One table per stop list and middle position, so a display asking again over
an extent that has not moved gets the bytes it already uploaded: a backend
re-uploads a ramp on identity.

```js
// type signature
(table: {…}, extent: [...]) => { ...; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## RampRef

The ramp a continuous colour scale samples: a named ramp, or evenly spaced
CSS colour stops.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## relight

Move a color's OKLCH lightness by `lightnessShift` and scale its chroma,
holding its hue.

For extending a categorical palette past its length. Cycling a nine-color
list over a 24-chromosome karyotype repeats the color outright; cycling it
with a lightness shift per lap gives the hue back as a variant still told
apart from the original — tab20's construction, which pairs a light and a
dark of each hue.

SHIFT rather than a fixed lightness, and SCALE rather than a fixed chroma,
because a categorical palette is uneven on purpose: category10's brown and
its red are 5 degrees apart in hue and are told apart by chroma alone, so
re-lighting both to one (lightness, chroma) makes them the same color.
Keeping each color's own relative chroma keeps brown reading as brown.

In OKLCH rather than through `lighten`/`darken`, which work in sRGB, where
the same coefficient moves a yellow and a blue by visibly different amounts:
a lap has to read as one tone across the whole palette or it reads as noise.

```js
// type signature
(color: string, lightnessShift: number, chromaScale?: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/color/index.ts)

## runTransforms

Run the transform steps over a feature list, in order, in the worker. The
list a step answers is what the next one reads, and the last one is what
the encoder walks.

```js
// type signature
(features: readonly Feature[], steps: readonly TransformStep[], jexl?: JexlInstance | undefined) => readonly Feature[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

## sampleColorRamp

The color at `t` in `[0, 1]` across a list of EVENLY SPACED stops, linearly
interpolated per channel. `t` is clamped, so the ends are the end stops
rather than an extrapolation past them, and a one-stop ramp is that stop
everywhere.

```js
// type signature
(stops: readonly ColorRampStop[], t: number) => ColorRampStop
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

## ScaleTable

Any channel's scale table; the kind names the channel.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## SessionPaletteProvider

Make JBrowse follow the host's light/dark state — the whole of it, in one
mount:

```tsx
<SessionPaletteProvider session={session} mode={myAppIsDark ? 'dark' : 'light'}>
  {tracks}
</SessionPaletteProvider>
```

`mode` is optional. Left out, JBrowse follows the page's declared
`color-scheme` — so a host whose dark-mode toggle sets it, as most do, mounts
this with a session and nothing else — and the OS preference where the page
declares none.

A component rather than a documented pair of calls because the pair has a
half that can be left out with nothing to show for it. `PaletteProvider` is
the name a host reaches for, and it colors the React side alone; the session
write is what reaches the RPC worker, which bakes feature labels into the
rendered image. So a host that mounts only the provider gets light-mode
labels on a dark page, from a canvas whose every other pixel is right, and
nothing errors. See useSessionPalette for the mechanism.

The session is the only thing that resolves a palette here, so a host
supplying colors of its own mounts `PaletteProvider` directly instead.

```js
// type signature
({ session, mode, children, }: { session: ThemeModeSession; mode?: "dark" | "light" | undefined; children: ReactNode; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/PaletteContext.tsx)

## StackStep

Assign every feature the lowest row on which it overlaps nothing already
there — greedy first fit in start order, the packing a pileup is — and
write it to the field `as` (`row`). `fields` names the interval read
(`start`, `end`); `padding` is bp of clearance kept between two features
sharing a row. The answer is the input in start order, so a `span`
encoding `row` stacks it. Under a facet it packs each section on its own.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## stopsFromRampLut

`n` evenly spaced legend stops read straight out of a
buildColorRampLut byte table — the same 256×1 RGBA array
`uploadColorRampLut` hands the GPU and the Canvas2D fillStyle LUTs index —
as the stops of a `RampScale`. It holds one claim by construction: the
swatch at bar fraction `t` is byte-identical to the ramp entry at `t` on
both backends. Alpha rides `opacity` (the juicebox fade), never baked into
the color string.

```js
// type signature
(lut: Uint8Array<ArrayBufferLike>, n: number) => RampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

## STRAND_FIELD

```js
// type signature
"strand"
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

## thresholdIndex

The bin a value falls in: how many of the ascending cut points it is at or
past, so a palette with one more entry than the domain paints it as
`palette[thresholdIndex(value, domain)]`. A value that is not a finite
number is in no bin and answers -1.

```js
// type signature
(value: unknown, domain: readonly number[]) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

## thresholdLabels

What a threshold scale's bins are called in a key, one label per palette
entry: `< a` below the first cut, `a – b` between two, `≥ b` past the last.

```js
// type signature
(domain: readonly number[]) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

## thresholdPalette

The colour of each interval, in order: the declared palette, and the
default categorical palette where it runs out.

```js
// type signature
(bins: number, palette?: readonly string[]) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

## ThresholdRef

A numeric field cut into intervals: `domain` is the ascending cut points
and `palette` holds one colour more, so a value paints the entry for the
number of cut points it is at or past. A value that is not a number
belongs to no interval.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## TransformStep

One step over the features before a layer is encoded, named by `type` the
way GenomeSpy spells a transform; every step runs in order and the next
reads what the last answered.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## VIRIDIS_STOPS

The 256 viridis stops, fully opaque. Feed them to buildColorRampLut
for the texture/fillStyle form, or to sampleColorRamp for legend
stops.

```js
// type signature
readonly ColorRampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

## ZoomRange

The bp/px interval, `[minBpPerPx, maxBpPerPx)`, over which an adapter with
zoom levels answers a fetch from the same level it answered `opts.bpPerPx`
from. A display holding the answer refetches when the view leaves it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/BaseAdapter/zoomRange.ts)

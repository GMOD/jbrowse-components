---
id: core
title: core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## buildColorRampLut

An RGBA lookup table over sampleColorRamp, laid out as the Nx1
texture both GPU backends upload and the Canvas2D twins index — entry `i` is
the color at `t = i / (N - 1)`. N comes off the shader that samples it, so
the table and `rampColor`'s texel mapping cannot disagree.

```js
// type signature
(stops: readonly ColorRampStop[]) => Uint8Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

## CategoricalRef

A field bound to a categorical scale: each distinct value takes one entry
of the channel's range — a palette entry for `color`, a glyph name for
`glyph`. With a `domain`, the listed values take the range in that order
and whatever else the region meets follows, sorted; without one each value
derives its entry from itself (an integer takes the slot it names, anything
else hashes in), so every region agrees on a value it shares with another at
the cost of an occasional collision, and `domain` is the way to spend the
range deliberately.

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
field to a scale, which is what a legend can describe. A continuous scale
reads the field through `domain` (the region's own extremes when absent)
into `ramp`, and there a listed `domain` is what pins the answer across a
whole view.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## colorEvaluator

A CSS colour or `jexl:` colour expression as a per-feature packed ABGR —
the unscaled arm of ColorEncoding, on its own for a display that
carries a plain `color` slot.

```js
// type signature
(color: string, jexl: JexlInstance) => (feature: Feature) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## ColorScaleTable

The scale a colour channel was resolved through, as the legend reads it —
the same table the colours in the payload came from, so the key cannot
disagree with the painting.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## EncodedChannels

One encoding's channels over one region's features, dense and
index-aligned: instance `i` of every array is the same feature, and
`featureIndex[i]` says which one of the input list it was.

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
request's `encodings[i]` over the region's features, so a display's mark
list indexes straight into it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## encodeFeatures

Evaluate one encoding over a feature list into dense channel arrays, the
scale table its colours came from, the `y` extremes and a hit index.

A feature whose `x`, `x2` or (declared) `y` is not finite is skipped, so
every array stays index-aligned with the Flatbush. Pure: the RPC around it
owns the adapter, the filters and the transferables.

```js
// type signature
(features: readonly Feature[], encoding: MarkEncodingInput, ctx: { jexl: JexlInstance; report?: ProgressReporter | undefined; }) => EncodedChannels
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## FieldRef

Where a channel's value comes from: a feature field name, read natively
(`feature.get(name)`), or a `jexl:` expression over `feature` — the opt-in
escape, three orders of magnitude slower per feature.

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

## MarkEncoding

The declared mapping from a feature's fields to a mark's channels. `x`
defaults to `start` and `x2` to `end`; a mark that plots no value leaves `y`
off. `glyph` is read by the `point` shape alone.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

## MarkEncodingInput

What `encodeFeatures` takes: a MarkEncoding, any channel of which
may be a ChannelReader in place of its declared form. The declared
form is what crosses the wire; a reader is built in the worker.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

## NO_VALUE_LABEL

The key row a feature with nothing in a categorical field lands on, so the
legend says why a mark is grey, or a disc, rather than listing a blank
value.

```js
// type signature
"(no value)"
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

`mode` is optional. Left out, JBrowse follows `prefers-color-scheme` and
re-themes when the OS preference changes, through the same session write an
explicit mode takes — so a host whose dark mode *is* the OS preference mounts
this with a session and nothing else. Pass a mode as soon as the host has a
toggle of its own, since the media query cannot see it.

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

## VIRIDIS_STOPS

The 256 viridis stops, fully opaque. Feed them to buildColorRampLut
for the texture/fillStyle form, or to sampleColorRamp for legend
stops.

```js
// type signature
readonly ColorRampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

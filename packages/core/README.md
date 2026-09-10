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

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### AggregateStep

One feature per distinct `groupby` value set (one for the whole region with
none), spanning its members' extent, carrying the group's fields and every `ops`
entry.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### Band

One band of a display's vertical stack — a coverage histogram, an arc strip, a
conservation row, a variant lane. The contract is the pair: `active` is whether
the band exists right now (the display pre-ANDs its settings half, `showX`, with
its data half, "some lane has ink"), and `height` is the stated height when it
does. Consumers read pixels through reservedPx or stackBands, never by
re-combining the pair — the re-combination is where the reserver and the painter
historically drifted.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### BinStep

Snap every feature to the genome-aligned bin of `step` bp its `field` (`start`
by default) falls in, writing the bin's edges over the fields `as` names —
`start` and `end` by default, so an `aggregate` grouped by those counts per bin
and the bar spans the bin.

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
// type signature
(n: number, { min, max }?: BandBounds) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandHeight.ts)

### buildColorRampLut

An RGBA lookup table over sampleColorRamp, laid out as the Nx1 texture both GPU
backends upload and the Canvas2D twins index — entry `i` is the color at
`t = i / (N - 1)`. N comes off the shader that samples it, so the table and
`rampColor`'s texel mapping cannot disagree.

```js
// type signature
(stops: readonly ColorRampStop[]) => Uint8Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### canonicalizeViewRefName

Resolve user-authored refName text against the assembly of the view containing
`node` — the one normalization layer, which resolves aliases and casing
together. Falls back to the input when the assembly is absent or its aliases
have not loaded.

Keyed off the VIEW's assembly rather than the track's, because the view is what
the comparison is against: displayed regions, loaded regions and blocks all
carry the refNames the view laid out.

Reach for this wherever a refName a _person_ wrote is about to be compared
against regions, features or blocks, which carry the assembly's canonical name.
A refName a display copied off a region is canonical already and needs nothing;
one that arrived in a session spec, a config slot or a URL is whatever the
author read out of the location box.

Skipping it fails silently and, worse, assembly-dependently: `chr12` matches on
an assembly canonicalized `chr12` and matches nothing on one canonicalized `12`,
so the same spec key works on one config and quietly does nothing on the next,
with no error for anyone to act on.

Resolves through `getCanonicalRefName2`, whose fallback is what keeps a spec
read before the alias file has loaded from throwing — and the getters that read
user specs do run from the first render.

Takes a refName, not a spec that might hold one: the resolver reads
`refName.toLowerCase()`, so anything else throws once the aliases are there, and
a caller reading an untyped `frozen` slot has to establish that it names a
refName at all before this is the right question to ask of it.

```js
// type signature
(node: IAnyStateTreeNode, refName: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### CategoricalRef

A field bound to a categorical scale: each distinct value takes one entry of the
channel's range — a palette entry for `color`, a glyph name for `glyph`. With a
`domain`, the listed values take the range in that order and whatever else the
region meets follows, sorted; without one each value derives its entry from
itself (an integer takes the slot it names, anything else hashes in), so every
region agrees on a value it shares with another at the cost of an occasional
collision, and `domain` is the way to spend the range deliberately.

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
// type signature
(current: number, target: number, bounds?: BandBounds) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandHeight.ts)

### ColorEncoding

How a mark's `color` channel resolves. A CSS colour or a `jexl:` expression
returning one paints per feature with no scale; the two object forms bind a
field to a scale, which is what a legend can describe. A continuous scale reads
the field through `domain` (the region's own extremes when absent) into `ramp`,
and there a listed `domain` is what pins the answer across a whole view.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### colorEvaluator

A CSS colour or `jexl:` colour expression as a per-feature packed ABGR — the
unscaled arm of ColorEncoding, on its own for a display that carries a plain
`color` slot.

```js
// type signature
(color: string, jexl: JexlInstance | undefined) => (feature: Feature) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### ColorScaleTable

The scale a colour channel was resolved through, as the legend reads it — the
same table the colours in the payload came from, so the key cannot disagree with
the painting.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### CoverageStep

Replace the features with runs of constant depth: how many of them overlap each
stretch of the region, in a field `as` (`coverage` by default), with the
stretches nothing overlaps left out.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

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
instance `i` of every array is the same feature, and `featureIndex[i]` says
which one of the input list it was. A lane is present when the caller asked for
it (LaneName); Encoded is this type with a known lane set required.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### encodedChannelTransferables

The buffers an EncodedChannels owns, for `rpcResult`'s transfer list.

```js
// type signature
(c: EncodedChannels) => ArrayBufferLike[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### EncodedFeaturesResult

What `CoreEncodeFeatures` answers for one region: `layers[i]` is the request's
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

```js
// type signature
<L extends LaneName>(features: readonly Feature[], encoding: MarkEncodingInput, lanes: readonly L[], ctx?: EncodeContext) => Encoded<L>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### FieldRef

Where a channel's value comes from: a feature field name, read natively
(`feature.get(name)`), or a `jexl:` expression over `feature` — the opt-in
escape, three orders of magnitude slower per feature.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### FilterStep

Keep the features a `jexl:` expression over `feature` admits.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### FlattenStep

Fan each feature out into one feature per element of an array-valued field —
`subfeatures`, so a gene answers its transcripts and a transcript its exons.
Each answer reads the element's own fields first and the feature it came from
for everything else, so an exon still knows its gene's name and strand. A
feature whose field holds no array drops out unless `keepEmpty` says otherwise.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### FormulaStep

Write a `jexl:` expression's value over `feature` into the field `as` of every
feature.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### getAssemblyHost

The host's assembly manager, for a module that resolves names and nothing else.

Unlike the accessors in `sessionServices.ts` this one buys the caller no smaller
type graph — an `AssemblyManager` is an MST model a `PluginManager` built, so
naming it costs what naming a session costs. It is here to say which service is
wanted, and because that cost is the finding: the assembly manager is the one
thing on `AbstractSessionModel` a third-party host cannot simply implement.

```js
// type signature
(node: IAnyStateTreeNode) => AssemblyHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

**This is exactly `readConfObject(model.configuration, path)`** — sugar for the
`.configuration` hop, and nothing more. The two readers carry the same slot-name
check, so reaching for the other one does not get a typo past tsc. It does not
consult the session and has no per-slot behavior; what you read is what the
track stores.

```js
// type signature
{ (model: {…}): ModelSnapshotType<…>; <…>(model: {…}, slotPath: SLOT, args?: Record<…> | undefined): SLOT extends string ? ConfigurationSlotValue<…> : any; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### getContainingDisplay

Returns the display model that contains the given node. Throws if the node has
no containing display.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractDisplayModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getContainingTrack

Returns the track model that contains the given node. Throws if the node has no
containing track.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractTrackModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getContainingView

Returns the view model that contains the given node. Throws if the node has no
containing view.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractViewModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getDialogHost

Where a display puts a dialog it cannot mount itself.

```js
// type signature
(node: IAnyStateTreeNode) => DialogHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getEnv

Returns the MST environment for a node, which carries the `pluginManager`.

```js
// type signature
(obj: IAnyStateTreeNode) => { pluginManager: PluginManager; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getNotificationSink

Where a display puts a message it cannot draw itself.

```js
// type signature
(node: IAnyStateTreeNode) => NotificationSink
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getPaletteHost

The colors to draw with, and the args that rebuild them in a worker.

```js
// type signature
(node: IAnyStateTreeNode) => PaletteHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getRenderingServices

Everything a display needs of its host in order to draw a region: the
assemblies, the RPC entry point and the colors.

```js
// type signature
(node: IAnyStateTreeNode) => RenderingServices
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getRpcHost

The host's RPC entry point, for a module that issues RPCs and nothing else.

```js
// type signature
(node: IAnyStateTreeNode) => RpcHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getSession

Returns the JBrowse session model for any node in the state tree. Throws if the
node has no session ancestor.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractSessionModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getSessionServices

The services a session offers that cost nothing application-shaped to name.
Prefer one of the narrower accessors below, which say which of them the calling
module actually uses.

```js
// type signature
(node: IAnyStateTreeNode) => SessionServices
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### GLYPH_CODES

The `point` shape's glyph code for each name an encoding can say.

```js
// type signature
Record<GlyphName, number>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/glyphNames.ts)

### GlyphEncoding

A GlyphName, a `jexl:` expression over `feature` returning one, or a field bound
to a categorical scale whose `range` lists the glyph names handed out — the
three glyphs, in order, when absent.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### GlyphScaleTable

The scale a glyph channel was resolved through: which glyph each value of the
field took.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### hydrateTrackConfig

Hydrate a plain track config into a live config node, dispatching on its `type`
to find the schema. `session.tracks` holds `types.frozen` plain objects until
something references a track (ADR-031), so a caller handed one of those has a
config that reads nothing but what was literally authored: a slot at its schema
default is absent, `preProcessSnapshot` has not run, and nothing that walks a
live node applies to it.

For the callers that need the resolved answer rather than the authored one and
cannot know which of the two they were handed. The About dialog's "Copy config"
is the case this exists for: it is reached from two menus, and one of them
passes a `session.tracks` entry.

Returns **undefined** rather than throwing when the config names a track type no
plugin registered, or when it is invalid enough that `create` rejects it — an
un-hydrated config has never been validated, so a dialog that opens over it must
not be the thing that discovers this. Callers fall back to treating it as the
plain object it is.

Shares `TrackConfigurationReference`'s per-PluginManager cache, so hydrating the
same entry twice returns the same node — and in admin/embedded sessions a track
opened later resolves to that same node. A non-admin's open track does not: it
resolves to the session's private working copy (ADR-032) and this is the
pristine mirror beside it. The two agree in content, which is what the caller
needs; `CopyConfigEntryPoints.test.ts` pins both halves.

```js
// type signature
(pluginManager: PluginManager, config: Record<string, unknown>) => (ModelInstanceTypeProps<Record<string, any>> & { ...; } & IStateTreeNode<...>) | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchema.ts)

### LaneName

The lanes a caller asks the encoder to fill, beyond `x`, `x2` and
`featureIndex`, which every payload carries: a shape's channels, and `index` for
the Flatbush a hover reads. A lane not asked for is neither allocated nor
transferred, and a caller that never hovers declines the index, which is most of
the encoder's cost after the walk.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### launchOrReplaceView

`addOrReplaceView` for view types whose state model may be lazily loaded; the
synchronous `addOrReplaceView` requires it loaded already.

```js
// type signature
(args: { session: AbstractViewContainer; typeName: string; initialState?: Record<string, unknown> | undefined; replacing?: AbstractViewModel | undefined; }) => Promise<...>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### LayerRequest

One layer of a `CoreEncodeFeatures` request: the encoding to evaluate and the
lanes the display's shape reads.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### MarkEncoding

The declared mapping from a feature's fields to a mark's channels. `x` defaults
to `start` and `x2` to `end`; a mark that plots no value leaves `y` off. `glyph`
is read by the `point` shape alone, `row` — an integer field, 0 where missing —
by the `span` shape, which stacks a feature on the band it names.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### MarkEncodingInput

What `encodeFeatures` takes: a MarkEncoding, any channel of which may be a
ChannelReader in place of its declared form. The declared form is what crosses
the wire; a reader is built in the worker.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### NO_VALUE_LABEL

The key row a feature with nothing in a categorical field lands on, so the
legend says why a mark is grey, or a disc, rather than listing a blank value.

```js
// type signature
'(no value)'
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### RampRef

The ramp a continuous colour scale samples: a named ramp, or evenly spaced CSS
colour stops.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### readConfObject

Given a configuration model (an instance of a ConfigurationSchema), read the
configuration value at the given path. Use this when you hold the configuration
model directly, e.g. an entry from `session.tracks`.

Wants a **live config node**, not a snapshot of one, and passing a snapshot is a
type error. Slots are built with `types.stripDefault`, so a slot sitting at its
default is absent from a snapshot — "unset" and "at its default" are
indistinguishable there, and a read off one reports a default as missing.

That is enforced in the types only, deliberately: it can't be a runtime check.
`generateHierarchy` reads slots straight off the **un-hydrated frozen** entries
of `jbrowse.tracks` on purpose, because hydrating every track to answer the
track selector is what `types.frozen` exists to avoid — and those reads are
indistinguishable at runtime from the broken spelling.

```js
// type signature
{…}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

### readConfSlot

Read a single config slot from a config that may be **either** a live MST node
or a plain snapshot object, evaluating the value if it is a `jexl:` expression.
For the dialogs and panels that are handed a track config without knowing which
of the two they got. An About panel gets a hydrated track config from the
session and a bare object from an embedded caller.

Reach for `readConfObject` or `readConfigValue` when the shape is known: this
one decides at runtime, and the plain branch inherits the snapshot caveat (a
slot at its default is absent from a snapshot, so it reads `undefined`).

```js
// type signature
<…>(config: Record<…> | (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>), slotPath: string | string[], args?: Record<…>, jexl?: JexlInstance | undefined) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

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
re-lighting both to one (lightness, chroma) makes them the same color. Keeping
each color's own relative chroma keeps brown reading as brown.

In OKLCH rather than through `lighten`/`darken`, which work in sRGB, where the
same coefficient moves a yellow and a blue by visibly different amounts: a lap
has to read as one tone across the whole palette or it reads as noise.

```js
// type signature
(color: string, lightnessShift: number, chromaScale?: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/color/index.ts)

### reservedPx

The pixels a band takes from the plot below it: 0 when off, the (optionally
bound) stated height when on. This is the single spelling of "off spends 0 px".

```js
// type signature
(band: Band) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### runLazyAfterAttach

Run a display's `afterAttach` body from a module loaded on demand, so the
autorun installers stay out of the display's eager bundle.

One policy for the gap the `await` opens: a node torn down before the module
lands installs nothing, and a module that fails to load is reported where the
user can see it rather than onto the display's own error slot — that slot is
what `reload()` clears, and nothing would re-run the install behind it. Three
displays hand-rolled this IIFE and each drew the lines differently.

```js
// type signature
<Self extends IStateTreeNode>(self: Self, load: () => Promise<(self: Self) => void>) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/lazyAfterAttach.ts)

### runTransforms

Run the transform steps over a feature list, in order, in the worker. The list a
step answers is what the next one reads, and the last one is what the encoder
walks.

```js
// type signature
(features: readonly Feature[], steps: readonly TransformStep[], jexl?: JexlInstance | undefined) => readonly Feature[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

### sampleColorRamp

The color at `t` in `[0, 1]` across a list of EVENLY SPACED stops, linearly
interpolated per channel. `t` is clamped, so the ends are the end stops rather
than an extrapolation past them, and a one-stop ramp is that stop everywhere.

```js
// type signature
(stops: readonly ColorRampStop[], t: number) => ColorRampStop
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### ScaleTable

Any channel's scale table; the kind names the channel.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### SessionPaletteProvider

Make JBrowse follow the host's light/dark state — the whole of it, in one mount:

```tsx
<SessionPaletteProvider session={session} mode={myAppIsDark ? 'dark' : 'light'}>
  {tracks}
</SessionPaletteProvider>
```

`mode` is optional. Left out, JBrowse follows `prefers-color-scheme` and
re-themes when the OS preference changes, through the same session write an
explicit mode takes — so a host whose dark mode _is_ the OS preference mounts
this with a session and nothing else. Pass a mode as soon as the host has a
toggle of its own, since the media query cannot see it.

A component rather than a documented pair of calls because the pair has a half
that can be left out with nothing to show for it. `PaletteProvider` is the name
a host reaches for, and it colors the React side alone; the session write is
what reaches the RPC worker, which bakes feature labels into the rendered image.
So a host that mounts only the provider gets light-mode labels on a dark page,
from a canvas whose every other pixel is right, and nothing errors. See
useSessionPalette for the mechanism.

The session is the only thing that resolves a palette here, so a host supplying
colors of its own mounts `PaletteProvider` directly instead.

```js
// type signature
({ session, mode, children, }: { session: ThemeModeSession; mode?: "dark" | "light" | undefined; children: ReactNode; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/PaletteContext.tsx)

### setConf

Write counterpart to `getConf`: sets a slot on a state model that has a
`.configuration` member (a track or display state model).

**Prefer this over a bare `self.configuration.setSlot('x', v)`.** The constraint
here mirrors `getConf`'s, so on a model with a concrete schema an unknown slot
name is a compile error. `setSlot` itself stays untyped on purpose — the config
editor's slot facade routes dynamic slot names through it
(`configurationSchema.ts`) — and guards the name at runtime instead (ADR-052),
so a misspelled write is diagnosed one way or the other.

**The read is the half with no diagnostic at all.** `getConf` for a name the
schema doesn't declare returns `undefined` and reports nothing, at any layer, so
the slot keeps reading as its default forever. Which makes the compile-time
constraint worth keeping _reachable_: it is only as good as the schema of the
holder handed in, and a holder widened to `AnyConfigurationModel` switches it
off entirely — the trap a mixin casting to reach its host walks into. Every such
cast names a concrete schema instead (`ConfigModelForFields`, or the base schema
when the slot is the base's), and `HostChecksSlotNames` pins each one.

A wrong _value_ type still throws at runtime (MST type-checks the assignment)
rather than at compile time. `value` is deliberately `unknown` because
`undefined` is a legitimate write — it resets a slot to its schema default — and
the declared slot value type doesn't include it.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<…> = ConfigurationSlotName<…>>(model: { ...; }, slotName: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### stackBands

Fold an ordered set of bands into tops and a bottom. The order is the argument,
so a display states its band order exactly once; reserve, paint and pick all
read the same fold, which is what keeps "the reserver and the painter read one
function" true by construction rather than by prose.

Only the fold is shared. What varies per display stays there: per-lane iteration
runs this once per lane, sticky-vs-scrolling is a property of how the result is
projected to the screen, and a band drawn outside its reservation (an overlay)
carries its own draw rect beside the stack.

```js
// type signature
<K extends string>(order: readonly K[], bands: Record<K, Band>) => BandStack<K>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### stopsFromRampLut

`n` evenly spaced legend stops read straight out of a buildColorRampLut byte
table — the same 256×1 RGBA array `uploadColorRampLut` hands the GPU and the
Canvas2D fillStyle LUTs index — as the stops of a `RampScale`. It holds one
claim by construction: the swatch at bar fraction `t` is byte-identical to the
ramp entry at `t` on both backends. Alpha rides `opacity` (the juicebox fade),
never baked into the color string.

```js
// type signature
(lut: Uint8Array<ArrayBufferLike>, n: number) => RampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### TransformStep

One step over the features before a layer is encoded, named by `type` the way
GenomeSpy spells a transform; every step runs in order and the next reads what
the last answered.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### VIRIDIS_STOPS

The 256 viridis stops, fully opaque. Feed them to buildColorRampLut for the
texture/fillStyle form, or to sampleColorRamp for legend stops.

```js
// type signature
readonly ColorRampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

<!-- API_DOCS_END -->

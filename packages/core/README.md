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
// type signature
(target: AnyConfigurationModel | { configuration: AnyConfigurationModel; }, settings: Record<string, unknown>) => ConfSettingsReport
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### arraySlotUnion

The `ConfigurationSchemaUnion` an array slot's entries answer to, read off the
slot's MST type, or undefined for any other slot.

```js
// type signature
(slotType: IAnyType) => ConfigurationSchemaUnionMetadata | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchemaUnion.ts)

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

### breakendKeepsDirections

Which way the sequence each end of a breakend KEEPS runs from its breakpoint, as
`+1 = right` / `-1 = left` — the convention `StarFusionAdapter`'s
`tickDirection` states and the one every producer in the tree emits.

The two halves read their strings with OPPOSITE polarity, which is the whole
reason to state them together. `Join: 'right'` says the mate piece is joined to
the RIGHT of the ref base, so this end keeps the sequence to its left: negated.
`MateDirection: 'right'` says the mate's own piece extends to the right of the
mate position, which is already the direction it keeps: taken as read. So
`N[chr2:2000[` is `{ joinDirection: -1, mateDirection: 1 }`, and that is the
same pair `StarFusionAdapter` emits for the fusion it describes — the donor
keeps the sequence below its breakpoint (-1) and the acceptor the sequence above
its own (+1).

Split out of `parseSvAlt` because a consumer holding an already-parsed
`Breakend` was re-deriving it by hand, in two adjacent ternaries of opposite
polarity — the shape that produced 78bb7b84f9.

```js
// type signature
(bnd: Breakend) => { mateDirection: number; joinDirection: number; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### buildColorRampLut

An RGBA lookup table over sampleColorRamp, laid out as the Nx1 texture both GPU
backends upload and the Canvas2D twins index — entry `i` is the color at
`t = i / (N - 1)`. N comes off the shader that samples it, so the table and
`rampColor`'s texel mapping cannot disagree.

`mid` is where the stop list's own midpoint lands in the table, so a diverging
ramp whose middle colour belongs at a value off the centre of the domain is
baked into the bytes. Every reader — the shader, the Canvas2D fillStyle table,
the legend bar — then samples one evenly spaced table and cannot disagree about
the warp.

```js
// type signature
(stops: readonly ColorRampStop[], mid?: number) => Uint8Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### canonicalizeViewRefName

Resolve user-authored refName text against the assembly of the view containing
`node`, resolving aliases and casing together. Falls back to the input when the
assembly is absent or its aliases have not loaded.

Uses the view's assembly, not the track's, because displayed regions, loaded
regions and blocks all carry the refNames the view laid out.

Call it wherever a refName a _person_ wrote is about to be compared against
regions, features or blocks, which carry the assembly's canonical name. A
refName a display copied off a region is already canonical. One from a session
spec, a config slot or a URL is whatever the author typed.

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
// type signature
(node: IAnyStateTreeNode, refName: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### categoricalField

`labels` names the `domain`'s values in a key, one each in order, where a config
spells them for a reader rather than as the data does.

```js
// type signature
(field: string, {…}?: { domain?: readonly string[] | undefined; range?: readonly string[] | undefined; labels?: readonly string[] | undefined; }) => CategoricalField
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### CategoricalField

One categorical field as every channel reads it — a facet's sections, a color's
range entries, a key's rows. `key` files a value, `compare` orders keys (the
`domain` first, the rest by `compareGroupKeys`, `''` after them), `label` names
a key in a legend, `sectionLabel` on a chip, and `color` paints it. A key's
color depends only on the key and the declaration, so every region agrees on it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### CategoricalRef

A field bound to a categorical scale: each distinct value takes one entry of the
channel's `range` — a colour for `color`, a shape name for `shape`. Every value
derives its entry from itself (an integer takes the slot it names, anything else
hashes in), so every region agrees on a value it shares with another at the cost
of an occasional collision. A `domain` spends the range deliberately: the listed
values take it in order, and a value the domain leaves out never takes a listed
value's entry. The domain orders and spends; it never adds a value the data
lacks.

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

### COLOR_SCHEMES

The named ramps a continuous colour scale's `scheme` takes, each one a stop
table in `colorRamp.ts` that every ramp baker reads, so no display can name a
scheme nothing bakes. `viridis`, `magma`, `inferno` and `cividis` are
matplotlib's perceptual ramps, dark at the low end; `juicebox` fades from
transparent to red, as Juicebox paints contacts; `fall` runs white through
yellow and red to black, as HiGlass does; `reds` and `blues` are ColorBrewer's,
from white; `redblue` and `purpleorange` diverge through white, ColorBrewer's
RdBu and PuOr.

```js
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
  'purpleorange')
]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorSchemes.ts)

### ColorEncoding

How a mark's `color` channel resolves. A CSS colour or a `jexl:` expression
returning one paints per feature with no scale; the object forms bind a field to
a scale, which a legend can describe, and share the config's member names.

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

### colorRampStops

The stops a continuous colour scale samples: `range`'s CSS colours where it
lists any, else the named `scheme`, viridis while that is unset, turned round
under `reverse`.

```js
// type signature
({ range, scheme, reverse, }: RampDeclaration) => readonly ColorRampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### ColorScaleTable

The scale a colour channel was resolved through, as the legend reads it — the
same table the colours in the payload came from, so the key cannot disagree with
the painting.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### ColorSchemeName

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorSchemes.ts)

### ConfigurationSchemaUnion

A list entry that is one of several configuration schemas, each keyed by the
`type` it answers to:
`types.array(ConfigurationSchemaUnion('Step', { filter, bin }))`. The keys are
the vocabulary, the snapshot's `type` picks the member, and a `type` naming no
member is refused in every build — where a bare `types.union` would load it as
its first member. Each member is an `explicitlyTyped`, `closed` schema named by
its key, so a key belonging to another member is refused rather than dropped;
one that is not throws here.

```js
// type signature
<const MEMBERS extends Record<string, AnyConfigurationSchemaType>>(name: string, members: MEMBERS) => ConfigurationSchemaUnionType<MEMBERS>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchemaUnion.ts)

### continuousColorScale

A continuous colour scale over `extent`, the values it met: the domain its
declared ends and the extent make, the stops and the table they bake to, and the
packed colour a value paints through them: an infinity the end on its side, as a
threshold places it, and NaN, text that is no number, the misconfiguration grey.
The encoder and every display painting a ramp itself read it, so a value takes
one colour whoever paints it.

```js
// type signature
(encoding: ContinuousRef, extent: readonly [number, number]) => {…}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### ContinuousRef

A numeric field read through a linear or log scale into a ramp. Each end of the
domain is pinned by `domainMin` or `domainMax`, or is the region's own extreme
where unset, so pinning both keeps colours consistent across a whole view. The
ramp is `range`'s CSS colours, evenly spaced, where it lists any, else the named
`scheme`; `reverse` turns it round.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### CoverageStep

Replace the features with runs of constant depth: how many of them overlap each
stretch of the region, in a field `as` (`coverage` by default), with the
stretches nothing overlaps left out.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### darkAtLowEnd

Whether a named ramp runs dark at its low end, drawn over white: viridis and its
siblings do, juicebox, fall, reds and blues do not.

```js
// type signature
(scheme: "blues" | "cividis" | "fall" | "inferno" | "juicebox" | "magma" | "purpleorange" | "redblue" | "reds" | "viridis") => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### DEFAULT_COLOR_SCHEME

The ramp a continuous scale samples while it names no `range` and no `scheme`,
so a declaration spelling it out and one leaving it unset resolve alike.

```js
// type signature
;'blues' |
  'cividis' |
  'fall' |
  'inferno' |
  'juicebox' |
  'magma' |
  'purpleorange' |
  'redblue' |
  'reds' |
  'viridis'
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorSchemes.ts)

### EncodeContext

What surrounds an encode: the jexl instance a `jexl:` channel compiles against —
a caller whose channels are all readers or field names passes none — a progress
reporter, and the region the features were fetched for, in the adapter's naming,
with which an `x2` on another sequence indexes over the whole region, since the
curve to it reaches the region's edge from its near foot.

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

### FacetedLayer

One layer of a faceted request: its features in section order, and the stacked
row of each, index for index.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/featureTransforms.ts)

### facetLayers

A faceted request's layers: the features split on the facet's field, the facet's
own steps and then each layer's run over each section alone, and the sections
stacked — a section's rows start where the one above it ends, and it is as tall
as the tallest layer packed it. Every layer's features come back in section
order beside their stacked rows, so a faceted display is the unfaceted one drawn
once per section, and a feature is handed on as its steps left it. A layer
naming no `row` field stands on each section's first row, the answer the
unfaceted encoder gives it.

```js
// type signature
(features: readonly Feature[], facet: FacetSpec, layers: readonly {…}[], jexl?: JexlInstance | undefined) => { ...; }
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

### fieldReader

What a channel reads off a feature: a field by name, a dotted path into a
structured field where no field carries the whole name (`INFO.SVTYPE` on a VCF
record), or a `jexl:` expression over `feature`. A jexl expression that does not
compile throws here, once, rather than on every feature.

```js
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

### getBreakendMateLocString

The mate locString ("chr2:100") of a parsed breakend, or undefined when it names
no navigable position. Two ALT forms reach here without one: a single breakend
(`.A` / `G.`) has no mate at all, and the symbolic-mate forms (`G<DEL>`,
`<DEL>G`) get a placeholder `<DEL>:1` from parseBreakend, which puts a symbolic
allele id where a contig name belongs. Callers that navigate or split-view a
mate must drop both rather than treat `<DEL>` as a refName.

```js
// type signature
(breakend?: Breakend | undefined) => string | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

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
{…}
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

### HitIndexed

An encoded payload as a display stores it: the hit index the worker built with
hitIndexOf, wrapped once where the payload lands.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### hitIndexOf

The hit index over `count` instances: each a box from `x` to `x2` at its `y`, or
at 0 for a mark with no value.

```js
// type signature
(x: Uint32Array<ArrayBufferLike>, x2: Uint32Array<ArrayBufferLike>, y: Float32Array<ArrayBufferLike> | undefined, count?: number) => Flatbush
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### hydrateTrackConfig

Hydrate a plain track config into a live config node, dispatching on its `type`
to find the schema. `session.tracks` holds `types.frozen` plain objects until
something references a track (ADR-031). One of those holds only what was
literally authored: a slot at its schema default is absent, `preProcessSnapshot`
has not run, and nothing that walks a live node applies to it.

Use it where a caller needs the resolved config and may be handed either form.
The About dialog's "Copy config" is reached from two menus, and one of them
passes a `session.tracks` entry.

Returns **undefined** when the config names a track type no plugin registered,
or when `create` rejects it as invalid. An un-hydrated config has never been
validated, so the dialog opening over it should not throw. Callers fall back to
using the plain object.

Shares `TrackConfigurationReference`'s per-PluginManager cache, so hydrating the
same entry twice returns the same node, and in an admin session a track opened
later resolves to that same node. A non-admin's open track resolves to the
session's private working copy (ADR-032), and this function returns the pristine
mirror beside it. The two have the same content; `CopyConfigEntryPoints.test.ts`
tests both cases.

```js
// type signature
(pluginManager: PluginManager, config: Record<string, unknown>) => AnyConfigurationModel | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchema.ts)

### isMissing

Whether a field holds no value at all, as against text that fails to parse:
absent, empty, or a VCF's `AF=.`, which arrives as `[undefined]`.

```js
// type signature
(value: unknown) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### isPlainFieldRef

Whether a field ref is a bare name: what `feature.get` answers on its own, with
no path to walk and no expression to evaluate. A loop over a plain name keeps
the direct call, and only a config that writes a path pays for one.

```js
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

A VCF end is its own position. A paired adapter's end is a block, and the
junction is the block's edge on the side the end keeps: stated by
`mateDirection` where the adapter knows it, read off the strands where the
record states one for each end as BEDPE does, and with neither the two blocks
face each other. A PAF row's strand is the query's orientation and states none
for the target, so it names no side.

```js
// type signature
(feature: Feature, alt?: string | undefined) => { own: JunctionEnd; mate: JunctionEnd; } | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### LaneName

The lanes a caller asks the encoder to fill, beyond `x`, `x2` and
`featureIndex`, which every payload carries: a mark's channels, and `index` for
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
lanes the display's mark reads.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### LocusRef

A position that may lie on another sequence: the field holding its refName and
the field holding its 0-based coordinate, as a paired record states its mate
(`{ chrom: 'mate.refName', pos: 'mate.start' }`). Spelt the way GenomeSpy spells
a genomic position over two columns.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### MarkEncoding

The declared mapping from a feature's fields to a mark's channels. Every
positional channel is a field: `x` defaults to `start` and `x2` to `end`, a mark
that plots no value leaves `y` off, and the scale `y` is read through belongs to
the display rather than to the encoding. `shape` is read by the `point` mark
alone, `row` — an integer field, 0 where missing — by every mark, which stands a
feature in the band it names.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### MarkEncodingInput

What `encodeFeatures` takes: a MarkEncoding, any channel of which may be a
ChannelReader in place of its declared form, and `row` the values themselves,
one per input feature, where the caller computed them — a facet's stacked rows.
The declared form is what crosses the wire; a reader or a value list is built in
the worker.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### MateStep

One feature per other end a record states: the `mate` a paired adapter fills in
(BEDPE, STAR-Fusion), or each VCF `ALT` naming a locus, a breakend's mate or a
symbolic allele's `END` on `CHR2` or its own sequence. Each answer carries
`mate` (`refName`, `start`, `end`, 0-based and half-open, and the far end's
`mateDirection`), its own end's `mateDirection`, the `alt` it came from and
`svtype`, the record's `INFO.SVTYPE` or the allele's kind. A record naming no
other end drops out, and two records or alleles stating one pair of ends answer
once.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### MISCONFIGURED_ABGR

The misconfiguration grey packed as the encoder paints it: a `jexl:` colour that
answered no string, a ramp value that is no number, text a threshold cannot
read.

```js
// type signature
number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### NO_VALUE_ABGR

The no-value grey packed as the encoder paints it: a feature with nothing in the
field a threshold reads.

```js
// type signature
number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### NO_VALUE_LABEL

The row a feature with nothing in a categorical field lands on, so a key says
why a mark is grey rather than listing a blank value.

```js
// type signature
'(no value)'
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### NOT_A_NUMBER_LABEL

The key a value holding text that is no number files under on a threshold scale,
painted the misconfiguration grey rather than passing for a missing value.

```js
// type signature
'(not a number)'
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### numericDomain

A domain written as strings — the shared `domain` slot is a `stringArray` — read
back as the numbers it names. A member that is not a number reads NaN, which
every comparison against it declines.

```js
// type signature
(domain: readonly (string | number)[]) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### parseSvAlt

Parse raw (non-assembly-resolved) mate coordinates from a VCF SV feature+alt.
Returns undefined when no mate coordinate info is found.

```js
// type signature
(feature: Feature, alt?: string | undefined) => { mateRefName: string; matePos: number; mateDirection?: number | undefined; joinDirection?: number | undefined; } | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### PileupStep

Assign every feature the lowest row on which it overlaps nothing already there —
greedy first fit in start order, the packing a pileup is — and write it to the
field `as` (`row`). `fields` names the interval read (`start`, `end`); `padding`
is bp of clearance kept between two features sharing a row. The answer is the
input in start order, so a `span` encoding `row` stacks it. Under a facet it
packs each section on its own.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

### preProcessConfigSnapshot

A snapshot as `type` admits it: the same lift and checks `type.create` applies,
so a dialog or a validator refuses exactly what a config file cannot hold.
Throws what the schema's `preProcessSnapshot` throws.

```js
// type signature
(type: IAnyType, snapshot: unknown) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/snapshotPreprocess.ts)

### RampDeclaration

A continuous colour scale's ramp as a config declares it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### rampDomain

The domain a continuous colour scale spans: each end `min` or `max` pins, else
the extent's, ascending, since a span has no direction and `reverse` is the
ramp's. An open end stops at a pinned one rather than crossing it, and an extent
holding no value (`[Infinity, -Infinity]`) spans [0, 1].

```js
// type signature
(min: number | undefined, max: number | undefined, extent: readonly [number, number]) => [number, number]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### rampGapScales

The rows a ramp's key lists beside its bar once a feature painted one: the
not-a-number and no-value rows a threshold's key ends with. Empty while neither
painted.

```js
// type signature
(id: string, met: { missing?: boolean | undefined; notNumber?: boolean | undefined; }) => CategoricalScale[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### rampLutOf

The buildColorRampLut table a ramp declaration asks for, the same `Uint8Array`
for the same declaration, since a GPU backend re-uploads its ramp texture when
the identity changes and a render state is rebuilt far more often than its ramp.

```js
// type signature
(ramp: RampDeclaration) => Uint8Array<ArrayBufferLike>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### rampOverExtent

A ramp table over `extent`, the union a display took across the regions it
loaded: each open end of the domain moved to the union's, the pinned ends kept,
and the table baked again where a `domainMid` places its middle stop by that
domain. Each region baked its own, so keeping the first region's put the middle
colour at a value none of them declared.

One table per stop list and middle position, so a display asking again over an
extent that has not moved gets the bytes it already uploaded: a backend
re-uploads a ramp on identity.

```js
// type signature
(table: {…}, extent: [number, number]) => {…}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

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

### requirementProblems

The `requires` entries of a configuration schema that `snapshot` does not meet,
as a config file or `getSnapshot` spells it: a slot left off reads as its
default, so a `when` value that is the default fires for an absent slot, which
is what the generated JSON Schema's `if` does.

```js
// type signature
(type: IAnyType, snapshot: Record<string, unknown>) => RequirementProblem[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/requirements.ts)

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

### safeParseBreakend

parseBreakend, honoring its `Breakend | undefined` signature. ALT strings are
user data and malformed breakends do occur;

```js
// type signature
(alt: string) => Breakend | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

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

### selectEncodedFeature

Open the feature widget on the feature behind one instance of a
`CoreEncodeFeatures` answer. A display holds channels, not records, so it sends
`CoreGetEncodedFeature` the request the instance's region came back under, and
the worker answers the entry of `layer`'s list that the instance's
`featureIndex` names: the record as the adapter wrote it, or the bin or run the
steps made. A second click aborts the first.

```js
// type signature
(self: IStateTreeNode<IAnyType>, rotation: { begin(): ActiveFetch; cancel: () => void; dispose(): void; }, args: Omit<CoreEncodeFeaturesArgs, "byteLimit"> & { ...; }) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/selectEncodedFeature.ts)

### SessionPaletteProvider

Make JBrowse follow the host's light/dark state — the whole of it, in one mount:

```tsx
<SessionPaletteProvider session={session} mode={myAppIsDark ? 'dark' : 'light'}>
  {tracks}
</SessionPaletteProvider>
```

`mode` is optional. Left out, JBrowse follows the page's declared `color-scheme`
— so a host whose dark-mode toggle sets it, as most do, mounts this with a
session and nothing else — and the OS preference where the page declares none.

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

Write counterpart to `getConf`, and it takes the same path: a slot name, or an
array naming a sub-schema's member at any depth —
`setConf(self, ['scales', 'y', 'domainMin'], 5)`. Takes the display or track
model, or a config node directly.

**The path length says what the write replaces.** A path ending on a slot writes
that slot and leaves the object around it alone; a path ending on a sub-schema
replaces the whole object, which is how a channel whose members move together —
a facet's field and the domain that field's values order — gets written without
a stale member surviving underneath.

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
<…>(target: CONFMODEL | { ...; }, slotPath: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### SHAPE_CODES

The `point` mark's painter code for each shape an encoding can name.

```js
// type signature
Record<ShapeName, number>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/shapeNames.ts)

### ShapeEncoding

A ShapeName, a `jexl:` expression over `feature` returning one, or a field bound
to a categorical scale whose `range` lists the shape names handed out — the
three shapes, in order, when absent.

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
`range` is the px at each end of the domain (1 to 6 unset), and each end of the
domain is pinned by `domainMin` or `domainMax` or follows the loaded regions'
extremes where unset, as a colour ramp's does. A feature holding no number takes
the range's first px.

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

### STRAND_FIELD

```js
// type signature
'strand'
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/categoricalField.ts)

### svTypeOfAlt

The structural variant type an ALT allele spells: a symbolic allele's name
(`<DEL>` and `<DUP:TANDEM>` give `DEL` and `DUP`), `BND` for a breakend, else
undefined.

```js
// type signature
(alt: string | undefined) => string | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/svAlt.ts)

### thresholdCuts

A threshold scale's cut points as thresholdIndex walks them: the numbers the
domain names, ascending. Cuts written high to low, as p-value thresholds often
are, left the middle interval unreachable, the walk stopping at the first cut a
value is under.

```js
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
// type signature
(field: string, {…}?: { domain?: readonly string[] | undefined; range?: readonly string[] | undefined; labels?: readonly string[] | undefined; }) => CategoricalField
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdIndex

The bin a value falls in: how many of the ascending cut points it is at or past,
so a palette with one more entry than the domain paints it as
`palette[thresholdIndex(value, domain)]`. A value that is not a number is in no
bin and answers -1; an infinite one takes the end bin on its side, as d3's
threshold scale places it, so a `-log10` of a zero p-value lands in the top bin.

```js
// type signature
(value: unknown, domain: readonly number[]) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdKeyEntries

A threshold key's rows: every interval, painted or not, since the bins are the
whole domain, then the not-a-number and no-value rows where a feature took one,
in the order `thresholdField` sorts them.

```js
// type signature
(cuts: readonly number[], range: readonly string[] | undefined, met: {…}, names?: readonly string[]) => {…}[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdLabels

What a threshold scale's bins are called in a key, one label per palette entry:
`< a` below the first cut, `a – b` between two, `≥ b` past the last.

```js
// type signature
(domain: readonly number[]) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### thresholdPalette

The colour of each interval, in order: the declared palette, and the default
categorical palette where it runs out.

```js
// type signature
(bins: number, palette?: readonly string[]) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/thresholdScale.ts)

### ThresholdRef

A numeric field cut into intervals: `domain` is the ascending cut points and
`range` holds one colour more, so a value paints the entry for the number of cut
points it is at or past. A value that is not a number belongs to no interval.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncodingTypes.ts)

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

### withHitIndex

HitIndexed over what the worker shipped.

```js
// type signature
<T extends EncodedChannels>(channels: T) => HitIndexed<T>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/markEncoding.ts)

### ZoomRange

The bp/px interval, `[minBpPerPx, maxBpPerPx)`, over which an adapter with zoom
levels answers a fetch from the same level it answered `opts.bpPerPx` from. A
display holding the answer refetches when the view leaves it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/BaseAdapter/zoomRange.ts)

<!-- API_DOCS_END -->

---
title: Configuration schema
description:
  Slot types, inheritance, callbacks, preProcessSnapshot, and reading config
  values
guide_category: Core concepts
---

JBrowse configuration is built with `ConfigurationSchema`, a thin wrapper around
MST (`@jbrowse/mobx-state-tree`) models. Every adapter, track, and display
declares a schema of typed slots; instances are created from config JSON and
observed reactively. Read slots with `getConf` (from a state model) or
`readConfObject` (from a raw config node).

## Defining a schema

`ConfigurationSchema(name, slots, options)`. `BedGraphAdapter` is about as small
as a real one gets:

<!-- include: plugins/bed/src/BedGraphAdapter/configSchema.ts -->

````ts
import {
  ConfigurationSchema,
  expandUriShorthand,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandUriShorthand(snap, 'bedGraphLocation')
}

/**
 * #config BedGraphAdapter
 * #trackType QuantitativeTrack
 * #fileFormat quantitative | BedGraph (plain) | Loaded entirely into memory; for small files
 * used to load plain-text bedGraph signal files. Loads the whole file into
 * memory, so prefer the BedGraphTabixAdapter for large files.
 *
 * #example
 * ```js
 * {
 *   type: 'BedGraphAdapter',
 *   uri: 'https://example.com/signal.bedGraph',
 * }
 * ```
 */
const BedGraphAdapter = ConfigurationSchema(
  'BedGraphAdapter',
  {
    /**
     * #slot
     * location of the plain-text bedGraph (`chrom start end value`, one line
     * per interval). May be gzipped.
     */
    bedGraphLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bedgraph',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "BedGraphAdapter",
     *   "uri": "yourfile.bed"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)
export type BedGraphAdapterConfig = Instance<typeof BedGraphAdapter>

export default BedGraphAdapter
````

The name must match the `type` field in config JSON, and `explicitlyTyped: true`
requires that field to be present. Each slot becomes an observable MST property.

The `Instance<typeof …>` export at the bottom is how the rest of the codebase
gets a typed handle on the schema — it is the `CONF` in
`BaseFeatureDataAdapter<BedGraphAdapterConfig>`, which types `this.getConf(...)`
reads. Export one from every schema you write.

The `#config`, `#slot`, and `#preProcessSnapshot` JSDoc tags generate the
[config reference pages](/docs/config); they are not part of the schema API.

## Slot types

A slot's `type` is one of a closed set. Everything downstream keys off the name:
the MST type the value is built from, what a `getConf` read of it is typed as,
and which control the configuration editor renders for it. Because the system is
typed, a slot can be edited graphically without an author writing any UI.

<!-- SLOT_TYPES START -->

<!-- prettier-ignore -->
| `type` | MST model | Reads as | Config editor renders |
| --- | --- | --- | --- |
| <code>boolean</code> | <code>types.boolean</code> | <code>boolean</code> | checkbox |
| <code>maybeBoolean</code> | <code>types.maybe(types.boolean)</code> | <code>boolean &#124; undefined</code> | checkbox |
| <code>color</code> | <code>CssColorType</code> | <code>string</code> | text field beside a swatch that opens a color picker |
| <code>maybeColor</code> | <code>types.maybe(CssColorType)</code> | <code>string &#124; undefined</code> | text field beside a swatch that opens a color picker |
| <code>colorArray</code> | <code>types.array(CssColorEntryType)</code> | <code>string[]</code> | a text field and color picker per entry, with add and delete |
| <code>featureField</code> | <code>types.string</code> | <code>string</code> | single-line text field |
| <code>fileLocation</code> | <code>FileLocation</code> | <code>FileLocation</code> | URL, local file path (desktop) or file blob (browser) |
| <code>maybeFileLocation</code> | <code>MaybeFileLocation</code> | <code>FileLocation &#124; undefined</code> | URL, local file path (desktop) or file blob (browser) |
| <code>frozen</code> | <code>types.frozen()</code> | <code>any</code> | monospace textarea holding arbitrary JSON |
| <code>maybeFrozen</code> | <code>types.maybe(types.frozen())</code> | <code>any</code> | monospace textarea holding arbitrary JSON |
| <code>integer</code> | <code>types.integer</code> | <code>number</code> | numeric text field that rounds to an integer |
| <code>number</code> | <code>types.number</code> | <code>number</code> | numeric text field |
| <code>maybeNumber</code> | <code>types.maybe(types.number)</code> | <code>number &#124; undefined</code> | numeric text field |
| <code>numberMap</code> | <code>types.map(types.number)</code> | <code>Record&lt;string, number&gt;</code> | one card per key, each holding that key's numeric field |
| <code>string</code> | <code>types.string</code> | <code>string</code> | single-line text field |
| <code>maybeString</code> | <code>types.maybe(types.string)</code> | <code>string &#124; undefined</code> | single-line text field |
| <code>stringArray</code> | <code>types.array(types.string)</code> | <code>string[]</code> | "todolist" of text fields, one per entry, with add and delete |
| <code>stringArrayMap</code> | <code>types.map(types.array(types.string))</code> | <code>Record&lt;string, string[]&gt;</code> | one card per key, each holding that key's "todolist" of strings |
| <code>stringEnum</code> | the `model` the slot declares | the `model` enumeration's members | dropdown of the `model`'s members |
| <code>maybeStringEnum</code> | the `model` the slot declares | the `model` enumeration's members | dropdown of the `model`'s members |
| <code>stringEnumArray</code> | the `model` the slot declares | a list of the `model` enumeration's members | a dropdown of the `model`'s members per entry, with add and delete |
| <code>stringMap</code> | <code>types.map(types.string)</code> | <code>Record&lt;string, string&gt;</code> | one card per key, each holding that key's text field |
| <code>text</code> | <code>types.string</code> | <code>string</code> | multi-line textarea |

<!-- SLOT_TYPES END -->

A name outside this set is rejected at schema construction. That check exists
because such a slot otherwise still _works_ — the value round-trips as long as
you supply a `model` — and the only symptom is that everything keyed off the
type name stops recognising it.

The `maybe*` forms are `undefined` while unset. Unset is the one state no config
can spell, so it stays distinguishable from every real value a user might write,
and a display reads it as "decide this from the data" — a MAF track's `height`
fits its rows when nobody has fixed one, and a feature `color` left unset lets
the feature's own BED color through.

Because unset _is_ their default, **`maybe*` slots omit `defaultValue`** — every
other type must declare one, and leaving it off is a type error. Writing
`defaultValue: undefined` on a `maybe*` slot is legal but usually adds nothing.

The exception is a `maybe*` slot **overriding a base slot that has a concrete
default**: the override merges field-by-field, so omitting `defaultValue`
inherits the base's value and the slot is never unset. State
`defaultValue: undefined` there to overwrite it.

`frozen` and `maybeFrozen` hold arbitrary JSON. The value is not deeply
reactive, and reads are typed `any` — the structure is the caller's to assert.

For enums, use `type: 'stringEnum'` and add a `model` field. The value scale's
`type` member:

<!-- include: packages/wiggle-core/src/valueScaleConfigSchema.ts#stringEnumSlot -->

```ts
type: {
  type: 'stringEnum',
  model: types.enumeration('ValueScaleType', [...scaleTypes]),
  defaultValue: 'linear',
  description: scaleTypes.join(' or '),
},
```

`stringEnum` (and `maybeStringEnum`) are the only types the config editor reads
the `model`'s choices from, so a slot typed anything else renders as a free text
input however valid its `model` is. A `maybeStringEnum` dropdown carries a
leading "default" entry above the members, which is how the unset state is both
shown and set.

## Schema inheritance with baseConfiguration

Displays inherit base display slots by passing `baseConfiguration` in the
options argument. `LinearMafDisplay` declares its own slots and takes the rest
from the base linear display schema:

<!-- include: plugins/maf/src/LinearMafDisplay/configSchema.ts#schemaOptions -->

```ts
{
  /**
   * #baseConfiguration
   */
  baseConfiguration: baseLinearDisplayConfigSchema,
  explicitlyTyped: true,
  preProcessSnapshot: refuseRetiredConfig,
},
```

`fillLocations` settles precedence: the derived locations fill in the slots, and
any slot the config spells out for itself wins. So a config naming both a `uri`
and an index that does not sit next to the data file keeps the index it named.

Passed as `preProcessSnapshot: normalizeSnapshot` in the schema's options, that
allows minimal configs in `config.json` — neither `bamLocation` nor `index` is
written out:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "my_alignments_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://yourhost/file.bam"
  }
}
```

`preProcessSnapshot` also runs on track configs to inject missing display stubs
for each display type the track supports.

## Reading config values

Which reader you want follows from what you are holding and what the slot is.
The full signatures are in the
[configuration API reference](/docs/api/core-configuration).

Use `getConf` when you hold a **state model** that has a `.configuration` member
(a track model, display model, etc.) — `LinearMarkDisplay`'s
`displayCrossHatches` getter is `getConf(self, 'displayCrossHatches')`, and its
typed `conf` getter, in a block of its own, is what every later block reads a
sub-schema through:

<!-- include: plugins/marks/src/LinearMarkDisplay/model.ts#chainedViews -->

```ts
.views(self => ({
  /**
   * #getter
   * the config typed off the concrete schema
   */
  get conf(): LinearMarkDisplayConfig {
    return self.configuration
  },
}))
```

Use `readConfObject` when you hold the **config model itself** — an entry from
`session.tracks`, or a sub-config you resolved yourself. The multi-wiggle
"combine selected tracks" menu item works on the track selector's selection,
which holds configs rather than models:

<!-- include: plugins/wiggle/src/CreateMultiWiggleExtension/index.ts#readConfObject -->

```ts
// `tracks` are the selected track *configs*, not track models, so these
// are readConfObject reads rather than getConf ones
assemblyNames: [
  ...new Set(tracks.flatMap(c => readConfObject(c, 'assemblyNames'))),
],
adapter: {
  subadapters: tracks.map(c => ({
    ...readConfObject(c, 'adapter'),
    source: readConfObject(c, 'name'),
  })),
},
```

A TypeScript error "Property 'configuration' is missing" is the signal that you
have a raw config and should call `readConfObject` instead of `getConf`.

`getConf` and `readConfObject` both accept a path array for nested access —
`getConf(self, ['adapter', 'sequenceAdapter'])`, or the adapter form shown under
[configuration internals](#configuration-internals) below.

Writes go through [`setConf`](/docs/api/core-configuration#setconf), not a bare
`self.configuration.setSlot('x', v)`. `setConf` constrains the slot name against
the schema the same way `getConf` does, so on a model whose schema is concrete a
typo is a compile error. `setSlot` takes a plain `string` and cannot do that; it
throws at runtime instead, naming the slots the schema does declare. That
runtime check is the backstop for the writes the compile-time one cannot see —
anything through a mixin or a widened factory, where the concrete schema is
erased.

## ConfigurationReference

State models refer to their config via `ConfigurationReference`, alongside the
`type` literal that discriminates them. This is one argument of the model's
`types.compose(...)` chain, which is where the model gets its name:

<!-- include: plugins/marks/src/LinearMarkDisplay/model.ts#configRef -->

```ts
types.model({
  type: types.literal('LinearMarkDisplay'),
  /**
   * #property
   */
  configuration: ConfigurationReference(configSchema),
```

`ConfigurationReference` is a union of a string ID reference and the full config
snapshot. At runtime it resolves to the MST config node, either by looking up
the ID in the session's config registry, or by hydrating the inline snapshot.

The resolution dispatch is based on `explicitIdentifier` in the schema options:

- `'trackId'` → `TrackConfigurationReference` (resolves through
  `session.getTrackById(id)`)
- `'displayId'` → `DisplayConfigurationReference`
- anything else → plain reference

`ConfigurationReference` carries the schema through to `self.configuration`, so
`getConf(self, slot)` and `readConfObject(self.configuration, slot)` check the
slot name and return its real value type — **but only when the schema is
concrete**. Type the state model factory's `configSchema` parameter to the
schema's own type, not to `AnyConfigurationSchemaType`, or the reads degrade to
`any` with no compile error to say so. A `conf` getter typed off the concrete
schema (`get conf(): LinearMarkDisplayConfig`) is still the tidy way to name it
once, the same move as `BaseAdapter<CONF>`, but it no longer provides the
checking.

## Frozen track hydration

`jbrowse.tracks` is stored as `types.frozen` (plain JS objects) for performance
with thousands of tracks. Track configs become MST nodes lazily, only when a
track is opened and `TrackConfigurationReference.get()` is called. The hydrated
node is cached on the `PluginManager`: MST's custom-reference `get()` memoizes
nothing, so without that cache every read of `track.configuration` would
fabricate a fresh non-identical node.

The cache is why `session.getTrackById(id)` hands back a plain object for a
track nobody has opened: access it with `readConfObject`, not `getConf`. (There
is a `getTracksById()` returning the whole map, but it is deprecated — reading
it subscribes the caller to every track, so an edit to any one of them wakes
it.)

## Config callbacks (jexl)

A slot takes a callback in place of a plain value where it declares
`contextVariable`, the arguments the callback reads; the calling code supplies
them as the third argument to `readConfObject`. The mark display's colour object
declares one on its `value`:

<!-- include: plugins/marks/src/LinearMarkDisplay/markColorConfigSchema.ts#contextVariableSlot -->

```ts
/**
 * #slot value
 * A CSS colour, or a jexl callback over `feature` returning one, for a
 * mark whose colour is not a scale. Writing `color: 'red'` or
 * `color: 'jexl:…'` directly on the encoding lands here.
 */
value: {
  type: 'color',
  defaultValue: DEFAULT_MARK_COLOR,
  description: 'CSS colour or jexl callback',
  contextVariable: ['feature'],
},
```

The multi-way synteny display reads its gene `utrColor` that way, once per
feature and memoized, and not at all when the slot holds a plain colour:

<!-- include: plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/geneColor.ts#contextVariableRead -->

```ts
// the slot as written, not resolved: a jexl colour read without a feature
// evaluates against an empty context and hands back the fallout (adr-066)
const utrConstant = isJexl(utrColor)
  ? undefined
  : cssColorToABGR(String(utrColor))
const utr = (feature: Feature) =>
  utrConstant ??
  memo(utrByFeature, feature.id(), () =>
    cssColorToABGR(String(readConfObject(conf, 'utrColor', { feature }))),
  )
```

`getConf` takes the context object in the same third position. Evaluate these
once per feature when the features or config change, not per frame: panning only
moves pixels, and re-running a jexl expression per feature per frame is the
usual cause of a display that scrolls badly.

:::warning An arg-less read of a callback slot resolves it against nothing

The context object is `readConfObject`'s and `getConf`'s optional third
argument, so "what is this setting" and "what is this setting for this feature"
are the same call with and without it. On a slot holding a `jexl:` value the
arg-less form still evaluates, against a context where every name the expression
mentions is `undefined`, and hands back the fallout as the setting. Nothing
throws at the reader, and the two ways it goes wrong look nothing alike:

- the expression touches a member of the missing value (`get(feature,…)`) and
  throws out of whatever getter did the read, which shows up as the display
  erroring;
- every function in it is total (`split(feature.name,…)`), and a plausible wrong
  value comes back — `''`, `NaN` — and travels on as a real setting.

A value going into `rpcProps()`, a renderer, or a worker is one something
downstream will still bind a feature to. Read it **raw** (`self.conf.someSlot`),
not through a reader. A value used on the main thread here and now, such as a
swatch, a menu label, or arithmetic, is a resolving read instead, and needs
either a feature in the third argument or an `isJexl` guard and a fallback,
since no single swatch can show a per-feature expression.

:::

Callbacks are written in [jexl](https://github.com/TomFrost/Jexl). For example,
a `VariantTrack` can color SNVs green and everything else purple:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "my_variant_track",
  "name": "Variants colored by type",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/file.vcf.gz"
  },
  "displayDefaults": {
    "color": "jexl:feature.type=='SNV'?'green':'purple'"
  }
}
```

A callback may call custom jexl functions your plugin registers with
`pluginManager.jexl.addFunction` (see [](/docs/developer_guides/no_build_plugin)
for a worked example). The [jexl config guide](/docs/config_guides/jexl) covers
the expression language itself.

A slot that declares no `contextVariable` refuses a `jexl:` string: loading a
config, `setSlot`, the config editor and the generated JSON Schema each name the
slot. A callback the code evaluates is one the schema says it takes, so a
missing declaration shows up the first time a config writes one.

A slot naming a field the display reads per feature, such as a colour or facet
`field`, is a `featureField` rather than a callback. It takes a field name, a
dotted path, or a `jexl:` expression deriving the value, and the display
evaluates that expression per feature, so `readConfObject` and `getConf` hand it
over as written.

## Configuration internals

A configuration is a `@jbrowse/mobx-state-tree` model tree: leaf nodes are
config-slot types and inner nodes are `ConfigurationSchema` types. All
configurations descend from a single root, `root.configuration`.

```text
       Schema
    /     |     \
   Slot  Schema  Slot
         |    \
         Slot  Slot
```

A schema can nest a sub-schema as a slot. `BamAdapter` embeds its index config
that way:

<!-- include: plugins/alignments/src/BamAdapter/configSchema.ts#nesting -->

```ts
/**
 * #slot
 * location of the BAM file. Per-base mismatches come from the record's MD
 * tag when it has one, and are otherwise computed against the assembly's
 * reference sequence.
 */
bamLocation: {
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bam',
    locationType: 'UriLocation',
  },
},

/**
 * #slot
 * where the BAM index is and which kind it is. The `uri` shorthand derives
 * both, so a config using it states neither.
 */
index: bamIndexSchema(),
```

Read a nested slot with a path array. From inside an adapter that is
`BaseAdapter<CONF>`, the read goes through `this.getConf`:

<!-- include: plugins/alignments/src/BamAdapter/BamAdapter.ts#nestedRead -->

```ts
// a path array reaches into the nested `index` sub-schema; reading
// `getConf('index').indexType` instead would bypass default resolution
const csi = this.getConf(['index', 'indexType']) === 'CSI'
const location = this.getConf(['index', 'location'])
```

Avoid reading properties directly off the result (e.g.
`readConfObject(config, ['index']).indexType`), which bypasses default-value
resolution.

## See also

- [](/docs/developer_guides/mst_patterns)
- [](/docs/developer_guides/creating_display)
- [CONFIG_PATTERN.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/CONFIG_PATTERN.md)
  — the whole path a display's config takes to reach a renderer: config to MST
  snapshot to plain object to RPC payload, and what each hop may carry

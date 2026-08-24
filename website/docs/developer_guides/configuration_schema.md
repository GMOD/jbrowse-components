---
title: Configuration schema
description:
  Slot types, inheritance, callbacks, preProcessSnapshot, and reading config
  values
guide_category: Core concepts
---

**TL;DR:** JBrowse configuration is built with `ConfigurationSchema`, a thin
wrapper around MST models. Every adapter, track, and display declares a schema
of typed slots; instances are created from config JSON and observed reactively.
Read slots with `getConf` (from a state model) or `readConfObject` (from a raw
config node).

## Defining a schema

`ConfigurationSchema(name, slots, options)`. `BedGraphAdapter` is about as small
as a real one gets:

<!-- include: plugins/bed/src/BedGraphAdapter/configSchema.ts -->

````ts
import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bedGraphLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
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
is what requires that field to be present. Each slot becomes an observable MST
property.

The `Instance<typeof …>` export at the bottom is how the rest of the codebase
gets a typed handle on the schema — it is the `CONF` in
`BaseFeatureDataAdapter<BedGraphAdapterConfig>`, which types `this.getConf(...)`
reads. Export one from every schema you write.

The `#config`, `#slot`, and `#preProcessSnapshot` JSDoc tags generate the
[config reference pages](/docs/config); they are not part of the schema API.

## Slot types

A slot's `type` is one of a closed set. The name is what everything downstream
keys off: the MST type the value is built from, what a `getConf` read of it is
typed as, and — because the system is typed — which control the configuration
editor renders for it, so a slot can be edited graphically without an author
writing any UI.

<!-- SLOT_TYPES START -->

<!-- prettier-ignore -->
| `type` | MST model | Reads as | Config editor renders |
| --- | --- | --- | --- |
| <code>boolean</code> | <code>types.boolean</code> | <code>boolean</code> | checkbox |
| <code>maybeBoolean</code> | <code>types.maybe(types.boolean)</code> | <code>boolean &#124; undefined</code> | checkbox |
| <code>color</code> | <code>types.string</code> | <code>string</code> | text field beside a swatch that opens a color picker |
| <code>maybeColor</code> | <code>types.maybe(types.string)</code> | <code>string &#124; undefined</code> | text field beside a swatch that opens a color picker |
| <code>fileLocation</code> | <code>FileLocation</code> | <code>FileLocation</code> | URL, local file path (desktop) or file blob (browser) |
| <code>frozen</code> | <code>types.frozen()</code> | <code>any</code> | monospace textarea holding arbitrary JSON |
| <code>maybeFrozen</code> | <code>types.maybe(types.frozen())</code> | <code>any</code> | monospace textarea holding arbitrary JSON |
| <code>integer</code> | <code>types.integer</code> | <code>number</code> | numeric text field that rounds to an integer |
| <code>number</code> | <code>types.number</code> | <code>number</code> | numeric text field |
| <code>maybeNumber</code> | <code>types.maybe(types.number)</code> | <code>number &#124; undefined</code> | numeric text field |
| <code>numberMap</code> | <code>types.map(types.number)</code> | <code>Record&lt;string, number&gt;</code> | one card per key, each holding that key's numeric field |
| <code>string</code> | <code>types.string</code> | <code>string</code> | single-line text field |
| <code>stringArray</code> | <code>types.array(types.string)</code> | <code>string[]</code> | "todolist" of text fields, one per entry, with add and delete |
| <code>stringArrayMap</code> | <code>types.map(types.array(types.string))</code> | <code>Record&lt;string, string[]&gt;</code> | one card per key, each holding that key's "todolist" of strings |
| <code>stringEnum</code> | the `model` the slot declares | the `model` enumeration's members | dropdown of the `model`'s members |
| <code>maybeStringEnum</code> | the `model` the slot declares | the `model` enumeration's members | dropdown of the `model`'s members |
| <code>text</code> | <code>types.string</code> | <code>string</code> | multi-line textarea |

<!-- SLOT_TYPES END -->

A name outside this set is rejected at schema construction. That check exists
because such a slot otherwise still _works_ — the value round-trips as long as
you supply a `model` — and the only symptom is that everything keyed off the
type name stops recognising it.

The `maybe*` forms are `undefined` while unset. That is what a **promotable**
slot needs: `undefined` means "not set on this track, follow the session-wide
default", and it is the one value no config can spell, so it stays
distinguishable from every real value the user might write. Pair it with
`promotedBase` for what inheriting resolves to, and read it with `resolveConf`.
`lineWidth` in the example below is one.

Because unset _is_ their default, **`maybe*` slots omit `defaultValue`** — every
other type must declare one, and leaving it off is a type error. Writing
`defaultValue: undefined` on a `maybe*` slot is legal but usually says nothing.

The exception is a `maybe*` slot **overriding a base slot that has a concrete
default**: the override merges field-by-field, so omitting `defaultValue`
inherits the base's value and the slot is never unset. State
`defaultValue: undefined` there to overwrite it.

`frozen` and `maybeFrozen` hold arbitrary JSON. The value is not deeply
reactive, and reads are typed `any` — the shape is the caller's to assert.

For enums, use `type: 'stringEnum'` and add a `model` field. The score axis's
`scaleType` slot:

<!-- include: packages/wiggle-core/src/scoreAxisConfigSchemaFields.ts#stringEnumSlot -->

```ts
scaleType: {
  type: 'stringEnum',
  model: types.enumeration('Scale type', ['linear', 'log']),
  defaultValue: 'linear',
  description: 'Scale type (linear or log)',
},
```

`stringEnum` (and `maybeStringEnum`) are the only types the config editor reads
the `model`'s choices from, so a slot typed anything else renders as a free text
input however valid its `model` is. A `maybeStringEnum` dropdown carries a
leading "default" entry above the members, which is how the unset state is both
shown and set.

## Schema inheritance with baseConfiguration

Displays inherit base display slots by passing `baseConfiguration`.
`LinearPairedArcDisplay` declares two slots of its own and takes the rest from
the base linear display schema:

<!-- include: plugins/arc/src/LinearPairedArcDisplay/configSchema.ts#schema -->

```ts
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearPairedArcDisplay',
    {
      /**
       * #slot
       */
      color: {
        type: 'color',
        description: 'the color of the arcs',
        defaultValue: 'jexl:defaultPairedArcColor(feature,alt)',
        contextVariable: ['feature', 'alt'],
      },
      /**
       * #slot
       */
      lineWidth: {
        type: 'maybeNumber',
        description:
          'the stroke width of the arcs, in pixels. Unset (the default) follows the session-wide default for this display type',
        // sentinel promotable slot: see promotableDefaults.ts
        promotedBase: defaultArcLineWidth,
      },
      /**
       * #slot
       */
      minScore: {
        type: 'number',
        defaultValue: 0,
        description:
          'hide arcs whose feature score is below this; features with no score are always drawn',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
```

(The `#slot` and `#baseConfiguration` comments are JSDoc tags that generate the
[config reference pages](/docs/config) — they are not part of the schema API.)

The base schema's slots are merged in first. When a name collides, what happens
depends on the kind of entry:

- **A slot the child redeclares merges field-by-field over the base slot**, so
  the override states only what differs and inherits the rest: `description`,
  `advanced`, `contextVariable`, `validate`, `model`, and the promotable fields.
  Keep `type` in the override either way: that is what marks an entry as a slot
  rather than a nested sub-schema.
- **A nested sub-schema or a constant replaces the base entry wholesale.** They
  have no fields to fold.

To turn an inherited field off, state it rather than omitting it:
`mySlot: { type: 'number', defaultValue: 4, advanced: false }` still inherits
the base slot's `description` and `validate`, and is not advanced here.

The schema's third argument — its options — merges the same shallow way, with
four exceptions. `actions`, `views`, `extend` and `preProcessSnapshot`
**compose** with the base's instead of replacing them, base first. The first
three chain through separate MST calls, so the base's members are on `self`
inside your function and you override one by redeclaring its name;
`preProcessSnapshot` folds to `child(base(snapshot))`, so the base normalizes
before you see the snapshot. `createBaseTrackConfig` declares two of the four —
`actions` and `preProcessSnapshot` — so a track config schema that declares its
own composes on top of the base's.

Pass the type `ConfigurationSchema()` returned, and nothing else. The slot table
lives in a registry keyed by that exact type, so a `types.late` wrapper or a
union from `pluginManager.pluggableConfigSchemaType(…)` carries none of it: both
type-check, and both throw at construction.

:::note Changed behavior

An override used to _replace_ the whole base slot definition, so every field it
left out was dropped. If your plugin redeclares a slot from a base display
schema and was relying on that (to shed an inherited `advanced` or `validate`,
say), state the field explicitly, as above. Overrides that only moved a
`defaultValue` need no change.

:::

## preProcessSnapshot

Use `preProcessSnapshot` to normalize incoming config JSON before the MST model
is created. It is what makes the `uri` shorthand work: `BamAdapter` passes this
function, which expands a bare `uri` into the `bamLocation` and `index` slots
the schema actually declares, and derives the index name from it.

<!-- include: plugins/alignments/src/BamAdapter/configSchema.ts#preProcess -->

```ts
export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bamLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        index: {
          indexType: snap.csi ? 'CSI' : 'BAI',
          location: {
            uri: `${snap.uri}.${snap.csi ? 'csi' : 'bai'}`,
            baseUri: snap.baseUri,
          },
        },
      }
    : snap
}
```

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
(a track model, display model, etc.) — `LinearArcDisplay`'s `displayMode`
getter:

<!-- include: plugins/arc/src/LinearArcDisplay/model.ts#chainedViews -->

```ts
  /**
   * #getter
   * the config typed off the concrete schema; `ConfigurationReference`
   * erases `self.configuration` to `any`, so reads route through this to
   * stay typed (same move as `BaseAdapter<CONF>`)
   */
  get conf(): LinearArcDisplayConfig {
    return self.configuration
  },
  /**
   * #getter
   * arcs whose feature scores below this are not drawn; 0 (the default)
   * draws every arc, as does any feature carrying no score
   */
  get minScore(): number {
    return getConf(self, 'minScore')
  },
  /**
   * #getter
   * the score span the filter slider is laid out over, `undefined` when the
   * loaded features give it nothing to filter on
   */
  get scoreRange() {
    return self.features && featureScoreRange(self.features)
  },
}))
.views(self => ({
  /**
   * #getter
   */
  get displayMode(): ArcDisplayMode {
    return getConf(self, 'displayMode')
  },
```

Use `readConfObject` when you hold the **config model itself** — an entry from
`session.tracks`, or a sub-config you resolved yourself. The multi-wiggle
"combine selected tracks" menu item works on the track selector's selection,
which is configs rather than models:

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

Both accept a path array for nested access —
`getConf(self, ['adapter', 'sequenceAdapter'])`, or the adapter form shown under
[configuration internals](#configuration-internals) below.

Use [`resolveConf`](/docs/api/core-configuration#resolveconf) on a
**promotable** slot, and only there. `getConf` stays raw, so it returns the
`undefined` inherit sentinel along with the real values — a type you cannot hand
to a consumer expecting a real setting, which is how the compiler points at the
read that should have been `resolveConf`. Never silence that with
`?? someDefault`: it bypasses the cascade rather than walking it. `resolveConf`
throws on a plain slot, which has no cascade to walk.

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

<!-- include: plugins/arc/src/LinearPairedArcDisplay/model.ts#configRef -->

```ts
types.model({
  /**
   * #property
   */
  type: types.literal('LinearPairedArcDisplay'),
  /**
   * #property
   */
  configuration: ConfigurationReference(configSchema),
}),
```

`ConfigurationReference` is a union of a string ID reference and the full config
snapshot. At runtime it resolves to the MST config node, either by looking up
the ID in the session's config registry, or by hydrating the inline snapshot.

The resolution dispatch is based on `explicitIdentifier` in the schema options:

- `'trackId'` → `TrackConfigurationReference` (resolves through
  `session.getTrackById(id)`)
- `'displayId'` → `DisplayConfigurationReference`
- anything else → plain reference

`ConfigurationReference` types `self.configuration` as `any`, so reads off it
are unchecked. Displays that care add a `conf` getter typed off the concrete
schema (`get conf(): LinearPairedArcDisplayConfig`) and read through that — the
same move as `BaseAdapter<CONF>`.

## Frozen track hydration

`jbrowse.tracks` is stored as `types.frozen` (plain JS objects) for performance
with thousands of tracks. Track configs become MST nodes lazily, only when a
track is opened and `TrackConfigurationReference.get()` is called. The hydrated
node is cached on the `PluginManager`: MST's custom-reference `get()` memoizes
nothing, so without that cache every read of `track.configuration` would
fabricate a fresh non-identical node.

This is why `session.getTrackById(id)` hands back a plain object for a track
nobody has opened: access it with `readConfObject`, not `getConf`. (There is a
`getTracksById()` returning the whole map, but it is deprecated — reading it
subscribes the caller to every track, so an edit to any one of them wakes it.)

## Config callbacks (jexl)

Any slot can hold a callback instead of a plain value. A slot's
`contextVariable` field lists the arguments the callback expects; the calling
code supplies them as the third argument to `readConfObject`:

<!-- include: plugins/arc/src/LinearArcDisplay/configSchema.ts#contextVariableSlot -->

```ts
color: {
  type: 'color',
  description: 'the color of the arcs',
  defaultValue: 'darkblue',
  contextVariable: ['feature'],
},
```

`LinearArcDisplay` reads all five of its per-feature slots that way, in one
getter kept out of the render loop:

<!-- include: plugins/arc/src/LinearArcDisplay/model.ts#contextVariableRead -->

```ts
get arcStyles() {
  // thickness/arcHeight are `type: 'number'` slots, so getConf types (and
  // returns) a number — both have a default, so the read is never unset.
  // color/label/caption are string slots read through the typed self.conf.
  const kept =
    self.features && filterByScore(self.features, self.minScore)
  return kept?.map(feature => ({
    feature,
    color: readConfObject(self.conf, 'color', { feature }),
    thickness: getConf(self, 'thickness', { feature }),
    label: readConfObject(self.conf, 'label', { feature }),
    caption: readConfObject(self.conf, 'caption', { feature }),
    arcHeight: Math.min(
      getConf(self, 'arcHeight', { feature }),
      self.height,
    ),
  }))
},
```

`getConf` takes the context object in the same third position. Evaluate these
once per feature when the features or config change, not per frame: panning only
moves pixels, and re-running a jexl expression per feature per frame is the
usual cause of a display that scrolls badly.

:::warning An arg-less read of a callback slot resolves it against nothing

That third argument is **optional**, so "what is this setting" and "what is this
setting for this feature" are the same call with and without it. On a slot
holding a `jexl:` value the arg-less form still evaluates, against a context
where every name the expression mentions is `undefined`, and hands back the
fallout as the setting. Nothing throws at the reader, and the two ways it goes
wrong look nothing alike:

- the expression touches a member of the missing value (`get(feature,…)`) and
  throws out of whatever getter did the read, which surfaces as the display
  erroring;
- every function in it is total (`split(feature.name,…)`), and a plausible wrong
  value comes back — `''`, `NaN` — and travels on as a real setting.

So a value that something downstream will still bind a feature to — anything
going into `rpcProps()`, a renderer, or a worker — must be read **raw**
(`self.conf.someSlot`), not through a reader. A value being used on the main
thread here and now — a swatch, a menu label, arithmetic — is a resolving read,
and needs either a feature in the third argument or an `isJexl` guard and a
fallback, since no single swatch can show a per-feature expression.

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

`contextVariable` is editor metadata and nothing more: it is what raises the
config editor's value/callback toggle, and no part of the read path consults it.
A slot that declares none is still reachable by hand-writing `jexl:` into the
JSON, so declare one to make the editor work — but never read it as a signal
that a slot does or doesn't hold a callback. A promotable slot is the one place
the pair is refused outright, and that throws at construction: the cascade
discards a `jexl:` value at both tiers, so the toggle would offer a control
whose every write silently degraded back to `promotedBase`.

## Configuration internals

A configuration is a `@jbrowse/mobx-state-tree` model tree: leaf nodes are
config-slot types and inner nodes are `ConfigurationSchema` types. All
configurations descend from a single root, `root.configuration`.

```
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

index: ConfigurationSchema('BamIndex', {
  /**
   * #slot index.indexType
   * `BAI` is the usual `samtools index` output. `CSI` is required for a
   * reference longer than 512 Mb, which BAI cannot address.
   */
  indexType: {
    model: types.enumeration('IndexType', ['BAI', 'CSI']),
    type: 'stringEnum',
    defaultValue: 'BAI',
  },
  /**
   * #slot index.location
   * location of the index. Only needed when it is not named
   * `<file>.bam.bai` (or `.bam.csi`), which is what the `uri` shorthand
   * assumes.
   */
  location: {
    type: 'fileLocation',
    defaultValue: {
      uri: '/path/to/my.bam.bai',
      locationType: 'UriLocation',
    },
  },
}),
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

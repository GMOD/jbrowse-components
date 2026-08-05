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

The canonical list of slot types. Because the system is typed, each slot can be
edited graphically; [Graphical editing](#graphical-editing) below shows how each
type renders.

| Type             | JS type                    | Notes                                               |
| ---------------- | -------------------------- | --------------------------------------------------- |
| `string`         | `string`                   |                                                     |
| `text`           | `string`                   | Alias for string; textarea in the GUI               |
| `number`         | `number`                   | Float                                               |
| `integer`        | `number`                   | Integer                                             |
| `boolean`        | `boolean`                  |                                                     |
| `stringEnum`     | `string`                   | One of a fixed set; needs a `model` (see below)     |
| `color`          | `string`                   | Validated CSS color string; color picker in the GUI |
| `fileLocation`   | `FileLocation`             | `{ uri, locationType }` or `{ localPath }`          |
| `stringArray`    | `string[]`                 |                                                     |
| `stringArrayMap` | `Record<string, string[]>` |                                                     |
| `numberMap`      | `Record<string, number>`   |                                                     |
| `frozen`         | `unknown`                  | Arbitrary JSON; not deeply reactive                 |

Five types also have a `maybe` form — `maybeNumber`, `maybeBoolean`,
`maybeColor`, `maybeFrozen`, `maybeStringEnum` — whose default is `undefined`
rather than a concrete value. That is what a **promotable** slot needs:
`undefined` means "not set on this track, follow the session-wide default", and
it is the one value no config can spell, so it stays distinguishable from every
real value the user might write. Pair it with `promotedBase` for what inheriting
resolves to, and read it with `resolveConf`. `lineWidth` in the example below is
one.

For enums, use `type: 'stringEnum'` and add a `model` field. The wiggle
display's `summaryScoreMode` slot:

<!-- include: plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts#stringEnumSlot -->

```ts
summaryScoreMode: {
  type: 'stringEnum',
  model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
  description:
    'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
  defaultValue: 'whiskers',
},
```

`stringEnum` (and `maybeStringEnum`) are the only types the config editor reads
the `model`'s choices from, so a slot typed anything else renders as a free text
input however valid its `model` is.

## Graphical editing

Because slots are typed, the configuration editor renders an appropriate control
for each one:

- `stringEnum` - dropdown box
- `color` - color picker
- `boolean` - checkbox
- `number` / `integer` - numeric input
- `string` - text input
- `text` - textarea
- `frozen` - textarea holding arbitrary JSON
- `fileLocation` - URL, local file path (desktop), or file blob (browser)
- `stringArray` - "todolist" editor to add/remove entries
- `stringArrayMap` / `numberMap` - key-value editors

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
        defaultValue: undefined,
        promotedBase: defaultArcLineWidth,
        promotable: true,
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
  Keep `type` and `defaultValue` in the override either way: those are what mark
  an entry as a slot rather than a nested sub-schema.
- **A nested sub-schema or a constant replaces the base entry wholesale.** They
  have no fields to fold.

To turn an inherited field off, state it rather than omitting it:
`mySlot: { type: 'number', defaultValue: 4, advanced: false }` still inherits
the base slot's `description` and `validate`, and is not advanced here.

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
allows minimal configs in `config.json`:

```json
"adapter": {
  "type": "BamAdapter",
  "uri": "tracks/sample.bam"
}
```

`preProcessSnapshot` also runs on track configs to inject missing display stubs
for each display type the track supports.

## Reading config values

The full signatures for `getConf` and `readConfObject` are in the
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
}))
.views(self => ({
  /**
   * #getter
   */
  get displayMode() {
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

- `'trackId'` → `TrackConfigurationReference` (looks in `session.tracksById`)
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
node is cached by identity so the same frozen object always produces the same
MST node.

This is why `session.tracksById` returns plain objects: access them with
`readConfObject`, not `getConf`.

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
  return self.features?.map(feature => ({
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

Callbacks are written in [jexl](https://github.com/TomFrost/Jexl). For example,
a `VariantTrack` display can color SNVs green and everything else purple:

```json
"displays": [
  {
    "type": "LinearVariantDisplay",
    "displayId": "volvox_filtered_vcf_color-LinearVariantDisplay",
    "color": "jexl:get(feature,'type')=='SNV'?'green':'purple'"
  }
]
```

Any slot with a `contextVariable` can take a jexl callback as its default value,
including custom jexl functions your plugin registers with
`pluginManager.jexl.addFunction` (see [](/docs/developer_guides/no_build_plugin)
for a worked example). The [jexl config guide](/docs/config_guides/jexl) covers
the expression language itself.

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

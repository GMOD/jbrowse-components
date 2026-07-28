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

```ts
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

const MyAdapterConfigSchema = ConfigurationSchema(
  'MyAdapter', // schema name, must match the `type` field in config
  {
    // Slots — each becomes an observable MST property
    endpoint: {
      type: 'string',
      defaultValue: 'https://api.example.com',
      description: 'API endpoint URL',
    },
    maxResults: {
      type: 'integer',
      defaultValue: 100,
    },
    colorBy: {
      type: 'stringEnum',
      model: types.enumeration('ColorBy', ['strand', 'basemod', 'none']),
      defaultValue: 'none',
    },
  },
  {
    explicitlyTyped: true, // requires `type` field in config JSON
  },
)
```

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

For enums, use `type: 'stringEnum'` and add a `model` field:

```ts
displayMode: {
  type: 'stringEnum',
  model: types.enumeration('DisplayMode', ['normal', 'compact', 'collapse']),
  defaultValue: 'normal',
},
```

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

Displays inherit base display slots by passing `baseConfiguration`:

```ts
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearMyDisplay',
    {
      mySlot: { type: 'string', defaultValue: '' },
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
```

The base schema's slots are merged in first. When a name collides, what happens
depends on the kind of entry:

- **A slot the child redeclares merges field-by-field over the base slot**, so
  the override states only what differs and inherits the rest — `description`,
  `advanced`, `contextVariable`, `validate`, `model`, and the promotable fields.
  Keep `type` and `defaultValue` in the override either way: those are what mark
  an entry as a slot rather than a nested sub-schema.
- **A nested sub-schema or a constant replaces the base entry wholesale.** They
  have no fields to fold.

To turn an inherited field off, state it rather than omitting it:

```ts
// inherits the base slot's description and validate, but is not advanced here
mySlot: { type: 'number', defaultValue: 4, advanced: false },
```

:::note Changed behavior

An override used to _replace_ the whole base slot definition, so every field it
left out was dropped. If your plugin redeclares a slot from a base display
schema and was relying on that — to shed an inherited `advanced` or `validate`,
say — state the field explicitly, as above. Overrides that only moved a
`defaultValue` need no change.

:::

## preProcessSnapshot

Use `preProcessSnapshot` to normalize incoming config JSON before the MST model
is created, for example to support a shorthand URI syntax:

```ts
ConfigurationSchema(
  'MyAdapter',
  {
    indexLocation: { type: 'fileLocation', defaultValue: { uri: 'data.ix' } },
    dataLocation: { type: 'fileLocation', defaultValue: { uri: 'data.bin' } },
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap =>
      snap.uri
        ? {
            ...snap,
            dataLocation: { uri: snap.uri, baseUri: snap.baseUri },
            indexLocation: { uri: `${snap.uri}.ix`, baseUri: snap.baseUri },
          }
        : snap,
  },
)
```

This allows minimal configs in `config.json`:

```json
{ "type": "MyAdapter", "uri": "tracks/data.bin" }
```

`preProcessSnapshot` also runs on track configs to inject missing display stubs
for each display type the track supports.

## Reading config values

The full signatures for `getConf` and `readConfObject` are in the
[configuration API reference](/docs/api/core-configuration).

Use `getConf` when you hold a **state model** that has a `.configuration` member
(a track model, display model, etc.):

```ts
import { getConf } from '@jbrowse/core/configuration'

// Inside a .views() or .actions() block
get name() {
  return getConf(self, 'name')
},
get adapterConfig() {
  return getConf(self, 'adapter')
},
```

Use `readConfObject` when you hold the **config model itself** (e.g., an entry
from `session.tracks`, or a sub-config you resolved yourself):

```ts
import { readConfObject } from '@jbrowse/core/configuration'

const maxHeight = readConfObject(config, 'maxHeight')
const displayMode = readConfObject(config, 'displayMode')
```

A TypeScript error "Property 'configuration' is missing" is the signal that you
have a raw config and should call `readConfObject` instead of `getConf`.

Both accept a path array for nested access:

```ts
getConf(self, ['adapter', 'sequenceAdapter'])
readConfObject(config, ['index', 'indexType'])
```

## ConfigurationReference

State models refer to their config via `ConfigurationReference`:

```ts
import { ConfigurationReference } from '@jbrowse/core/configuration'

types.model('LinearMyDisplay', {
  type: types.literal('LinearMyDisplay'),
  configuration: ConfigurationReference(myConfigSchema),
})
```

`ConfigurationReference` is a union of a string ID reference and the full config
snapshot. At runtime it resolves to the MST config node, either by looking up
the ID in the session's config registry, or by hydrating the inline snapshot.

The resolution dispatch is based on `explicitIdentifier` in the schema options:

- `'trackId'` → `TrackConfigurationReference` (looks in `session.tracksById`)
- `'displayId'` → `DisplayConfigurationReference`
- anything else → plain reference

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

```js
color: {
  type: 'color',
  defaultValue: 'goldenrod',
  contextVariable: ['feature'],
},
```

```js
readConfObject(config, 'color', { feature })
```

Callbacks are written in [jexl](https://github.com/TomFrost/Jexl). For example,
a `VariantTrack` display can color SNVs green and everything else purple:

```json
{
  "type": "LinearVariantDisplay",
  "displayId": "volvox_filtered_vcf_color-LinearVariantDisplay",
  "color": "jexl:get(feature,'type')=='SNV'?'green':'purple'"
}
```

Any slot with a `contextVariable` can take a jexl callback as its default value,
including [custom jexl functions](/docs/developer_guides/pluggable_elements)
your plugin registers. See the [jexl config guide](/docs/config_guides/jexl) for
more.

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

A schema can nest a sub-schema as a slot. For example, `BamAdapter` embeds its
index config:

```js
ConfigurationSchema(
  'BamAdapter',
  {
    bamLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam', locationType: 'UriLocation' },
    },
    index: ConfigurationSchema('BamIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bam.bai',
          locationType: 'UriLocation',
        },
      },
    }),
  },
  { explicitlyTyped: true },
)
```

Read a nested slot with a path array:

```js
const indexType = readConfObject(config, ['index', 'indexType'])
```

Avoid reading properties directly off the result (e.g.
`readConfObject(config, ['index']).indexType`), which bypasses default-value
resolution.

## See also

- [](/docs/developer_guides/mst_patterns)
- [](/docs/developer_guides/creating_display)

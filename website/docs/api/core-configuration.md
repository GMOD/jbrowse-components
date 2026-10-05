---
id: core-configuration
title: core/configuration
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## applyConfSettings

Write a settings bag — a session spec's track entry, a share link, an agent
call — onto a config. Each key names a member: a slot or a channel is written
whole, as `setConf` writes it, so `null` resets it (ADR-146); a namespace's
object names members inside it, at any depth, and the ones it leaves out
keep their values. The config's own lift and checks run over the bag first,
and each namespace's over its part, so a shorthand or a legacy key reads the
same here as in `config.json`. A key the config does not declare is reported
for the caller to route or refuse, and a declared key whose write throws
costs that key alone.

```js
// type signature
(target: AnyConfigurationModel | { configuration: AnyConfigurationModel; }, settings: Record<string, unknown>) => ConfSettingsReport
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## arraySlotUnion

The `ConfigurationSchemaUnion` an array slot's entries answer to, read off
the slot's MST type, or undefined for any other slot.

```js
// type signature
(slotType: IAnyType) => ConfigurationSchemaUnionMetadata | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchemaUnion.ts)

## ConfigurationSchemaUnion

A list entry that is one of several configuration schemas, each keyed by the
`type` it answers to: `types.array(ConfigurationSchemaUnion('Step', { filter,
bin }))`. The keys are the vocabulary, the snapshot's `type` picks the
member, and a `type` naming no member is refused in every build — where a
bare `types.union` would load it as its first member. Each member is an
`explicitlyTyped`, `closed` schema named by its key, so a key belonging to
another member is refused rather than dropped; one that is not throws here.

```js
// type signature
<const MEMBERS extends Record<string, AnyConfigurationSchemaType>>(name: string, members: MEMBERS) => ConfigurationSchemaUnionType<MEMBERS>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchemaUnion.ts)

## evaluateForFeature

A config value as `feature` reads it: a `jexl:` callback evaluated against
the feature, anything else as written.

```js
// type signature
(value: unknown, feature: Feature, jexl: JexlInstance) => unknown
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

## getConf

Reads a configuration value from a track or display state model: exactly
`readConfObject(model.configuration, path)`, with the same slot-name check.

```js
// type signature
{…}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## hydrateTrackConfig

Hydrate a plain track config, such as a `session.tracks` entry, into a live
config node, dispatching on its `type` to find the schema. A plain entry
holds only what was authored: a slot at its default is absent and
`preProcessSnapshot` has not run.

Returns **undefined** when no plugin registered the type or `create` rejects
the config, which has never been validated; callers fall back to the plain
object. Hydrating one entry twice returns one node. A shown track resolves to
the session's working copy instead (ADR-032), which has the same content.

```js
// type signature
(pluginManager: PluginManager, config: Record<string, unknown>) => AnyConfigurationModel | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchema.ts)

## liftPlot

A draft as the display's config would hold it, through the schema's own
lift and checks: a shorthand becomes its object, a default falls off, and
what a config file is refused for throws, a key outside the plot included.
The node is never attached, so nothing on the display is touched; a display
reads its typed members off it. The draft is copied first, since MST
freezes what it creates from.

```js
// type signature
(conf: AnyConfigurationModel, draft: Plot) => AnyConfigurationModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

## parsePlot

The text as a plot, refusing a key the display's plot does not hold. The
schema is the parser past this point.

```js
// type signature
(text: string, keys: readonly string[]) => Plot
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

## Plot

A display's plot settings as written: a key left out is left alone, and
`null` resets that setting. Untyped, since a value may be a shorthand the
schema lifts, and the schema is what judges it.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

## PLOT_VOCABULARY

The grammar's settings, by the slot name every display that has one gives
it, and what each holds: what "Edit plot..." shows and an agent reads as a
display's `plot`. A display's plot is the ones its config declares
(`plotKeysOf`).

```js
// type signature
Readonly<Record<string, string>>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

## PlotExample

A worked example of a display's plot: the text it fills the editor with,
and what it does.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

## plotKeysOf

The plot keys a display config declares.

```js
// type signature
(conf: AnyConfigurationModel) => string[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

## plotOf

A display's plot as declared, defaults left off. A list sitting at a
default it shares with no other display, a default plot's marks, shows its
entries, since they are what is drawn.

```js
// type signature
(conf: AnyConfigurationModel) => Plot
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

## plotWrites

What applying a draft writes: each setting whose lifted value differs from
the plot, as the lifted value, and `null` for one it resets. A value
spelled another way but lifting to the same setting writes nothing.
Throws a refusal before anything is written.

```js
// type signature
(conf: AnyConfigurationModel, draft: Plot) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/plot.ts)

## preProcessConfigSnapshot

A snapshot as `type` admits it: the same lift and checks `type.create`
applies, so a dialog or a validator refuses exactly what a config file
cannot hold. Throws what the schema's `preProcessSnapshot` throws.

```js
// type signature
(type: IAnyType, snapshot: unknown) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/snapshotPreprocess.ts)

## readConfObject

Given a configuration model (an instance of a ConfigurationSchema), read the
configuration value at the given path. Use this when you hold the
configuration model directly, e.g. a track's `configuration`.

Wants a **live config node**, not a snapshot of one, and passing a snapshot is
a type error. Slots are built with `types.stripDefault`, so a slot sitting at
its default is absent from a snapshot — "unset" and "at its default" are
indistinguishable there, and a read off one reports a default as missing.

An entry of `session.tracks` is such a snapshot, typed `TrackConfigEntry`, so
this refuses one. Read `trackId` and `type` off it directly, and a slot
through a helper that supplies the default, such as
`getConfAssemblyNamesOrNone`. The refusal is in the types only: the track
selector reads raw members off thousands of frozen entries on purpose,
because hydrating every track to answer it is what `types.frozen` exists to
avoid.

```js
// type signature
{…}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

## requirementProblems

The `requires` entries of a configuration schema that `snapshot` does not
meet, as a config file or `getSnapshot` spells it: a slot left off reads as
its default, so a `when` value that is the default fires for an absent slot,
which is what the generated JSON Schema's `if` does.

```js
// type signature
(type: IAnyType, snapshot: Record<string, unknown>) => RequirementProblem[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/requirements.ts)

## setConf

Write counterpart to `getConf`, and it takes the same path: a slot name, or
an array naming a sub-schema's member at any depth —
`setConf(self, ['scales', 'y', 'domainMin'], 5)`. Takes the display or track
model, or a config node directly.

A path ending on a slot writes that slot; one ending on a sub-schema replaces
the whole object, so a channel's members (a facet's field and its domain)
move together. On a concrete schema an unknown slot name is a compile error,
and `setSlot` refuses one at runtime (ADR-052). A wrong value type throws at
runtime; `null` or `undefined` resets the slot to its default (ADR-146).

```js
// type signature
<…>(target: CONFMODEL | { ...; }, slotPath: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

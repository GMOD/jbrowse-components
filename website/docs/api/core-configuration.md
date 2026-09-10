---
id: core-configuration
title: core/configuration
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

**This is exactly `readConfObject(model.configuration, path)`** — sugar for
the `.configuration` hop, and nothing more. The two readers carry the same
slot-name check, so reaching for the other one does not get a typo past tsc.
It does not consult the session and has no per-slot behavior; what you read is
what the track stores.

```js
// type signature
{ (model: {…}): ModelSnapshotType<…>; <…>(model: {…}, slotPath: SLOT, args?: Record<…> | undefined): SLOT extends string ? ConfigurationSlotValue<…> : any; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## hydrateTrackConfig

Hydrate a plain track config into a live config node, dispatching on its
`type` to find the schema. `session.tracks` holds `types.frozen` plain
objects until something references a track (ADR-031), so a caller handed one
of those has a config that reads nothing but what was literally authored: a
slot at its schema default is absent, `preProcessSnapshot` has not run, and
nothing that walks a live node applies to it.

For the callers that need the resolved answer rather than the authored one
and cannot know which of the two they were handed. The About dialog's "Copy
config" is the case this exists for: it is reached from two menus, and one of
them passes a `session.tracks` entry.

Returns **undefined** rather than throwing when the config names a track type
no plugin registered, or when it is invalid enough that `create` rejects it —
an un-hydrated config has never been validated, so a dialog that opens over
it must not be the thing that discovers this. Callers fall back to treating
it as the plain object it is.

Shares `TrackConfigurationReference`'s per-PluginManager cache, so hydrating
the same entry twice returns the same node — and in admin/embedded sessions a
track opened later resolves to that same node. A non-admin's open track does
not: it resolves to the session's private working copy (ADR-032) and this is
the pristine mirror beside it. The two agree in content, which is what the
caller needs; `CopyConfigEntryPoints.test.ts` pins both halves.

```js
// type signature
(pluginManager: PluginManager, config: Record<string, unknown>) => (ModelInstanceTypeProps<Record<string, any>> & { ...; } & IStateTreeNode<...>) | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchema.ts)

## readConfObject

Given a configuration model (an instance of a ConfigurationSchema), read the
configuration value at the given path. Use this when you hold the
configuration model directly, e.g. an entry from `session.tracks`.

Wants a **live config node**, not a snapshot of one, and passing a snapshot is
a type error. Slots are built with `types.stripDefault`, so a slot sitting at
its default is absent from a snapshot — "unset" and "at its default" are
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

## readConfSlot

Read a single config slot from a config that may be **either** a live MST
node or a plain snapshot object, evaluating the value if it is a `jexl:`
expression. For the dialogs and panels that are handed a track config without
knowing which of the two they got. An About panel gets a hydrated track
config from the session and a bare object from an embedded caller.

Reach for `readConfObject` or `readConfigValue` when the shape is known:
this one decides at runtime, and the plain branch inherits the snapshot
caveat (a slot at its default is absent from a snapshot, so it reads
`undefined`).

```js
// type signature
<…>(config: Record<…> | (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>), slotPath: string | string[], args?: Record<…>, jexl?: JexlInstance | undefined) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

## setConf

Write counterpart to `getConf`: sets a slot on a state model that has a
`.configuration` member (a track or display state model).

**Prefer this over a bare `self.configuration.setSlot('x', v)`.** The
constraint here mirrors `getConf`'s, so on a model with a concrete schema an
unknown slot name is a compile error. `setSlot` itself stays untyped on
purpose — the config editor's slot facade routes dynamic slot names through
it (`configurationSchema.ts`) — and guards the name at runtime instead
(ADR-052), so a misspelled write is diagnosed one way or the other.

**The read is the half with no diagnostic at all.** `getConf` for a name the
schema doesn't declare returns `undefined` and reports nothing, at any layer,
so the slot keeps reading as its default forever. Which makes the
compile-time constraint worth keeping *reachable*: it is only as good as the
schema of the holder handed in, and a holder widened to
`AnyConfigurationModel` switches it off entirely — the trap a mixin casting
to reach its host walks into. Every such cast names a concrete schema instead
(`ConfigModelForFields`, or the base schema when the slot is the base's), and
`HostChecksSlotNames` pins each one.

A wrong *value* type still throws at runtime (MST type-checks the assignment)
rather than at compile time. `value` is deliberately `unknown` because
`undefined` is a legitimate write — it resets a slot to its schema default —
and the declared slot value type doesn't include it.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<…> = ConfigurationSlotName<…>>(model: { ...; }, slotName: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

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
{…}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## hydrateTrackConfig

Hydrate a plain track config into a live config node, dispatching on its
`type` to find the schema. `session.tracks` holds `types.frozen` plain
objects until something references a track (ADR-031). One of those holds only
what was literally authored: a slot at its schema default is absent,
`preProcessSnapshot` has not run, and nothing that walks a live node applies
to it.

Use it where a caller needs the resolved config and may be handed either
form. The About dialog's "Copy config" is reached from two menus, and one of
them passes a `session.tracks` entry.

Returns **undefined** when the config names a track type no plugin
registered, or when `create` rejects it as invalid. An un-hydrated config has
never been validated, so the dialog opening over it should not throw. Callers
fall back to using the plain object.

Shares `TrackConfigurationReference`'s per-PluginManager cache, so hydrating
the same entry twice returns the same node, and in an admin session a track
opened later resolves to that same node. A non-admin's open track
resolves to the session's private working copy (ADR-032), and this function
returns the pristine mirror beside it. The two have the same content;
`CopyConfigEntryPoints.test.ts` tests both cases.

```js
// type signature
(pluginManager: PluginManager, config: Record<string, unknown>) => (ConfigNodeType<any> & ModelInstanceTypeProps<Record<string, any>> & { ...; } & IStateTreeNode<...>) | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchema.ts)

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

## setConf

Write counterpart to `getConf`, and it takes the same path: a slot name, or
an array naming a sub-schema's member at any depth —
`setConf(self, ['scales', 'y', 'domainMin'], 5)`. Takes the display or track
model, or a config node directly.

**The path length says what the write replaces.** A path ending on a slot
writes that slot and leaves the object around it alone; a path ending on a
sub-schema replaces the whole object, which is how a channel whose members
move together — a facet's field and the domain that field's values order —
gets written without a stale member surviving underneath.

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
<…>(target: CONFMODEL | { ...; }, slotPath: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

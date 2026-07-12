---
id: core-configuration
title: core/configuration
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## applyPromotableDefault

Apply a promotable value along either or both axes — the manage-default dialog's
submit. `future` sets (or clears) the session default so new + un-pinned tracks
inherit it. `openTracks` also updates the currently-open tracks that differ:
when the default now holds these values (`future`), un-pin them so they inherit
it (and track later changes); otherwise write the values onto them directly, so
"open tracks" works even without a persistent default.

```js
// type signature
(self: PromotableDisplay, entries: PromotableEntry[], opts: { future: boolean; openTracks: boolean; }) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## clearDisplaySessionDefaults

Clear every promoted default for this display type, so sibling tracks revert to
their own config values. Backs the badge's "clear default" action.

```js
// type signature
(self: PromotableDisplay) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## displaySessionDefaultChanges

Effective differences an un-pinned track inherits from session-wide defaults,
one per promotable slot whose inherited value differs from its schema default.
Drives the track-selector "affected by a session default" badge.

```js
// type signature
(self: PromotableDisplay) => TrackConfigChange[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(model: { ...; }, slotPath?: SLOT | undefined, args?: Record<...>) => SLOT extends string ? ConfigurationSlotValue<...> : any
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

## getConfResolved

Read a `promotable` slot, layering the session-wide promoted default under the
track's own value. Drop-in for `getConf` on the display's own promotable slots,
and always returns a real value (never a slot's inherit sentinel). Main-thread
only (consults the session) — the worker reads raw config.

```js
// type signature
<T = unknown>(self: PromotableDisplay, slot: string) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## isPromotableDefault

Whether every value in `entries` is the current session default for its slot.
The live state the manage-default dialog's checkbox reflects.

```js
// type signature
(self: PromotableDisplay, entries: PromotableEntry[]) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makeCurrentValueSessionDefaultControl

Promote-current control: "make this track's current resolved value(s) the
session default". Use for a symmetric setting (a `maybeBoolean` toggle, or a
multi-mode slot like displayMode) where the pin means "whatever I'm showing",
not a fixed on-value. Groups multiple slots behind one control.

```js
// type signature
(self: PromotableDisplay, slots: string[]) => SessionDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makeSessionDefaultControl

Per-value control: "make `slot === onValue` the session default". The meaning is
per-value ("make arcs the default"), independent of the track's current value —
so an always-visible control never promotes a meaningless value, and two toggles
sharing one slot (arcs vs read cloud) stay independent.

```js
// type signature
(self: PromotableDisplay, slot: string, onValue: unknown) => SessionDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makeSlotsValueSessionDefaultControl

Per-value control over a _group_ of slots: "make this exact combination of slot
values the session default". Like `makeSessionDefaultControl` but for a
multi-slot value (e.g. a feature-height preset = height + spacing + mode), so
each row of a preset radio group gets its own independent control whose `active`
reflects that specific combination being the current default.

```js
// type signature
(self: PromotableDisplay, entries: PromotableEntry[]) => SessionDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## readConfObject

Given a configuration model (an instance of a ConfigurationSchema), read the
configuration value at the given path. Use this when you hold the configuration
model directly, e.g. an entry from `session.tracks`.

```js
// type signature
{ <CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(confObject: CONFMODEL, slotPath?: SLOT | undefined, args?: Record<...> | undefined): SLOT extends string ? ConfigurationSl...
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

## resolvePromotableConfigSnapshot

The display's full config snapshot (`getConfSnapshot`) with every `promotable`
slot overwritten by its resolved value in place. For building a worker payload:
a promotable slot serializes as its raw inherit sentinel — an `'inherit'` enum
member, or the `undefined` of a `maybeBoolean`/`maybeNumber` — which the worker
can't interpret. This hands it concrete values instead, with no per-slot
bookkeeping, so adding a promotable worker-consumed slot needs no rpcProps
change and can't silently ship a sentinel. Main-thread only (getConfResolved
consults the session). Display-only promotable slots the worker never reads
(e.g. displayMode) are still excluded by the caller — resolving them here is a
harmless no-op since they're dropped anyway.

```js
// type signature
(self: PromotableDisplay) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## SessionDefaultControl

A promotable "default for all tracks of this type" control, bundled so a menu
row consumes it as a single prop. `active` = this value is currently the session
default; `toggle` sets it as the default or clears it (non-destructive — no open
track is overwritten). `self`/`entries` let the trailing adornment open the
manage-default dialog, whose "apply to open tracks" is the only path that
overwrites tracks pinned to a different value.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## setPromotableDefault

Set (`on`) or clear (`!on`) this value combination as the session default for
the display type. Non-destructive: un-pinned open tracks inherit it via
`getConfResolved`; tracks pinned to their own value keep it.

```js
// type signature
(self: PromotableDisplay, entries: PromotableEntry[], on: boolean) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## tracksDifferingFrom

Open tracks (across all views) whose resolved value differs from `entries` —
exactly the tracks "apply to open tracks" would visibly change. Drives the
dialog's preview list and count.

```js
// type signature
(self: PromotableDisplay, entries: PromotableEntry[]) => PromotableDisplay[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

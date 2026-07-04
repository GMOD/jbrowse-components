---
id: core-configuration
title: core/configuration
---

Note: this document is automatically generated from exported functions marked
with an `#api` JSDoc tag in our source code. See
[Plugin dependencies and re-exports](/docs/developer_guides/imports_and_reexports)
for how to import these from a plugin.

## areSlotsAtSessionDefault

true when every listed slot's resolved value already equals its session-wide
promoted default — drives the track-menu "make default" checkbox.

```js
// type signature
(self: PromotableDisplay, slots: string[]) => boolean
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

## getSlotInheritedValue

The value an un-pinned track resolves to for this slot — the session-wide
promoted default when usable, else the base — regardless of whether this track
currently pins its own value. Lets a track menu label its "follow default"
choice with the mode it would fall back to (e.g. `Default (Compact)`).

```js
// type signature
<T = unknown>(self: PromotableDisplay, slot: string) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## isSlotPinned

Whether this track pins the slot (holds a non-default value) rather than
inheriting the session-wide promoted default.

```js
// type signature
(self: PromotableDisplay, slot: string) => boolean
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

## setSlotsSessionDefault

Explicit setter for a group of slots' session-wide default: `promote` stores
each slot's current resolved value as the default for this display type;
`!promote` clears it so sibling tracks fall back to their own config. The caller
decides direction — pass `!areSlotsAtSessionDefault(...)` to toggle at the point
of use. Grouping (e.g. featureHeight + featureSpacing) keeps a multi-slot
setting behind one "make default" item.

```js
// type signature
(self: PromotableDisplay, slots: string[], promote: boolean) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

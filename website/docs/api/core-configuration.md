---
id: core-configuration
title: core/configuration
---

Note: this document is automatically generated from exported functions marked
with an `#api` JSDoc tag in our source code. See
[Plugin dependencies and re-exports](/docs/developer_guides/imports_and_reexports)
for how to import these from a plugin.

### areSlotsAtSessionDefault

true when every listed slot's resolved value already equals its session-wide
promoted default — drives the track-menu "make default" checkbox.

```js
// type signature
(self: PromotableDisplay, slots: string[]) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### clearDisplaySessionDefaults

Clear every promoted default for this display type, so sibling tracks revert to
their own config values. Backs the badge's "clear default" action.

```js
// type signature
(self: PromotableDisplay) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### displaySessionDefaultChanges

Effective differences an un-pinned track inherits from session-wide defaults,
one per promotable slot whose inherited value differs from its schema default.
Drives the track-selector "affected by a session default" badge.

```js
// type signature
(self: PromotableDisplay) => TrackConfigChange[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(model: { ...; }, slotPath?: SLOT | undefined, args?: Record<...>) => SLOT extends string ? ConfigurationSlotValue<...> : any
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

### getConfResolved

Read a `promotable` slot, layering the session-wide promoted default under the
track's own value. Drop-in for `getConf` on the display's own promotable slots.
Main-thread only (consults the session) — the worker reads raw config.

```js
// type signature
<T = unknown>(self: PromotableDisplay, slot: string) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### readConfObject

Given a configuration model (an instance of a ConfigurationSchema), read the
configuration value at the given path. Use this when you hold the configuration
model directly, e.g. an entry from `session.tracks`.

```js
// type signature
{ <CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(confObject: CONFMODEL, slotPath?: SLOT | undefined, args?: Record<...> | undefined): SLOT extends string ? ConfigurationSl...
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

### toggleSlotsSessionDefault

Promote each listed slot's current resolved value to the session-wide default,
or clear them when they already are the default (a single toggle for a group of
slots, e.g. featureHeight + featureSpacing behind one "make default" item).

```js
// type signature
(self: PromotableDisplay, slots: string[]) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

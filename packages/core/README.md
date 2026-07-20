# jbrowse-core

[![NPM version](https://img.shields.io/npm/v/@jbrowse/core.svg?style=flat-square)](https://npmjs.org/package/@jbrowse/core)

Core JBrowse libraries used by most JBrowse plugins.

## Documentation

See [docs](docs/README.md)

## Academic Use

This package was written with funding from the [NHGRI](http://genome.gov) as
part of the [JBrowse](http://jbrowse.org) project. If you use it in an academic
project that you publish, please cite the most recent JBrowse paper, which will
be linked from [jbrowse.org](http://jbrowse.org).

## License

Apache-2.0 © Evolutionary Software Foundation

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### clearPromotedDefaults

Clear every promoted default for this display type, so sibling tracks revert to
their own config values. Backs the badge's "clear default" action.

```js
// type signature
(self: PromotableDisplay) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### DisplayTypeDefaultControl

A promotable "default for all tracks of this type" control, bundled so a menu
row's trailing pin consumes it as a single prop. `active` = this value is
currently the session default (a filled pin); `toggle` sets it as the default or
clears it. On set, `toggle` immediately applies the value to the display the pin
was clicked from (so the active track updates with one click) and raises a
snackbar with an "Apply to N open tracks" action for the remaining open tracks
not already showing this value (see `applyDefaultToggle`).

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

For a `promotable` slot, use `getConfResolved` instead — a raw `getConf` skips
the session-wide display-type-default tier of the cascade (a dev build warns
when this happens).

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(model: { ...; }, slotPath?: SLOT | undefined, args?: Record<...>) => SLOT extends string ? ConfigurationSlotValue<...> : any
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

### getConfResolved

Read a `promotable` slot, layering the session-wide promoted default under the
track's own value. Drop-in for `getConf` on the display's own promotable slots,
and always returns a real value (never a slot's inherit sentinel). Main-thread
only (consults the session) — the worker reads raw config.

```js
// type signature
<T = unknown>(self: PromotableDisplay, slot: string) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### getContainingDisplay

Returns the display model that contains the given node. Throws if the node has
no containing display.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractDisplayModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getContainingTrack

Returns the track model that contains the given node. Throws if the node has no
containing track.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractTrackModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getContainingView

Returns the view model that contains the given node. Throws if the node has no
containing view.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractViewModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getDisplayTypeDefaultChanges

Effective differences a track following the default inherits from session-wide
defaults, one per promotable slot whose inherited value differs from its schema
default. Drives the track-selector "affected by a session default" badge.

```js
// type signature
(self: PromotableDisplay) => TrackConfigChange[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### getEnv

Returns the MST environment for a node, which carries the `pluginManager`.

```js
// type signature
(obj: IAnyStateTreeNode) => { pluginManager: PluginManager; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getSession

Returns the JBrowse session model for any node in the state tree. Throws if the
node has no session ancestor.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractSessionModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### isSlotCustomized

Whether this track has customized the slot (holds a non-default value of its
own) rather than following the display type's default. The correct "reset to
default" predicate for a promotable slot: comparing the resolved value to the
base instead reads as at-default for a track merely _following_ a non-base
promoted default, so the reset control lights up on a no-op.

```js
// type signature
(self: PromotableDisplay, slot: string) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### makeCurrentValueDisplayTypeDefaultControl

Promote-current control: "make this track's current resolved value(s) the
session default". Use for a symmetric setting (a `maybeBoolean` toggle, or a
multi-mode slot like displayMode) where the pin means "whatever I'm showing",
not a fixed on-value. Groups multiple slots behind one control.

```js
// type signature
(self: PromotableDisplay, slots: string[]) => DisplayTypeDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### makeDisplayTypeDefaultControl

Per-value control: "make `slot === onValue` the session default". The meaning is
per-value ("make arcs the default"), independent of the track's current value —
so an always-visible control never promotes a meaningless value, and two toggles
sharing one slot (arcs vs read cloud) stay independent.

```js
// type signature
(self: PromotableDisplay, slot: string, onValue: unknown) => DisplayTypeDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### makeSlotsValueDisplayTypeDefaultControl

Per-value control over a _group_ of slots: "make this exact combination of slot
values the session default". `active` reflects whether this exact combination is
the current default; `toggle` flips it (set/clear, non-destructive). Each row of
a preset radio group (e.g. a feature-height preset = height + spacing + mode)
gets its own independent control. The base builder the single-value /
promote-current wrappers below delegate to.

```js
// type signature
(self: PromotableDisplay, entries: PromotableEntry[]) => DisplayTypeDefaultControl
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

### resolvePromotableConfigSnapshot

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

### setConf

Write counterpart to `getConf`: sets a slot on a state model that has a
`.configuration` member (a track or display state model). Centralizes the
`configuration.setSlot` cast so mixins whose `self` isn't typed with
`configuration` don't each re-cast.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | string = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(model: { ...; }, slotName: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

<!-- API_DOCS_END -->

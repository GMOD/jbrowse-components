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

### isSlotPinned

Whether this track pins the slot (holds a non-default value) rather than
inheriting the session-wide promoted default.

```js
// type signature
(self: PromotableDisplay, slot: string) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### isSlotValueSessionDefault

Whether a _specific_ value is the session-wide promoted default for this slot,
independent of the track's current value. Use for an always-visible "make this
the default for all tracks" control whose meaning is "promote this on-value"
(e.g. a per-mode toggle), rather than the value-dependent
`areSlotsAtSessionDefault` used by "promote whatever is current" controls.

```js
// type signature
(self: PromotableDisplay, slot: string, value: unknown) => boolean
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

### setSlotsSessionDefault

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

### setSlotValueSessionDefault

Promote a specific value as the session-wide default for this slot (`on`), or
clear the default (`!on`). Pair with `isSlotValueSessionDefault`.

```js
// type signature
(self: PromotableDisplay, slot: string, value: unknown, on: boolean) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

<!-- API_DOCS_END -->

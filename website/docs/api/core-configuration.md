---
id: core-configuration
title: core/configuration
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## clearPromotedDefaults

Clear every promoted default for this display type, so sibling tracks revert to
their own config values. Backs the badge's "clear default" action.

```js
// type signature
(self: PromotableDisplay) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## DisplayTypeDefaultControl

A promotable "default for all tracks of this type" control, bundled so a menu
row's trailing pin consumes it as a single prop. `active` = this value is
currently the session default (a filled pin); `toggle` sets it as the default or
clears it. On set, `toggle` immediately applies the value to the display the pin
was clicked from (so the active track updates with one click) and raises a
snackbar with an "Apply to N open tracks" action for the remaining open tracks
not already showing this value (see `applyDefaultToggle`).

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

A `promotable` slot is resolved through the display-type-default cascade (track
value -> session-wide promoted default -> base) rather than read raw, so a
display's own value getter can be a plain `getConf(self, 'slot')` and still
follow the cascade — and can never surface a slot's inherit sentinel. That
resolution is main-thread only (it consults the session); the worker reads plain
config snapshots through `readConfObject`, which stays raw. See
`promotableResolve.ts`.

```js
// type signature
<…>(model: { ...; }, slotPath?: SLOT | undefined, args?: Record<...>) => SLOT extends string ? ConfigurationSlotValue<...> : any
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## getDisplayTypeDefaultChanges

Effective differences a track following the default inherits from session-wide
defaults, one per promotable slot whose inherited value differs from its schema
default. Drives the track-selector "affected by a session default" badge.

```js
// type signature
(self: PromotableDisplay) => TrackConfigChange[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## isSlotCustomized

Session-wide "promoted defaults" for display-type config slots — the UI /
control layer over the read-time cascade in `promotableResolve.ts`. A
`promotable` slot resolves through three tiers (track's own customized value ->
session-wide default for this display type -> base); a display reads the
resolved value with `getConf` (which routes promotable slots through
`resolveSlot`), and the session store (`get/setDisplayTypeDefault`) holds the
promoted value. Everything here reads a field off `resolveSlot`. Whether this
track has customized the slot (holds a non-default value of its own) rather than
following the display type's default. The correct "reset to default" predicate
for a promotable slot: comparing the resolved value to the base instead reads as
at-default for a track merely _following_ a non-base promoted default, so the
reset control lights up on a no-op.

```js
// type signature
(self: PromotableDisplay, slot: string) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makeCurrentValueDisplayTypeDefaultControl

Promote-current control: "make this track's current resolved value(s) the
session default". Use for a symmetric setting (a `maybeBoolean` toggle, or a
multi-mode slot like displayMode) where the pin means "whatever I'm showing",
not a fixed on-value. Groups multiple slots behind one control.

```js
// type signature
(self: PromotableDisplay, slots: string[]) => DisplayTypeDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makeDisplayTypeDefaultControl

Per-value control: "make `slot === onValue` the session default". The meaning is
per-value ("make arcs the default"), independent of the track's current value —
so an always-visible control never promotes a meaningless value, and two toggles
sharing one slot (arcs vs read cloud) stay independent.

```js
// type signature
(self: PromotableDisplay, slot: string, onValue: unknown) => DisplayTypeDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makeSlotsValueDisplayTypeDefaultControl

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

## readConfObject

Given a configuration model (an instance of a ConfigurationSchema), read the
configuration value at the given path. Use this when you hold the configuration
model directly, e.g. an entry from `session.tracks`.

```js
// type signature
{…}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

## resolvePromotableConfigSnapshot

The display's full config snapshot (`getConfSnapshot`) with every `promotable`
slot overwritten by its resolved value in place. For building a worker payload:
a promotable slot serializes as its raw inherit sentinel — an `'inherit'` enum
member, or the `undefined` of a `maybeBoolean`/`maybeNumber` — which the worker
can't interpret. This hands it concrete values instead, with no per-slot
bookkeeping, so adding a promotable worker-consumed slot needs no rpcProps
change and can't silently ship a sentinel. Main-thread only (`getConf` consults
the session). Display-only promotable slots the worker never reads (e.g.
displayMode) are still excluded by the caller — resolving them here is a
harmless no-op since they're dropped anyway.

```js
// type signature
(self: PromotableDisplay) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## setConf

Write counterpart to `getConf`: sets a slot on a state model that has a
`.configuration` member (a track or display state model). Centralizes the
`configuration.setSlot` cast so mixins whose `self` isn't typed with
`configuration` don't each re-cast.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<…> | string = ConfigurationSlotName<…>>(model: { ...; }, slotName: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

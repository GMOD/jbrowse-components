---
id: core-configuration
title: core/configuration
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## clearPromotedDefaults

Clear promoted defaults for this display type, so every track following one
reverts to its own config value. Backs the badge's "clear session default"
action, which passes the slots it actually listed
(`getDisplayTypeDefaultChanges`).

Pass `slots` whenever the UI named what it was clearing. The all-slots default
reaches further than any such list: a promoted default the track _customized_
over, or one promoted to a value equal to `promotedBase`, is invisible in the
badge dialog (neither is `inherited`) yet still governs sibling tracks — so
clearing it from a dialog that never showed it changes tracks other than the one
whose badge was clicked.

```js
// type signature
(self: ResolvableDisplay, slots?: Iterable<string>) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## DisplayTypeDefaultControl

A promotable "default for all tracks of this type" control, bundled so a menu
row's trailing pin consumes it as a single prop. `active` = this value is
currently the session default (a filled pin); `toggle` sets it as the default or
clears it, touching no track's own value (see `applyDefaultToggle`). On set it
raises a snackbar with an "Override N customized tracks" action for every open
track not already showing this value — that action is the only thing in the
subsystem that rewrites a track.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

**This is exactly `readConfObject(model.configuration, path)`** — sugar for the
`.configuration` hop, plus a stricter slot-name check (see ./CLAUDE.md). It does
not consult the session and has no per-slot behavior; what you read is what the
track stores.

A `promotable` slot read this way therefore yields the raw stored value,
`undefined` included — that `undefined` is the cascade's inherit sentinel, and
`resolveConf` is what turns it into a real value. The read type keeps the
`undefined` on purpose, so reaching for the wrong reader is a compile error
rather than a silent one.

```js
// type signature
<…>(model: { ...; }, slotPath?: SLOT | undefined, args?: Record<...>) => SLOT extends string ? ConfigurationSlotValue<...> : any
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## getConfigSnapshotWithPromotables

The display's full config snapshot with every `promotable` slot overwritten by
its resolved value in place. For building a worker payload: a promotable slot
serializes as its raw inherit sentinel (`undefined`, since they're all `maybe*`
types), which the worker can't interpret — it has no session to resolve against.
This hands it concrete values instead, with no per-slot bookkeeping, so adding a
promotable worker-consumed slot needs no rpcProps change and can't silently ship
a sentinel. Main-thread only (the cascade consults the session). Display-only
promotable slots the worker never reads (e.g. displayMode) are still excluded by
the caller — resolving them here is a harmless no-op since they're dropped
anyway.

```js
// type signature
(self: ResolvableDisplay) => Record<string, unknown>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## getDisplayTypeDefaultChanges

Effective differences a track following the default inherits from session-wide
defaults, one per promotable slot whose inherited value differs from its schema
default. Drives the track-selector "affected by a session default" badge.

```js
// type signature
(self: ResolvableDisplay) => TrackConfigChange[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## getTrackConfigWithPromotables

See TrackConfigWithPromotables.

```js
// type signature
(session: AbstractSessionModel, trackConfig: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => TrackConfigWithPromotables
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## isSlotCustomized

Whether this track has customized the slot (holds a non-default value of its
own) rather than following the display type's default. The correct "reset to
default" predicate for a promotable slot: comparing the resolved value to the
base instead reads as at-default for a track merely _following_ a non-base
promoted default, so the reset control lights up on a no-op.

```js
// type signature
(self: ResolvableDisplay, slot: string) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makeCurrentValueDisplayTypeDefaultControl

Promote-current control: "make this track's current resolved value the session
default". Use for a symmetric setting (a `maybeBoolean` toggle, or a multi-mode
slot like displayMode) where the pin means "whatever I'm showing", not a fixed
on-value.

```js
// type signature
(self: ResolvableDisplay, slot: string) => DisplayTypeDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makeDisplayTypeDefaultControl

Per-value control: "make `slot === onValue` the session default". The meaning is
per-value ("make arcs the default"), independent of the track's current value —
so an always-visible control never promotes a meaningless value, and two toggles
sharing one slot (arcs vs read cloud) stay independent.

```js
// type signature
(self: ResolvableDisplay, slot: string, onValue: unknown) => DisplayTypeDefaultControl
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## openPromotableDisplays

Every display on an open track, across all open views — the reach of anything
that acts on "the tracks the user is looking at": the cascade's own "apply to
open tracks", and the share/export bake. One walk so those can't drift apart.

Recurses into composite views. A display nested in one resolves the cascade like
any other but was invisible to both callers, so the share/export bake didn't
bake its inherited values and a shared session containing a breakpoint-split or
synteny view rendered differently for the recipient. `LGVSyntenyDisplay` is only
ever reached through this branch, so don't flatten the recursion away.
`hasChildViews` names the one composite shape it does not cover.

A view holding neither (e.g. spreadsheet) drops out via the structural guards. A
view whose displays declare no promotable slot (e.g. dotplot, which does hold
tracks) is walked and contributes nothing — harmless, and cheaper than asking
each display whether it has anything to promote.

```js
// type signature
(session: AbstractSessionModel) => ResolvableDisplay[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## readConfObject

Given a configuration model (an instance of a ConfigurationSchema), read the
configuration value at the given path. Use this when you hold the configuration
model directly, e.g. an entry from `session.tracks`.

Wants a **live config node**, not a snapshot of one, and passing a snapshot is a
type error. Slots are built with `types.stripDefault`, so a slot sitting at its
default is absent from a snapshot — "unset" and "at its default" are
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

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

## resolveConf

Reads a `promotable` slot through the display-type-default cascade — the track's
own value, else the session-wide promoted default for this display type, else
the slot's `promotedBase`. Always yields a real value, never the `undefined`
inherit sentinel, so a display's value getter is
`get displayMode(): DisplayMode { return resolveConf(self, 'displayMode') }`
with no post-guard and no cast.

Separate from `getConf` rather than folded into it, deliberately. Resolution is
not free and not universal: it consults the session (so it's main-thread only,
and throws on a detached node) and it means something only for the ~15
promotable slots out of 1300-odd config reads in the repo. Hiding it inside
`getConf` made every one of those reads a maybe-cascade whose behavior you
couldn't see at the call site and which turned on a `promotable: true` flag in
another file. Naming it at the call site costs one word and restores `getConf`
to being what everyone already believed it was.

Throws if `slot` isn't promotable — the cascade has nothing to say about a plain
slot, and `getConf` is what you want there.

Takes no jexl `args`, unlike `getConf`: a promotable slot cannot hold a callback
(see `SlotResolution`), so there is no per-feature context to supply.

```js
// type signature
<…>(model: IAnyStateTreeNode & ... 1 more ... & { ...; }, slot: SLOT) => ConfigurationSlotValueResolved<...>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## setConf

Write counterpart to `getConf`: sets a slot on a state model that has a
`.configuration` member (a track or display state model). Centralizes the
`configuration.setSlot` cast so mixins whose `self` isn't typed with
`configuration` don't each re-cast.

**Prefer this over a bare `self.configuration.setSlot('x', v)`.** The constraint
here mirrors `getConf`'s, so on a model with a concrete schema an unknown slot
name is a compile error. The raw `setSlot` action takes a plain `string`, and a
typo there fails _completely silently_: the assignment lands on an undeclared
property, so nothing throws, nothing persists, and the matching `getConf` read
keeps returning the default. That is the one config mistake with no diagnostic
at any layer. `setSlot` itself stays untyped on purpose. The config editor's
slot facade routes dynamic slot names through it (`configurationSchema.ts`).

A wrong _value_ type still throws at runtime (MST type-checks the assignment)
rather than at compile time. `value` is deliberately `unknown` because the
inherit sentinel (`undefined`/`null`) is a legitimate write on every promotable
slot, which the declared slot value type doesn't include.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<…> = ConfigurationSlotName<…>>(model: { ...; }, slotName: SLOT, value: unknown) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## TrackConfigWithPromotables

A track config snapshot with every display's `promotable` slots resolved, plus
the list of values that came from a session-wide default rather than from the
config itself.

For handing a track's config to somewhere that leaves the cascade for good — the
About dialog's "Copy config", whose output a user pastes into a `config.json`. A
raw `getSnapshot` records a slot a track merely _follows_ as absent
(`stripDefault` collapsed it), so the copied config renders differently from the
track it was copied from. This is `getComputedStyle` at that boundary, and
`fromDisplayTypeDefaults` is what lets the UI say so rather than silently
materializing a session preference into a track config.

Resolves through the open display when the track is open, and from the display
config alone when it isn't — an unopened track has no display state, but "what
would this render as" still has an answer.

**Writes every promotable slot, including the ones sitting at `promotedBase`,
and that is the decision — don't "align" it with the share bake.** The bake
writes only genuinely-inherited values, because a baked value reads as
customized on the recipient's side and an at-base slot needs nothing. A pasted
`config.json` is read by a _different mechanism_ — there is no cascade there at
all — so writing only the inherited ones would leave every other slot to pick up
whatever the reader has promoted in their own browser. What a user copying a
config wants is the values they are looking at. The cost is that the pasted
track is customized on those slots and no longer follows a later promoted
default, which is what a config file means.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

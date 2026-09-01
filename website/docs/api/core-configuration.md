---
id: core-configuration
title: core/configuration
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## clearPromotedDefaults

Clear the named promoted defaults for this display type, so every track
following one reverts to its own config value. Backs the badge's "clear session
default" action, which passes the slots it actually listed
(`getDisplayTypeDefaultChanges`).

**`slots` is required, and an all-slots default is not the convenience it looks
like.** It reaches further than any list a dialog can have shown: a promoted
default the track _customized_ over, or one promoted to a value equal to
`promotedBase`, is `inherited: false` and so appears in no row, yet still
governs sibling tracks — so clearing it from a dialog that never showed it moves
tracks other than the one whose badge was clicked. Clearing every promoted
default at once is a preferences-scope action, and Preferences → "Reset to
defaults" is where it lives (`clearPreferenceOverrides`).

```js
// type signature
(self: ResolvableDisplay, slots: Iterable<string>) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

**This is exactly `readConfObject(model.configuration, path)`** — sugar for the
`.configuration` hop, and nothing more. The two readers carry the same slot-name
check, so reaching for the other one does not get a typo past tsc. It does not
consult the session and has no per-slot behavior; what you read is what the
track stores.

A `promotable` slot read this way therefore yields the raw stored value,
`undefined` included — that `undefined` is the cascade's inherit sentinel, and
`resolveConf` is what turns it into a real value. The read type keeps the
`undefined` on purpose, so reaching for the wrong reader is a compile error
rather than a silent one.

```js
// type signature
{ (model: {…}): ModelSnapshotType<…>; <…>(model: {…}, slotPath: SLOT, args?: Record<…> | undefined): SLOT extends string ? ConfigurationSlotValue<…> : any; }
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

The return type is branded (`ResolvedConfigSnapshot`) so a payload builder can
demand a snapshot that has been through here. The assertion below is the one
place the brand is applied, and it sits on the line after the resolve.

```js
// type signature
(self: ResolvableDisplay) => ResolvedConfigSnapshot
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
(session: PromotedDefaultStore, trackConfig: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => TrackConfigWithPromotables
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## hydrateTrackConfig

Hydrate a plain track config into a live config node, dispatching on its `type`
to find the schema. `session.tracks` holds `types.frozen` plain objects until
something references a track (ADR-031), so a caller handed one of those has a
config that reads nothing but what was literally authored: a slot at its schema
default is absent, `preProcessSnapshot` has not run, and nothing that walks a
live node — the promotable cascade above all — applies to it.

For the callers that need the resolved answer rather than the authored one and
cannot know which of the two they were handed. The About dialog's "Copy config"
is the case this exists for: it is reached from two menus, and one of them
passes a `session.tracks` entry.

Returns **undefined** rather than throwing when the config names a track type no
plugin registered, or when it is invalid enough that `create` rejects it — an
un-hydrated config has never been validated, so a dialog that opens over it must
not be the thing that discovers this. Callers fall back to treating it as the
plain object it is.

Shares `TrackConfigurationReference`'s per-PluginManager cache, so hydrating the
same entry twice returns the same node — and in admin/embedded sessions a track
opened later resolves to that same node. A non-admin's open track does not: it
resolves to the session's private working copy (ADR-032) and this is the
pristine mirror beside it. The two agree in content, which is what the caller
needs; `CopyConfigEntryPoints.test.ts` pins both halves.

```js
// type signature
(pluginManager: PluginManager, config: Record<string, unknown>) => (ModelInstanceTypeProps<Record<string, any>> & { ...; } & IStateTreeNode<...>) | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchema.ts)

## isSlotCustomized

Whether this track has customized the slot (holds a non-default value of its
own) rather than following the display type's default. The correct "reset to
default" predicate for a promotable slot: comparing the resolved value to the
base instead reads as at-default for a track merely _following_ a non-base
promoted default, so the reset control lights up on a no-op.

`SLOT` is constrained the way `getConf`'s is. A pin or a reset over a slot name
the schema does not declare is inert and silent — `resolveSlot` answers about
nothing, so the control draws outline forever — and a widened `self` switches
the check off (`HostChecksSlotNames`).

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(self: ResolvableDisplay<CONFMODEL>, slot: SLOT) => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## makePin

The pin for one promotable slot: "apply this value to every open track of this
display type", and — via the snackbar it raises — "keep it as the default for
the ones opened later".

`value` chooses between the subsystem's two meanings, which are otherwise
identical:

- **Give it** for a per-value pin — "make _arcs_ the default" — independent of
  what the track currently shows. Use on an always-visible pin so it can never
  promote a meaningless value, and so two rows sharing one slot (arcs `'arc'` vs
  read cloud `'cloud'`; sashimi `'down'` vs `'auto'`) stay independent.
- **Omit it** for "whatever I'm showing", resolved through the cascade. Use for
  a symmetric or continuous setting where no fixed on-value makes sense (wiggle
  point size, arc line width, `mismatchAlpha`).

One function with an optional argument, rather than the two exported builders it
replaces — a per-value one and a `…CurrentValue…` one, the second of which was
exactly the first applied to `resolveSlot(self, slot).value`. The pair was one
function plus a doc section explaining which name to reach for; omitting the
argument now says what the longer name said.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<…>>(self: ResolvableDisplay<CONFMODEL>, slot: SLOT, ...value: [] | [...]) => Pin
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## Pin

The "apply this to every open track of this type" affordance on a menu row — the
trailing `PushPin`, bundled so the row consumes it as one prop. Built by
makePin.

`active` = this value is currently the session default (a filled pin), which is
the state, not the click. `toggle` **applies the value to every open track of
the display type** and raises a snackbar whose one action promotes it to the
display type's default; on an already-promoted value it clears that default
instead, touching no track (see `applyPinClick`).

**`toggle` rather than an `apply`/`clear` pair**, which was tried and dropped:
the sole renderer is a MUI `ToggleButton` whose `onChange` means exactly "flip",
so splitting it adds a member _and_ a branch at the one call site that never
needed one. `active` is already public for a caller that wants to state a
direction. (The house preference for explicit setters over toggles is about MST
actions, where a toggle destroys the ability to set a known state; nothing here
stores a value.)

Lives here, alone and with no imports, rather than beside `makePin` in
`promotableDefaults.ts`: the menu types describe a pin without building one, and
`MenuTypes.ts` taking this one interface from that module gave a React-free type
file a type closure of 374 files. See
`agent-docs/ideas/barrels-block-extraction.md` and `scripts/moduleClosure.ts`.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotablePin.ts)

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

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

## readConfSlot

Read a single config slot from a config that may be **either** a live MST node
or a plain snapshot object, evaluating the value if it is a `jexl:` expression.
For the dialogs and panels that are handed a track config without knowing which
of the two they got. An About panel gets a hydrated track config from the
session and a bare object from an embedded caller.

Reach for `readConfObject` or `readConfigValue` when the shape is known: this
one decides at runtime, and the plain branch inherits the snapshot caveat (a
slot at its default is absent from a snapshot, so it reads `undefined`).

```js
// type signature
<…>(config: Record<…> | (ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>), slotPath: string | string[], args?: Record<…>, jexl?: JexlInstance | undefined) => T
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

## resolveConf

Reads a `promotable` slot through the display-type-default cascade — the track's
own value, else the session-wide promoted default for this display type, else
the slot's `promotedBase`. Always yields a real value, never the `undefined`
inherit sentinel, so a display's value getter is
`get displayMode(): DisplayMode { return resolveConf(self, 'displayMode') }`
with no post-guard and no cast.

Separate from `getConf` rather than folded into it, deliberately: resolution
consults the session, so it is main-thread only and throws on a detached node.
Folding it in was built and reverted — ADR-046.

Throws if `slot` isn't promotable — the cascade has nothing to say about a plain
slot, and `getConf` is what you want there.

Takes no jexl `args`, unlike `getConf`: a promotable slot cannot hold a callback
(see `SlotResolution`), so there is no per-feature context to supply.

```js
// type signature
<…>(model: ResolvableDisplay<...>, slot: SLOT) => ConfigurationSlotValueResolved<...>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

## ResolvedConfigSnapshot

A display config snapshot whose promotable slots hold RESOLVED values rather
than the inherit sentinel — what a worker payload has to be built from.

The brand is required and unforgeable, so a plain `Record<string, unknown>` is
not assignable to it and neither is `getSnapshot(self.configuration)`. That is
the whole point. Everything downstream of the resolve is an ERASED container — a
snapshot is `Record<string, unknown>`, and the payload it becomes is an
`as`-asserted interface — so a payload builder handed the RAW snapshot instead
typechecks, ships `undefined` for every promotable slot, and types it as the
resolved value. That was measured, not supposed: the raw spelling in
`LinearBasicDisplay`'s `rpcProps()` passed `pnpm typecheck` and every suite in
`plugins/canvas`, `packages/core/src/configuration` and `products/jbrowse-web`,
while sending the worker `undefined` for chevrons, subfeature labels and feature
height.

The rest of this subsystem's guarantees are carried by types that stay connected
to the schema: a raw read of a promotable `maybe*` slot is `T | undefined` (see
`ConfigurationSlotValue`), so `getConf` where `resolveConf` was meant is a
compile error at any typed consumer. The brand is that guarantee re-established
at the point where the connection is cut.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

## setConf

Write counterpart to `getConf`: sets a slot on a state model that has a
`.configuration` member (a track or display state model).

**Prefer this over a bare `self.configuration.setSlot('x', v)`.** The constraint
here mirrors `getConf`'s, so on a model with a concrete schema an unknown slot
name is a compile error. `setSlot` itself stays untyped on purpose — the config
editor's slot facade routes dynamic slot names through it
(`configurationSchema.ts`) — and guards the name at runtime instead (ADR-052),
so a misspelled write is diagnosed one way or the other.

**The read is the half with no diagnostic at all.** `getConf` for a name the
schema doesn't declare returns `undefined` and reports nothing, at any layer, so
the slot keeps reading as its default forever. Which makes the compile-time
constraint worth keeping _reachable_: it is only as good as the schema of the
holder handed in, and a holder widened to `AnyConfigurationModel` switches it
off entirely — the trap a mixin casting to reach its host walks into. Every such
cast names a concrete schema instead (`ConfigModelForFields`, or the base schema
when the slot is the base's), and `HostChecksSlotNames` pins each one.

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

Resolves from the display _config_ alone, whether or not the track is open.
Everything the cascade takes is on the config node: it is the same node an open
display's `configuration` points at (the hydration cache makes it stable), its
`type` is the display type the session-wide tier is keyed on (every display
schema is `explicitlyTyped` under the display type's own name), and the session
is passed in. So an unopened track — which has no display state at all — still
has an answer to "what would this render as", by the same code path.

**Writes every promotable slot, including the ones sitting at `promotedBase`,
and that is the decision — don't "align" it with the share bake.** A pasted
`config.json` is read by a mechanism with no cascade in it at all, so writing
only the inherited values would leave every other slot to pick up whatever the
reader has promoted in their own browser. Pinned by
`products/jbrowse-web/src/tests/CopyConfigPromotedDefaults.test.ts`.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

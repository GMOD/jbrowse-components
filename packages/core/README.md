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

### clampBandHeight

Clamp one resize of a drag-resizable band.

The floor is `min(MIN_BAND_HEIGHT, current)`, never the bare constant: a band
whose config declares it smaller than the floor must stay where it is. Taking
`Math.max(MIN_BAND_HEIGHT, target)` instead made the _first_ drag on such a band
jump it up to 20 before honoring the delta. A band at or above the floor is
unaffected, one below it can still be dragged but never smaller than it already
is, and one dragged back past the floor regains it.

`ResizeHandle` emits one delta per animation frame, so callers driving a drag
pass `current + distance` as the target and read `current` inside the action — a
component computing the target from a rendered height drops every tick that
lands before React re-renders.

```js
// type signature
(current: number, target: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandHeight.ts)

### clearPromotedDefaults

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

### getConf

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

### getConfigSnapshotWithPromotables

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
(self: ResolvableDisplay) => TrackConfigChange[]
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

### getTrackConfigWithPromotables

See TrackConfigWithPromotables.

```js
// type signature
(session: AbstractSessionModel, trackConfig: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => TrackConfigWithPromotables
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### isSlotCustomized

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

### makePin

The pin for one promotable slot: "make this value the default for every track of
this display type".

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
(self: ResolvableDisplay, slot: string, ...value: [] | [unknown]) => Pin
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### openPromotableDisplays

Every display on an open track, across all open views — the reach of anything
that acts on "the tracks the user is looking at": a promoted default's "apply to
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

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/openDisplays.ts)

### Pin

The "make this the default for all tracks of this type" affordance on a menu row
— the trailing `PushPin`, bundled so the row consumes it as one prop. Built by
makePin.

`active` = this value is currently the session default (a filled pin); `toggle`
sets it as the default or clears it, touching no track's own value (see
`applyDefaultToggle`). On set it raises a snackbar with an "Override N
customized tracks" action for every open track not already showing this value —
that action is the only thing in the subsystem that rewrites a track.

**`toggle` rather than a `promote`/`clear` pair**, which was tried and dropped:
the sole renderer is a MUI `ToggleButton` whose `onChange` means exactly "flip",
so splitting it adds a member _and_ a branch at the one call site that never
needed one. `active` is already public for a caller that wants to state a
direction. (The house preference for explicit setters over toggles is about MST
actions, where a toggle destroys the ability to set a known state; nothing here
stores a value.) ADR-048's requirement is that the flip be _symmetric_ —
pin-then-unpin discards nothing — not that it be two functions.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### readConfObject

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

### relight

Move a color's OKLCH lightness by `lightnessShift` and scale its chroma, holding
its hue.

For extending a categorical palette past its length. Cycling a nine-color list
over a 24-chromosome karyotype repeats the color outright; cycling it with a
lightness shift per lap gives the hue back as a variant still told apart from
the original — tab20's construction, which pairs a light and a dark of each hue.

SHIFT rather than a fixed lightness, and SCALE rather than a fixed chroma,
because a categorical palette is uneven on purpose: category10's brown and its
red are 5 degrees apart in hue and are told apart by chroma alone, so
re-lighting both to one (lightness, chroma) makes them the same color. Keeping
each color's own relative chroma keeps brown reading as brown.

In OKLCH rather than through `lighten`/`darken`, which work in sRGB, where the
same coefficient moves a yellow and a blue by visibly different amounts: a lap
has to read as one tone across the whole palette or it reads as noise.

```js
// type signature
(color: string, lightnessShift: number, chromaScale?: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/color/index.ts)

### resolveConf

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
couldn't see at the call site and which turned on a `promotedBase` declared in
another file. Naming it at the call site costs one word and restores `getConf`
to being what everyone already believed it was.

Throws if `slot` isn't promotable — the cascade has nothing to say about a plain
slot, and `getConf` is what you want there.

Takes no jexl `args`, unlike `getConf`: a promotable slot cannot hold a callback
(see `SlotResolution`), so there is no per-feature context to supply.

```js
// type signature
<…>(model: IStateTreeNode<...> & ... 1 more ... & { ...; }, slot: SLOT) => ConfigurationSlotValueResolved<...>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/getConf.ts)

### setConf

Write counterpart to `getConf`: sets a slot on a state model that has a
`.configuration` member (a track or display state model).

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

### TrackConfigWithPromotables

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

<!-- API_DOCS_END -->

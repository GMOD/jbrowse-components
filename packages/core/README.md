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

### Band

One band of a display's vertical stack — a coverage histogram, an arc strip, a
conservation row, a variant lane. The contract is the pair: `active` is whether
the band exists right now (the display pre-ANDs its settings half, `showX`, with
its data half, "some lane has ink"), and `height` is the stated height when it
does. Consumers read pixels through reservedPx or stackBands, never by
re-combining the pair — the re-combination is where the reserver and the painter
historically drifted.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### boundBandHeight

Bound a band height to its legal range — a config value, a menu choice, or a
slider position, i.e. anywhere the number is being _stated_ rather than dragged.

The **floor** keeps the band operable at its smallest: for a drag-resized band
that means keeping the handle grabbable, for a menu-sized one it is the height
below which its content stops reading. The **ceiling** stops a band from
swallowing the plot it sits over — every display floors its plot area at 0, so
an unbounded band takes the rows to zero height rather than to a scrollbar, and
takes the band's own handle off-screen with them.

The bounds differ per band and the rule does not, which is why this takes them
rather than each band re-deriving the reasoning — that is how the two
`clampBandHeight`s in this repo drifted apart, each ending up with one half of
this rule and a doc comment claiming to be the whole of it.

```js
// type signature
(n: number, { min, max }?: BandBounds) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandHeight.ts)

### buildColorRampLut

An RGBA lookup table over sampleColorRamp, laid out as the Nx1 texture both GPU
backends upload and the Canvas2D twins index — entry `i` is the color at
`t = i / (N - 1)`. N comes off the shader that samples it, so the table and
`rampColor`'s texel mapping cannot disagree.

```js
// type signature
(stops: readonly ColorRampStop[]) => Uint8Array<ArrayBuffer>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### canonicalizeViewRefName

Resolve user-authored refName text against the assembly of the view containing
`node` — the one normalization layer, which resolves aliases and casing
together. Falls back to the input when the assembly is absent or its aliases
have not loaded.

Keyed off the VIEW's assembly rather than the track's, because the view is what
the comparison is against: displayed regions, loaded regions and blocks all
carry the refNames the view laid out.

Reach for this wherever a refName a _person_ wrote is about to be compared
against regions, features or blocks, which carry the assembly's canonical name.
A refName a display copied off a region is canonical already and needs nothing;
one that arrived in a session spec, a config slot or a URL is whatever the
author read out of the location box.

Skipping it fails silently and, worse, assembly-dependently: `chr12` matches on
an assembly canonicalized `chr12` and matches nothing on one canonicalized `12`,
so the same spec key works on one config and quietly does nothing on the next,
with no error for anyone to act on.

Resolves through `getCanonicalRefName2`, whose fallback is what keeps a spec
read before the alias file has loaded from throwing — and the getters that read
user specs do run from the first render.

Takes a refName, not a spec that might hold one: the resolver reads
`refName.toLowerCase()`, so anything else throws once the aliases are there, and
a caller reading an untyped `frozen` slot has to establish that it names a
refName at all before this is the right question to ask of it.

```js
// type signature
(node: IAnyStateTreeNode, refName: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### clampBandHeight

Clamp one _resize_ of a drag-resizable band: boundBandHeight, plus the one rule
a resize needs that a stated height does not.

The floor becomes `min(bounds.min, current)`, never the bare bound: a band whose
config declares it smaller than the floor must stay where it is. Taking the bare
floor instead made the _first_ drag on such a band jump it up to the floor
before honoring the delta. A band at or above the floor is unaffected, one below
it can still be dragged but never smaller than it already is, and one dragged
back past the floor regains it.

The ceiling is not relaxed the same way — a band already over its ceiling is the
state the user is trying to escape, so a resize brings it back inside.

`ResizeHandle` emits one delta per animation frame, so callers driving a drag
pass `current + distance` as the target and read `current` inside the action — a
component computing the target from a rendered height drops every tick that
lands before React re-renders.

```js
// type signature
(current: number, target: number, bounds?: BandBounds) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandHeight.ts)

### clearPromotedDefaults

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

### getAssemblyHost

The host's assembly manager, for a module that resolves names and nothing else.

Unlike the accessors in `sessionServices.ts` this one buys the caller no smaller
type graph — an `AssemblyManager` is an MST model a `PluginManager` built, so
naming it costs what naming a session costs. It is here to say which service is
wanted, and because that cost is the finding: the assembly manager is the one
thing on `AbstractSessionModel` a third-party host cannot simply implement.

```js
// type signature
(node: IAnyStateTreeNode) => AssemblyHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getConf

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

The return type is branded (`ResolvedConfigSnapshot`) so a payload builder can
demand a snapshot that has been through here. The assertion below is the one
place the brand is applied, and it sits on the line after the resolve.

```js
// type signature
(self: ResolvableDisplay) => ResolvedConfigSnapshot
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

### getDialogHost

Where a display puts a dialog it cannot mount itself.

```js
// type signature
(node: IAnyStateTreeNode) => DialogHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

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

### getNotificationSink

Where a display puts a message it cannot draw itself.

```js
// type signature
(node: IAnyStateTreeNode) => NotificationSink
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getPaletteHost

The colors to draw with, and the args that rebuild them in a worker.

```js
// type signature
(node: IAnyStateTreeNode) => PaletteHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getRenderingServices

Everything a display needs of its host in order to draw a region: the
assemblies, the RPC entry point and the colors.

```js
// type signature
(node: IAnyStateTreeNode) => RenderingServices
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getRpcHost

The host's RPC entry point, for a module that issues RPCs and nothing else.

```js
// type signature
(node: IAnyStateTreeNode) => RpcHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getSession

Returns the JBrowse session model for any node in the state tree. Throws if the
node has no session ancestor.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractSessionModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getSessionServices

The services a session offers that cost nothing application-shaped to name.
Prefer one of the narrower accessors below, which say which of them the calling
module actually uses.

```js
// type signature
(node: IAnyStateTreeNode) => SessionServices
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

### getTrackConfigWithPromotables

See TrackConfigWithPromotables.

```js
// type signature
(session: PromotedDefaultStore, trackConfig: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>) => TrackConfigWithPromotables
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### hydrateTrackConfig

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
same entry twice returns the same node and a track that gets opened later reuses
it.

```js
// type signature
(pluginManager: PluginManager, config: Record<string, unknown>) => (ModelInstanceTypeProps<Record<string, any>> & { ...; } & IStateTreeNode<...>) | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/configurationSchema.ts)

### isSlotCustomized

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

### makePin

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

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/readConfObject.ts)

### readConfSlot

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

### reservedPx

The pixels a band takes from the plot below it: 0 when off, the (optionally
bound) stated height when on. This is the single spelling of "off spends 0 px".

```js
// type signature
(band: Band) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### resolveConf

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

### ResolvedConfigSnapshot

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

### sampleColorRamp

The color at `t` in `[0, 1]` across a list of EVENLY SPACED stops, linearly
interpolated per channel. `t` is clamped, so the ends are the end stops rather
than an extrapolation past them, and a one-stop ramp is that stop everywhere.

```js
// type signature
(stops: readonly ColorRampStop[], t: number) => ColorRampStop
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

### SessionPaletteProvider

Make JBrowse follow the host's light/dark state — the whole of it, in one mount:

```tsx
<SessionPaletteProvider session={session} mode={myAppIsDark ? 'dark' : 'light'}>
  {tracks}
</SessionPaletteProvider>
```

A component rather than a documented pair of calls because the pair has a half
that can be left out with nothing to show for it. `PaletteProvider` is the name
a host reaches for, and it colors the React side alone; the session write is
what reaches the RPC worker, which bakes feature labels into the rendered image.
So a host that mounts only the provider gets light-mode labels on a dark page,
from a canvas whose every other pixel is right, and nothing errors. See
useSessionPalette for the mechanism.

The session is the only thing that resolves a palette here, so a host supplying
colors of its own mounts `PaletteProvider` directly instead.

```js
// type signature
({ session, mode, children, }: { session: ThemeModeSession; mode: "dark" | "light"; children: ReactNode; }) => Element
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/PaletteContext.tsx)

### setConf

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

### stackBands

Fold an ordered set of bands into tops and a bottom. The order is the argument,
so a display states its band order exactly once; reserve, paint and pick all
read the same fold, which is what keeps "the reserver and the painter read one
function" true by construction rather than by prose.

Only the fold is shared. What varies per display stays there: per-lane iteration
runs this once per lane, sticky-vs-scrolling is a property of how the result is
projected to the screen, and a band drawn outside its reservation (an overlay)
carries its own draw rect beside the stack.

```js
// type signature
<K extends string>(order: readonly K[], bands: Record<K, Band>) => BandStack<K>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/bandLayout.ts)

### stopsFromRampLut

`n` evenly spaced legend stops read straight out of a buildColorRampLut byte
table — the same 256×1 RGBA array `uploadColorRampLut` hands the GPU and the
Canvas2D fillStyle LUTs index — formatted for `SvgGradientLegend`. It holds one
claim by construction: the swatch at bar fraction `t` is byte-identical to the
ramp entry at `t` on both backends. Alpha rides `opacity` (the juicebox fade),
never baked into the color string.

```js
// type signature
(lut: Uint8Array<ArrayBufferLike>, n: number) => GradientStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

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
and that is the decision — don't "align" it with the share bake.** A pasted
`config.json` is read by a mechanism with no cascade in it at all, so writing
only the inherited values would leave every other slot to pick up whatever the
reader has promoted in their own browser. Pinned by
`products/jbrowse-web/src/tests/CopyConfigPromotedDefaults.test.ts`.

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/promotableDefaults.ts)

### VIRIDIS_STOPS

The 256 viridis stops, fully opaque. Feed them to buildColorRampLut for the
texture/fillStyle form, or to sampleColorRamp for legend stops.

```js
// type signature
readonly ColorRampStop[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/colorRamp.ts)

<!-- API_DOCS_END -->

---
id: core-util
title: core/util
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## boundBandHeight

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

## canonicalizeViewRefName

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

## clampBandHeight

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

## getAssemblyHost

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

## getContainingDisplay

Returns the display model that contains the given node. Throws if the node has
no containing display.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractDisplayModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

## getContainingTrack

Returns the track model that contains the given node. Throws if the node has no
containing track.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractTrackModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

## getContainingView

Returns the view model that contains the given node. Throws if the node has no
containing view.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractViewModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

## getDialogHost

Where a display puts a dialog it cannot mount itself.

```js
// type signature
(node: IAnyStateTreeNode) => DialogHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

## getEnv

Returns the MST environment for a node, which carries the `pluginManager`.

```js
// type signature
(obj: IAnyStateTreeNode) => { pluginManager: PluginManager; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

## getNotificationSink

Where a display puts a message it cannot draw itself.

```js
// type signature
(node: IAnyStateTreeNode) => NotificationSink
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

## getPaletteHost

The colors to draw with, and the args that rebuild them in a worker.

```js
// type signature
(node: IAnyStateTreeNode) => PaletteHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

## getRenderingServices

Everything a display needs of its host in order to draw a region: the
assemblies, the RPC entry point and the colors.

```js
// type signature
(node: IAnyStateTreeNode) => RenderingServices
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

## getRpcHost

The host's RPC entry point, for a module that issues RPCs and nothing else.

```js
// type signature
(node: IAnyStateTreeNode) => RpcHost
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

## getSession

Returns the JBrowse session model for any node in the state tree. Throws if the
node has no session ancestor.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractSessionModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

## getSessionServices

The services a session offers that cost nothing application-shaped to name.
Prefer one of the narrower accessors below, which say which of them the calling
module actually uses.

```js
// type signature
(node: IAnyStateTreeNode) => SessionServices
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/sessionServices.ts)

## openPromotableDisplays

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

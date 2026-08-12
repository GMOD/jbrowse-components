---
id: core-util
title: core/util
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

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

`initialized` gates the call rather than a try/catch, because
`getCanonicalRefName` THROWS before the alias file has loaded — and the getters
that read user specs run from the first render.

```js
// type signature
(node: IAnyStateTreeNode, refName: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

## clampBandHeight

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

## getEnv

Returns the MST environment for a node, which carries the `pluginManager`.

```js
// type signature
(obj: IAnyStateTreeNode) => { pluginManager: PluginManager; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

## getSession

Returns the JBrowse session model for any node in the state tree. Throws if the
node has no session ancestor.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractSessionModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

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

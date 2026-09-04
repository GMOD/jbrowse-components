---
name: ui-state-holds-keys-not-indices
description: UI state that outlives a data commit — a click, a pin, a per-row incumbent — must hold a semantic key that re-resolves against the rebuilt data, never an index into the arrays a refetch replaces. The failure that named it clears the very state a click created, because the click's own side effect triggers the refetch; the fallback for genuinely nameless records is clear-on-commit, stated at the commit. Read before storing anything the pointer produced.
---

# UI state holds keys, not indices

A fetch commits its results as arrays — packed typed arrays, a targets list, a
layout's rows — and interaction state naturally wants to point into them: the
clicked instance, the hovered target, the row a decision was made for. An index
is the cheapest pointer, and it is correct for exactly as long as the arrays it
addresses exist. Every refetch replaces them, and an index that survives the
replacement does not error: it addresses whatever now sits at that offset, or
nothing.

## The shape

Two conditions, both ordinary:

- **The state outlives the frame.** A hover dies with the pointer and can
  address anything; a click, a pin, a held incumbent is meant to still be there
  after the next commit.
- **The data is regenerable.** Any pan, zoom, resize or mode change can replace
  the arrays wholesale, and the state holder is not told.

The failure is silent in both directions. In range, the index selects an
unrelated record and the UI confidently marks the wrong thing. Out of range,
the read produces `undefined` or `NaN` and whatever consumes it — a shader
uniform, a lookup — degrades without a message.

## The failure that named it

`MultiWaySyntenyDisplay` records the clicked ribbon so the render passes can
outline it. The first version cleared that record on every feature commit,
which is the safe index policy — and it made the feature disappear the moment
it worked: clicking a ribbon opens the details widget, the widget resizes the
view, the resize refetches, and the commit cleared the click it was answering.
A pixel A/B of the frame before and after the clear came back identical, which
is how it was caught (`model.test.ts`, "a ribbon click keeps its outline id
until empty canvas or a refetch").

The fix is what this doc states: the click stores the ortholog group's KEY, and
a getter re-resolves it against whatever geometry currently exists
(`clickedFeatureId` via `ribbonGeometry.groupTarget`). A refetch that still
contains the group re-resolves to its new index; one that dropped the group
resolves to nothing, which is also correct — the outline vanishes with its
subject rather than migrating to a stranger.

## The fallback, for records with no name

Some records genuinely have no stable identity — an alignment-level ribbon in
the same display is one fetch's row and nothing more. There the index is the
only pointer available, and the policy is **clear-on-commit, stated at the
commit**: the action that replaces the arrays drops the reference, in the same
MST action, with the reason beside it. `LinearSyntenyDisplay.setRpcData` is the
worked example — it drops the hover and click indices and the open context menu
together, and its comment carries the out-of-range consequence (a NaN written
into the clicked-id uniform) that makes the clear non-optional. The multiway
display runs both policies side by side: a group-keyed click survives the
commit, a bare direct-link index is dropped by it.

## The same rule one level up

An index into a LIST OF MODELS has the same failure with a longer fuse. The
synteny follow's per-level state was once keyed by level number; a removed
level renumbered the rest, and a re-added row inherited a dead level's
incumbent feature and cached transform. The key that fixed it is the node
itself — `levelStates` is a `WeakMap` on the level model, which also makes
pruning automatic. Where the shared object between producer and consumer IS the
key, a `Map` keyed on it needs no invalidation protocol at all; that is the
same move [carry-the-decision-not-the-rendered-state](carry-the-decision-not-the-rendered-state.md)
makes for a different reason.

## What to check in review

- Anything written by a pointer event and read after an `await`, a debounce or
  an autorun re-run: what does it hold, and who replaces that?
- If it holds an index: which action commits the arrays, and does that action
  drop the index in the same transaction?
- If it holds a key: does the resolver answer "gone" as empty rather than
  falling back to a positional guess?

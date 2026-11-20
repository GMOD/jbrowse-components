---
name: a-track-nothing-has-read-is-invisible-to-get-referring
description: The MST fork's `walk` skips children not yet instantiated, so `getReferring` misses a track entry nothing has read, and deleting the track leaves it failing on `Could not resolve trackId`. ReferenceManagement reads track ids off snapshots instead.
---

# A track nothing has read is invisible to getReferring

## Ruling

Fix it in ReferenceManagement, reading track ids off snapshots, so nothing is
instantiated to find a referrer. The fork's `walk` stays as it is.

## Mechanism

`getReferringMultiple` (`packages/product-core/src/Session/ReferenceManagement.ts`)
finds the nodes that refer to a track by calling MST's `walk` from the root. In
the @jbrowse/mobx-state-tree fork, `walk` recurses through
`node.getChildren()` and visits a child only when
`isStateTreeNode(child.storedValue)`. A child whose observable instance has not
been created yet has no `storedValue`, so `walk` skips it and everything below
it. A view's track entry that nothing has read is one of those children, so
`getReferring` returns nothing for it.

`deleteTrackConf` dereferences through `getReferring`, so it leaves that entry
in the view and deletes the config the entry points at. The first read of the
entry then throws `Could not resolve trackId "<id>"` out of the configuration
reference.

## Repro

In jest, with no React render to read the restored node:

- launch a track in an admin session, Delete track from its menu, click the
  snackbar's Undo (`restoreTrackConf` splices the track's snapshot back into
  the view);
- call `session.getReferring(trackId)`: it returns `[]` while
  `view.tracks.length` is 1;
- read `view.tracks[0].configuration`, and `getReferring` now finds it.

`DeleteTrackUndo.test.ts`'s case "the snackbar's Undo is a history step too"
hit this. Ctrl+Z after the snackbar's Undo runs `deleteTrackConf`, which missed
the entry, and a reaction threw on the missing config. The test now asserts
`shownIds(view)` right after the snackbar's Undo. That assertion reads every
track entry, which stands in for the render that instantiates them in the app.

## Who it can hit

In the app, rendering a track entry instantiates it before the user can act
on it, which is why the Delete track path works there. A track in a view that
has not rendered yet is the exposure: deleting it from another view's menu, or
through the API, leaves that view's entry behind, and the app fails when that
view first renders. A session loaded from a snapshot and driven by code with no
render (an agent, an embedded host, a test) can hit it too.

## Where it could be fixed

- **The fork's `walk`**: visit an uninstantiated child by creating it, or by
  walking its snapshot. Creating it is what lazy instantiation exists to avoid,
  and `walk` has other callers that would pay for it too. Walking the snapshot
  would mean resolving references from the snapshot, without the instances
  `getReferring` reads now.
- **ReferenceManagement**: walk the tree itself, reading each model property
  (which instantiates it) instead of calling `walk`. That fixes only this
  caller, but every `getReferring` call (each track delete, each connection
  removal) would then instantiate the whole session, including every view that
  has not rendered.

Both of those cost whatever lazy instantiation saves on a large session, which
is why the ruling reads snapshots instead: a node's snapshot is there whether
or not it has been instantiated.

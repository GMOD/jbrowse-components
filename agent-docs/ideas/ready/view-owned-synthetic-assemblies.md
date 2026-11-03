---
name: view-owned-synthetic-assemblies
description: A comparative view's synthetic assembly (read-vs-ref, multi-way lanes) lives in session.temporaryAssemblies, a session list that outlives its one owner, and most of the temporary-assembly machinery exists to compensate; the assembly should ride on the view or display that owns it, as ADR-084 did for view-local track configs.
---

# View-owned synthetic assemblies

A read-vs-ref launch (linear and dotplot) and a multi-way synteny lane each
synthesize an assembly only one view or display can draw. It goes into
`session.temporaryAssemblies` (`app-core/src/Assemblies/AssembliesMixin.ts`),
a session list with no owner, and everything below exists because that list
outlives the thing that put the assembly there:

- `releaseTemporaryAssemblies` (`synteny-core`) runs from both `beforeDetach`
  and `beforeDestroy`, because on the destroy task `getSession` throws
  ([ADR-069](../../architecture-decision-records/adr-069-detach-do-not-destroy-what-react-may-hold.md)).
- Multi-way refcounts holders per display in module-level `WeakMap`s
  (`MultiWaySyntenyDisplay/laneHolders.ts`), re-adds lane assemblies on restore
  in an autorun (`afterAttach.ts` `installLaneAssemblies`), and asks
  `holdsTemporarily` by `===` on the name (`model.ts`).
- `buildReadVsRefNames` stamps `now()` plus a random number into the name,
  because `addTemporaryAssembly` dedupes by name and hands a second launch the
  first one's assembly.
- `namesTemporaryAssembly` (core) feeds three guards against a track config
  that names one: the `assertTrackConfOutlivesItsAssemblies` contract check
  (product-core), the track menu greying its copy actions, and
  `addTrackFromWidget` routing the track inline. It needs the session's
  assembly manager to compare names.

[ADR-084](../../architecture-decision-records/adr-084-a-view-local-track-config-rides-on-its-track.md)
fixed the same shape for track configs: a view-local config now rides on its
track and leaves with it.

## Proposal

The owner carries the assembly in its own snapshot (a `syntheticAssemblies`
array on the view, or on the display for multi-way lanes), and
`assemblyManager.assemblyList` (`core/src/assemblyManager/assemblyManager.ts`,
today `jbrowse.assemblies + sessionAssemblies + temporaryAssemblies`) gains the
assemblies the session's live views declare. Lifetime is then the owner's
lifetime, a restored session restores them with the view, and the release
hooks, the holder refcount, the name stamp and `installLaneAssemblies` go away.

`temporaryAssemblies`, `addTemporaryAssembly` and `removeTemporaryAssembly` are
plugin-facing session API (`core/src/util/types/index.ts`): keep them as
deprecated shims, and keep loading a v4 session that carries the list.

## What still needs an answer

- The copy guard does not go away: a copied config naming a view's assembly is
  still dead once the view closes. It becomes a question to the assembly
  manager ("is this assembly view-owned?") instead of a scan of a session list.
- `assemblyList` reading views couples the manager to `session.views`, and the
  getter is hot. Measure before and after on a session with many views.
- `products/jbrowse-web/src/components/localFileTracks.ts` walks the snapshot's
  `temporaryAssemblies` for local files; it has to walk the owners instead.
- Anything resolving an assembly from session config rather than the manager
  misses a view-owned one. `findAssemblyConf` (`AssembliesMixin.ts`,
  `assemblyConfsInScope`) is the one in-tree; `jbrowse-desktop`'s
  `rootModel.ts` calls it.

## Reach

About twenty non-test files, all in-tree: `alignments-core`, `app-core`,
`core`, `product-core`, `synteny-core`, `dotplot-view`,
`linear-comparative-view`, `data-management` and `jbrowse-web`. Grep the four
session-API names above for the current list.

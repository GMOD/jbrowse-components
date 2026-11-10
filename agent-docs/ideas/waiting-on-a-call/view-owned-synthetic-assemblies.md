---
name: view-owned-synthetic-assemblies
description: A comparative view's synthetic assembly (read-vs-ref, multi-way lanes) lives in `session.temporaryAssemblies`, a list that outlives its one owner. Three ways of moving it onto the owner were tried and each broke something; the call is whether to build the fourth, which keeps the list and derives only the removal.
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
- `namesTemporaryAssembly` (core) feeds three guards against a track config
  that names one: the `assertTrackConfOutlivesItsAssemblies` contract check
  (product-core), the track menu greying its copy actions, and
  `addTrackFromWidget` routing the track inline.

[ADR-084](../../architecture-decision-records/adr-084-a-view-local-track-config-rides-on-its-track.md)
fixed the same shape for track configs: a view-local config now rides on its
track and leaves with it.

## What the list gets right

Each of these was lost by one of the attempts below, so a replacement has to
keep all four:

- **The config node is in the session tree the moment the session is.** A
  session is checked for unloadable tracks inside the action that assigns it
  (`replaceSession` → `dropUnloadableTracks`), before any reaction runs. The
  read row's sequence track resolves to the read assembly's `sequence`, so an
  assembly built one reaction later costs the row that track.
  `viewTeardown.test.tsx` ("an inline view-local config survives a session
  round trip") pins this for an app already running when it opens the session.
- **A detached session still resolves it.** `replaceSession` detaches the old
  session and destroys it once React lets go (ADR-069); its views are observed
  until then, and their lookups stay inside the detached tree.
- **Assembly lookups do not read the views.** `SvInspectorView.ownViews`
  depends on its spreadsheet being initialized, which depends on an assembly,
  so a lookup that walks `ownViews` is a MobX cycle.
- **Two multi-way displays can share a lane.** An assembly's `name` is an MST
  identifier for the whole tree, so there is one config node per name.

## Tried

| Design | What broke |
| --- | --- |
| The owner holds the config node (`types.array(assemblyConfigSchema)` on the view or display) | Two displays showing one lane each hold a node of that name, which makes every `assembly.configuration` reference ambiguous. The schema type is also built per root model, where a plugin's view model cannot reach it. Not built. |
| The owner declares a snapshot and the assembly manager's autorun keeps a config node per declared name (landed as `76c3988871`, reverted) | The node appears one reaction after the declaration. A running app opening a saved linear read-vs-ref session dropped the read's sequence track ("Removed 1 track that could not be loaded"). |
| The same, with the manager's config nodes derived in a getter and `Assembly.configuration` resolved through `confByName` | Every assembly lookup then reads every view's `ownViews`: a MobX cycle in `SvInspectorView`. A detached session's views also lost the assembly at detach. |

Two findings hold for any design:

- **The per-launch stamp in the read assembly's name stays.** Two owners of one
  name share one assembly, and the dotplot launch carries no bases while the
  linear launch does.
- **A walk for declarations stops at the view.** Reading
  `track.displays[]` from the assembly manager builds every lazily built track,
  and one whose config does not resolve throws there. A display that declares
  registers with its view instead.

## Proposal

Keep the config nodes where they are, in `session.temporaryAssemblies`, added
by the launcher or the display as today. Replace only the removal, which is
where the hooks and the refcount live:

- The session records which temporary assemblies are view-owned (a persisted
  set of names, written by the add).
- Each owner declares the names it draws: the comparative views already have
  `assemblyNames`, and the multi-way display has its described lanes.
- One session autorun removes a view-owned assembly no open view declares.

A late removal is harmless where a late add was not: an assembly that lingers
for one reaction breaks nothing. `releaseTemporaryAssemblies`, both hooks on
each comparative view, `laneHolders.ts` and `installLaneAssemblies` go; a
plugin's own `addTemporaryAssembly` entry is not in the set and is left alone.

## What still needs an answer

- Whether that is worth building. It removes the release hooks, the lane
  refcount and the detach/destroy ordering trap, and adds one autorun and
  one persisted set. No user-visible bug is open against today's code.
- The walk for declared names runs in a reaction, not in a lookup, so the
  `ownViews` cycle does not apply, but it should be checked against
  `SvInspectorView` first.
- "Return to import form" (`clearView`) leaves the read assembly until the view
  closes today. Under the sweep it goes when the view stops naming it.

---
status: Accepted
summary: 'A read-vs-ref view and a multi-way display declare the assemblies only they draw as `syntheticAssemblies`, and the assembly manager builds one per declared name; `session.temporaryAssemblies`, a list that outlived its owner, keeps only its plugin callers'
---

# ADR-261: A synthetic assembly is declared by the view that draws it

## Status

Accepted (2026-11-09). Same genre as
[ADR-084](adr-084-a-view-local-track-config-rides-on-its-track.md), which did
this for a view-local track config.

## Context

A read-vs-ref launch (linear and dotplot) and a multi-way synteny lane each
synthesize an assembly only one view or display can draw. It went into
`session.temporaryAssemblies`, a session list with no owner, and each owner
carried its own way of taking the assembly back out:

- `releaseTemporaryAssemblies` ran from both `beforeDetach` and `beforeDestroy`
  on the two comparative views, because on the destroy task `getSession` throws
  ([ADR-069](adr-069-detach-do-not-destroy-what-react-may-hold.md)).
- The multi-way display counted holders per session in module-level `WeakMap`s
  (`laneHolders.ts`) so two displays could share a lane, and re-added lane
  assemblies in an autorun (`installLaneAssemblies`) for a restored session.
- "Return to import form" (`clearView`) left the assembly in the list until the
  view closed.

## Decision

**An owner declares its assemblies as config snapshots, and the assembly manager
builds an assembly for each declared name.**

- `DotplotView` and `LinearSyntenyView` hold a frozen `syntheticAssemblies`
  property, which the launchers write into the view spec. It is in the view's
  snapshot, so a saved session restores the assembly with the view.
- `MultiWaySyntenyDisplay.syntheticAssemblies` is a getter over the lanes it has
  described. A restored session describes them again, so nothing is persisted.
  The display registers with its `LinearGenomeView` in `afterAttach`
  (`addSyntheticAssemblySource`), and the view's `syntheticAssemblies` getter
  reads every registered display's.
- `declaredSyntheticAssemblies` (`core/util/syntheticAssemblies.ts`) walks the
  session's views and their nested views.
- `assemblyManager.syntheticAssemblyConfs` holds one config per declared name,
  kept by the reconcile autorun that already builds the assembly models. The
  manager is outside the session snapshot, so the config is stored once, on its
  owner.
- `assemblyManager.isTemporaryAssembly(name)` answers the copy guard, the
  add-track routing and the contract check (`namesTemporaryAssembly`), for a
  declared assembly and for one in `session.temporaryAssemblies`.

Declarations are plain data keyed by name, which is why two displays sharing a
lane need no count: the assembly stays while either declares it.

## Rejected

| Alternative | Why not |
| --- | --- |
| The owner holds the config node itself (`types.array(assemblyConfigSchema)` on the view) | An assembly's `name` is an MST identifier for the whole tree. Two multi-way displays showing one lane would each hold a node of that name, which makes every `assembly.configuration` reference ambiguous and takes the session down. Giving the node to the first display tears the assembly down and rebuilds it under the second when the first closes. The schema type is also built per root model, where a plugin's view model cannot reach it. |
| Dropping the per-launch stamp from the read assembly's name | Two views declaring one name share one assembly. The dotplot launch carries no bases and the linear launch does, so a linear view opened second would show no read sequence. |
| Removing `temporaryAssemblies`, `addTemporaryAssembly` and `removeTemporaryAssembly` | Plugin-facing session API (`pluginFacingSessionApi.test.ts`). They stay, marked `@deprecated`. |
| The walk reads `track.displays[].syntheticAssemblies` itself | It builds every lazily built track from the assembly manager's autorun, and a track whose config does not resolve throws there, which stops the manager for every assembly. |
| Moving a saved session's `temporaryAssemblies` entry onto its view at load | A session saved before this change keeps its read-vs-ref view working from the list, and the entry stays after the view closes. A read's assembly is small and no shipped release wrote a multi-way lane there. |

## Consequences

Deleted: `releaseTemporaryAssemblies` and both hooks on each comparative view,
`laneHolders.ts`, `installLaneAssemblies`, and the spec builders' second return
value (`temporaryAssembly`); each now returns the view spec alone.

`clearView` drops the view's synthetic assemblies with its rows.

**The assembly appears when the action that adds its view ends**, not before the
view exists, since the manager's autorun runs then. `assemblyManager.has`
answers from the declaration, so nothing reports the name to
`Core-handleUnrecognizedAssembly` in between, and `waitForAssembly` waits for
the model.

`MultiWaySyntenyDisplay.openInNewView` is a method, not an action: it calls the
`releaseLane` action and opens the view after it returns, so the session has
given the lane's genome up before the new view asks a hub for it.

An edit to a synthetic assembly's sequence track config writes the manager's
copy and is not saved. Nothing in the app edits one.

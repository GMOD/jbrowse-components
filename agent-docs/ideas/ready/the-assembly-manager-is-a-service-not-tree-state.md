---
name: the-assembly-manager-is-a-service-not-tree-state
description: AssemblyManager is an MST model whose one property an autorun rebuilds from config, so it pays the tree lifecycle without using snapshots, undo or patches. It becomes a plain MobX class with the same members, and core exports a named `Assembly` type.
---

# The assembly manager is a service, not tree state

## Ruling

Do it, and export a named `Assembly` type from core so Apollo's next build
compiles.

## What it is today

`assemblyManagerFactory` is a root-model property whose only property is
`assemblies: [{ configuration: safeReference }]`. Nothing writes that array but
the `afterAttach` autorun, which reconciles it against `assemblyList` with a
self-write under `untracked` (and the lint disable that needs). Each `Assembly`
is one reference plus a block of volatiles, and finds its RPC manager by
`getParent(self, 2)`. The assembly manager's own `CLAUDE.md` says a loaded
assembly is fixed until a page reload, so nothing reads it as a snapshot, undoes
it or listens to its patches.

What the tree costs it:

- A startup window. The models exist only once the autorun has run, which is
  why `has()` falls back to `confByName`.
- The orphan pass in `reconcile`, for a model whose config has left the list.
- Liveness and detach-before-destroy rules (ADR-069) on a thing that is
  derived from config.
- Type weight. `lightweight-toolkit.md` found `AssemblyHost` puts the
  application in a caller's type graph because the assembly manager is an MST
  model a `PluginManager` built. `Assembly.configuration` stays a config node,
  so leaving MST removes only part of that; `scripts/moduleClosure.ts` says how
  much.

## The change

A plain MobX class: a computed `Map<name, Assembly>` over `assemblyList`, built
lazily, with the same public members. `RpcManager` is the precedent, a plain
class held in a root volatile. The rule it states: persisted or undoable state
is MST, and a runtime service derived from config is plain MobX.

## What reads it from outside

Searched: this repo, `publishedPluginReads.json`, and the plugin repos in
`~/src` (Apollo3, jb2plugins, the jbrowse-plugin-* repos, lorax-plugin,
react-msaview), 2026-11-17.

- Apollo (`session/session.ts`, `CollaborationServerDriver.ts`) and the
  assistant chatbot plugin call `assemblyManager.assemblies` as an array, and
  Apollo calls `getConf(assembly, ['sequence', 'metadata'])`. `getConf` asks
  only for `.configuration`, so an `assemblies` getter and an `Assembly` that
  keeps `configuration`, `name`, `aliases`, `error` and `initialized` serve
  both.
- In-tree, `jbrowse-img`'s `renderRegion.ts` and the desktop test harness read
  the same members.
- Apollo types an assembly as
  `Instance<ReturnType<typeof assemblyManager>>['assemblies'][0]`, a type-only
  import. Its built bundle keeps running and its next build fails to compile
  unless core exports a named `Assembly` type.
- Nothing found calls an MST function (`isAlive`, `getParent`, `getSnapshot`,
  `onPatch`) on an assembly or calls the private `addAssembly` /
  `removeAssembly`. A plugin outside that search that does would break with no
  warning (`reference/PLUGIN_ABI_STABILITY.md`).
- An old root snapshot's `assemblyManager` key is dropped as an unknown key.

## Looked at alongside, and not proposed

- **render-core's lifecycle without MST.** `RenderLifecycleMixin` uses MST for
  a dispose hook, a liveness check and a type name in one error message. An
  MST-free core under a new subpath with the mixin as an adapter breaks nothing,
  since the graph-genome-viewer plugins read the mixin at its current path; it
  is worth doing only when render-core on its own has a user.
- **Plain config objects in the worker.** ADR-147's reasons (persistence, undo,
  references) do not apply there, but its normalizer cost does, and per-worker
  type construction is unmeasured, so there is no number for what it would
  save. An adapter that treats `this.config` as a node would break silently;
  the search above found none live (the retired jbrowse-plugin-mafviewer did,
  and `plugins/maf`, which replaced it, does not), and core's `getAdapterId`
  already takes a plain config.

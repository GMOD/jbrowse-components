---
name: plugin-abi-stability
description: Why plugin exports ossify into permanent ABI, and the fixes. Read when removing or renaming a plugin export.
---

# Plugin ABI stability & architecture ossification

**Purpose.** Why "architecture we built once becomes maintained forever," what
actually causes it, and a menu of fixes ordered by leverage. This is the
problem-analysis + options doc that fleshes out **RFC-001 §7 "API stability
policy (deferred)"** — it is *not* a committed policy. RFC-001 deferred formal
semver/`api-extractor` discipline as premature for an experimental phase; this
doc captures the thinking so it's ready when there are stable surfaces to
protect. Read alongside `ARCHITECTURE.md` "Display stacks".

## The three surfaces that exist today, and how to remove from them

Whatever the policy ends up being, these three are already checked:

- **`ReExports/modules.ts`** — the `@jbrowse/core/*` modules external plugins
  resolve against, pinned by `abi.test.ts` against `abiBaseline.json`. A removal
  fails there. To drop a name, delete it from the baseline in the same commit
  and say in the message which published plugins you checked.
- **The session, and it fails quieter.** Plugins look members up behind
  `'x' in session`, so removing one throws nothing at all — no compile error, no
  test failure, just a plugin that stops asking. `pluginFacingSessionApi.test.ts`
  pins what published bundles actually call, and performs the call rather than
  asserting the member exists.
- **The accumulating extension points, which fail quietest of the three.**
  `addToExtensionPoint` excludes them in its *type*, so a plugin rebuilt against
  v5 gets a compile error naming `contributeToExtensionPoint`. A prebuilt v4
  bundle carries no types: the call reaches `pushExtensionPointCallback`, joins
  the fold chain, and the old-style callback returns its own single-element array
  in place of everyone else's entries. Nothing throws, and the plugin that did it
  still works — the plugins that lose their entries are the other ones.

**The signature is as public as the name.** A required second argument breaks a
duck-typed caller exactly as deleting the member would, so plugin-facing
arguments may be added **optional** and never made required.

## What has already left the re-export surface

Generated from `REMOVAL_GROUPS` in `packages/core/src/ReExports/knownRemovals.ts`
by `pnpm gen-abi-removals`, and published from there into the release
announcement as well — a group is invisible by being absent, and a hand-copied
version of this list had lost seventeen names.

<!-- BEGIN GENERATED ABI REMOVALS -->

- the renderer registry (`RendererType`, `FeatureRendererType`, `BoxRendererType`, `CircularChordRendererType`, `ServerSideRendererType`, `GlyphType`, `getParentRenderProps`)
- layout, which moved onto the GPU packing path (`PileupLayout`, `SceneGraph`, `calculateLayoutBounds`, `getLayoutId`)
- `AbortSignal` cancellation, which became stop tokens (`abortBreakPoint`, `checkAbortSignal`, `observeAbortSignal`, `makeAbortableReaction`)
- the renderer era's RPC retry and progress reporting (`RetryError`, `isRetryException`, `updateStatus2`, `getProgressDisplayStr`, `getStatsId`)
- desktop file handles, which the desktop package now owns (`getFileHandleCache`, `setFileHandleCache`, `removeFileHandle`, `cleanupStaleHandles`, `getPendingFileHandleIds`, `setPendingFileHandleIds`, `clearPendingFileHandleIds`, `restorePendingFileHandles`)
- renames with a survivor — `contrastingTextColor` is `makeContrasting`, `checkStopToken2` is `checkStopToken`, `assembleLocStringFast` is `assembleLocString`, `findLast`/`findLastIndex` are the `Array.prototype` methods
- `BaseTooltip`, which moved to its own `@jbrowse/core/ui/BaseTooltip` module to keep @floating-ui off the startup path
- names with no caller left in core, which the last callers inlined or folded away (`forEachWithStopTokenCheck`, `TextSearchManager`, `isContainedWithin`, `iterMap`, `when`, `blobToDataURL`, `cartesianToPolar`, `degToRad`, `getUriLink`, `defaultStops`, `useDebouncedCallback`)
- `isConfigurationSlotType`, with the config models that were flattened

That is 46 names over 53 entries, since 7 of them were served from two modules each. Every one is recorded with its reason in `REMOVAL_GROUPS` in `packages/core/src/ReExports/knownRemovals.ts`, and checked on every run against the exports of the previously published package.
<!-- END GENERATED ABI REMOVALS -->

## The symptom

A design decision (e.g. the legacy block-render stack behind `BaseLinearDisplay`)
becomes legacy, but cannot be removed, so it is maintained indefinitely. The
codebase accretes frozen layers that nobody actively wants but nobody can prove
are safe to delete.

## The root cause is not "runtime imports" — it's the *invisible, unbounded,
unversioned ABI* they expose

Runtime-loaded plugins **must** share the host's singletons (React, MST,
`@jbrowse/core`) — bundling their own copies duplicates React, breaks
`instanceof`, and bloats. That sharing is delivered two ways today:

| Surface | Where | How plugins reach it |
| --- | --- | --- |
| Core re-export registry | `packages/core/src/ReExports/list.ts` (~289 lines) | `jbrequire('@jbrowse/core/...')` |
| Per-plugin `exports` object | each plugin's `exports = { … }` (e.g. `LinearGenomeViewPlugin.exports`) | `pluginManager.getPlugin('X').exports.Y` |

The delivery mechanism is **load-bearing and not removable** without killing
no-build runtime plugins (a core JBrowse feature). But the mechanism is just the
pipe. The disease is three properties of *what flows through it*:

- **Invisible** — nothing tells you `BaseLinearDisplay` is load-bearing until an
  external plugin breaks at runtime in a deployment you never see. The host
  build has zero visibility into external consumers.
- **Unbounded** — every symbol ever added to an `exports` object or `list.ts` is
  *accidentally* public. There is no line between "API we promise" and "thing we
  happened to expose."
- **Unversioned** — a plugin built against last year's host resolves against
  today's `.exports` with no compatibility check. Removing a symbol is a runtime
  `undefined is not a function`, not a build error.

"Maintained forever" is the symptom. The cause is: **you can never prove a thing
is safe to remove.** So nothing is removed.

---

## In-tree is already solved; external is the whole problem

For **in-tree** consumers the compiler *is* the contract test: remove a symbol an
in-tree plugin composes and `tsc` fails in the same PR. An in-tree export
snapshot mostly reinvents that — low value.

The unsolved problem is **external** plugins:

- built against a *published* `@jbrowse/*`,
- resolving the ABI at **runtime** in environments you can't observe (a huge
  fraction of JBrowse is self-hosted academic deployments that never phone home),
- failing at **runtime, not build time**.

No amount of in-tree analysis sees them. Design every fix below around "consumers
I cannot see."

> **RFC-001's direction** (§2 goal #3, §4): replace `getPlugin('X').exports.Y`
> with static `import { Y } from '@jbrowse/plugin-x'` resolved via esbuild
> `globalExternals`. This makes a plugin's host-dependencies **explicit in its
> own source and build** (typecheck + visible import graph) — a real
> improvement to *plugin-author* ergonomics. But note: `globalExternals` does
> **not** by itself solve the *host's* problem. The host still exposes a surface,
> still can't see external consumers, and still can't tell what's safe to remove.
> The moves below are what bound/version/observe that surface.

---

## The real cure: bound what external plugins *can* reach

You cannot prove an external plugin doesn't use `BaseLinearDisplay`. The only way
to make an internal **safe to refactor** is to make it **unreachable**. Ordered
by leverage:

### 1. Split the runtime surface into `@public` vs everything else (highest leverage)

Curate a small, named, documented `@public` set that external plugins may reach;
put the rest behind a separate, explicitly-unsupported path (`Plugin.unstable.X`,
or simply absent from the registry). Then "is this safe to remove?" gets a
*static* answer for the first time: if it was never `@public`, a plugin that
reached it did so knowing it could break.

- The stable set becomes **small enough to actually honor forever**; everything
  behind the boundary is free to refactor.
- `BaseLinearDisplay` is the poster child: it's in `.exports` by accident of
  history, not by intent.
- Enforce the boundary with a checked-in snapshot of the `@public` set so changes
  to it are a *reviewed decision with a changelog line*, not silent drift. (The
  snapshot's value is governing the *external-facing* surface — not catching
  in-tree breakage, which the compiler already does.)

### 2. Version the contract and fail *loud*

The worst external failure is silent `undefined is not a function` six months
later. Give the plugin-API surface a **semver** and a **load-time compatibility
check**: a plugin declares the API version it targets; the host refuses to load
on mismatch with a clear *"plugin X targets API v2, host provides v4 — see
migration guide."* You don't avoid breakage — you **schedule** it (break on a
major, with a guide) instead of ambushing a lab admin. This is most of the
difference between "frozen forever" and "deprecate on a cadence."

### 3. Instrument deprecations at runtime — turn "guess" into "know"

Wrap a deprecated export in a getter/Proxy that `console.warn`s (and optionally
telemetry-pings) on access: *"`BaseLinearDisplay` is deprecated, removal in vX."*
Ship a few releases; remove with **evidence** instead of archaeology.

- **Blind spot, stated honestly:** telemetry only sees deployments you observe.
  Self-hosted instances — where external plugins are most common — won't report.
  So use telemetry to *accelerate* removal where visible, never as the *gate*.
  The gate is the `@public` boundary (#1).

### 4. Make the blessed extension points good enough that nobody reaches into internals

gdc/icgc/mafviewer compose `BaseLinearDisplay` because there's no stable
high-level "custom server-rendered display" API — so they grab an internal and
freeze it. Every gap RFC-001 closes is one fewer internal leaking into the
permanent ABI. This is the durable long-term answer; #1–#3 are what make the
*transition* safe.

---

## The honest tension

Part of JBrowse's value proposition *is* "plugins can reach deep — compose our
MST models, extend our displays." A maximally-narrow API throws that away. The
goal is **not** lockdown. It is: make the **blessed surface small and stable**,
and make deep-reach an **explicit, marked, may-break opt-in** rather than an
accidental forever-contract. Power for those who knowingly opt in; freedom for
maintainers to refactor everything else. Evaluate RFC-001 through this lens.

---

## The same disease rots the *docs* (and the cure rhymes)

Architecture docs ossify for the identical structural reason the API does: they
encode **incidental current membership** instead of **durable contracts**, and
nothing checks them against the code. `ARCHITECTURE.md` had drifted into claims
like "these four displays are GPU" and "Manhattan composes
`linearWiggleDisplayModelFactory`" — both false by the time they were read.

- **State invariants/rules, not enumerations.** "A display composes one of three
  foundation mixins; here's how to tell which from its `types.compose`" does not
  rot. "These four displays are GPU" does.
- **When you must enumerate, generate the list from source.** The repo already
  does this with `pnpm autogen` for config/state-model docs — extend the
  philosophy. A membership table an agent hand-maintains *will* drift; one
  emitted from `addDisplayType` registrations cannot.
- **Put a machine between the contract and drift** — a test, or an autogenerated
  region — for the claims that matter.

Unifying principle for code and docs alike: **don't let incidental current state
masquerade as an intentional contract, and put a machine between the contract and
drift.**

---

## Worked example: retiring the legacy block stack

> **Resolution (webgl-poc):** this example has since played out — the opposite
> way from the graceful "path out" below. The GPU migration **removed** the
> block state model, `LinearBareDisplay`, `BasicTrack`, and the block components
> in-tree and **accepted the gdc/icgc breakage**, offering to rebuild the path as
> an external compat plugin (core's `ServerSideRendererType` /
> `renderToAbstractCanvas` / `CoreRender` machinery stays public, so that's a
> clean plugin, not a monkeypatch). So "nothing is removed" was not iron law — a
> hard-enough forcing function (a whole-pipeline rewrite) overrode it. The
> analysis below still holds for every export *not* worth a rewrite to shed; read
> it as "the cost of keeping," with the block stack as the case where the cost of
> keeping finally lost. See `ARCHITECTURE.md` §"The legacy block stack" and
> `reference/HISTORICAL.md`.

The pre-rip situation, and the graceful path we *didn't* take:

- **Pre-rip:** `BaseLinearDisplay` (state model) + the server-side-render block
  path were `@jbrowse/plugin-linear-genome-view` public exports. In-tree only
  `LinearBareDisplay` composed them (and it was the LGV test suite's lightweight
  test vehicle). External `gdc`/`icgc`/`mafviewer` reached
  `LGVPlugin.exports.BaseLinearDisplay` + `BaseLinearDisplayComponent` at runtime.
  `mafviewer` was already superseded in-tree by `plugins/maf`.
- **Why it was stuck:** can't prove no external plugin composes it → can't remove
  *without breaking someone*.
- **Graceful path out (not taken):** (a) declare
  `BaseLinearDisplay`/`BaseLinearDisplayComponent` `@public` or not; (b) if not,
  wrap in a runtime deprecation warning to start the clock and learn usage; (c)
  ship a version-gated API so removal lands on a major with a migration guide.
  "Indefinite maintenance" becomes "removed in v4, warned since v3." webgl-poc
  instead took the blunt path (remove now, accept breakage) because the GPU
  rewrite made in-tree maintenance of the block path untenable.
- **`BaseLinearDisplayComponent` followed it out on 2026-08-05**, so neither half
  of that pair is reachable any more: it is gone from `LGVPlugin.exports` and
  from the barrel. It was the last reader of `BaseDisplayModel`'s
  `DisplayMessageComponent` getter, which went with it — a display model no
  longer holds a React component at all. In-tree it had no users left except ~19
  test harnesses registering it as a stand-in `ReactComponent` for a display they
  never render, which now pass `() => null`. Same blunt path, same reasoning, and
  named here because this file is where the *first* half's removal is recorded:
  an external plugin reaching `LGVPlugin.exports.BaseLinearDisplayComponent` at
  runtime gets `undefined` rather than a deprecation. See
  DISPLAYCHROME.md §"One element per display", for what replaced it.

---

## Ledger: behavior changes external plugins inherit

Not every ABI break is a removed export. A change to how core *interprets* what a
plugin declares reaches every external plugin at once, with no import to grep
for and no compile error anywhere. Those go here, with the opt-out, so a plugin
author who lands on a behavior change can find the sentence that explains it.

- **Config slot overrides merge over `baseConfiguration` instead of replacing
  it** (`mergeSchemaDefinition`, `configuration/configurationSchema.ts`). A
  schema that redeclares a slot its base already defines now inherits every
  field the override leaves out — `description`, `advanced`, `contextVariable`,
  `validate`, `model`, `promotable`/`promotedBase` — where it used to drop them.
  For the 32 in-tree overrides this was strictly a fix (three were losing
  metadata by accident), and it is almost certainly what an external author
  meant too. But an override that relied on *replacement* to shed an inherited
  field silently gains it back. **Opt-out: state the field
  (`advanced: false`).** Documented for plugin authors in
  `developer_guides/configuration_schema.md`; sub-schemas and constants still
  replace wholesale.

- **Five preference-store members are now required on `AbstractSessionModel`**
  (`util/types/index.ts`): `setPreferenceOverride`, `clearPreferenceOverrides`,
  `setScrollZoom`, `getDisplayTypeDefault`, `setDisplayTypeDefault`. All five are
  declared by `BaseSessionModel`, so every in-tree session and every product
  built on `@jbrowse/product-core` already satisfies them; the optionality only
  ever made the core readers carry `?.` calls that skipped silently. A plugin
  that *builds its own session model from scratch* rather than composing
  `BaseSessionModel` now fails to type-check against `AbstractSessionModel` until
  it declares them. **Opt-out: none — compose `BaseSessionModel`**, or declare
  the five members (a `getDisplayTypeDefault` returning `undefined` is a valid
  "this session promotes nothing").

- **A `promotable` slot's `promotedBase` is frozen at schema build**
  (`freezeDeep` from `configuration/configurationSlot.ts`), as is any value put
  into the session preference store. The resolver hands both out *by reference* —
  `promotedBase` is the schema's own literal, shared by every track sitting at
  base — so mutating a value read with `resolveConf` used to silently repaint
  every other track of that display type, and for `promotedBase` every later
  session too. It now throws. Two ways a plugin can meet this: a display that
  edits a resolved value in place must copy instead (`{...colorBy, type}`), and a
  schema whose `promotedBase` points at an object the plugin mutates elsewhere
  must declare its own literal. **Opt-out: none** — the value is genuinely shared,
  and this is the same convention MST already applies to every snapshot it hands
  out (there gated to dev mode; here unconditional, see `freezeDeep`).

- **A `promotable` slot's `promotedBase` is checked against its own slot at
  schema build** (`isUsableValue` from `configuration/slotShape.ts`, called by
  `ConfigSlot`). The base is the bottom of the cascade — every other tier falls
  back to it — so a base the slot could not hold was returned by *every* read
  with nothing thrown anywhere: an enum member absent from `model`, a non-finite
  `maybeNumber`, or a value the slot's own `validate` hook rejects. All three now
  throw at construction, naming the slot and the value. Two consequences for a
  plugin. A schema with a typo'd `promotedBase` fails at install rather than
  rendering wrong. And a `validate` hook now runs at *schema build* as well as at
  read time, so a hook that consults state its plugin registers later in
  `install()` can throw on a base that is actually fine — the fix is to make the
  hook depend on module-level data (which is what `isRegisteredColorScheme` and
  its `COLOR_SCHEMES` const do), not to reorder installation. **Opt-out: none**
  — every in-tree base passes, and a base that fails is broken for every track
  of that display type.

- **Loop callbacks no longer read the clock on every call** (`createTimeGate`,
  `util/timeGate.ts`, used by `checkStopTokenThrottled` and `createProgressReporter`).
  Both used to call `Date.now()` per invocation; at a 666k-read pileup that
  measured ~28 ms per callsite. They now consult the clock on a stride learned
  from the observed call rate. A plugin's own worker loops inherit this through
  the shared helpers: progress emits and cancellation checks can
  now land up to ~1/8 of an interval later than before, and after a *sudden*
  mid-loop slowdown (per-item cost jumping ~1000x) one further interval late,
  since the stride is an extrapolation. Cancellation correctness is unchanged —
  the check still fires, and a loop that is slow throughout measures a low rate
  and keeps a stride of 1, which is why a *fixed* stride was wrong here.
  **Opt-out: none** — call `checkStopToken` (the one-shot form) directly at a
  point that must not be thinned.

- **`RpcMethodType.deserializeArguments` is called by the base, so a plugin
  that also calls it runs it twice** (`invoke`, `pluggableElementTypes/
  RpcMethodType.ts`). Every `execute` used to open with
  `await this.deserializeArguments(args, driver)`; the base now does it and
  hands `execute` the deserialized args. An external plugin written against the
  older contract still opens with that line, so its override sees the same
  object a second time. **An override must therefore be idempotent** — the two
  in-tree ones are, and how they get there is the pattern: the base's
  `setBlobMap` replaces wholesale, and the filters override tests
  `args.filters instanceof SerializableFilterChain` before rebuilding, without
  which a second pass reaches `filters.map` on a chain and throws. A
  non-idempotent override cannot be fixed from here, and the failure lands
  inside the plugin's own code with no mention of core in the trace.
  **Opt-out: drop the call from `execute`** — it is redundant now — or make the
  override detect its own output. Not detectable in-tree: the double call is
  correct behavior for every override that tolerates it.

- **Six `RpcMethodType` methods no longer take `rpcDriverClassName`**:
  `serializeArguments`, `serializeNewAuthArguments`, `deserializeArguments`,
  `invoke`, `execute`, `deserializeReturn`. It was added in 2021 for a
  main-thread serialization skip that no longer exists and nothing has read it
  since. This is the *signature* half of the rule above, running the direction
  the rule does not cover: removing a parameter breaks a **subclass**, where
  adding one breaks a **caller**. A derived method with more required
  parameters than its base is not assignable to it, so an external
  `async execute(args, driver: string)` now fails to type-check. Runtime is
  unaffected — the argument is simply absent, and no in-tree or published code
  ever branched on its value. **Opt-out: delete the parameter.** A plugin that
  must compile against both this release and an older one can declare it
  optional (`driver?: string`), which satisfies either base.

- **The RPC call has no second options position any more.**
  `RpcManager.call(sessionId, functionName, args)` lost its fourth parameter,
  and with it `BaseRpcDriver.call`'s and `transport`'s `options`. Only
  `rpcDriverName` was ever read from it, as a *fallback* behind the same field in
  `args` (that field has since gone too, further down this ledger), and nothing
  in the tree passed it there. Everything else put in it went
  to a position `MainThreadRpcDriver` drops on the floor and
  `WorkerPoolRpcDriver` spread over its own — which is the same two-positions
  disagreement that made `CoreGetExportData` silent under a worker and cancelable
  under neither, and one in-tree call site was still shaped by it: the hic
  header read passed a `statusCallback` there, so its "walking the norm-vector
  index" labels appeared under a web worker and nowhere else. **Opt-out: move
  the field into `args`**, which is where `RpcHandles` says it belongs and where
  every driver reads it. Subclassing `BaseRpcDriver` is the
  breaking half — an override declaring `options` is no longer assignable, per
  the parameter-count rule above.

- **`RpcMethodType.deserializeReturn` is now typed off the registry**, taking
  the entry's wire shape and returning its `return`. It was `(unknown, unknown)
  => Promise<unknown>`, so the type a caller was promised rested on a cast in
  `RpcManager.call` and on nothing else; the hook that produces the value is now
  checked against the same entry `execute` is. The check is covariant, so an
  override returning anything the entry does not declare is a compile error at
  the override — which is the point, and is also the break. An override that
  called `super` to strip the `rpcResult` envelope should call `unwrapRpcResult`
  (`@jbrowse/core/util/librpc`) instead: `super` now promises the rebuilt value
  the override is the one rebuilding. **Opt-out: leave the class
  unparameterized** — `RpcMethodType` with no name argument resolves both ends to
  `unknown`, exactly as before.

- **`RpcMethodType` takes one type parameter now, not two**, and so do the three
  rename-region bases: `RpcMethodType<'X', Y>` is an arity error, drop the `Y`.
  The wire return moved into the registry entry (`transferables` / `wire`), where
  it is a reference to the registry rather than a copy of it — fifteen classes
  had been keeping the copy in step by hand, and one had already drifted. A base
  still generic over its key was the last thing that needed the parameter, since
  `RpcWireReturn<MethodName>` will not resolve while the name is a parameter;
  that base is gone too (see below). **Opt-out: none, and none is needed** — the
  argument a plugin was passing is what its own registry entry already says. If
  it has no entry, the class is unparameterized and never had a second argument
  to pass.

- **`DiagonalizeRpcBase` is no longer exported from `@jbrowse/synteny-core`.**
  It was an abstract base generic over its registry key, subclassed only to set
  `name`, and being generic is the whole reason it needed machinery (a pinned
  wire return, a `DiagonalizeMethodName` constraint to keep the pin honest, an
  intersection on `execute`'s args) — to share three lines. The shared part is
  `runDiagonalize(pluginManager, args)`, exported from the same barrel and
  keeping the dynamic import. **Opt-out: extend `RpcMethodType<'YourKey'>` and
  call `runDiagonalize` from `execute`**, which is what the two in-tree methods
  now do. The general rule this leaves: share an RPC body as a function, never
  as a base generic over the key.

  `executeDiagonalize` went from that barrel in the same change, and it is the
  half worth reading twice: `runDiagonalize` reaches it through a dynamic import,
  so a static export beside that is a live way to undo the split — a bundler
  seeing one module imported both ways puts it in the main chunk, silently, for
  whichever plugin did the static import. `tree-sidebar/CLAUDE.md` prices that
  same mistake at 608KB vs 539KB. **Opt-out: `await runDiagonalize(...)`**, which
  awaits the identical function.

- **`RpcClient.call` no longer takes a transfer list.** Transferables flow only
  worker → main, inside a reply's `rpcResult` wrapper; transferring an *argument*
  would neuter the main thread's own buffer. The option existed for one and
  nothing ever passed it. `RpcServer.emit` keeps its transfer list, which runs
  the direction that works. **Opt-out: none needed** — a call passing one was
  already being handed a `[]` by every in-tree path.

- **`@jbrowse/core/data_adapters/dataAdapterCache` is now served**
  (`ReExports/list.ts`). `adapterCache` is module-level state, so a plugin that
  deep-imported `getAdapter` got a *second* cache in the RPC worker while
  `CoreFreeResources` called `freeAdapterResources` on the host's — and that
  function's own comment says the cache is the only strong reference to an
  adapter, so a plugin's adapters and everything they hold lived as long as the
  worker no matter how many tracks closed. Serving the module is what makes an
  external RPC method share the host's cache.

  **This one runs the opposite direction from the rest of the ledger**, and the
  direction is the point: *adding* to `list.ts` is what has the consequence,
  not removing. Nothing already published changes — an existing bundle has the
  module inlined and keeps working. But a deep path absent from `list.ts` is
  **bundled, not host-bound**, which `jb2plugins/CLAUDE.md` names as the safe
  way to reuse core code across every host; putting a path in the list takes
  that option away, so the plugin's **next rebuild** silently becomes
  host-bound and error-pages on any host older than this release. Five external
  plugins deep-import this module today — graphgenomeview, gwas, mafviewer,
  msaview, tview — and msaview is one of the three that still load from the
  store on current hosts.

  **Opt-out: keep bundling it** by dropping the path from the plugin's own
  globals map before `globalExternals` sees it. msaview already has the
  machinery (`SHAPE_VARIES_BY_HOST` in its `esbuild.mjs`), added for a
  different reason. Either way, gate the publish with `pnpm host-compat` —
  booting the built bundle on v4.0.0/v4.3.0 is the only check that sees this
  class of failure, and it is the check that would have caught all three of the
  outages that file records.

  The general rule, which is not obvious from anywhere else in this doc: **an
  ABI addition is safe for the host and for every published bundle, but it is a
  version floor for the next build of any plugin already reaching that path.**
  Weigh it against what bundling actually costs — here a silent unbounded leak,
  which wins; for a stateless helper it usually would not.

- **An RPC call can no longer be pinned to a driver.** `BaseDisplay` lost
  `rpcDriverName`, `effectiveRpcDriverName`, `setRpcDriverName` and
  `parentDisplay`; `baseTrackConfig` lost its `rpcDriverName` slot; and
  `RpcRouting` is gone from `RpcCallArgs`, so an `args` bag naming a driver is an
  excess property rather than a route. Every call runs on `rpc.defaultDriver`, or
  on the host default when that is empty.

  It could go because it had never really worked. One call site in the tree
  passed the field — a tag-value scan in the alignments plugin — so a track
  configured onto `MainThreadRpcDriver` ran that one scan there and sent every
  block fetch, render and details query to the worker pool anyway. The four
  display members are the quiet half: a plugin display reading
  `self.effectiveRpcDriverName` now reads `undefined` and its call goes where it
  was already going, and a plugin config carrying `rpcDriverName` becomes an
  unknown slot, which JBrowse ignores. Neither says anything.

  **Opt-out: none, and per-call routing is not the thing to restore.** Sending
  one call elsewhere only means something with a backend that differs in what it
  *can* do, which is the tabled server-side-driver work.
  `RpcManager.registerDriverFactory` is still there and still how a plugin adds a
  driver; point `rpc.defaultDriver` at it and the whole session runs there.

## Follow-ups

Smallest-useful-first; none committed — they need a scope decision and probably
belong *inside* RFC-001 §7 rather than bolted beside it.

- [ ] **Name the `@public` set.** Audit each plugin `exports` object +
  `ReExports/list.ts`; tag entries `@public`/`@internal`. Output: a documented
  list. (Design input for RFC-001 §7.)
- [ ] **Snapshot the `@public` set + CI diff.** Minimal (a JSON snapshot + a
  jest diff test), *not* a heavyweight `api-extractor` toolchain — keep it a net
  simplification, not a new thing to maintain.
- [ ] **Runtime deprecation-warning wrapper.** A tiny helper to mark a specific
  export deprecated; apply to gray-area exports like `BaseLinearDisplay` first.
  Ships now, starts learning usage.
- [ ] **API-version declaration + load-time compat check.** Plugins declare a
  target API version; host fails loud on mismatch. Largest piece; depends on
  having a named `@public` set first.
- [ ] **Doc anti-rot.** Convert hand-maintained membership lists in
  `ARCHITECTURE.md` to autogenerated regions (sourced from `addDisplayType`
  registrations) or invariant-style prose; add a drift check for the
  foundation→display mapping.
- [ ] **Confirm RFC-001 `globalExternals` migration** removes new-plugin reliance
  on `getPlugin('X').exports`, then measure how much of the runtime surface is
  *only* reached the legacy way (candidates for the `unstable` namespace).

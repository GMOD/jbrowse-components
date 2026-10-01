---
name: view-init
description:
  The launch input a view takes on the view object, the partition that captures
  it, and the launch state machine. Read when touching view launch, URL params,
  or createViewState.
kind: spec
---

# View launch input

How a view gets navigated, tracked and highlighted at launch. Every surface —
URL params, a session spec, a config `defaultSession`, an `addView` literal,
embedded `createViewState` — hands the view **one object**, and one processing
path turns it into state.
[ADR-099](../architecture-decision-records/adr-099-a-view-takes-one-authored-object.md)
records why, and the per-surface shapes it retired; read it before proposing
that a surface get its own shape back.

## One object, every surface

Write every setting directly on the view object:

```
{ type, id?, …launch keys, …declared view props }
```

`withLaunchInput` (`packages/core/src/util/withLaunchInput.ts`) splits that
object at snapshot time. A key naming something to resolve — `loc`, `tracks`,
`highlight` — moves into the internal `launch` blob, applied once and cleared.
Everything else stays on the snapshot, where MST restores and validates it
against the registered view type's property list (read from the
`PluginManager`, so a property `extendViewType` composes on counts). **Declaring
a property is declaring it authorable**; no per-setting arm exists to forget.

Each view type registers its launch keys as
`Record<keyof Commands, LaunchKeySpec>`, so a command the view interprets and
nobody registered is a compile error.

## An assembly name read off a track config: canonical, **and** screened

A track config's `assemblyNames` may name an alias, or an assembly the session
lacks. Any such name reaching an **`AssemblySelector` value** or a **view's
launch input** must be:

- **canonical** — `canonicalAssemblyNames` (`@jbrowse/core/util/tracks`).
  `AssemblySelector` silently blanks a value that is not one of the session's
  own `assemblyNames`.
- **present** — `assemblyManager.has`, never
  `getCanonicalAssemblyName(...) !== undefined`. A missing name sets the view's
  error, and `showImportForm` replaces the user's stack with an import form.

Keep one derivation per path (`connectedEndpoints`, `syntenyTrackRows`). Nothing
renames assembly names at the RPC boundary, so unlike refNames
(REFNAME_NAMESPACES.md) there is no worker-side exception.

## LGV's launch keys

`InitState` (`plugins/linear-genome-view/src/LinearGenomeView/types.ts`) lists
them. `LinearGenomeViewLaunchProps` is the other half an author may write,
derived as every declared property minus the launch keys and the view's
identity.

## The partition

`withLaunchInput` is a `preProcessSnapshot` and it is **pure**: a session's view
type is a `types.union`, so MST runs every member's preprocessor against every
candidate snapshot, and a warning from there fires for view types the author
never wrote. `afterAttach`, reached only by the snapshot that won, reports what
the partition captured (`reportUnknownKeys`, `reportMalformedRows`).

Load-bearing properties of the wrapper:

- **`.preProcessSnapshot` with a terminal cast, never `types.snapshotProcessor`**,
  which stops being a `ModelType` — `PluginManager.pluggableMstType` then drops
  the view from the session's view union without a word.
- **Order.** MST runs preprocessors in reverse of the order added, so this goes
  on the chain BEFORE a view's own legacy-key preprocessor.
- **The widening cast is the last link that may change the creation type.** It
  replaces `CustomC`, so a `.props()` added after it is invisible to
  `SnapshotIn`.

### Discriminators

`tracks` and `views` name both an authored recipe and built state. Each
colliding key registers a discriminator that splits one array per entry:

| kind | a recipe entry is | why it holds |
| --- | --- | --- |
| `trackEntries` | a string, or `'trackId' in entry` | `BaseTrackModel` declares no `trackId`; `type` would not discriminate, since specs write display types inline |
| `rows` | an entry with no `type` | a built row is a view snapshot, and every view's `type` is a required literal |
| `launch` | always | the key collides with no declared property |
| `replay` | always, and the value also lands on the property | below |

A **row** list cannot be split: `views` indexes against `levels` and per-level
`tracks`, so a mixed list goes whole to the bucket `afterAttach` reports, and
the view comes up on its import form rather than a misaligned stack.

### `replay`

A launch key that IS a declared property, but whose launch needs an ordered
imperative step beyond the property write, lands on the prop and rides in the
blob too. The deciding question: _on an already-materialized view, does writing
the property alone produce the correct picture?_ `sameScale` is the only member:
writing it alone skips `applySharedScale()`, which has to run after
`autoDiagonalize` re-centres the rows.

Each view's registration lives beside its model (`launchInput.test.ts` pins
it). Everything else a view takes — `color`, `alpha`, `lodMode`, `height` — is
a declared property, not a launch key.

## The registration is the one declaration

`ViewType.acceptedKeys` — state model properties, launch keys and
`passThrough` — answers "what may an author write on this view". Its consumers:

- **`loadSessionSpec`**, because a spec never becomes a snapshot. It reports
  through `unknownKeysMessage` as an error, since the launcher's own failure
  lands as an error a line later. A view type that registers no launch keys
  classifies nothing.
- **`jbrowse validate`** builds each view's JSON Schema `$defs` entry from
  `stateModelProps` and `launchKeys` (ADR-120).
- **`check-build-scripts.py`**, for build-script session JSON.
- **The URL parameters page**, through the `SPEC_KEYS` marker blocks.
- **The compiler**, through `ViewTypeRegistry`: `ViewSnapshotInput<N>` makes
  `session.addView('LinearGenomeView', { asembly })` a compile error at the
  literal site. A new view earns this by augmenting `ViewTypeRegistry` and
  annotating its model (`const stateModel: ViewTypeRegistry['X'] = …`).
  `NoInfer` keeps a variable's `type: string` from loosening the name, so a
  spec built in a variable annotates itself, and a deliberately out-of-contract
  row list says so with `addView<string>(…)`.
  `LinearGenomeView/viewSnapshotInput.test.ts` holds the assertions.

**An out-of-tree view that registers nothing keeps MST's silent drop**, and a
spec built through untyped indirection still needs the runtime path and the
validator.

## The flow

```
URL ?loc=&assembly=&tracks=&tracklist=&nav=&highlight=&regions=
  → SessionLoader.urlViewInit        (buildLgvInit, app-core/SessionSpec/lgvUrlInit.ts)
  → decodeJb1StyleSession → loadSessionSpec → 'LaunchView-LinearGenomeView'
  → LaunchLinearGenomeViewF: session.addView('LinearGenomeView', spec)

the same params over a config's defaultSession (&extendSession=true)
  → applyDefaultSessionViewInit: view.setLaunch({ …base, …init, assembly })

createViewState({ view, location, highlight })  (react-linear-genome-view)
  → `view` spread into the default session's view snapshot
  → location/highlight over a caller's own session: view.setLaunch(...)

session/config JSON, an addView literal, a session spec's view
  → withLaunchInput's preProcessSnapshot → `launch`

                         ▼ all converge ▼
LGV afterAttach setupInitAutorun:
  wait for `initialized`
  → tracklist → loc | displayedRegionNames | (no regions yet) all regions
  → tracks → nav → highlights → clear
```

The launcher sorts nothing: `LaunchLinearGenomeViewF` validates `assembly` and
hands the rest to `addView`, which is what makes a spec, a `defaultSession` view
and an `addView` literal one shape. A highlight-only launch must not clobber
existing navigation, but an explicit `displayedRegionNames` navigates even when
regions exist. A bare string where an array belongs (`tracks: 'genes'`) is one
entry, not its characters.

**The URL wire layer restates the param list.** `LgvUrlInit` is an all-string
shape, and app-core cannot import the LGV plugin, so adding a URL param means
touching both it and `InitState`. jbrowse-web's `buildLgvInit` is annotated
with the real type, and that is where the two are checked against each other.

## The shared state machine

`installInitAutorun(self, { name, ready, materialized, apply })`
(`packages/core/src/util/installInitAutorun.ts`) owns the re-entry guard, the
serialized drain, the identity-checked clear and the failure policy for LGV,
dotplot, synteny, circular and spreadsheet. Its doc comment carries the policy.
Breakpoint and sv-inspector apply synchronously, with no await window to guard.

### Mid-apply waits, and why there is no timeout

`apply` gets `{ superseded }` — true once the node is gone or a newer
`setLaunch` replaced this input. Any wait inside `apply` that can park
indefinitely **must** fold it in:

```ts
await when(() => superseded() || cond() || !!self.error) // waiting on SELF
await whenViewsSettled(self.views, superseded) // rows that carry no launch
```

**`whenViewSettled(self, superseded)` is not the first of those.** Its
`pendingLaunch === undefined` term cannot go true inside your own `apply`,
because the blob clears only after `apply` returns. The helper is for a view
whose launch is not the one you are applying.

A fixed timeout is not a substitute: it expires on a slow-but-healthy load and
silently drops the navigation. Every exit from such a wait is something that
reports itself (an error banner, or the next launch taking over), so the caller
skips quietly rather than notifying.

**One timer survives deliberately.** LGV's `openTracklist` waits for the width
change that opening the drawer causes, and in embedded and modal-drawer layouts
none ever comes — "never" and "not yet" look the same without a clock. Use
MobX's `when(..., { timeout })`, which disposes its timer, never
`Promise.race([when(cond), setTimeout])`, whose losing timer outlives the race.

Two hazards when adding a step:

- **Anything `apply` sets up front must be re-declared by the next pass.** A
  superseded apply can stop between its first write and the step that resolves
  it — `beginAutoDiagonalize(requested)` declares `pendingAutoDiagonalize` for
  the current pass rather than only raising it.
- **A readiness gate must cover its own apply window.** Both comparative views
  fold `initPending` into `settled`: rows exist several awaits before their
  tracks, and an empty one settles vacuously.

## The loading state machine (`model.ts` getters)

Every gate reads `pendingLaunch(self.launch)`, never the raw property: **a
snapshot whose only launch content was a typo (`asembly`, `veiws`) has nothing
to launch**, and a view that thought otherwise would wait on an assembly nobody
named. It returns the blob itself, never a copy, because the autorun clears by
identity.

- `hasSomethingToShow` = `hasDisplayedRegions || !!pendingLaunch`
- `awaitingInitNavigation` = `!!pendingLaunch && !hasDisplayedRegions` — not
  the comparative views' `initPending`, which is the bare `!!pendingLaunch`
- `showLoading` = `hasSomethingToShow && !error && (!initialized || awaitingInitNavigation)`
- `showImportForm` = `!hasSomethingToShow || !!error`

`withLaunchInput`'s `postProcessSnapshot` keeps the blob only while the view's
`materialized` predicate says no, so an autosave before navigation does not
save a view that reloads onto its import form.

## A nested view's `bodyMounted` reads true while it is out of the DOM

`ViewContainer`'s effect is the only writer of `bodyMounted`, and it never
reaches a view nested in another view's rows (synteny rows, breakpoint panels),
so every display inside waits for a paint nothing will make. Readiness asks
`effectiveBodyMounted` (`BaseViewModel`), which folds in every enclosing view;
`computeActivityPhase` takes it as the `hostMounted` thunk. A view collapsed to
its ruler (`scalebarOnly`, synteny rows after `compactAllViews`) says it renders
no displays through the `rendersDisplays` hook, folded in for that view alone.

## Verified in a browser

jsdom cannot see a view that comes up blank or parks on a readiness gate.
`products/jbrowse-web/browser-tests/probe-view-launch-surfaces.ts` drives each
view type on each surface against the built app. A `CircularView` body is not
bit-stable between loads — Chrome rasterizes the same SVG labels two ways while
the geometry stays fixed — so the probe compares SVG body pixel counts within a
tolerance and every canvas count exactly.

## Tests

`withLaunchInput.test.ts` for the partition, `launchInput.test.ts` beside each
view for its registration and gate, `installInitAutorun.test.ts` for the
machine, `LinearSyntenyView/initFailure.integration.test.ts` for both failure
policies, and `LinearGenomeView/index.test.ts` for LGV end to end.

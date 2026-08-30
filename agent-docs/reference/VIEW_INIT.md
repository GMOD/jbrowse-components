---
name: view-init
description: The declarative init launch spec, afterAttach, and the view launch state machine. Read when touching view launch, URL params, or createViewState.
---

# View `init` — declarative launch mechanism

How a linear genome view gets navigated, tracked, and highlighted at launch.
One declarative blob (`InitState`) feeds three surfaces (URL params, embedded
`createViewState`, session/config JSON) through one processing path.

## An assembly name read off a track config: canonical, **and** screened

A track config's `assemblyNames` may name an alias, and may name an assembly the
session has no configuration for. Any such name reaching an **`AssemblySelector`
value** or a **view init** must be both:

- **canonical** — `canonicalAssemblyNames` (`@jbrowse/core/util/tracks`).
  `AssemblySelector` blanks a value that is not one of the session's own
  `assemblyNames`, so an alias renders as an empty field with nothing said. The
  matching helpers already canonicalize both sides, so an alias-named track is
  found and then hands over a name the form cannot show.
- **present** — `assemblyManager.has`, never
  `getCanonicalAssemblyName(...) !== undefined`. A missing name is not a blank
  row but a broken view: the init error sets the view's error, `showImportForm`
  reads it, and the user's stack is replaced by an import form.

Keep one derivation per path (`connectedEndpoints`, `syntenyTrackRows`). Nothing
renames assembly names at the RPC boundary, so unlike refNames
(REFNAME_NAMESPACES.md) there is no worker-side exception.

## The shape

`InitState` (`plugins/linear-genome-view/src/LinearGenomeView/types.ts`):

```ts
interface InitState {
  assembly: string // required
  loc?: string // locstring; absent => showAllRegionsInAssembly
  grow?: number // fractional zoom-out around `loc` (0.2 = 20% padding a side)
  displayedRegionNames?: string[] // whole-genome view restricted to these
  // refNames, in order, globs allowed; ignored when `loc` is set
  tracks?: TrackInit[] // string id, or { trackId, trackSnapshot?, displaySnapshot? }
  tracklist?: boolean // open the hierarchical track selector
  nav?: boolean // false => setHideHeader(true)
  highlight?: (string | HighlightType)[] // HighlightType object, locstring, or
  // (URL wire-format) JSON-encoded HighlightType string
}
```

Only keys needing on-attach resolution live here. Plain persisted view props
(`showCenterLine`, `trackLabels`, `colorByCDS`, `showHighlightChips` —
`LinearGenomeViewLaunchProps`) sit on the view snapshot **next to** `init`, where
MST restores them natively; nested inside `init` they are ignored with a warning
naming them.

## Two shapes, one per surface — and why they are not unified

```
spec / URL   { type, id?, displayName?, …resolution keys, …plain view props }   flat args
snapshot     { type, id?,               init: { …resolution keys }, …props }    MST state
```

They differ because they *are* different things. A spec view is **arguments** to
`LaunchView-<type>`, in that launcher's own vocabulary (a dotplot takes `views`, a
spreadsheet takes `uri`), and the launcher sorts them into what the new view
needs. A config/defaultSession view is **state**, so a key needing resolution on
load has nowhere to live but the frozen `init` property, and a plain prop is a
property in its own right — a view prop written *inside* `init` lands in the blob
where nothing reads it, hence the afterAttach warning.

The mirror mistake is a spec's launch key written flat on a snapshot, next to
`init` rather than inside it, where MST drops it for naming no declared
property. `warnUnknownSnapshotKeys` (`core/util/warnUnknownSnapshotKeys.ts`)
reports that one from each view's own `preProcessSnapshot`, on the `[jbrowse
view contract]` channel, so a test collecting it fails.

Nesting a spec's keys under `init` is therefore **reported, not accepted**
(`loadSessionSpec`). Two rejected alternatives, so this doesn't get relitigated:

- **Flattening `init` centrally in `loadSessionSpec`** erases the
  command-vs-prop distinction the launcher exists to draw, before the launcher can
  see it: `init: { colorByCDS: true }` then works from a spec while the identical
  config drops it. That asymmetry is what a `preProcessSnapshot` "hoist" was then
  written to paper over — a `types.frozen` blob quietly relocating its own keys.
  Both were backed out.
- **Teaching each launcher to accept both** is per-view-type work every future
  launcher has to remember, so the accepted shape ends up differing by view type
  rather than by surface, which is worse. One check in `loadSessionSpec` covers
  every view type including plugin-provided ones.

The residual cost is that moving a view between a config and a URL means
reshaping it, which is what the diagnostic names.

### What each launcher's vocabulary actually is (checked, all seven)

- **Pure declarative args, no view props at all** — dotplot (`views: [{assembly,
  loc, displayedRegionNames}]`), circular (`assembly`, `tracks`), spreadsheet
  (`assembly`, `uri`, `fileType`), synteny (`views`, `tracks`, + init fields).
  None of these is a view snapshot, and none could become one.
- **Declarative args mixed with view-snapshot props** — LGV
  (`LinearGenomeViewLaunchProps`), breakpoint (every snapshot prop but
  `type`/`views`/`init`), sv-inspector (`height`).

So the init-vs-prop split is *not* an LGV peculiarity — three launchers arrived at
it independently. (An earlier note here suggested dropping the LGV's view-prop
bucket as "the one non-inherent piece"; that was wrong, and it would make the LGV
the odd one out.)

The two mixed launchers resolve the prop set differently, and the difference is
deliberate:

- **breakpoint derives it from the model** — `Omit<SnapshotIn<Model>,
  'type'|'views'|'init'>`, fully type-checked with no cast and nothing to
  maintain, so every view prop is settable. But the runtime just spreads `rest`
  into the snapshot, and MST drops unknown keys silently: **no typo detection**.
- **LGV uses a runtime key table** (`partitionLaunchKeys`), which is hand-listed
  (guarded by `Record<keyof …, true>` so it can't drift from the interface) and
  buys the "ignored unknown key(s)" warning.

LGV wants the warning because it is the view type that untyped surfaces target —
URL params and hand-written spec JSON, where a typo has no compiler to catch it.
Breakpoint is reached mostly programmatically. If a runtime prop list is ever
wanted without the hand-list, that needs the *values* enumerable at runtime, which
a type is not — hence the table.

It lives on the model as `init: types.frozen<InitState | undefined>()`
(`model.ts`). It is **transient**: applied once on attach, then cleared with
`setInit(undefined)`, so a saved session never carries it. (The old "#property
non-serialized" docstring was wrong — `frozen` *is* serialized; it's just
self-clearing, so it's effectively absent by the time a session is saved.)

## The flow

```
URL ?loc=&assembly=&tracks=&tracklist=&nav=&highlight=
  → createSessionLoaderFromUrl       (products/jbrowse-web/src/createSessionLoader.ts)
  → buildJb1SessionSpec + splitHighlights (sessionLoaderHelpers.ts)
  → loadSessionSpec: evaluateAsyncExtensionPoint('LaunchView-LinearGenomeView')
  → LaunchLinearGenomeViewF: session.addView('LinearGenomeView', { init })

createViewState({ location, highlight })  (react-linear-genome-view)
  → view.setInit({ assembly, loc, highlight })   (when `location` OR `highlight` is set;
                                                  loc-less init skips re-nav if regions exist)

session/config JSON
  → view snapshot carries `init` directly

                         ▼ all converge ▼
afterAttach.ts setupInitAutorun (autorun "LGVInit"):
  wait for `initialized`            → warn on unknown / misplaced keys
  → if tracklist: open selector, wait for the one width change (only if drawer was closed)
  → if loc: navToLocString
    elif displayedRegionNames: showNamedRegions   (an explicit list navigates even
                                                   when regions already exist)
    elif no regions yet: showAllRegionsInAssembly (a highlight-only init must not
                                                   clobber existing navigation)
  → showTrack for each init.tracks entry
  → if nav !== undefined: setHideHeader(!nav)
  → backfill assemblyName on existing highlights, then parse init.highlight
    (per-entry try/catch: parseLocString throws on an unknown refName)
  → setInit(undefined)   // clear; one-shot
```

Every step is failure-isolated: `installInitAutorun` catches and reports, because
the autorun body is async, so an escaping throw is an unhandled rejection with no
snackbar that leaves the view half-initialized. A bare string where an array
belongs (`tracks: 'genes'`) is treated as one entry — a string is iterable, so
looping it directly walked its characters.

## The shared state machine (`packages/core/src/util/installInitAutorun.ts`)

LGV, dotplot and synteny each hand-rolled the same machine — re-entry guard,
readiness gate, ordered apply, `setInit(undefined)`, catch — and drifted on the
error policy. They now share `installInitAutorun(self, { name, ready,
materialized, apply })`, which owns:

- the non-observable `draining` flag. `ready` folds in the measured width, which
  flips true→false→true on a StrictMode remount or a dockview re-mount, so the
  autorun re-fires mid-apply whether it is an `autorun` or a `reaction`.
  Overlapping applies duplicated LGV's `init.highlight`, and in synteny the
  second run's `setViews` detached the models the first was still awaiting.
- the serialized drain, so an init set mid-apply is applied rather than
  stranded, and the identity-checked clear (`self.init === init`), so that
  pending init isn't silently dropped by a blind `setInit(undefined)`.
- one failure policy, keyed off `materialized` — the same line each view's
  `postProcessSnapshot` draws for persistence:

| | `init` | report |
| --- | --- | --- |
| before materialization | kept, for a reload retry | `setError` → import form banner |
| after materialization | cleared | `notifyError` → snackbar |

Pre-materialization is `setError` and not a snackbar because the import form
renders `model.error` in its own banner; a snackbar would state the same failure
twice and the banner is the one that persists. Post-materialization is the
inverse: `setError` would discard rows that loaded fine, since `showImportForm`
keys off `error` alone. Clearing `init` there is also what disarms the re-fire.

### Mid-apply waits, and why there is no timeout

`apply` gets a second argument, `{ superseded }` — true once the node is gone or
a newer `setInit` has replaced this init. Any wait inside `apply` that can park
indefinitely **must** fold it in:

```ts
await when(() => superseded() || cond() || !!self.assemblyErrors)
```

Dotplot used to race these against a 30s ceiling. A fixed timeout can only
guess: too short and it expires on a slow-but-healthy remote assembly, silently
dropping the navigation the init asked for; long enough not to, and in the one
case it uniquely covers — a fetch that hangs without ever erroring — it changes
nothing the spinner isn't already saying. What it was actually buying is
liveness for the *drain*: a parked `apply` holds `draining` true, so the init
that replaced it is stranded until the wait ends. `superseded` provides that
exactly instead of eventually, so the ceiling is gone.

The corollary is that every exit from such a wait is caused by something that
reports itself (an assembly failure lands in `error` and the import form's
banner; a supersede is the next init taking over), so the caller re-checks its
own precondition and skips quietly rather than notifying.

Making supersede reachable has a second consequence worth knowing before you add
a step: **anything `apply` sets up front must be re-declared by the next pass,
not inherited.** A superseded apply can now stop between its first write and the
step that resolves it. The comparative views raise `pendingAutoDiagonalize`
before any render can paint, so a supersede would strand it true with no reorder
coming and wedge `settled` — hence `beginAutoDiagonalize(requested)`, which
declares the gate for the current init instead of only ever raising the flag.
Early-set state belongs in one action that states it, not in a conditional that
raises it.

The mirror-image hazard is state the apply has **not** set yet. Both comparative
views expose `initPending` (just `!!init`, which `installInitAutorun` clears as
the last thing a pass does) and fold it into `settled`: a level or axis exists
from the moment the rows do, several awaits before the apply adds the tracks, and
an empty one paints a cleared canvas and settles vacuously over its zero
displays. Any readiness gate a view publishes has to cover its own apply window,
not just the steps that window runs.

**One timer survives, and it is not an oversight.** LGV's `openTracklist` waits
1s for the width change that opening the drawer causes. The rule that condemns
the others acquits this one: they waited on state that either arrives or turns
into an error, both observable, whereas this waits on an *event whose absence is
a normal steady state* — embedded and modal-drawer layouts don't shrink the
view, so no change is ever coming and nothing says so. "Never" and "not yet" are
indistinguishable without a clock, so the clock is the only available bound. It
uses MobX's `when(..., { timeout })`, which disposes its own timer; the hand-
rolled `Promise.race([when(cond), setTimeout])` shape does not — the losing timer
outlives the race. Before adding a ceiling, check which of the two kinds of wait
you have.

`apply` therefore never clears `init` and never catches for reporting — it
catches only the failures it wants to keep going through (a bad locstring in one
row), and everything it lets escape is fatal-as-of-that-point. Per view:

| view | `ready` | `materialized` |
| --- | --- | --- |
| LGV | `initialized` | always true — one row, and `error` already derives a failed `init.assembly` |
| dotplot | `volatileWidth` | `assemblyNames.length` (set by the first apply step) |
| synteny | `width` | `views.length` (`buildViews` awaits every assembly before `setViews`) |

Tests: `packages/core/src/util/installInitAutorun.test.ts` for the machine,
`LinearSyntenyView/initFailure.integration.test.ts` for the two policy branches
end to end.

## The loading state machine (`model.ts` getters)

`init` participates in the import-form-vs-spinner decision so an async assembly
load shows a spinner, not the import form:

- `initialized` — false until `volatileWidth` is set; when `init` is set it
  additionally waits for `init.assembly` to have `regions` loaded (otherwise it
  falls back to `assembliesInitialized`).
- `hasSomethingToShow` = `hasDisplayedRegions || !!init`
- `showLoading` = `!initialized && !error && hasSomethingToShow`
- `showImportForm` = `!hasSomethingToShow || !!error`

So: fresh view, no init, no regions → import form. With `init` set →
`hasSomethingToShow` is true immediately → spinner until the assembly loads.

## A nested view's `bodyMounted` reads true while it is out of the DOM

`ViewContainer`'s effect is the only writer of the raw `bodyMounted` flag, and
it never reaches a view nested in another view's rows — synteny rows, breakpoint
panels. There the raw flag reads `true` for a subtree that is not in the DOM,
and every display inside it waits for a first paint nothing will make.

So readiness asks `effectiveBodyMounted` (`BaseViewModel`), which folds in the
answer of every view this one is nested inside. `computeLoadingTerm` takes it as
the `hostMounted` thunk, so a display never spells the walk itself.

## Cross-view note

Every view type has its own `init` + `LaunchView-<Type>` extension point +
afterAttach autorun that clears it (dotplot, synteny, circular, spreadsheet,
breakpoint, sv-inspector). Same lifecycle, per-view `InitState` shape. The three
with an async multi-step apply (LGV, dotplot, synteny) share the machine above.
Circular, breakpoint and sv-inspector apply synchronously inside the autorun, so
there is no await window to guard. SpreadsheetView is async but deliberately
different — a `reaction` on `init` alone, cleared synchronously up front, so
re-entrancy is excluded by the dependency graph instead of a flag; it can do
that because `init` is not what keeps its loading state up. Beware:
`session.setInit(...)` (app-core / jbrowse-web `loadSessionSpec`) is a **different
`init`** — the workspace dockview layout — not this view-launch spec.

## Known warts (see also the user doc website/docs/automating.md)

- **The URL wire layer duplicates the param list.** `buildJb1SessionSpec`
  (`sessionLoaderHelpers.ts`) and the `SessionLoader.ts` MST props are *all-string*
  shapes (`tracks` comma-joined, `highlight` space-joined via `splitHighlights`'
  brace-counting, booleans as `types.maybe(types.boolean)`), so they can't share
  `InitState`'s value types — adding a new URL param means touching both. Note the
  *type* sites do NOT drift: `initKeys.ts`'s two maps are
  `Record<keyof InitState, true>` / `Record<keyof LinearGenomeViewLaunchProps, true>`
  and `LaunchLinearGenomeViewArgs` is
  `Partial<InitState> & LinearGenomeViewLaunchProps & {session}`, all
  compile-checked against those interfaces.

## Tests

`plugins/linear-genome-view/src/LinearGenomeView/index.test.ts` — init-without-loc,
showLoading transitions, `TrackInit` object form, `init.highlight` (locstring +
JSON forms + assembly fallback, and a bad entry not taking out its siblings),
`init.nav`, `init.displayedRegionNames` over an already-navigated view,
unknown/misplaced-key warnings. `initKeys.test.ts` covers the key split;
`LaunchLinearGenomeView/index.test.ts` the extension point itself.
Integration: `products/jbrowse-web/src/tests/LaunchLinearGenomeView.test.tsx`.

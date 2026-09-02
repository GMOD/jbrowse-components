---
name: view-init
description:
  The launch input a view takes on the view object, the partition that captures
  it, and the launch state machine. Read when touching view launch, URL params,
  or createViewState.
---

# View launch input

How a view gets navigated, tracked and highlighted at launch. Every surface —
URL params, a session spec, a config `defaultSession`, an `addView` literal,
embedded `createViewState` — hands the view **one object**, and one processing
path turns it into state.

## One object, every surface

The rule has no exceptions: _write every setting directly on the view object._

```
{ type, id?, …launch keys, …declared view props }
```

`withLaunchInput` (`packages/core/src/util/withLaunchInput.ts`) splits that
object at snapshot time. A key naming something to resolve moves into the
internal `launch` property; everything else stays on the snapshot, where MST
restores and validates it natively. A view type registers which of its keys are
which, and the registration argument is `Record<keyof Commands, LaunchKeySpec>`,
so a command the view interprets and nobody registered is a compile error rather
than a key that partitions as a typo.

**A launch key is not a snapshot key.** `loc` is a locstring that has to become
displayed regions, `tracks` is trackIds that have to become open tracks,
`highlight` needs `coerceHighlight` and the assembly manager. None has an MST
property behind it, so none can be restored — hence a blob applied once and
cleared. A declared property is the other case and needs no per-setting code at
all: the partition leaves it on the snapshot for MST to restore against the
model's own property list, so **declaring a property is declaring it
authorable**, mixins included. The hand-written
`if (init.x !== undefined) self.setX(init.x)` arm per property is what that
replaced — while it existed, `drawLocationMarkers` shipped unauthorable and four
DotplotView properties never had an arm.

## An assembly name read off a track config: canonical, **and** screened

A track config's `assemblyNames` may name an alias, and may name an assembly the
session has no configuration for. Any such name reaching an **`AssemblySelector`
value** or a **view's launch input** must be both:

- **canonical** — `canonicalAssemblyNames` (`@jbrowse/core/util/tracks`).
  `AssemblySelector` blanks a value that is not one of the session's own
  `assemblyNames`, so an alias renders as an empty field with nothing said. The
  matching helpers already canonicalize both sides, so an alias-named track is
  found and then hands over a name the form cannot show.
- **present** — `assemblyManager.has`, never
  `getCanonicalAssemblyName(...) !== undefined`. A missing name is not a blank
  row but a broken view: the launch error sets the view's error, `showImportForm`
  reads it, and the user's stack is replaced by an import form.

Keep one derivation per path (`connectedEndpoints`, `syntenyTrackRows`). Nothing
renames assembly names at the RPC boundary, so unlike refNames
(REFNAME_NAMESPACES.md) there is no worker-side exception.

## LGV's launch keys

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

`LinearGenomeViewLaunchProps` is the other half of what an author may write, and
it is derived rather than listed: every declared property of the view, minus the
launch keys and the view's identity. `showCenterLine`, `trackLabels`,
`colorByCDS`, `showHighlightChips` and the rest sit beside `loc` and `tracks` on
the same object.

## The partition

`withLaunchInput` is a `preProcessSnapshot` and it is **pure**. A session's view
type is a `types.union`, so MST runs every member's preprocessor against every
candidate snapshot while deciding which one matches, and runs it about twice
more per instantiation — a warning from in there fires against snapshots that
are about to be rejected, and fires for view types the author never wrote.
`afterAttach`, reached only by a snapshot that won, reports what the partition
captured: `reportUnknownKeys` for a key nothing reads, `reportMalformedRows` for
a row list refused whole. Both are `console.warn` plus a `notify`.

Three properties of the wrapper that are load-bearing:

- **`.preProcessSnapshot` with a terminal cast, never `types.snapshotProcessor`.**
  The processor carries the same widened input type and stops being a
  `ModelType`, and `PluginManager.pluggableMstType` filters union members on
  `isModelType` — a wrapped view stateModel is dropped from the session's view
  union without a word. `ViewType.stateModel: IAnyModelType` and every
  `.properties` introspection site break with it.
- **ORDER.** MST runs preprocessors in the reverse of the order they were added,
  so this belongs on the chain BEFORE a view's own legacy-key preprocessor, where
  it partitions the snapshot MST finally consumes rather than a key that remap is
  about to convert.
- **The widening cast is the last link that may change the creation type.** It
  replaces `CustomC`, so a `.props()` added after it is invisible to
  `SnapshotIn`. Further `preProcessSnapshot`/`postProcessSnapshot` links are
  fine; both carry `CustomC` through.

### Discriminators, all model-guaranteed

`tracks` and `views` name both an authored recipe (`tracks: ['genes']`) and built
state (`view.tracks`, an array of track models). Neither the state props nor the
authored names had to be renamed: each colliding key registers the discriminator
that splits one array per entry, so a mixed array splits rather than picking one
meaning for the whole thing.

| kind | a recipe entry is | why it holds |
| --- | --- | --- |
| `trackEntries` | a string, or `'trackId' in entry` | a built track snapshot cannot carry `trackId` — `BaseTrackModel` does not declare it. `type` would not discriminate: specs write display types inline |
| `rows` | an entry with no `type` | a built row is a view snapshot, and every view's `type` is a required literal |
| `highlightEntries` | a string | a string needs `coerceHighlight` and the assembly manager; an object is the persisted shape |
| `launch` | always | the key collides with no declared property, so the lift is unconditional |
| `replay` | always, and the value also lands on the property | below |

A **row** list is the one that cannot be split: `views` indexes against `levels`
and per-level `tracks`, so lifting half of it renumbers the other half. A pure
preprocessor cannot throw — it runs against snapshots the union is about to
reject — so the whole list goes to the bucket `afterAttach` reports, and the view
comes up on its import form rather than on a silently misaligned stack.

### `replay`, and the question that decides it

A launch key whose name IS a declared property with the same value meaning, where
launching needs an ordered imperative step beyond the property write, is not
remapped: the value lands on the prop and a copy rides in the blob. The deciding
question, and it belongs in the registration entry: _on an already-materialized
view, does writing the property alone produce the correct picture?_

`sameScale` is the only member. Writing it alone latches the shared-zoom limit as
state and skips `applySharedScale()`, so the rows never move onto one bp/px — and
the zoom has to run after `autoDiagonalize` has rewritten and re-centred them,
which is the ordering half. A sweep of every Commands interface against every
prop list found nothing else.

### What each view registers

| view | launch keys | notes |
| --- | --- | --- |
| LGV | `loc`, `grow`, `assembly`, `displayedRegionNames`, `tracklist`, `nav`, `tracks`, `highlight` | `bpPerPx`/`offsetPx` are `passThrough` — no longer declared properties, still converted by the model's own preprocessor |
| dotplot | `views`, `tracks`, `highlight`, `autoDiagonalize` | `views` is unconditional: the model declares `hview`/`vview` and derives `views` as a getter |
| synteny | `views`, `tracks`, `levelHeights`, `autoDiagonalize`, `collapseEmptyRows`, `drawCurves`, `drawLocationMarkers`, `sameScale` | `tracks` is unconditional: the levels between the rows hold theirs, so the view declares no top-level `tracks` |
| circular | `assembly`, `displayedRegionNames`, `tracks` | `displayedRegions` is the resolved form of the second |
| spreadsheet | `assembly`, `uri`, `fileType`, `filterText` | four plain lifts; the view declares no property of any of those names |
| sv-inspector | `assembly`, `uri`, `fileType`, `filterText` | written out rather than borrowed from the spreadsheet's, so the Record fails the build when a view's commands and its registration disagree |
| breakpoint | `views` | its one key and its one discriminator |

Everything else each view can be launched with is a declared property —
`colorBy`, `alpha`, `minAlignmentLength`, `lodMode`, `height` — and none of them
is a launch key.

## The registration is the one declaration

`ViewType.launchKeys` carries it, and `ViewType.acceptedKeys` is the derived
answer to "what may an author write on this view": the state model's properties,
plus the launch keys, plus `passThrough`. Four consumers read it rather than
restating it.

- **`loadSessionSpec`** runs the same classification the snapshot path gets,
  because a spec never becomes a snapshot: `LaunchView-<type>` takes these keys
  as arguments, so the partition never sees them. It reports through
  `unknownKeysMessage`, the same wording, so a typo reads the same whether it was
  written in a config or in a URL. An error rather than the snapshot path's
  warning, because the launcher's own failure lands as an error a line later and
  a warning under it reads as the lesser of the two when it is the cause. A view
  type that registers no launch keys classifies nothing — its launcher's
  vocabulary is undeclared, so every argument would read as a typo.
- **`jbrowse validate`** builds a `views` manifest group from `stateModelProps`
  and `launchKeys`, which is what makes `checkSessionViewKeys` exhaustive rather
  than a guess. It names the other view types that DO take a key, since
  `assembly` on a DotplotView is not a misspelling and no did-you-mean reaches
  it.
- **`check-build-scripts.py`** applies the same placement rule to the session
  JSON a build script emits.
- **The URL parameters page** renders each view's launch keys from the
  registration (`#launchKeys` and the `SPEC_KEYS` marker blocks), rather than
  restating the list.

**An out-of-tree view that registers nothing keeps MST's silent drop until it
does**, and excess-property checking is TypeScript's literal-site check, so a
spec built through untyped indirection still needs the runtime path and the
validator.

## The flow

```
URL ?loc=&assembly=&tracks=&tracklist=&nav=&highlight=&regions=
  → SessionLoader.urlViewInit        (buildLgvInit, app-core/SessionSpec/lgvUrlInit.ts)
  → decodeJb1StyleSession: spec { views: [{ type: 'LinearGenomeView', …init }] }
  → loadSessionSpec: evaluateAsyncExtensionPoint('LaunchView-LinearGenomeView')
  → LaunchLinearGenomeViewF: session.addView('LinearGenomeView', spec)

the same params over a config's defaultSession (&extendSession=true)
  → applyDefaultSessionViewInit: view.setLaunch({ …base, …init, assembly })

createViewState({ location, highlight, init })  (react-linear-genome-view)
  → view.setLaunch(...)   (loc-less input skips re-nav if regions exist)

session/config JSON, an addView literal, a session spec's view
  → the view object → withLaunchInput's preProcessSnapshot → `launch`

                         ▼ all converge ▼
afterAttach.ts setupInitAutorun (autorun "LGVInit"):
  wait for `initialized`
  → if tracklist: open selector, wait for the one width change (only if drawer was closed)
  → if loc: navToLocString
    elif displayedRegionNames: showNamedRegions   (an explicit list navigates even
                                                   when regions already exist)
    elif no regions yet: showAllRegionsInAssembly (a highlight-only launch must not
                                                   clobber existing navigation)
  → showTrack for each track recipe
  → if nav !== undefined: setHideHeader(!nav)
  → backfill assemblyName on existing highlights, then parse the highlight recipes
    (per-entry try/catch: parseLocString throws on an unknown refName)
  → setLaunch(undefined)   // clear; one-shot
```

Nothing is sorted in the launcher: `LaunchLinearGenomeViewF` validates
`assembly` and hands the rest to `addView`, and the view's own preprocessor
partitions it. That is what makes a spec, a `defaultSession` view and an
`addView` literal one shape.

Every step is failure-isolated: `installInitAutorun` catches and reports, because
the autorun body is async, so an escaping throw is an unhandled rejection with no
snackbar that leaves the view half-initialized. A bare string where an array
belongs (`tracks: 'genes'`) is treated as one entry — a string is iterable, so
looping it directly walked its characters.

## The shared state machine (`packages/core/src/util/installInitAutorun.ts`)

LGV, dotplot and synteny each hand-rolled the same machine — re-entry guard,
readiness gate, ordered apply, clear, catch — and drifted on the error policy.
They now share `installInitAutorun(self, { name, ready, materialized, apply })`,
which owns:

- the non-observable `draining` flag. `ready` folds in the measured width, which
  flips true→false→true on a StrictMode remount or a dockview re-mount, so the
  autorun re-fires mid-apply whether it is an `autorun` or a `reaction`.
  Overlapping applies duplicated LGV's highlights, and in synteny the second
  run's `setViews` detached the models the first was still awaiting.
- the serialized drain, so an input set mid-apply is applied rather than
  stranded, and the identity-checked clear (`self.pendingLaunch === launch`), so
  that pending input isn't silently dropped by a blind `setLaunch(undefined)`.
- one failure policy, keyed off `materialized` — the same line each view's
  `postProcessSnapshot` draws for persistence:

| | launch state | report |
| --- | --- | --- |
| before materialization | kept, for a reload retry | `setError` → import form banner |
| after materialization | cleared | `notifyError` → snackbar |

Pre-materialization is `setError` and not a snackbar because the import form
renders `model.error` in its own banner; a snackbar would state the same failure
twice and the banner is the one that persists. Post-materialization is the
inverse: `setError` would discard rows that loaded fine, since `showImportForm`
keys off `error` alone. Clearing there is also what disarms the re-fire.

### Mid-apply waits, and why there is no timeout

`apply` gets a second argument, `{ superseded }` — true once the node is gone or
a newer `setLaunch` has replaced this input. Any wait inside `apply` that can park
indefinitely **must** fold it in:

```ts
await when(() => superseded() || cond() || !!self.assemblyErrors)
```

Dotplot used to race these against a 30s ceiling. A fixed timeout can only
guess: too short and it expires on a slow-but-healthy remote assembly, silently
dropping the navigation that was asked for; long enough not to, and in the one
case it uniquely covers — a fetch that hangs without ever erroring — it changes
nothing the spinner isn't already saying. What it was actually buying is
liveness for the *drain*: a parked `apply` holds `draining` true, so the input
that replaced it is stranded until the wait ends. `superseded` provides that
exactly instead of eventually, so the ceiling is gone.

The corollary is that every exit from such a wait is caused by something that
reports itself (an assembly failure lands in `error` and the import form's
banner; a supersede is the next launch taking over), so the caller re-checks its
own precondition and skips quietly rather than notifying.

Making supersede reachable has a second consequence worth knowing before you add
a step: **anything `apply` sets up front must be re-declared by the next pass,
not inherited.** A superseded apply can now stop between its first write and the
step that resolves it. The comparative views raise `pendingAutoDiagonalize`
before any render can paint, so a supersede would strand it true with no reorder
coming and wedge `settled` — hence `beginAutoDiagonalize(requested)`, which
declares the gate for the current pass instead of only ever raising the flag.
Early-set state belongs in one action that states it, not in a conditional that
raises it.

The mirror-image hazard is state the apply has **not** set yet. Both comparative
views expose `initPending` and fold it into `settled`: a level or axis exists
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

`apply` therefore never clears and never catches for reporting — it catches only
the failures it wants to keep going through (a bad locstring in one row), and
everything it lets escape is fatal-as-of-that-point. Per view:

| view | `ready` | `materialized` |
| --- | --- | --- |
| LGV | `initialized` | always true — one row, and `error` already derives a failed assembly |
| dotplot | `volatileWidth` | `assemblyNames.length` (set by the first apply step) |
| synteny | `width` | `views.length` (`buildViews` awaits every assembly before `setViews`) |

Tests: `packages/core/src/util/installInitAutorun.test.ts` for the machine,
`LinearSyntenyView/initFailure.integration.test.ts` for the two policy branches
end to end.

## The loading state machine (`model.ts` getters)

The launch blob participates in the import-form-vs-spinner decision so an async
assembly load shows a spinner, not the import form. The gate every one of these
reads is `pendingLaunch(self.launch)` — the blob when it still holds something to
apply, else `undefined` — and not the raw property: **a snapshot whose only
launch content was a typo has nothing to launch**, and a view that thinks
otherwise waits on an assembly nobody named and never leaves the spinner. It
returns the blob itself and never a copy, because the autorun clears by identity.

- `initialized` — false until `volatileWidth` is set; with a pending launch it
  additionally waits for that launch's `assembly` to have `regions` loaded
  (otherwise it falls back to `assembliesInitialized`).
- `hasSomethingToShow` = `hasDisplayedRegions || !!pendingLaunch`
- `awaitingInitNavigation` = `!!pendingLaunch && !hasDisplayedRegions` — the
  window where the assembly is ready and the autorun has not navigated yet,
  which `initialized` does not cover. **Not the comparative views'
  `initPending`**, which is the bare `!!pendingLaunch` and which they read from
  `settled` rather than from the loading gate; the two disagree exactly once regions exist, and this one
  stops holding the spinner there.
- `showLoading` = `hasSomethingToShow && !error && (!initialized || awaitingInitNavigation)`
- `showImportForm` = `!hasSomethingToShow || !!error`

So: fresh view, nothing to launch, no regions → import form. With a pending
launch → `hasSomethingToShow` is true immediately → spinner until the assembly
loads.

The blob is transient: applied once on attach, then cleared, so a saved session
never carries it. `postProcessSnapshot` keeps it only while `displayedRegions`
is still empty, so an autosave firing before the autorun has navigated does not
save a view that reloads onto its import form.

## A nested view's `bodyMounted` reads true while it is out of the DOM

`ViewContainer`'s effect is the only writer of the raw `bodyMounted` flag, and
it never reaches a view nested in another view's rows — synteny rows, breakpoint
panels. There the raw flag reads `true` for a subtree that is not in the DOM,
and every display inside it waits for a first paint nothing will make.

So readiness asks `effectiveBodyMounted` (`BaseViewModel`), which folds in the
answer of every view this one is nested inside. `computeLoadingTerm` takes it as
the `hostMounted` thunk, so a display never spells the walk itself.

## Cross-view note

All seven view types take their settings the same way and share the partition;
each still owns its own `LaunchView-<Type>` extension point and its own autorun.
The three with an async multi-step apply (LGV, dotplot, synteny) share the
machine above. Circular, breakpoint and sv-inspector apply synchronously inside
the autorun, so there is no await window to guard. SpreadsheetView is async but
deliberately different — a `reaction` cleared synchronously up front, so
re-entrancy is excluded by the dependency graph instead of a flag; it can do that
because the launch blob is not what keeps its loading state up.

## Known warts (see also the user doc website/docs/automating.md)

**The URL wire layer duplicates the param list.** `LgvUrlInit`
(`app-core/SessionSpec/lgvUrlInit.ts`) is an all-string shape — `tracks`
comma-joined, `highlight` space-joined via `splitHighlights`' brace-counting,
booleans read one at a time — and app-core cannot import the LGV plugin, so it
restates the interface rather than sharing `InitState`'s value types. Adding a
URL param means touching both. jbrowse-web's `buildLgvInit` wrapper is annotated
with the real type and is where the two are checked against each other; if the
restatement ever stops being assignable, that is where it fails.

## Before v5 there were two shapes

Until v5 the correct shape depended on the surface: flat on the view in a spec, a
URL and a jbrowse-img spec; nested under `init` in a `defaultSession`. v5 takes
the flat one everywhere and unwraps `init` into it, warning in one wording on
every surface — the settings still apply, and the flat spelling wins where a key
is written both ways. The command-vs-property distinction behind the old split is
real and the partition still draws it — what was wrong was asking an author to
draw it, against an MST that drops a misplaced key without a word. This doc
argued for keeping the two shapes, and the mistakes that shipped were following
it.

[ADR-099](../architecture-decision-records/adr-099-a-view-takes-one-authored-object.md)
is the record: what the split cost, the two alternatives rejected before this one
and still rejected on the same grounds, and why the state props did not have to
be renamed. Read it before proposing that a surface get its own shape back.

## Verified in a browser

jsdom cannot see a view that comes up blank, sits on a readiness gate or falls
back to its import form, so every migrated view was driven in headless Chrome
against the built app on each surface. LGV, synteny and dotplot went first
(2026-08-30, numbers not kept); the four below went on 2026-09-02 with
`products/jbrowse-web/browser-tests/probe-view-launch-surfaces.ts`, which is
the reusable driver. It readies on the positive session gate, then
`waitForViewPhases` (the one that sees `[data-view-component-pending]` — a lazy
view body reads "Loading…" for a couple of seconds after `data-app-phase` is
already `ready`, and a probe gating on the app marker alone photographs a hang),
then the display phases and paint, then the app holding `ready`. The census is
an element capture of every `<canvas>` and of every view body, counting the
pixels off the modal colour at 4 bits per channel — not a look at the
screenshot. All against the volvox fixture at a 1400x900 viewport.

| view | flat spec URL | flat `defaultSession` | census |
| --- | --- | --- | --- |
| CircularView (`volvox_sv_test`) | painted | painted, identical | 8 chords, body 1396x436: 64,623 or 64,628 px — below |
| SpreadsheetView (`volvox.filtered.vcf.gz`) | painted | painted, identical | 22 rows, body 1396x480: 104,730 px |
| SvInspectorView (`volvox.dup.vcf.gz`) | painted | painted, identical | 8 chords, 8 rows, body 1396x538: 92,289 px |
| BreakpointSplitView (2 × `volvox_sv`, `ctgA:1-50000`) | painted | painted, identical | canvases 1386x250: 85,903 and 61,796 px; body 1396x697: 246,463 px |

A snapshot whose only launch content is a typo (`asembly`, `veiws`) opens on the
import form with nothing pending and raises the one warning, on all four. On a
spec URL the same typo is named as an error and the launcher then does what it
always did with a missing key: spreadsheet and sv-inspector open their import
form, circular and breakpoint refuse (`No assembly provided`, `needs a "views"
array`) with no view opened — LGV's policy, and no hang either way.

One caveat on "identical", because it costs a run to rediscover: a
`CircularView` body is not bit-stable from one page load to the next. Chrome
rasterizes the same SVG two ways — 263 pixels of the rotated `ctgA`/`ctgB`
labels and the ring's two tangent points, a net 5 of 64,623 — and which way it
lands does not track the surface, so two spec-URL loads differ exactly as often
as a spec URL and a `defaultSession` do. The geometry under it does not move at
all (`bpPerPx` 56.91611773867309 and `radiusPx` 160 on eight consecutive loads),
which is what says this is the rasterizer and not the launch input. So the probe
compares a body count within a tenth of a percent and everything else — phases,
chord and row counts, canvas count and sizes, canvas pixel counts — exactly.
Only the SVG bodies drift; every canvas count came back bit-identical across
every run.

The five `SvInspectorView` figures were spot-checked rather than re-shot:
`node scripts/generate-screenshots.ts --check --filter sv_inspector` from
`website/` renders each twice and compares them without touching a committed
PNG, and all six it selects came out stable to 0.000% with every page readied by
the app's own `ready` marker. They author the flat shape the probe drives, and
`sv_inspector_importform_after` is the bare `{ type: 'SvInspectorView' }` that
has to reach the import form.

Two things the run found that jsdom could not:

- **A config loaded from a URL stamps `baseUri` beside every `uri` it carries,
  a `defaultSession` view's included** (`addRelativeUris`). Spreadsheet and
  sv-inspector reported it as a typo on every such config and dropped it, so the
  sheet's file resolved against the page while the tracks beside it resolved
  against the config. It is a launch key now and rides into the file location.
- **An empty BreakpointSplitView held `data-app-phase` at `loading`.** Its
  `initialized` required at least one panel, and `AppReadyMarker` reads a false
  there as the app still loading — so a split view on its import form, from a
  typo or from the Add menu, was a page every capture gate waited on forever.

## Tests

`packages/core/src/util/withLaunchInput.test.ts` for the partition itself, and
`launchInput.test.ts` beside each migrated view for that view's registration,
discriminator and readiness gate.
`plugins/linear-genome-view/src/LinearGenomeView/index.test.ts` covers the
LGV's behaviour end to end — launch without `loc`, showLoading transitions, the
`TrackInit` object form, the highlight forms (locstring, JSON, assembly
fallback, and a bad entry not taking out its siblings), `nav`,
`displayedRegionNames` over an already-navigated view, and the unknown-key
report. `LaunchLinearGenomeView/index.test.ts` covers the extension point;
`products/jbrowse-web/src/tests/LaunchLinearGenomeView.test.tsx` the integration.

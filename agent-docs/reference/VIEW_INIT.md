---
name: view-init
description: The declarative init launch spec, afterAttach, and the view launch state machine. Read when touching view launch, URL params, or createViewState.
---

# View `init` — declarative launch mechanism

How a linear genome view gets navigated, tracked, and highlighted at launch.
One declarative blob (`InitState`) feeds three surfaces (URL params, embedded
`createViewState`, session/config JSON) through one processing path.

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

Every step is failure-isolated: `applyInitOnce` catches and notifies, because the
autorun body is async, so an escaping throw is an unhandled rejection with no
snackbar that leaves the view half-initialized. A bare string where an array
belongs (`tracks: 'genes'`) is treated as one entry — a string is iterable, so
looping it directly walked its characters.

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

## Cross-view note

Every view type has its own `init` + `LaunchView-<Type>` extension point +
afterAttach autorun that clears it (dotplot, synteny, circular, spreadsheet,
breakpoint, sv-inspector). Same lifecycle, per-view `InitState` shape. Beware:
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

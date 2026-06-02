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
  tracks?: TrackInit[] // string id, or { trackId, trackSnapshot?, displaySnapshot? }
  tracklist?: boolean // open the hierarchical track selector
  nav?: boolean // false => setHideHeader(true)
  highlight?: string[] // locstring OR JSON-encoded HighlightType (see wart below)
}
```

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
  → view.setInit({ assembly, loc, highlight })   (only when `location` is set — see wart)

session/config JSON
  → view snapshot carries `init` directly

                         ▼ all converge ▼
afterAttach.ts setupInitAutorun (autorun "LGVInit"):
  wait for `initialized`            → warn on unknown keys
  → if tracklist: open selector, wait for width to settle
  → if loc: navToLocString  else: showAllRegionsInAssembly
  → showTrack for each init.tracks entry
  → if nav !== undefined: setHideHeader(!nav)
  → backfill assemblyName on existing highlights, then parse init.highlight
  → setInit(undefined)   // clear; one-shot
```

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

## Known warts (see also the user doc website/docs/initializing_views.md)

- **`highlight: string[]` leaks the URL wire-format into the programmatic API.**
  Each entry is *either* a locstring *or* a JSON-encoded `HighlightType` string,
  because URL params are strings (hence `splitHighlights`' brace-counting).
  `createViewState`/session-JSON authors are forced to hand-write JSON-in-a-string
  instead of passing a `HighlightType`. The natural fix is
  `highlight?: (string | HighlightType)[]`.
- **The field list is duplicated across ~6 sites** and drifts: `InitState`,
  `knownInitKeys` (afterAttach), `LaunchLinearGenomeViewArgs`,
  `buildJb1SessionSpec`, `createSessionLoaderFromUrl`, plus the docs. The
  `knownInitKeys` runtime warning exists only because `init` is an untyped
  `frozen` blob, so typos can't be caught at compile time.
- **`createViewState` drops `highlight` when `location` is absent** — `setInit`
  is only called inside `if (location)`. The naive fix regresses by clobbering a
  `defaultSession`'s navigation via `showAllRegionsInAssembly`; needs a
  loc-less-but-highlight-only path that doesn't re-navigate.
- **The `tracklist` width race** — `await when(volatileWidth changes, {timeout:
  500})` guesses the drawer changes width within 500ms; the most likely source of
  a future "navigated to the wrong region with `&tracklist=true`" bug.

## Tests

`plugins/linear-genome-view/src/LinearGenomeView/index.test.ts` — init-without-loc,
showLoading transitions, `TrackInit` object form, `init.highlight` (locstring +
JSON forms + assembly fallback), `init.nav`, unknown-key warning.
Integration: `products/jbrowse-web/src/tests/LaunchLinearGenomeView.test.tsx`.

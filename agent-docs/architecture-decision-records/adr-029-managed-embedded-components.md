---
status: Proposed
summary: "Managed embedded React components (uncontrolled, init-driven)"
---

# ADR-029: Managed embedded React components (uncontrolled, init-driven)

## Status

Proposed (POC on `webgl-poc`)

## Context

Embedding a JBrowse view has always been a two-step imperative ceremony: call
`createViewState({...})` to build a live MST engine (plugin manager, assembly
manager, RPC workers), stash it in `useState(() => ...)`, then pass it to
`<JBrowseLinearGenomeView viewState={state}>` and drive everything through
imperative method calls (`state.session.view.navToLocString(...)`,
`showTrack(...)`). New users find this unintuitive — it doesn't look or feel
like a normal React component with a prop API.

The ask: make it behave more like an ordinary controlled/declarative component
where you pass props and the component figures out what to do.

## Decision

Add a thin **managed** component per product that wraps the existing
`viewState` primitive — *additive*, the primitive stays untouched:

- `LinearGenomeView` (vs primitive `JBrowseLinearGenomeView`)
- `CircularGenomeView` (vs `JBrowseCircularGenomeView`)
- `JBrowse` (vs `JBrowseApp`)

It is **uncontrolled**: props are initial values (like an input's
`defaultValue`). The engine is built once in `useState(() => createViewState)`;
later prop changes are ignored. Swap assembly/plugins by remounting via React
`key`.

Three roles, cleanly separated:

- **declarative input** — a single launch blob. For the single-view products
  this is the view's own `init` (`InitState` / `CircularViewInit`, see
  `../reference/VIEW_INIT.md`); for the app it's a session-centric `views[]` array. Reusing
  the view's own init shape means the same blob round-trips through saved
  sessions and URL specs — no new vocabulary.
- **declarative output** — `onChange` (patch observer), already on
  `createViewState`.
- **imperative handle** — a `ref` to the live engine (`forwardRef` +
  `useImperativeHandle`) for post-launch ops the props don't cover
  (`navToLocString`, `showTrack`, `addView`, `onPatch`, ...).

```tsx
<LinearGenomeView   assembly={…} tracks={…} init={{ assembly, loc, tracks }} ref={r} />
<CircularGenomeView assembly={…} tracks={…} init={{ assembly, tracks }}      ref={r} />
<JBrowse assemblies={…} tracks={…} views={[{ type: 'LinearGenomeView', init: {…} }]} ref={r} />
```

### Type shape

Each product splits its `createViewState` options into a shared
`CreateViewStateBaseOptions` (engine-construction inputs) that both APIs build
on by **positive composition** — no `Omit`:

```ts
interface ViewStateOptions extends CreateViewStateBaseOptions {
  location?; highlight?; defaultSession?    // imperative-era initial state
}
interface LinearGenomeViewProps extends CreateViewStateBaseOptions {
  init?: InitState                          // the one declarative input
}
```

So `location`/`highlight`/`defaultSession` live only on the imperative API;
`init` (or `views`) is the managed component's single initial-state mechanism.

## Alternatives considered

### Fully/partially controlled component (rejected)

The original idea was a controlled component: a `shownTracks: string[]` prop
diffed against `view.tracks` each render, with `onShownTracksChange` feeding
back. Rejected after analysis:

- **Lossy.** Per-track state (height, chosen display type, colors) lives inside
  the track instance's `displays[0]` snapshot; a `string[]` of ids can only
  control *presence*. Enriching the prop to `TrackInit[]` just relocates the
  snapshot-authoring ceremony into props.
- **Hostile revert.** JBrowse renders its own track selector/menus that call
  `showTrack` directly. A controlled prop would `hideTrack` anything the user
  opened that way unless the parent echoes it back — a disappearing-track bug,
  not a dropped keystroke.
- **Async + high-frequency.** `navToLocString` is async and rejects on bad
  input; `offsetPx`/`bpPerPx` change every frame during pan/zoom. Location
  can't be a synchronous controlled value without fighting the user.
- **Relocates complexity.** The diff/sync layer is new code with its own
  loop/ordering/equality bugs; for power users the explicit imperative API is
  more predictable.

The uncontrolled-with-`init` design keeps the engine intact, adds no sync loop,
and the `ref` handle covers the imperative cases without the controlled hazards
(a ref is one-way output — no diff loop, no revert).

### Drop the imperative escape hatch (rejected)

Considered making the managed component purely declarative and telling users to
drop to `createViewState` if they need imperative control. Rejected:
external-control embeds (a variant table or search box driving the view) are
the *mainstream* reason to embed, not an edge case, and forcing a full rewrite
at the first imperative need is a cliff, not a ramp. Every mature React wrapper
around a stateful engine (react-leaflet, react-three-fiber, mapbox/deck.gl
wrappers) ships exactly this handle. Kept it — as a `ref`, not the original
`onStateReady` callback.

## Consequences

- The app component (`JBrowse`) is intentionally **session-centric** (`views[]`)
  rather than single-view (`assembly`/`init`), because react-app is multi-view;
  flattening it into single-view props would break with 2+ views.
- `init.tracks` showing is additive (never hides), matching the view's own init
  autorun — fine for launch, but the managed component is not a track
  reconciler.
- `CircularViewInit` was unexported; now exported from `plugin-circular-view`.
- Open: naming (`JBrowse` for the managed app sits next to `JBrowseApp`); MDX
  docs positioning the managed components as the front door.
```

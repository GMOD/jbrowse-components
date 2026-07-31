---
status: Accepted
summary: "A track list that is not a view is addressed by id through its view (`trackContainerFor`), not registered as a hidden view type"
---

# ADR-050: Track containers are addressed through their view, not registered as view types

## Status

Accepted (2026-07).

## Context

`LinearSyntenyView` stacks N genome rows with N-1 synteny bands between them.
Each band ("level") owns its own track list, its own height, and its own GPU
canvas. It is not a view: it has no width, no `setWidth`, no menu, no React
component, and it never appears in `session.views` — it lives in
`LinearComparativeView.levels`.

It was nonetheless registered as a view type named `LinearSyntenyViewHelper`,
with `hiddenFromGUI: true` and a `() => null` component. Four things depended
on that lie, and every one of them was about opening a track into it:

- `HierarchicalTrackSelectorWidget.view` and `AddTrackWidget.view` are
  `types.safeReference(pluggableMstType('view', 'stateModel'))`. Only a
  registered view type is a legal target, so pointing a selector at a band
  required the band to be in the view union.
- `filterTracks` narrows the offered tracks with
  `getViewType(view.type).displayTypes`, and `TypeRecord.get` **throws** on an
  unregistered name.
- `showTrackGeneric` picked the display the same way, from `self.type` — and
  `self` there is the band, not a view.

`LinearSyntenyDisplay` was therefore registered with
`viewType: 'LinearSyntenyViewHelper'`, which left `LinearSyntenyView` itself
owning zero display types. That was already inconsistent: `getCompatibleDisplays`
resolves through `getContainingView`, which walks *past* a level (no width) to
the real view, so it found no synteny displays at all. Invisible only because
its one caller needs `length > 1` to render anything.

The cost was spread thin and kept getting rediscovered: `parentViewDuck`, the
`isSyntenyLevel` predicate, and comments in three files explaining that
`getContainingView` "walks past it because it has no width".

## Decision

**A track container is not a view. Widgets target a view, plus optionally one
container within it, by id.**

- `AbstractViewModel` gains an optional
  `trackContainerFor?: (id: string) => TrackContainer | undefined`. Views owning
  exactly one track list (all of them but this one) don't implement it.
  `TrackContainer` — tracks, assembly names, show/hide/toggle — is the slice
  both widgets write into, in the same spirit as the existing
  `TrackActionView`.
- Both widgets gain `trackContainerId: types.maybe(types.string)` and resolve
  `trackContainer` as `id === undefined ? view : view.trackContainerFor?.(id)`.
  Every other view resolves to itself, so nothing else changes.
- `showTrackGeneric` reads its display types from
  `isViewModel(self) ? self : getContainingView(self)` — the same walk-past that
  already resolved the band's `parentView`.
- `LinearSyntenyDisplay` registers against `LinearSyntenyView`, which is where
  `getContainingView` was pointing all along.
- The `LinearSyntenyViewHelper` view-type registration is deleted.

**By id, not index.** `reconcileLevels()` pops levels when a genome row is
removed; an index would silently retarget an open selector at a different
assembly pair.

The model keeps its `LinearSyntenyViewHelper` name and `type` literal — saved
sessions persist them inside `levels`. The name is now the only residue.

### Why not a `trackContainer` pluggable element group

`addTrackContainerType` + a union in both widgets' references would make the
registration honest, but it relocates the wart rather than removing it:
`filterTracks` and `getRefSeqTrackConf` would still need a per-container
`displayTypes` lookup, and a second registry exists to serve one member. If a
second non-view track container ever appears, revisit — the `trackContainerFor`
hook is what a registry would have to be built behind anyway.

## Consequences

- Opening a track into a specific band goes through
  `activateTrackSelector(level)` → `{ view: self.id, trackContainerId }`, and
  "Add track" from that selector inherits the same pair. Covered by
  `LinearSyntenyViewMultiwayInit.test.tsx`.
- The selector's localStorage scope key is now keyed on `LinearSyntenyView`
  rather than `LinearSyntenyViewHelper`, so a synteny user's collapsed-category
  state resets once.
- A session saved with a selector or add-track widget pointing at a level id
  now resolves that `safeReference` to `undefined` and opens empty, the same as
  any other dangling widget reference. Not migrated.
- `levels` is still untyped at use sites, but for an unrelated reason that is
  now stated where it happens: `LinearComparativeView` → level →
  `LinearSyntenyDisplay` (whose `view` getter names `LinearSyntenyViewModel`) →
  `LinearComparativeView` is a genuine **type** cycle, so the array's model is
  annotated `IAnyModelType` to cut inference. The runtime import is acyclic.
  Breaking that cycle means narrowing the display's `view` getter off the
  concrete view model, which is a separate change.

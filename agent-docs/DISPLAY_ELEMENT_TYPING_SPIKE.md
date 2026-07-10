# Spike: typing the erased `displays` array element on `BaseTrackModel`

Handoff from a `product-core` / core type & MST-composition audit. Two rounds of
safe cleanups already landed (see **Context** below). This documents the one
remaining *substantive* type-safety improvement, why it was deferred, and the
measured data that de-risks a future dedicated PR.

## The finding

`BaseTrackModel.displays` is declared

```ts
displays: types.array(pm.pluggableMstType('display', 'stateModel')),
```

`PluginManager.pluggableMstType` (`packages/core/src/PluginManager.ts`) returns
a **runtime** `types.union(...)` of every plugin-registered display state-model,
typed only as `IAnyType`. So the element type of `self.displays` erases to
effectively `any`. Every display access on a base-typed track
(`d.viewMenuActions`, `d.trackMenuItems()`, `self.activeDisplay.getPortableSettings?.()`)
is therefore unchecked, and the scattered `as MenuItem[]` / optional-chaining in
`BaseTrackModel.ts` are compensating for that erasure, not for a real union.

The union is genuinely unknowable statically (plugins register at runtime), so
the lever is **not** the exact union — it is a shared **base display interface**
that all displays satisfy, used to type the array element.

## Spike experiment + measured blast radius

Typed the element via a minimal local interface, casting the union **once** at
the single `BaseTrackModel` call site (leaving every *other* `pluggableMstType`
caller — `connectionInstances`, `sessionTracks`, etc. — untouched at `any`, so
their blast radius is zero):

```ts
interface DisplayModelSlice {
  type: string
  configuration: AnyConfigurationModel & { displayId: string }
  viewMenuActions: MenuItem[]
  trackMenuItems: () => MenuItem[]
  getPortableSettings?: (displayId: string) => Record<string, unknown> | undefined
}
// displays: types.array(
//   pm.pluggableMstType('display','stateModel') as unknown as IType<any,any,DisplayModelSlice>
// )
```

Full monorepo `pnpm typecheck`: **exactly 9 errors, all in 2 files** — *not* the
monorepo-wide cascade one might fear. Every error is **legitimate** (real code
that `any` was silently hiding):

| File | Loc | Error |
| --- | --- | --- |
| `plugins/linear-genome-view/.../TrackContainer.tsx` | 70 | `display` possibly undefined; `.prefersOffset` missing |
| `plugins/linear-genome-view/.../TrackContainer.tsx` | 103 | `display` possibly undefined; `.resizeHeight` missing |
| `plugins/linear-genome-view/.../TrackRenderingContainer.tsx` | 51 | `.height`, `.RenderingComponent`, `.DisplayBlurb` missing |
| `plugins/linear-genome-view/.../TrackRenderingContainer.tsx` | 97 | `display` possibly undefined; `.height` missing |

Two distinct real issues surface:

- **Display-specific member access off a base track.** Both components take
  `track: BaseTrackModel` and read *linear-display-specific* members
  (`height`, `RenderingComponent`, `DisplayBlurb`, `prefersOffset`,
  `resizeHeight`) from `track.displays[0]`. Known-safe by convention (an LGV
  track always holds a linear display) but never expressed in types.
- **Possibly-undefined `displays[0]`.** `track.displays[0]` is `T | undefined`;
  under `any` this was invisible. The base already exposes the intended
  accessor — the `activeDisplay` getter (`self.displays[0]!`) with the documented
  "a shown track always has at least one display" invariant.

## Why it was deferred (the blocker)

The clean fix casts each consumer site's `track.displays[0]` to the **concrete
base-linear-display model type** — but the plugin exports **no composed
`BaseLinearDisplayModel` instance type** (`plugins/linear-genome-view/src/BaseLinearDisplay/index.ts`
exports the config schema and the individual mixins — `TrackHeightMixin` owns
`height`/`resizeHeight` — but not a single Instance type of the composed base
display). So landing it requires **first building and exporting that composed
type**, which for a heavily-mixed MST model is itself non-trivial. Bolting
bespoke member-interfaces onto the plugin files instead would push casts/
interfaces outward for typo-safety at ~3 base sites — cost slightly exceeds
benefit as a drive-by. Hence: dedicated PR, not a quick win.

## Plan for the dedicated PR

- Export a composed base-linear-display model type from the linear-genome-view
  plugin (`Instance<>` of the composed `BaseLinearDisplay` state model, covering
  `height`, `resizeHeight`, `prefersOffset`, `RenderingComponent`,
  `DisplayBlurb`, plus the `DisplayModelSlice` members).
- Define/export a shared base display interface in `@jbrowse/core`
  (`AbstractDisplayModel` exists in `packages/core/src/util/types/index.ts` but
  is thin and carries `rendererType: any` — extend it, or add a sibling, with
  `viewMenuActions` / `trackMenuItems` / `getPortableSettings?`).
- Retype `BaseTrackModel.displays`' element to that interface (the one cast in
  `PluginManager.pluggableMstType` output, kept local to this call site — do
  **not** change `pluggableMstType`'s default, which would break every other
  caller currently relying on `any`).
- Fix the 9 consumer sites: cast `track.displays[0]` to the exported concrete
  linear-display type (they legitimately know it is one), and route through
  `activeDisplay` / a non-null accessor for the possibly-undefined reads.
- Gate on `pnpm typecheck` + LGV browser tests.

The key de-risking datum: the actual blast radius is **9 errors in 2 files**, so
this PR is bounded and mechanical once the base display type exists.

## Context — what already landed (do not redo)

- `product-core` / app / web-core: use `isSessionWithConnections` guard over a
  hand-rolled cast, dedup `jbrowse.tracks as PlainTrackConfig[]` into a
  `baseTracks()` helper, consolidate the `self.session` shadow into one
  `SessionShadow`, drop a dead `& SessionWithSessionTracks`, hoist a repeated
  mixin self-cast, remove an inert `& BaseSession` cast, guard the worker
  `MessageEvent` payload.
- core base models: **bug fix** — `InternetAccountModel.addAuthHeaderToInit`
  built headers by object-spreading `init.headers`, which drops everything when
  a caller passes a `Headers` *instance* (reached via every auth `getFetcher`);
  now uses the `Headers` constructor. Plus `menuItems()` `#getter`→`#method` doc
  tag and an `activeDisplay` reuse in `BaseTrackModel`.

## Investigated and deliberately NOT changed (proven non-issues)

- `BaseTrackModel.canConfigure` `?.`/`?? {}` — `sessionTracks`/`trackConfigDeltas`/
  `adminMode` are optional on `AbstractSessionModel` and `SessionWithConfigEditing`
  does not require them, so the optional access is correct regardless of guard order.
- Dropping the `as MenuItem[]` at `trackMenuItems` — with the erased element it
  yields `any[]`, strictly worse.
- `ViewMenu.tsx` `as unknown as (SessionWithMultipleViews & SessionWithDockviewLayout)`
  — load-bearing: `setPendingMove` (dockview-only) is called in the non-panel
  branch, so the component genuinely requires both mixins. Narrowing would break it.
- `ConfigModelParent` drift-check (`AssertExtends`) — the contract is a single
  stable field (`rpcManager`) checkable locally beside its provider; not worth
  the generic-root plumbing its `SessionModelParent` sibling justifies.
- Making `pluggableMstType` generic with a non-`any` default — would flip every
  existing caller's element from `any` to the new default and cascade widely.
  Keep the retype local to the one opting-in call site.

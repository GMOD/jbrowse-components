---
name: lazy-display-behavior-plan
description: Design note on deferring displays' interaction surface out of the eager bundle via the MST fork's extendInstance, not implemented. Read for bundle-size work on display models.
---

# Lazy-loaded display behavior via `extendInstance`

Design note (not yet implemented). Explores using the `@jbrowse/mobx-state-tree`
fork's `extendInstance(instance, fn)` primitive to defer the dependency-heavy,
interaction-only slice of display models out of the eager bundle.

## Background: how display models load today

- Each plugin **statically** imports its `model.ts`/`baseModel.ts` factory in
  `index.ts`, so the chain is in the bundle regardless of use.
- At `createPluggableElements()` (boot), `PluginManager.addElementType`'s
  scheduled callback runs **every** `stateModelFactory(configSchema)` — building
  the full MST type eagerly (e.g. `LinearBasicDisplay/baseModel.ts`, 2898 lines),
  whether or not a track of that type ever exists.
- `pluggableMstType('display','stateModel')` = `types.union(...allDisplays)`, the
  declared type of `track.displays[]`. It must contain every display type any
  saved session could reference, or hydration throws synchronously.
- Only `ReactComponent` is `lazy()`-split. The model is not.

## The primitive

`extendInstance(instance, fn)` (fork branch `feat/extend-instance-lazy-chain`,
uncommitted) attaches `{ actions?, views?, state? }` to a **live** instance using
the same `instantiate{Views,Actions,VolatileState}` machinery as `.extend()`,
run inside an action context so it works on protected trees. Attached members are
not part of the static type (declare the augmented shape via an erased
`import type`). Snapshots are unaffected (only props persist).

Design rule from the fork: **keep persisted state (props) on the base; put
behavior (views/actions) on the lazily-attached segment.** In JBrowse this is a
hard constraint — the union hydrates only props, so any `.props()` left in a
deferred segment would be dropped from the snapshot.

## Key finding: two classes of member, not one wall

The "sync-access gap" is really two categories:

- **Render-critical (sync, must be present at hydrate):** layout getters,
  `rpcProps()`, `regionCannotBeRendered`, height, `renderProps`. Read every
  render/fetch cycle. Small; needed for first paint anyway. Stay on the base.
- **Interaction-triggered (async-safe):** `trackMenuItems`, `contextMenuItems`,
  dialog launchers, export sub-flows. Read only on user gesture. Dependency-heavy
  (MUI icons, editors, `lazy()` dialogs, tree-sidebar). **These are what we
  defer.**

Two mechanics make deferring the interaction surface safe:

- `trackMenuItems` is a plain view **function**, not a computed getter. MST
  installs view functions via `defineProperty({configurable:true})`, so
  `extendInstance` can override on a live instance in production, and observers
  re-invoke functions each reaction — no stranded computed atom. The fork's
  "sharp edge over lazy members" caveat applies to render-critical **getters**,
  not menu functions.
- The surface is read only at interaction boundaries (`TrackLabelMenu.tsx:38`,
  and the track aggregate `BaseTrackModel.ts:321`
  `self.displays.flatMap(d => d.trackMenuItems())`), never in the render loop — so
  an `await` before reading is acceptable there.

## Core mechanism

Attach the deferred surface as a **volatile function slot** (cleaner than
overriding the view — base view identity never changes, slot write drives the
reactive re-render):

```ts
.volatile(() => ({ menuImpl: undefined as undefined | ((self: Self) => MenuItem[]) }))
.actions(self => ({
  async ensureBehaviorLoaded() {
    if (!self.menuImpl) {
      const { buildTrackMenuItems } = await import('./trackMenuItems.ts')
      extendInstance(self, () => ({ state: { menuImpl: buildTrackMenuItems } }))
    }
  },
}))
.views(self => ({
  trackMenuItems() {
    return [...baseItems, ...(self.menuImpl?.(self) ?? [])]
  },
}))
```

Interaction boundary (React), Option A — await then read the still-sync view:

```ts
// TrackLabelMenu open handler
await display.ensureBehaviorLoaded()
const items = track.trackMenuItems()
```

Option B — no await; let MobX re-render the open menu when the slot lands
(base items instantly, full list a frame later).

## Where the bytes come from

Byte savings are primarily **transitive deps** (MUI icons, editors, non-lazy
dialog helpers) that the eager menu code pins today — not the model body's own
code (measured earlier at single-digit KB gzipped per model). Several displays
have **already extracted** menu building into standalone, trivially
`import()`-able modules:

- `plugins/hic/src/LinearHicDisplay/trackMenuItems.ts` (122 lines)
- `plugins/canvas/src/LinearMultiRowFeatureDisplay/trackMenuItems.ts` (130 lines)
- `plugins/maf/src/LinearMafDisplay/trackMenuItems.ts`
- `plugins/variants/src/shared/multiSampleVariantMenuItems.ts`
- `plugins/linear-genome-view/src/LinearGenomeView/menuItems.ts`

These import `@mui/icons-material/*`, `@jbrowse/tree-sidebar`, `lazy()` dialogs —
exactly the deferrable dep weight.

## Phases

- **Phase 0 — fork prerequisite.** Land `extendInstance` in
  `@jbrowse/mobx-state-tree`, publish, bump the two `package.json` deps
  (`package.json`, `packages/core/package.json`). Blocks everything.
- **Phase 1 — pilot: `LinearHicDisplay`.** Off the hot path, already has an
  extracted `trackMenuItems.ts`. Convert its import to dynamic behind
  `ensureBehaviorLoaded`, wire the volatile slot, add the await at the interaction
  boundary. **Measure (gate below) before continuing.**
- **Phase 2 — other extracted menu modules.** `LinearMultiRowFeatureDisplay`,
  `LinearMafDisplay`, multi-sample variants. Same recipe, low friction.
- **Phase 3 — hot-path displays.** `LinearBasicDisplay`/`LinearAlignmentsDisplay`:
  models can't defer (paint immediately) but their menu/context-menu/dialog
  surface can. First extract menu building out of the model chain (mechanical
  refactor of the `superTrackMenuItems` wrap blocks) into standalone modules,
  then apply the recipe. Highest byte payoff, most care.
- **Phase 4 — shared helper.** Extract a `lazyInteractionSurface(loader)` mixin
  once proven 3–4×, so new displays opt in with one call.

## Per-display migration recipe

- Identify interaction-only functions in the chain; grep the model to confirm no
  render-critical getter calls into them.
- Move them to a standalone module exporting `buildTrackMenuItems(self)` /
  `buildContextMenuItems(self)` (many already are).
- Ensure the module is reachable **only** via `import()` — no value
  `export { … } from './trackMenuItems.ts'` in any `index.ts`, or the bundler
  re-pins it. Type-only re-exports are fine (erased).
- Add the volatile slot(s), `ensureBehaviorLoaded`, base view delegate(s).
- Add `await display.ensureBehaviorLoaded()` at the interaction boundary(ies).

## Risks & mitigations

- **Static re-export leak** — one value re-export defeats the split. Add a
  check-script (mirror the existing doc-import checks) asserting deferred menu
  modules have no static importers outside `import()`.
- **Render-critical getter reads a deferred slot** — returns `undefined`
  mid-render. Keep the render core fully on the base; audit per display.
- **`contextMenuItems` parity** — give it the same treatment or it re-pins the
  deferred code.
- **StrictMode double-invoke** of `ensureBehaviorLoaded` — keep idempotent
  (`if (!self.menuImpl)` guard + in-flight promise dedupe).
- **First-interaction latency** — one `import()` round-trip before the menu
  fills; negligible (small, usually-warm chunk), and Option B renders base items
  instantly.

## Measurement — gate for continuing past Phase 1

- Build jbrowse-web before/after Phase 1; diff main-chunk gzipped size; confirm a
  new async chunk appears with the hic menu code + its icons (`AccountTreeIcon`,
  `HeightIcon`, tree-sidebar).
- Report per display: own-code bytes moved **and** transitive deps that left the
  eager chunk (the real prize). **If the deps don't leave** (shared with other
  eager code), stop — ROI collapses to the single-digit-KB own-code figures.

## Scope note

This defers the **interaction surface** of displays and works even on the hot
path. It is orthogonal to (and more tractable than) deferring whole secondary
*view* stacks (dotplot/synteny/circular/hic/breakpoint/sv-inspector) via a thin
registered base + `extendInstance` — that variant's unique value is synchronous
saved-session hydration of a code-split view, but it requires hoisting each
view's entire persisted-prop surface to a thin base and a render-path loading
gate. Revisit after the interaction-surface approach is proven.

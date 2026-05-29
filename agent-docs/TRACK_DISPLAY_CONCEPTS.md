# Track/Display concept cleanup: BasicTrack, FeatureTrack, BaseLinearDisplay, LinearBasicDisplay, LinearBareDisplay

Status: analysis + plan. **Decision (2026-05-29): the legacy block-based render
path is kept indefinitely.** So this plan is consolidation + clarity only — no
retirement of the block stack, no removal of public types.

## The mental model

On the webgl branch there are two parallel display stacks. The five names in the
title are split across them; the naming collisions (`Base`/`Bare`/`Basic`) are an
artifact of the half-finished GPU migration, not a design.

| Concept | Stack | Role | File |
|---|---|---|---|
| `FeatureTrack` | track (stack-agnostic) | canonical feature track type | `plugins/linear-genome-view/src/FeatureTrack/` |
| `BasicTrack` | track | byte-identical "synonym for FeatureTrack" | `plugins/linear-genome-view/src/BasicTrack/` |
| `BaseLinearDisplay` | **legacy block** | base model: `blockState`, `serverSideRenderedBlock`, `renderSvg`, RPC | `plugins/linear-genome-view/src/BaseLinearDisplay/` |
| `LinearBareDisplay` | **legacy block** | concrete display, adds pluggable `renderer` slot; "not commonly used" | `plugins/linear-genome-view/src/LinearBareDisplay/` |
| `LinearCanvasBaseDisplay` | **GPU** | base model: fetch/layout/GPU upload, no blocks | `plugins/canvas/src/LinearBasicDisplay/baseModel.ts` |
| `LinearBasicDisplay` | **GPU** | concrete GPU display | `plugins/canvas/src/LinearBasicDisplay/` |

### The core source of confusion

Three differently-scoped artifacts share the `BaseLinearDisplay` name:

| Artifact | Kind | Scope |
|---|---|---|
| `baseLinearDisplayConfigSchema` | config schema | **shared by both stacks** — GPU `LinearCanvasBaseDisplay` config, legacy `LinearBareDisplay` config, and third-party plugins all extend it |
| `BaseLinearDisplay` | state model | **legacy block only** — only `LinearArcDisplay` + `LinearBareDisplay` compose it |
| `BaseLinearDisplayComponent` | React shell | **shared by both stacks** — generic shell that renders the model's `RenderingComponent` |

So `LinearBasicDisplay` (GPU) does **not** extend the `BaseLinearDisplay` state
model — it extends `LinearCanvasBaseDisplay` — even though it reuses the shared
config schema and the shared React shell. Anyone reading the names assumes
`LinearBasicDisplay extends BaseLinearDisplay`, which is false. The GPU stack
also includes `LinearVariantDisplay`, `LinearWiggleDisplay`, and
`LinearManhattanDisplay` (all on `LinearCanvasBaseDisplay`/`MultiRegionDisplayMixin`).

## Hard constraints (do not break)

- **Type-literal strings** `FeatureTrack`, `BasicTrack`, `LinearBareDisplay`,
  `LinearBasicDisplay`, `BaseLinearDisplay` appear in stored session snapshots
  and external plugin configs. Renaming any breaks old-session loading
  (`feedback_no_rename_mst_type_literals`). Display renames *could* in principle
  go through the existing `DisplayType.aliases` → `displayAliasMap` machinery in
  `baseTrackConfig.ts`; **track types have no alias mechanism** so their literals
  are fully frozen.
- **Public exports** consumed by external plugins (verified in `~/src/jb2plugins`:
  mafviewer, gdc, gwas, quantseq, multilevel-linear-view): `BaseLinearDisplay`,
  `baseLinearDisplayConfigSchema`, `BaseLinearDisplayComponent`,
  `createBaseTrackConfig`, `createBaseTrackModel`. Keep all exported with stable
  signatures.
- `BaseLinearDisplay` the **model** stays live: only `LinearArcDisplay` and
  `LinearBareDisplay` compose it, but the whole block/RPC path stays. The shared
  `baseLinearDisplayConfigSchema` and `BaseLinearDisplayComponent` are used by
  both stacks and are doubly load-bearing.

## Applied changes (all back-compat safe)

- **Sharpened the `BasicTrack` doc comment** to state it's a back-compat synonym
  (kept the schema — see "Why not collapse" below).
- **Fixed the false/misleading comments** in `BaseLinearDisplay/models/configSchema.ts`
  (it wrongly claimed `LinearBasicDisplay` extends it) and added stack-orientation
  headers to the `BaseLinearDisplay`, `LinearBareDisplay`, and canvas
  `LinearBasicDisplay` model files.
- **Added the "Display stacks" section** to `ARCHITECTURE.md` with the
  three-scope table.
- **Renamed the local `interface BasicTrack`** in `baseTrackConfig.ts` →
  `TrackConfigSnapshot` (it was a generic snapshot shape, a third meaning of
  "Basic"; pure local type, no serialization impact).
- **Fixed a double-slash import** in `LinearBareDisplay/index.ts`.

### Why not collapse `BasicTrack` into a shared FeatureTrack factory
Rejected: (a) it's ~3 meaningful lines, exactly the "indirection to compress
small repetition" the project guidelines warn against; (b) the generated
`website/docs/config/BasicTrack.md` page is built from that file's `#config
BasicTrack` JSDoc — sharing the factory would silently drop the doc page.

## Deleting `BasicTrack` entirely — investigated, deferred

A track-type **alias** mechanism (mirror of `DisplayType.aliases` →
`displayAliasMap`) would let `FeatureTrack` declare `aliases: ['BasicTrack']` and
remove the duplicate registration. Investigated; **deferred as too risky for the
payoff** given the "don't break back-compat" constraint. The blocker:

- A track's `type` string is dispatched by **two independent MST unions**:
  - **config tree**: `pluggableConfigSchemaType('track')` over `jbrowse.tracks` /
    `sessionTracks` — implicit `type`-literal discrimination.
  - **model tree**: `pluggableMstType('track','stateModel')` over **`view.tracks`**
    (the *shown*-track models, persisted in saved/shared sessions).
- The config-tree union can be remapped in `baseTrackConfig.preProcessSnapshot`
  (where the display alias remap already lives) — safe and easy.
- The **model-tree union cannot**: MST picks a union member by the raw `type`
  literal *before* any member's `preProcessSnapshot` runs, so deleting the
  `BasicTrack` state model breaks loading of any saved session with an open
  `BasicTrack`. Fixing it means either an explicit `dispatcher` on the generic
  `pluggableMstType` (touches every pluggable model group) or a per-view
  `view.tracks` preprocessor.
- Remapping only the config tree (leaving the model registered) creates a
  config/model mismatch: a `BasicTrack` model's
  `ConfigurationReference(BasicTrackSchema)` would resolve to a now-`FeatureTrack`
  config instance.

There are also **no existing BasicTrack session-load tests** to verify a change
against. Prerequisites before attempting deletion: (a) add a track-type alias
mechanism covering *both* unions (likely an explicit dispatcher in
`pluggableMstType`); (b) add a back-compat test that loads a saved session with
an open `type:'BasicTrack'` track and asserts it still renders.

## Explicitly NOT doing (given "keep block path indefinitely")

- Not deleting `LinearBareDisplay` or `BasicTrack` — block path stays; removal
  risks stored sessions + external refs.
- Not adding `@deprecated`/`console.warn` markers — the path isn't being retired.
- Not migrating arc off `BaseLinearDisplay`.

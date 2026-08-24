---
name: a-track-type-is-five-primitives
description: The target for a published third-party track-type ABI, written with no backward-compatibility obligation. Five of the six verbs a display needs already exist as plain functions or small classes; what is missing is the authoring surface. A third party hands one factory a payload type, a worker fetch, a mark list or a pass list, and a settings table that says what each setting invalidates, and never composes a mixin. Names the new package that would hold the display integration layer, the three installers that collapse to one, the ADRs whose ground this changes, and the order to take it in, with the score-example plugin as the size gauge.
---

# A track type is five primitives

The question this is written against: **can the GPU rendering system be reduced
to a handful of unix-like primitives, small enough to publish as an ABI that a
third party builds a track type on?** The constraint lifted on 2026-08-23 is
that nothing here owes backward compatibility, so names, packages and
abstractions are all movable.

The answer is yes, and most of the primitives are already in the tree. What
does not exist is the surface a third party would author against. Today that
surface is `types.compose` over nine model layers, and the docs already record
why that surface cannot get smaller by consolidation: MST's inference depth is
a ceiling ([ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md)),
mixin argument order is a contract a lint rule holds
([ARCHITECTURAL_LIMITS](../reference/ARCHITECTURAL_LIMITS.md#ordering-is-the-contract)),
and nineteen hooks each default to something that "keeps working and does less"
([ARCHITECTURE](../ARCHITECTURE.md#the-hooks-and-who-is-sitting-on-a-default)).
None of those guards run out of tree
([contract-checks-out-of-tree](contract-checks-out-of-tree.md)). The in-tree
example plugin itself builds its `rpcDataMap` with a bare `observable.map`,
which the architecture spec lists under "what not to do"; that is what a silent
contract looks like on the population it was written for.

## What is already a primitive

Measured 2026-08-23. A display needs six verbs. Five exist.

| verb | what exists | where | primitive? |
| --- | --- | --- | --- |
| fetch | `installFetch` / `runFetchOnce`, one skeleton since 2026-08-20 | `@jbrowse/core/util/installFetch` | yes, but reached through four installers and two foundations |
| upload | three installers over one `createMapUploadSync` | `render-core` | nearly: a keyed identity-diffed map with three release policies |
| draw | `InstancePass = PipelineDescriptor & { pack }`, `drawRegion` on GPU, `draw(ctx)` on Canvas2D, SVG runs the Canvas2D fn | `render-core` | yes |
| hit | per plugin; thirteen files in alignments, none shared | plugins | no |
| phase | `computeDisplayPhase`, `computeSvgReady`, `dataCurrent` | `render-core`, LGV | yes, as plain functions |
| mark | `PileupMark`: one declaration, pack + paint + hit derive; five of twenty alignments features on it, LOC-neutral, found a live GPU/Canvas2D bug | `plugins/alignments/src/features/mark.ts` | exists, alignments-only |

The render layer is small already: `GpuHal` is 17 methods, `RenderingBackend`
is 2, `PerRegionRenderingBackend` is 3, `render-core` is 7,648 lines with no
barrel. The score-example GPU renderer is 69 lines over a 63-line shader; its
Canvas2D twin is 24. [lightweight-toolkit](lightweight-toolkit.md) calls this
rung "packaging and naming, not architecture", and that holds.

The display layer is where the count is. `LinearWiggleDisplay` composes nine
model layers holding roughly 230 member names; `RegionTooLargeMixin` alone is
1,000 lines. The score-example, composing three, still imports 13
`@jbrowse/core` modules, 8 `render-core` modules and 5 symbols from the LGV
plugin, across 17 files and 709 lines.

## The five public primitives

The unix shape is dumb mechanism in the kernel and policy in userland. Here the
kernel is the host: fetch scheduling, cancel, the byte gate, the HAL, the
chrome, SVG export, hover invalidation. A third party never touches it. Their
program is five things.

**`Payload`.** Typed arrays in absolute genomic uint32, one per region (or one
per view). The byte stream. Already the convention
([BP_PRECISION](../reference/BP_PRECISION.md)); nothing changes except that the
factory below requires it rather than documenting it.

**`fetch(ctx, region) => Payload`.** Runs in the worker. `ctx` carries the
adapter, the settings tagged `fetch` below, the stop token and the status
callback. The factory registers the RPC method under the display type's name;
the author writes no `RpcMethodType` subclass and no `RpcRegistry` declaration
merge (the merge is the exact shape that broke Apollo with zero errors,
[PLUGIN_ABI_STABILITY](../reference/PLUGIN_ABI_STABILITY.md)). Today this is an
RPC class, a `fetchNeeded` override and a fan-out helper: three things for one.

**`marks`, or `passes` + `paint` + `hit`.** Two altitudes, both public, the
first built on the second.

- Declarative: a list of marks, each a shape plus accessors into the payload
  plus a color and two gates (`alpha`, `hittable`). The GPU pass, the Canvas2D
  painter, the SVG painter and the hit test all derive from the declaration.
  This is `PileupMark` generalized out of alignments
  ([one-mark-declaration-per-feature](one-mark-declaration-per-feature.md)),
  which needs a shape library: `span` (start..end, a band), `cell` (row cell),
  `bar` (span with height from a value; the score-example), `point` (bp plus a
  glyph), `line` (polyline of bp, y), `arc` (two bps, a dome), `tile` (a
  diagonal cell; Hi-C and LD), `text`. Each shape is one hand-written `.slang`,
  one Canvas2D painter and one hit function in `render-core`, so
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  (never transpile a draw stage) still holds: the shader is per shape, not per
  feature. Three of the shapes exist (`pointGlyph`, `rowRect`, `diagonalGrid`).
- Imperative: `passes` (the existing `InstancePass` list), `paint(ctx,
  regions, blocks, state)`, `hit(payload, x, y)`. The escape hatch for a shape
  the library does not have, and what every in-tree display stays on until a
  mark covers it.

**`settings`.** One table replacing `rpcProps()`, `gpuProps()` and
`renderState`. Each config slot carries what it invalidates: `fetch` (refetch in
the worker), `encode` (re-pack on the main thread), `frame` (redraw only). The
factory derives the RPC cache key from the `fetch` set, the encode `inputs`
from the `encode` set, and the render state from the rest. The
[`rpcProps()` loop trap](../ARCHITECTURE.md#rpcprops-loop-trap-and-how-to-break-it)
cannot be written because a fetch result is not a setting; "pick the payload,
never subtract" is automatic because the payload is the tagged set; the
`SettingsInvalidate` autorun installs itself. Today these are three MST view
methods spread across a config schema, and the split between them is the
commonest thing a new display gets wrong.

**`defineDisplay(spec)`.** The linker. Takes the four above plus `granularity:
'region' | 'view'`, an optional legend, menu items, a feature widget, and
returns everything `addDisplayType` needs: config schema, state model, React
component, `renderSvg`, and the RPC registration. Internally it composes the
in-tree mixins, so the typing depth ADR-041 measured is paid once, inside the
factory, for one fixed composition, rather than per display at the author's
call site. The nineteen hooks become typed fields on the spec, required where
the default is a trap (`viewSignature` on a `view`-granularity display) and
absent where the factory can derive them (`regionHasData` from the payload
map).

Five nouns. A track type is a payload, a fetch, a way to draw, a settings
table, and a call.

## What the host owns, and its own primitives

Behind the factory, the kernel is smaller than it looks and mostly exists:

- `Hal`, 17 methods, unchanged.
- `Pass`, `Renderer` (today `RenderingBackend`; see renames), unchanged.
- **one upload installer**, replacing three. A keyed map of immutable payloads
  diffed by identity, uploaded on change, with a release policy: prune to the
  active set (a display's own map), or delete per key (a shared canvas whose
  keys belong to siblings). Per-region is the map keyed by
  `displayedRegionIndex`, global is a one-key map, keyed shared-canvas is keyed
  by display id.
  [ADR-079](../architecture-decision-records/adr-079-a-display-installs-a-lifecycle.md)
  declined a union installer because the backend type degraded to `any` and a
  per-region prune would wipe siblings; the first is a typing exercise over a
  release-policy parameter rather than a tag, the second is the parameter.
- `installFetch`, unchanged; the two LGV foundations and the comparative
  installer become thin parameterizations of it rather than mixins that
  compose it.
- `computeDisplayPhase` / `computeSvgReady`, unchanged.
- `DisplayChrome` and `renderDisplaySvg`, unchanged in behavior; the factory
  wires them.

## Package organization

- **`@jbrowse/render-core`**, as is. Pixels only; no `@jbrowse/core`. Gains the
  shape library.
- **`@jbrowse/display-kit`**, new. Holds `defineDisplay` and the display
  integration layer that today lives in
  `plugins/linear-genome-view/src/BaseLinearDisplay/`: `FetchMixin`,
  `MultiRegionDisplayMixin`, `GlobalFetchMixin`, `RegionTooLargeMixin`, the
  fetch installers, `DisplayChrome`, `renderDisplaySvg`, and the contents of
  `@jbrowse/display-ui`, which folds in (both must be single-copy for the same
  reason, its React contexts). The view it reads is a duck-typed `RegionHost`
  interface (`displayedRegions`, `visibleRegions`, `bpPerPx`, `offsetPx`,
  `trackWidthPx`, `initialized`), never the LGV model type; the LGV plugin
  depends on display-kit, not the reverse. This is what a third party actually
  depends on, and today it is "the whole LGV plugin barrel", which the workers
  also carry
  ([ADR-043](../architecture-decision-records/adr-043-rpc-workers-carry-ui-code.md)).
- **`@jbrowse/shader-tools`**, as is, a dev dependency for anyone writing a
  shape or an imperative pass.
- A third party's dependency list is `display-kit` and, transitively,
  `render-core` and `core`. The peer set that must be single-copy
  (`@jbrowse/mobx-state-tree`, `@mui/material`, `react`, `mobx`, `mobx-react`)
  is declared as peers once it has been measured
  ([a-dependency-bump-is-an-abi-event](a-dependency-bump-is-an-abi-event.md)),
  which nobody has done and which is the first task below.

## Renames

Taken because there is no compatibility to keep, and each one removes a word
that means two things:

- `RenderingBackend` → `Renderer`. "Backend" is also the RPC driver and the GPU
  API; the classes are already named `GpuXxxRenderer` / `Canvas2DXxxRenderer`.
- `MultiRegionDisplayMixin` / `GlobalFetchMixin` → gone from the public
  surface; `granularity: 'region' | 'view'` on the spec.
- `rpcProps` / `gpuProps` / `renderState` → the `settings` table's `fetch` /
  `encode` / `frame` tags.
- `startRenderingBackend` / `attachRenderingBackend` /
  `installPerRegionLifecycle` / `installGlobalLifecycle` /
  `installKeyedLifecycle` → one `installUpload`, called by the factory.
- `rpcDataMap` → `payloads`, built only by the factory.
- `displayPhase` stays. `region` (a data unit) and `block` (a screen slice)
  stay distinct; they are two things.

## What stays on the in-tree stack

The ABI covers the shape the score-example has: a display in a linear view,
per-region or per-view data, marks or passes. It does not cover:

- **Alignments.** Twenty feature directories, a renderer-held region map, the
  whole-map `sync` upload, three derived tiers. It stays on the full stack and
  is not a target; a third party who needs a pileup extends nothing and should
  be told so. There is still no glyph extension point inside
  `LinearBasicDisplay`
  ([ADR-036](../architecture-decision-records/adr-036-delete-stranded-pluggable-glyph-registry.md)),
  and the ABI is "a display", not "a glyph inside someone else's display".
- **The comparative views and the circular view.** RFC-001 §2 already put
  non-LGV displays out of scope; nothing here changes that.

Two tiers, then: the published contract, snapshotted the way
`render-core/publicApi.test.ts` snapshots subpaths, and the in-tree stack,
which keeps every escape hatch.

## Decisions whose ground this changes

Each of these was taken on a premise the ABI goal removes. They are re-taken,
not overruled.

- [ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
  declined a shared quad skeleton on a two-consumer bar and said in so many
  words that "the third-party-plugin ergonomics argument is explicitly out of
  scope and, if it ever matters, is a different justification." It matters now,
  and the shape library is that helper with a name per shape.
- [ADR-079](../architecture-decision-records/adr-079-a-display-installs-a-lifecycle.md),
  the union installer, above.
- [ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md)
  kept the byte gate in the LGV plugin. It moves to display-kit with the rest
  of the integration layer, behind `RegionHost`.
- RFC-001 §2 ruled out a spec grammar or DSL because it "would replace only the
  render-callback layer, lose per-feature batching, conditional paths and
  custom hit-testing." The mark list is the DSL it feared, and the in-tree
  evidence since is that it keeps batching (one pass per shape), keeps
  conditional paths (the two gates), and derives the hit test. The imperative
  altitude stays for whatever it cannot say.
- [ADR-043](../architecture-decision-records/adr-043-rpc-workers-carry-ui-code.md)
  was blocked on keeping the fat barrel for external plugins. With no
  compatibility owed, the barrel goes and each plugin gets a narrow entry.

## Landed so far

- **Step 1** measured the single-copy set off the emitted `.d.ts`: `react`
  (114 files), `@jbrowse/mobx-state-tree` (265), `@mui/material` (42,
  augmented), `@jbrowse/core` (augmented by every plugin's registry
  declaration merge), `mobx` (5); `mobx-react` appears in none and is not in
  the set.
- **Step 2** landed as `@jbrowse/display-kit` (44 subpaths, `RegionHost` at 15
  members, the mixin getter renamed `host` so `host` is the contract and
  `view` is the LGV). `display-ui` stays its own package rather than folding
  in: its MUI-free module graph is a tested guarantee `display-kit`, which
  holds the Material chrome, cannot make.
- **Step 3** landed as ADR-088: one `installUpload` over `upload(key, data)` /
  `release(key)`, the three installers and their syncs deleted.
- **Step 4** landed as ADR-089: `defineDisplay(spec)`, and the settings table
  from step 5 came with it as `params` with `affects`. The gauge: the
  score-example went from 17 files and 709 lines to four files, the display
  itself 16 + 196 lines with its GPU pass, no import from the LGV plugin, and
  it gained SVG export. The typing unknown resolved: one fixed composition
  inside the factory infers fine.
- **Step 6** started as ADR-090: `mark: { type: 'bar', x, x2, y, color }`,
  the shape in render-core (`shaders/bar.slang`, `marks/bar.ts`), the wiring
  in display-kit. The example is three files, 16 + 122 + 38 lines, and has no
  shader and no draw function. The next shape joins on a consumer's pull.

## Order, and the gauge

The measurable target is the score-example: 17 files and 709 lines today, of
which the author's own decisions are perhaps 150. Under the factory it is the
payload type, `fetch`, one `bar` mark, a two-row settings table and the
`defineDisplay` call: five files, well under 200 lines, no shader, no MST.

1. **Measure the single-copy set.** Grep the emitted `.d.ts` for external
   specifiers. Declare them as peers. Add the tarball test that pins an older
   `@mui/material` on purpose. Nothing after this is testable out of tree
   without it.
2. **Create `display-kit`.** Move `BaseLinearDisplay/` and `display-ui` in
   behind `RegionHost`; narrow the LGV plugin's entry. Publish `render-core`,
   `display-kit`, `shader-tools`.
3. **Collapse the three upload installers to one.** Port the sixteen
   `installPerRegionLifecycle` sites, the four global and the four keyed.
4. **Write `defineDisplay` over the existing mixins** and port the
   score-example to it. Size it. If it is not under 200 lines the factory is
   wrong, not the example.
5. **The settings table.** Port wiggle and Manhattan; delete `rpcProps` /
   `gpuProps` / `renderState` from the public surface.
6. **The shape library and marks.** `bar`, `span`, `point`, `line` first,
   which cover score, wiggle, Manhattan and basic features. Port Manhattan to
   marks as the proof.
7. **Snapshot the public surface** and ship the contract checks behind a
   developer flag rather than stripping them.

## What is not known

- Whether a generic `defineDisplay<Spec>` can return a typed MST model with the
  spec's settings typed on `self` without hitting the same inference ceiling
  ADR-041 measured. The composition is fixed, which is the case for it; the
  settings generic is the case against. Step 4 is where this is found out, and
  it is why the factory is built before the settings table.
- How far the shape library reaches. Alignments' `coverage`, `insertion` and
  `modification` do not fit `PileupMark`; the ABI does not need them, but the
  first third-party request that does not fit a shape decides whether the
  library grows or the imperative altitude is the real contract.
- The single-copy set is guessed at five packages. The measurement in step 1
  may find more, and every one is a peer range this project then owns.
- `generateConfigDocs.ts` builds a display's config page from a `#config`
  JSDoc on a `ConfigurationSchema(` call, so a spec-built display has no
  config page until the generator learns to read the tag on a
  `defineDisplay(` call or on its `params`. The example's page is the one
  lost so far.

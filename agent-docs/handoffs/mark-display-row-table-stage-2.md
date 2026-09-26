---
name: mark-display-row-table-stage-2
description: ADR-165 stage 2 in flight, the GPU row table under the mark display's bar, point and link marks, as of 2026-09-26. The multi-texture half is committed (per-sampler filters, a texture per pass and sampler in all three HALs, `textures` records on marks); the shader half is a WIP commit gen:shaders refuses, since the binding-table allowlist knows one sampler. Also holds the Fable review of the grammar round (Manhattan as a mark display, the ggplot key controls) and the round's open follow-ups.
---

# Mark display row table, stage 2

Colin picked "Row table on marks first" in the 2026-09-26 grammar round: give
the mark display the row table multi-row already has
([ADR-165](../architecture-decision-records/adr-165-the-row-axis-rides-a-table-the-vertex-stage-samples.md)
§Stage 2), the step before folding the multi-row feature display into it.

## State

- **Committed, green** (`aa675ffe2d`): `//! texture-filter: <sampler>
  <filter>` names the sampler a module's filter is for (`colorRamp linear`,
  `rowTable nearest`), the codegen numbers each sampler its own unit and emits
  `name` in `TEXTURES`, `uploadTexture(passId, data, w, h, sampler?)`, WebGL2,
  WebGPU and MockHal keep a texture per pass and sampler, WebGPU builds a
  pass's bind group only once every sampler has a texture, and a mark's
  `textures` lens and a shape's `textures(params)` are records by sampler,
  bound in `defineMark`'s `drawRegion`, so a pass that does not draw uploads
  nothing (LD's genomic pass no longer uploads a ramp it never samples).
- **WIP, does not compile** (`90bb23ac2f`): `pointMark.slang`, `barMark.slang`
  and `linkMark.slang` import `rowTable`, bind `Sampler2D<float4> rowTable` at
  `[[vk::binding(4, 0)]]`, gain `int rowTableKeys`, and place and colour
  through `rowTableLookup`, a hidden key going off clip space. `pnpm
  gen:shaders` refuses all three: `binding table
  'uniform@1,texture@2,sampler@3,texture@4,sampler@5' is not one the render
  HALs bind` — the allowlist in
  `packages/shader-tools/src/shader-codegen/bindings.ts`, and the WebGPU
  layout it stands for.

## Next, in order

0. Close the two HAL hazards the review found in the committed half before
   anything samples two textures: WebGL2's `drawPass` must skip a pass
   missing any of its textures, as WebGPU's does, or unit 1 draws with
   another pass's table; and `uploadTexture`'s nameless default must hold
   only for a one-sampler pass (make `sampler` required otherwise), with
   `MockHal` throwing on an unknown sampler name.
1. Teach `bindings.ts`'s allowlist and the WebGPU bind group layout
   (`bindGroupLayoutEntries` / `getPassLayout` in `webgpuHal.ts`) the
   two-sampler table, then `pnpm gen:shaders` and check its exit code.
   `webgpuHalBindingVisibility.test.ts` already uploads every sampler's
   texture per shader, so it covers the new shape once it compiles. Add one
   test that a two-sampler pass draws nothing until both textures arrive.
2. The TS twins: `RowParams` gains `rowTable?: RowTable`, and `rowLane.ts`
   gains `rowSlot(row, i, table)` (undefined where hidden) and `rowColor`,
   which `pointMark`, `barMark` and `linkMark`'s painter, ink and hit test
   read, and `spanMark`'s `placeSpan` moves onto. Each shape's
   `writeUniforms` writes `rowTableKeys` (−1 without a table) and
   `textures(params)` returns `{ rowTable: params.rowTable?.texture }`.
3. The mark display, in its own module rather than `model.ts` (already ~2000
   lines): under `rows`, key each region's `row` lanes through `RowKeys` at
   arrival (the worker's facet table names each section's key), build the
   table from `sources`' order and the focus, and pass it in `renderState` to
   every mark. `facetRegion` stays for `facet`, whose sections are of
   variable height. What `facetRegion` did beyond re-offsetting has to come
   along: it drops hidden rows' instances and recomputes the axis extent and
   the key over what stays drawn (`drawnScales`), so `autoscaleRange` and
   `legendSections` must read the table. Readers of the `row` lane to check:
   `rowValuesAt` (sort at a column), `runMarkClustering`, `MarkHitInfo.row`,
   `findMarkHit`, the hover ring, `textMarks.ts`, the SVG export,
   `MarkTextLayer` (DOM, reads the table in JS), `MarkRows`. A `rows.field`
   change resets the `RowKeys` (a new key space, as `groupKeySpace` is); the
   density sidecar's layers carry no row; with `rows` beside `facet` the facet
   draws, so `rowTableKeys` stays −1 there. The review suggests splitting the
   rows/facet members out of `model.ts` into a mixin first, since this lands
   there.
4. Measure with `plugins/marks/benches/rowTableRepack.bench.ts` against its
   ADR-165 baseline, record it on ADR-165, and run the `Mark Display` browser
   suite (in the CI gate) on ada.

## Other follow-ups from the round

- From the review, small: an LD mark with a bin/aggregate step or no `y`
  adopts an index nothing joins, silently (`stateModelFactory.ts` `topSnp` /
  `ldMarkIndex` should require a `y` lane and no aggregate, or the notice
  should say so); "Color by LD" over a plot with only bar marks writes
  nothing; the JSON box says "Clears marks" where Manhattan resets to its
  default plot; `NUMERIC_KEY_HINT` counts entries before `breaks` narrows; and
  `jb.help` (`jbApi.ts`) should say a GWASTrack's plot is
  `LinearManhattanDisplay`.

- `jbrowse-web`'s `ConfigSlotDefaults.test.ts` snapshot is stale for the
  Manhattan and MarkColor/MarkShape slots; CLAUDE.md says fix it forward once
  CI reports it. Local main is ~170 commits ahead of origin and nothing from
  this round has been pushed.
- `valueScaleSchema`'s `autoscale`-less form has no caller since Manhattan
  took the mark display's scale; `AutoscaleModel` answering undefined is dead
  optionality.
- The LD plot is ~20 lines of config where `color: { field: 'ld' }` was one.
  Named, reusable plots would fix it, the "no plugin needed" thread Colin
  raised: config-level plot presets, and plugins contributing grammar pieces
  (an `ld` step, a click-set parameter) instead of display types. The
  convergence handoff declines a generic `lookup` join and declared
  selections; LD is the second use case that reasoning waited for.
- `~/.local/bin/jb-shoot` got two local fixes: its compose check read part
  names with a slash only and died silently under `set -e` on dog10k's
  hyphenated ones, and after a `--publish` ada's `figures.lock` blocked the
  next checkout.

## Fable review of the round

Read-only review by a Fable subagent on 2026-09-26, over the landed commits
(`72b471887d`…`10d04ee131`) and the multi-texture diff. A point of
reference, not a ruling.

**Ranked findings**

1. **WebGL2 draws a pass whose second sampler has no texture, silently (in-flight diff, `packages/render-core/src/hal/webgl2Hal.ts` `bindTexture`, diff lines 208–223).** `bindTexture` binds only the textures that exist; a missing one leaves unit N holding whatever another pass last bound there. The codegen refusal the diff deletes (`codegen.ts:1148-1160`) guarded exactly this, and WebGPU keeps its gate (`bindTexture` returns undefined → `drawPass` returns, `webgpuHal.ts:767`), so the two backends now diverge. Scenario: pointMark gains `rowTable` at unit 1; a pass drawn through `drawPlannedPasses` (no lens, so no `MarkTextureBinder.bind`) or any caller uploading only `colorRamp` draws with unit 1 still holding spanMark's table from the previous display → points placed by another track's row order, nothing to attribute it to. Give WebGL2 `drawPass` the same all-textures gate, and make `MockHal` throw on an unknown sampler name — `gpuHalBase.ts` `uploadTexture` (`if (binding)`) no-ops on a typo today.

2. **`uploadTexture(…, sampler?)` defaults to `textures[0]`** (types.ts diff line 112). Hic, wiggle, LD and ringWarp call `uploadColorRampLut` nameless. `TEXTURES` order comes from `findCombinedSamplers(reflection)`; once bar/point declare two samplers, whichever reflection lists first receives the nameless upload. Make `sampler` required, or allow the default only when `textures.length === 1`.

3. **Manhattan LD join: no correctness bug found.** Verified chain: `adapterOptions` rides `rpcProps` (`model.ts:1117-1126`) → `rpcArgs` → `fetchNeeded` resolves per region (`model.ts:1930-1940`) and stores the resolved `asked`, which `selectFeature` (`model.ts:1591`) hands `CoreGetEncodedFeature`, whose `layerFeatures.ts:49` passes `opts` to `getFeaturesArray`, so the widget shows `ld`. `topSnp` reads `x` = feature start (`markEncoding.ts:292`), so `refName:x+1` is a 1-based SNP. Shape-table entries are observed values (`markEncoding.ts:584`), so `indexSnpMissing` is real. `setLdColoring(false)` reaches `setSubschema(…, undefined)` → `create(undefined)` → default colour (`configurationSchema.ts:380-385`). A numeric `domain` is coerced (`colorConfigSchema.ts:102`). Layers index by mark, hidden marks included (`model.ts:649`), so `layers[ldMarkIndex]` is right.

   Silent edges, `stateModelFactory.ts`:
   - `:113-131` — an LD mark with a `bin`+`aggregate` transform has `x` = bin start; the adopted index names a locus with no SNP, the join finds nothing, `roles` lacks `index`, the notice stays quiet and every point is grey. Same for an LD mark with no `y` (span coloured by `ld`): `topSnp` is undefined and nothing adopts. Gate `ldMarkIndex` to a mark with a `y` lane and no aggregate, or name the case in the notice.
   - `:196-203` — "Color by LD to index SNP" over a plot with only bar marks writes nothing; the checkbox stays off with no message, and `colorByLdToHit` then pins an index nothing joins.
   - Toggling LD on costs two fetch rounds (marks change → fetch without `opts` → adopt → refetch), one all-grey frame between. `ldAutoIndex.test.ts` pins 4 calls; acceptable, just noting.

4. **Key controls: fine.** `sectionKey` folds the settings into identity (`legend.ts:154-158`), so marks differing only in `missingLabel` split — intended. Nit: `NUMERIC_KEY_HINT` counts `scale.entries.length` before `breaks` narrows (`legend.ts:406`), so a 20-value numeric field listing 3 breaks still gets the hint.

5. **`markPlot`/`liftMarkPlot` with a default list: fine.** `marks: null` → `setSubschema` → default plot (pinned in `configurationSchema.test.ts`); an unchanged round trip is a `compareStructural` no-op. The Edit box says "Clears marks" and the picture does not change on Manhattan — say "Resets marks to the default plot" when the schema names one (`markPlot.ts:181-190`).

6. **`display.type === 'LinearMarkDisplay'`: none in src.** `jbApi.ts:1443` help still steers `launchTrack(…, { type: 'LinearMarkDisplay', marks })`; on a GWASTrack the agent should name `LinearManhattanDisplay`. Doc only.

**Direction**

*Manhattan = mark model + LD layer* is the right shape. LD-as-grammar needs two things the grammar does not have: a second data source joined per region with the assembly's aliases (main thread) — the handoff's `lookup` rejection, and its reasoning holds: renaming, byte gate and zoom range would run twice — and a click-set parameter whose *default derives from the fetched data* with a settled-load fixpoint (`topSnp`). Vega-Lite selections carry no data-derived default that refetches. The remaining Manhattan-specific code is ~340 lines; the hooks it needed (`adapterOptions`, `resolveAdapterOptions`, `dataNotices`) are generic. What could still shrink: `topSnp` is "argmax of a mark's `y` across loaded regions", a mark-model helper any display could read.

*Monolith:* `model.ts` is 2061 lines, 87 members, ~30 `.views` blocks. The repo rule keeps the chain in one file, so split into mixin factories the chain composes, along seams already visible: (1) rows/facet layout — `facet`, `rowsLayout`, `effectiveRowHeight`, `splitByPlotRows`, source listing, clustering, sort-at-column — do this one *first*, since Stage 2's table logic lands there; (2) plot surface — `markPlot`, `liftMarkPlot`, `plotProblems`, `configProblems`, `notices`; (3) legend — `legendSections`, `colorScales`, `keySettingOf`, hover labels; (4) fetch — `rpcProps`, `layerRequests`, `fetchNeeded`; (5) interaction — hit test, hover, context menus, `selectFeature`.

**Stage 2**

Multi-texture per pass with a per-sampler filter is the right call; the shared-texture alternative forces one filter and `rampColor`'s linear tap at `0.5/height` would bleed into row 1. The shape draw already loops `samplers` and binds `own?.[sampler] ?? fromParams?.[sampler]` (`marks/types.ts:452-460`), so the HAL work matches the seam. The uniform gate `rowTableKeys −1` (`spanMark.slang:8`) is what makes the `INERT_RAMP` fallback for `rowTable` safe — bar/point need that uniform and the Canvas2D twins the same branch.

Watch in the rewiring: instances carry a *key*, so `findMarkHit`, the hover ring, `textMarks.ts` label placement and SVG export all need key→slot through the table (as `LinearMultiRowFeatureDisplay/hitTesting.ts` takes `rowKeys`), or labels drift from bars after a reorder. `facet.ts drawnScales` derives the legend from remapped instances; with the shader hiding rows, apply the hidden set to the legend separately. A `rows.field` change must reset `RowKeys` (a new key space, like `groupKeySpace`). Density sidecar layers carry no row → key 0 → gate or map. With `rows` beside `facet`, the facet draws — hold `rowTableKeys` at −1 there so the two paths cannot compose.

## test speedups
  You were right that the import graph is the problem — but it's only ~⅓ of the cost.

  ┌──────────────────────┬─────────┬───────┐
  │       Variant        │ Modules │ Time  │
  ├──────────────────────┼─────────┼───────┤
  │ Pure noop test       │       1 │ 0.73s │
  ├──────────────────────┼─────────┼───────┤
  │ 5 plugins            │     381 │ 2.58s │
  ├──────────────────────┼─────────┼───────┤
  │ Current (30 plugins) │   1,512 │ 3.33s │
  ├──────────────────────┼─────────┼───────┤
  │ Real test (10 tests) │  1,512+ │ 11.3s │
  └──────────────────────┴─────────┴───────┘

  The math for a 2× warm-cache win:
  - Trim corePlugins to per-test minimum: saves ~0.7s/file → ~10% on heavy tests, ~25% on light tests
  - Share JBrowse mount across tests in same file: saves ~3–5s per heavy file
  - Combined: realistic path to ~1.6–1.8×. Honest 2× requires both.

  SWC / esbuild / Vitest: 0% local warm-cache help. Confirmed by profile (babel is 1.8% CPU on real
  tests).

  What I'd actually do, in order:
  1. Make getPluginManager() in util.tsx accept a plugin list (default = corePlugins). Migrate the
  lightest tests to pass [LinearGenomeView, Config, Menus, Sequence, DataManagement]. Quick win, low
  risk.
  2. Audit one heavy plugin barrel (e.g. linear-comparative-view/src/index.ts reaches 504 files) to
  see if non-lazy imports can become lazy() — would benefit all tests.
  3. Only then consider sharing mounts across tests — bigger refactor, harder to keep correct.

  If you want, I can do step 1 as a real PR (refactor util.tsx + convert ~5 light tests) and measure
  the suite delta.


## Autogen docs


 Two notes worth flagging:
  1. plugins/variants/src/shared/SharedVariantConfigSchema.ts has a #slot JSDoc on a
  ...sharedVariantConfigSlots spread; the new extractor honours it and emits a blank-named slot. The
  old code silently dropped it. Either remove that #slot JSDoc or push the per-slot JSDocs down to
  where the fields are actually declared.
  2. The README's instructions for the dummy-function workaround were rewritten to describe the actual
   JSDoc-adjacency rule.

## Canvas



  High value

  1. Extract pure helpers out of baseModel.ts (1107 lines)

  CLAUDE.md says keep the MST chain in one file, but the pure helpers at the top and the
  closure-trapped fetch logic don't belong to that chain:

  - findSubfeatureById, fetchCanvasFeatureDetails, screenDensity, indexById → baseModel/helpers.ts
  (~70 lines off).
  - The biggest win: the fetchFeaturesForRegion / applyFetchResults closure at baseModel.ts:798-922.
  It's currently buried inside .actions(self => { ... }) purely so the inner functions can close over
  self. Hoist them to top-level functions taking self as a parameter — same closure semantics, vastly
  more grep-able, and testable without instantiating the model. The FetchResult / TooLargeResult
  interfaces should hoist too.

  2. LinearBasicDisplayModel structural type in FeatureComponent.tsx:40-97 drifts silently

  That 60-field hand-rolled interface is the file's biggest maintenance hazard. The comment explains
  why it exists (circular lazy-import) but doesn't catch drift. Add a static-assertion file next to
  model.ts:

  // model.contract.ts
  type _Check = Instance<typeof stateModelFactory> extends LinearBasicDisplayModel
    ? true : never

  Now renaming featureItemMap on the model is a compile error at the contract site, not a silent
  type-check pass.

  3. useFloatingLabels rebuilds a per-region featureId index inside useMemo

  useOverlayElements.tsx:67-70 allocates a Map<string, FlatbushItem> per region per memo run. The
  model already has featureIdIndex (baseModel.ts:426) and featureItemMap (baseModel.ts:461) globally.
  Pass featureItemMap in and look up item via it — drops O(features × regions) work per zoom/pan.

  4. Share label-positioning between SVG export and DOM overlay

  renderLabels in renderSvg.tsx:38-110 and the body of useFloatingLabels
  (useOverlayElements.tsx:51-198) both walk floatingLabelsData, apply the exact same "collapse when
  name hidden" rule for description's relativeY, and call computeLabelPosition with identical args.
  Two implementations of the same business rule = inevitable drift (this is the same anti-pattern that
   motivated feedback_correctness_over_compat.md).

  Extract iterateRenderedLabels(data, vr, visibility, emit) where emit receives { label, x, y,
  isOverlay, clickable }. Both call sites then differ only in their emit (push React div vs
  ctx.fillText). ~100 lines deduplicated.

  Medium value

  5. setShowOutline magic literal

  baseModel.ts:691: self.setOverride('outline', value ? 'rgba(0,0,0,0.3)' : ''). The schema describes
  outline as a color string with '' meaning none — but the only enable-path uses one hardcoded rgba.
  Either name the constant (DEFAULT_OUTLINE_RGBA) or switch to a boolean outline flag plus a separate
  outlineColor (probably the latter since outlineColor already crosses the RPC boundary as packed
  RGBA).

  6. Static label styles → makeStyles

  Per your feedback_use_makestyles memory: the inline style objects in useFloatingLabels (lines
  149-161) and useAminoAcidOverlay (lines 241-256) bake in mostly-static fields (position, fontSize,
  whiteSpace, lineHeight, WebkitFontSmoothing). Move those to classes; keep only
  transform/top/left/color inline.

  7. Collapse the three chained .views(self => ({...})) blocks around regionTooLarge

  baseModel.ts:338-382 is split into three blocks (bytesEstimateTooLarge+densityTooLarge, then
  regionTooLarge+regionTooLargeReason, then laidOutDataMap, then maxY/index views). They're chained
  purely because each tier references the prior tier's getter via self.X. That's correct — but check
  whether regionTooLarge/regionTooLargeReason actually need to be in a separate tier from
  bytesEstimateTooLarge/densityTooLarge (they can both go in one block since they all reference each
  other via this.X within a single views). Saves one level of indirection.

  8. executeRenderFeatureData.ts transferables list is hand-maintained

  executeRenderFeatureData.ts:169-185 lists 15 buffers by name. The fields are exactly the ones on
  FeatureDataResult that are TypedArray. A typo or a new field added without updating this list =
  silent perf regression (transferable would be cloned instead). Either:
  - derive at runtime: Object.values(result).filter(v => ArrayBuffer.isView(v)).map(v => v.buffer)
  - or define the transferable field list as a const tuple and Pick-type the result against it so the
  compiler enforces consistency.

  Anti-recommendations (things to leave alone)

  - Don't merge interleaveRects/interleaveLines/interleaveArrows in interleaveBuffers.ts into a
  parametric function. The field-by-field correspondence with shader generated offsets is the point.
  Per your feedback_complexity_not_loc.md memory, parametric-shader-style consolidation is a
  complexity trap.
  - Don't merge the three if numXxx > 0 blocks in GpuCanvasFeatureRenderer.uploadRegion. Same reason.
  - Don't split packRenderArrays into a parametric primitive packer. Same reason — the explicit
  per-primitive column list documents the GPU contract.
  - Don't extract getFeatureName/getFeatureDescription further — they're already in labelUtils.ts.

  Quick wins (one-line / mechanical)

  - baseModel.ts:284: assemblyNames[0]! with non-null assertion. Same value also read at model.ts:238.
   If getContainingTrack(self) guarantees at least one name, document it; otherwise both sites need
  guards.
  - collectRenderData.ts:152 rangeLine — fine but its callers each prepend their own context-specific
  fields. The helper itself is a ?: over one of two formats; consider inlining at the two call sites
  (per feedback_no_one_line_helpers).
  - peptideUtils.ts:60: DEFAULT_TRANSCRIPT_TYPES is module-level constant, but the canvas already has
  a transcriptTypes config field. Inconsistency between the two lists
  (mRNA/transcript/primary_transcript vs
  mRNA/transcript/primary_transcript/protein_coding_primary_transcript) is a likely source of "why
  doesn't this transcript get peptides" bugs. Reconcile or document why peptide fetch uses a wider
  set.

  Want me to do any of these? Most natural starting point would be #1 (extract pure helpers + lift
  fetch closure) — it's mechanical, doesn't change behavior, and unlocks easier review of everything
  else.

✻ Churned for 4m 1s

❯ these are great findings. you can do whatever you think is best

● Picking the highest-value items that are mechanical and behavior-preserving. I'll do them in order,
  then run tests.

  Plan:
  1. Extract pure helpers out of baseModel.ts
  2. Add a contract assertion catching drift in LinearBasicDisplayModel
  3. Replace magic outline color literal
  4. Drop the per-region flatbushItemById rebuild in useFloatingLabels
  5. Share label-positioning between SVG export and DOM overlay
  6. Derive transferables list at runtime
  7. Move static label styles into makeStyles

  Let me look at what's exported from baseModel.ts to avoid breaking imports.

  Searched for 2 patterns (ctrl+o to expand)

● Now let me make the changes. First, create the helpers file.

● Write(plugins/canvas/src/LinearBasicDisplay/baseModelHelpers.ts)
  ⎿  Wrote 76 lines to plugins/canvas/src/LinearBasicDisplay/baseModelHelpers.ts
       1 import { SimpleFeature } from '@jbrowse/core/util'
       2
       3 import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
       4 import type RpcManager from '@jbrowse/core/rpc/RpcManager'
       5 import type { Feature, Region } from '@jbrowse/core/util'
       6
       7 export function findSubfeatureById(
       8   feature: Feature,
       9   targetId: string,
      10 ): Feature | undefined {
     … +66 lines (ctrl+o to expand)

● Now strip those helpers out of baseModel.ts and import from the new file. Also add the outline color
   constant.

● Update(plugins/canvas/src/LinearBasicDisplay/baseModel.ts)
  ⎿  Added 6 lines, removed 1 line
       8  } from '@jbrowse/core/configuration'
       9  import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
      10  import {
      11 -  SimpleFeature,
      11    getContainingTrack,
      12    getContainingView,
      13    getSession,
     ...
      31  import { autorun, observable } from 'mobx'
      32
      33  import {
      34 +  fetchCanvasFeatureDetails,
      35 +  findSubfeatureById,
      36 +  indexById,
      37 +  screenDensity,
      38 +} from './baseModelHelpers.ts'
      39 +import {
      40    buildFeatureFlatbushIndex,
      41    buildSubfeatureFlatbushIndex,
      42  } from './components/hitTesting.ts'

● Update(plugins/canvas/src/LinearBasicDisplay/baseModel.ts)
  ⎿  Added 3 lines, removed 71 lines
      59    SubfeatureInfo,
      60  } from '../RenderFeatureDataRPC/rpcTypes.ts'
      61  import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
      62 -import type RpcManager from '@jbrowse/core/rpc/RpcManager'
      62  import type { Feature, Region } from '@jbrowse/core/util'
      63  import type { StopToken } from '@jbrowse/core/util/stopToken'
      64  import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
     ...
       77    return getContainingView(self) as LGV
       78  }
       79
       81 -function findSubfeatureById(
       82 -  feature: Feature,
       83 -  targetId: string,
       84 -): Feature | undefined {
       85 -  const subfeatures = feature.get('subfeatures')
       86 -  if (subfeatures) {
       87 -    for (const sub of subfeatures) {
       88 -      if (sub.id() === targetId) {
       89 -        return sub
       90 -      }
       91 -      const found = findSubfeatureById(sub, targetId)
       92 -      if (found) {
       93 -        return found
       94 -      }
       95 -    }
       96 -  }
       97 -  return undefined
       98 -}
       99 -
       80  export type { Region } from '@jbrowse/core/util'
       81
      102 -async function fetchCanvasFeatureDetails(
      103 -  session: {
      104 -    rpcManager: RpcManager
      105 -    notifyError: (msg: string, err?: unknown) => void
      106 -  },
      107 -  sessionId: string,
      108 -  adapterConfig: Record<string, unknown>,
      109 -  featureId: string,
      110 -  region: Region,
      111 -) {
      112 -  try {
      113 -    const result = await session.rpcManager.call(
      114 -      sessionId,
      115 -      'GetCanvasFeatureDetails',
      116 -      { sessionId, adapterConfig, featureId, region },
      117 -    )
      118 -    return result.feature ? new SimpleFeature(result.feature) : undefined
      119 -  } catch (e) {
      120 -    console.error('Failed to fetch feature details:', e)
      121 -    session.notifyError(`${e}`, e)
      122 -    return undefined
      123 -  }
      124 -}
      125 -
       82  const FeatureComponent = lazy(() => import('./components/FeatureComponent.tsx'))
       83
       84  const DESCRIPTION_DENSITY_THRESHOLD = 0.2
       85
      130 -// Features-per-pixel for a single region given its raw count, the region's
      131 -// genomic span, and the current bpPerPx. Used by the derived regionTooLarge
      132 -// banner and by force-load to sample observed density.
      133 -function screenDensity(
      134 -  ds: { featureCount: number; regionWidthBp: number },
      135 -  bpPerPx: number,
      136 -) {
      137 -  return (ds.featureCount / ds.regionWidthBp) * bpPerPx
      138 -}
       86 +// rgba string used when outline is toggled on via the menu; schema stores the
       87 +// raw color so users can still set their own via setOverride('outline', '#...').
       88 +const OUTLINE_DEFAULT_RGBA = 'rgba(0,0,0,0.3)'
       89
      140 -// First-wins index from per-region arrays. Spanning features can appear in
      141 -// multiple regions; we keep the first occurrence so consumers (hover lookup,
      142 -// selection, label resolution) get a single, stable item per featureId.
      143 -function indexById<T extends { featureId: string }>(
      144 -  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>,
      145 -  pick: (data: FeatureDataResult) => readonly T[],
      146 -) {
      147 -  const map = new Map<string, T>()
      148 -  for (const data of laidOutDataMap.values()) {
      149 -    for (const item of pick(data)) {
      150 -      if (!map.has(item.featureId)) {
      151 -        map.set(item.featureId, item)
      152 -      }
      153 -    }
      154 -  }
      155 -  return map
      156 -}
      157 -
       90  // Shared GPU-accelerated feature display base for canvas-rendered tracks.
       91  // Handles fetching, layout, the "Show labels" / "Show descriptions" UI, and
       92  // the fetch-invalidation autorun. Subclasses layer schema-specific properties

● Update(plugins/canvas/src/LinearBasicDisplay/baseModel.ts)
  ⎿  Added 1 line, removed 1 line
      625          },
      626
      627          setShowOutline(value: boolean) {
      628 -          self.setOverride('outline', value ? 'rgba(0,0,0,0.3)' : '')
      628 +          self.setOverride('outline', value ? OUTLINE_DEFAULT_RGBA : '')
      629          },
      630
      631          showContextMenuForFeature(

● Now mark the first task in_progress (already started), verify everything compiles before moving on.

● Let me verify task 1 by checking that baseModel.ts is still syntactically valid.

● Bash(npx tsgo --noEmit -p plugins/canvas 2>&1 | head -50)
  ⎿  error TS5081: Cannot find a tsconfig.json file at the current directory: /home/cdiesh/src/jb
     rowse-components/plugins/canvas/tsconfig.json.

  Listed 1 directory (ctrl+o to expand)

● Bash(npx tsgo --noEmit -p plugins/canvas/tsconfig.build.esm.json 2>&1 | head -60)
  ⎿  (No output)

● Clean — task 1 done. Mark complete and move to task 2.

● For the contract assertion, I'll export the interface from FeatureComponent.tsx and create a
  contract file that proves the model satisfies it. The contract file won't be imported at runtime,
  avoiding the lazy-cycle.

● Update(plugins/canvas/src/LinearBasicDisplay/components/FeatureComponent.tsx)
  ⎿  Added 4 lines, removed 3 lines
      35  // Hand-rolled structural type, NOT `Instance<typeof stateModelFactory>`. The
      36  // MST factory references this component via `lazy()`, so importing the real
      37  // model type back into the component creates a circular type reference that
      38 -// breaks inference across the whole file. Keep this in sync when adding
      39 -// model fields the component reads.
      40 -interface LinearBasicDisplayModel {
      38 +// breaks inference across the whole file. The compile-time check in
      39 +// LinearBasicDisplay/modelContract.ts catches drift: when the real MST model
      40 +// renames or drops a field, the contract file fails to typecheck.
      41 +export interface LinearBasicDisplayModel {
      42    height: number
      43    laidOutDataMap: Map<number, FeatureDataResult>
      44    visibleRegions: VisibleRegion[]

● Write(plugins/canvas/src/LinearBasicDisplay/modelContract.ts)
  ⎿  Wrote 19 lines to plugins/canvas/src/LinearBasicDisplay/modelContract.ts
       1 // Compile-time check that the hand-rolled LinearBasicDisplayModel structural
       2 // type in components/FeatureComponent.tsx stays in sync with the real MST
       3 // model. Renaming or removing a field on the model is a type error here
       4 // instead of a silent runtime failure inside the lazy-loaded component.
       5 //
       6 // Imports are type-only so the file is erased at runtime — that's what keeps
       7 // the lazy()-induced cycle between model.ts and FeatureComponent.tsx from
       8 // breaking inference (see FeatureComponent.tsx for context).
       9
      10 import type { LinearBasicDisplayModel } from './components/FeatureComponent.tsx'
     … +9 lines (ctrl+o to expand)

● Bash(npx tsgo --noEmit -p plugins/canvas/tsconfig.build.esm.json 2>&1 | head -80)
  ⎿  plugins/canvas/src/LinearBasicDisplay/modelContract.ts(18,3): error TS2741: Property 'visibl
     eRegions' is missing in type '{ id: string; type: "LinearBasicDisplay"; rpcDriverName: strin
     g | undefined; userByteSizeLimit: number | undefined; heightPreConfig: number | undefined; c
     … +3 lines (ctrl+o to expand)

● The contract check immediately found drift — visibleRegions is on the hand-rolled interface but the
  component reads it from view, not model. Let me audit the interface.

  Searched for 3 patterns (ctrl+o to expand)

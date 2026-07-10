import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView } from '@jbrowse/core/util'
import { getParent, types } from '@jbrowse/mobx-state-tree'
import { NO_CIGAR_OPS, coerceColorBy } from '@jbrowse/synteny-core'

import { syntenyDisplayKey } from './syntenyDisplayKey.ts'
import { computePresentCigarKinds } from '../LinearSyntenyRPC/presentCigarKinds.ts'
import { computeSyntenyColors } from '../LinearSyntenyRPC/syntenyColors.ts'
import { syntenyFetchRegions } from '../LinearSyntenyRPC/syntenyFetchWindow.ts'
import { getCigarOpAtInstance, getTooltip } from './components/util.ts'

import type { ClickCoord } from './components/util.ts'
import type { SyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { CigarOpMask, SyntenyColorBy } from '@jbrowse/synteny-core'

export interface SyntenyFeatureData {
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  identities: Float32Array
  // PAF mapping-quality (column 12), -1 where missing. Float32 because the
  // sentinel is -1 and we want to avoid an extra "valid" bitmap.
  mappingQuals: Float32Array
  // Adapter-computed length-weighted mean sequence identity per query/target
  // pair, a true [0,1] fraction. -1 where missing. See
  // PAFAdapter/util.ts:getWeightedMeans.
  meanIdentities: Float32Array
  featureIds: string[]
  names: string[]
  refNames: string[]
  assemblyNames: string[]
  // Mate fields packed as parallel arrays. Uint32 buffers are RPC-transferable
  // and match the bp coord convention used elsewhere in the codebase.
  // mate.name was always undefined (no adapter sets it) so it's dropped.
  mateStarts: Uint32Array
  mateEnds: Uint32Array
  mateRefNames: string[]
  mateAssemblyNames: string[]
  // True when at least one feature in this RPC response carried a CIGAR
  // string. Used to gate CIGAR-related menu items so they don't appear when
  // the resolved tier (coarse PIF, or a CIGAR-less PAF) has no per-row ops.
  hasCigar: boolean
}

export interface FeatPos {
  id: string
  strand: number
  name: string
  refName: string
  start: number
  end: number
  assemblyName: string
  mate: {
    start: number
    end: number
    refName: string
    assemblyName: string
  }
  identity?: number
}

// The worker sizes its viewport cull in px at fetch time, so zooming out by
// ~2x can leave features missing beyond the previous cull window. Bucketing
// bpPerPx on log2 lets the fetch autorun refire once per half-decade of zoom
// instead of on every settled zoom.
function bucketBpPerPx(bpPerPx: number) {
  return Math.floor(Math.log2(Math.max(bpPerPx, 1)))
}

function getFeatureAtIndex(data: SyntenyFeatureData, i: number): FeatPos {
  const identity = data.identities[i]!
  return {
    id: data.featureIds[i]!,
    strand: data.strands[i]!,
    name: data.names[i]!,
    refName: data.refNames[i]!,
    start: data.starts[i]!,
    end: data.ends[i]!,
    assemblyName: data.assemblyNames[i]!,
    mate: {
      start: data.mateStarts[i]!,
      end: data.mateEnds[i]!,
      refName: data.mateRefNames[i]!,
      assemblyName: data.mateAssemblyNames[i]!,
    },
    identity: identity === -1 ? undefined : identity,
  }
}

/**
 * #stateModel LinearSyntenyDisplay
 *
 * Pure-data model. The containing LinearSyntenyView owns the shared GPU
 * backend, the upload autorun (which watches every display's `instanceData`
 * and keys it by `displayKey`), and the render autorun. This display only
 * carries per-track state and the `renderParams` the view reads out.
 *
 * #example
 * A complete `SyntenyTrack` config to paste into `tracks`. The adapter needs
 * the query (first) and target (second) assembly names, matched by the track's
 * `assemblyNames`:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'hg38_vs_mm10',
 *   name: 'hg38 vs mm10',
 *   assemblyNames: ['hg38', 'mm10'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/hg38_vs_mm10.paf',
 *     queryAssembly: 'hg38',
 *     targetAssembly: 'mm10',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearSyntenyDisplay',
 *       displayId: 'hg38_vs_mm10-LinearSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearSyntenyDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      featureData: undefined as SyntenyFeatureData | undefined,
      /**
       * #volatile
       * Raw GPU-instance geometry produced by the RPC. The view observes
       * this on every display and uploads it to the shared backend keyed by
       * `displayKey`. Clearing it (undefined) triggers backend eviction.
       */
      instanceData: undefined as SyntenyGeometry | undefined,
      hoveredFeatureIdx: -1,
      clickedFeatureIdx: -1,
      contextMenuAnchor: undefined as ClickCoord | undefined,
      // True while an RPC fetch is in-flight. Distinguishes a first load (no
      // data yet) from a refetch (stale data still on screen) so the two get
      // different overlays — see `loading`/`refetching`.
      fetching: false,
      // Fetch-input signature the current featureData/instanceData was fetched
      // for (see `currentFetchKey`). Compared against the live inputs in
      // `dataCurrent` to detect data gone stale after a region/zoom change,
      // including during the pre-refetch debounce gap where `fetching` is still
      // false.
      loadedFetchKey: undefined as string | undefined,
      // Set once at view load by a refName-comparison check, independent of the
      // per-render fetch. See afterAttach.
      assembliesSwapped: false,
    }))
    .actions(self => ({
      /**
       * #action
       * Set both feature and instance data in one MST action so downstream
       * autoruns (upload, render) fire once per RPC completion, not twice.
       */
      setRpcData(
        featureData: SyntenyFeatureData | undefined,
        instanceData: SyntenyGeometry | undefined,
        fetchKey?: string,
      ) {
        self.featureData = featureData
        self.instanceData = instanceData
        self.loadedFetchKey = fetchKey
      },
      setFetching(arg: boolean) {
        self.fetching = arg
      },
      setAssembliesSwapped(arg: boolean) {
        self.assembliesSwapped = arg
      },
      setHoveredFeatureIdx(idx: number) {
        self.hoveredFeatureIdx = idx
      },
      setClickedFeatureIdx(idx: number) {
        self.clickedFeatureIdx = idx
      },
      openContextMenu(anchor: ClickCoord) {
        self.contextMenuAnchor = anchor
      },
      closeContextMenu() {
        self.contextMenuAnchor = undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get parentHelper() {
        return getParent<{
          height: number
          level: number
        }>(self, 4)
      },
      get level() {
        return this.parentHelper.level
      },
      /**
       * #getter
       * Stable backend key under the view-shared backend.
       */
      get displayKey() {
        return syntenyDisplayKey(self.id)
      },
      /**
       * #getter
       */
      get height() {
        return this.parentHelper.height
      },
      /**
       * #getter
       */
      get adapterConfig() {
        return {
          name: self.parentTrack.configuration.adapter.type,
          assemblyNames: getConf(self, 'assemblyNames'),
          ...getConf(self.parentTrack, 'adapter'),
        }
      },
      /**
       * #getter
       */
      get numFeats() {
        return self.featureData?.featureIds.length ?? 0
      },
      /**
       * #getter
       * Which CIGAR indel ops are actually painted in the current geometry.
       * The worker only emits an indel instance for an op wide enough to draw
       * (sub-pixel indels are dropped), so a set bit means a visible-width op
       * of that kind is on screen. The legend keys its indel chips off this
       * rather than the coarse "file has any CIGAR" flag, so whole-genome zoom
       * (every indel sub-pixel) shows no dead insertion/deletion swatch.
       */
      get presentCigarKinds(): CigarOpMask {
        const { instanceData } = self
        return instanceData
          ? computePresentCigarKinds(
              instanceData.kinds,
              instanceData.instanceCount,
            )
          : NO_CIGAR_OPS
      },
      /**
       * #getter
       * Warnings surfaced in the view header. Flags a likely reversed assembly
       * row order, detected once at view load (only when the two assemblies have
       * distinct chromosome names).
       */
      get warnings() {
        return self.assembliesSwapped
          ? [
              {
                message: 'The assemblies appear to be in the wrong order',
                effect:
                  'The chromosome names in the file match the opposite row. Try re-opening the synteny import form with the assemblies in the opposite order.',
              },
            ]
          : []
      },
      /**
       * #getter
       * A fetch has completed (data is present, even if it mapped zero
       * features). Not `numFeats > 0` — an empty-but-finished fetch is ready,
       * otherwise an empty result spins the loading overlay forever.
       */
      get ready() {
        return self.featureData !== undefined
      },
      /**
       * #getter
       * First load: a fetch is running and no data has arrived yet. Excludes
       * error so error UI and loading UI never show simultaneously. Drives the
       * full striped LoadingOverlay.
       */
      get loading() {
        return !this.ready && !self.error
      },
      /**
       * #getter
       * Refetch in-flight: a new fetch is running but stale ribbons are still
       * on screen (e.g. zoom-out across a log2 bucket, region change). Drives a
       * subtle corner indicator instead of the full overlay so the visible
       * ribbons aren't masked on every viewport change.
       */
      get refetching() {
        return self.fetching && this.ready && !self.error
      },
      /**
       * #getter
       * Fetch-input signature (region set/order, snapped fetch window, zoom
       * bucket, CIGAR/marker draw options, LOD tier) for the view's current
       * state — the same tracked deps the fetch autorun refetches on. Reactive:
       * flips the instant any of them changes. undefined until both connected
       * views are ready.
       */
      get currentFetchKey(): string | undefined {
        const connected = this.connectedViews
        if (!connected) {
          return undefined
        }
        const view = this.view
        const regionSig = [connected.v0, connected.v1]
          .map(v =>
            v.displayedRegions
              .map(
                r => `${r.refName}:${r.start}:${r.end}:${r.reversed ? 1 : 0}`,
              )
              .join(','),
          )
          .join('_')
        return [
          this.fetchRegionsKey,
          this.bpPerPxBucketKey,
          regionSig,
          view.drawCIGAR,
          view.drawCIGARMatchesOnly,
          view.drawLocationMarkers,
          view.lodMode,
        ].join('|')
      },
      /**
       * #getter
       * True when the rendered data was fetched for the view's current inputs.
       * Goes false the instant a region/zoom/draw-option change makes the held
       * ribbons stale — including during the pre-refetch debounce gap where
       * `fetching` is still false so `refetching` alone can't catch it. The
       * synteny analog of LGV's `viewportWithinLoadedData` and arc's
       * `loadedRegionSignature === currentRegionSignature`.
       */
      get dataCurrent(): boolean {
        return (
          self.loadedFetchKey !== undefined &&
          self.loadedFetchKey === this.currentFetchKey
        )
      },
      /**
       * #getter
       * Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady").
       * Synteny is not an LGV display — it composes only `BaseDisplay` with its
       * own fetch — so it has no `MultiRegionDisplayMixin`/`GlobalDataDisplayMixin`
       * `svgReady`; this is the equivalent. Stale-safe on both axes: `dataCurrent`
       * closes the pre-refetch debounce gap (stale window before `fetching`
       * flips) and `!refetching` covers the in-flight RPC, so an export fired
       * right after a zoom/pan waits for fresh ribbons instead of capturing stale
       * ones. No `regionTooLarge` state (synteny never gates on region size).
       */
      get svgReady() {
        return (
          (this.ready && !this.refetching && this.dataCurrent) || !!self.error
        )
      },
      /**
       * #getter
       */
      get view() {
        return getContainingView(self) as LinearSyntenyViewModel
      },
      getFeature(index: number) {
        const { featureData, instanceData } = self
        if (!featureData) {
          return undefined
        }
        const featureIdx = instanceData?.instanceFeatureIdx[index] ?? index
        if (featureIdx < 0 || featureIdx >= featureData.featureIds.length) {
          return undefined
        }
        return getFeatureAtIndex(featureData, featureIdx)
      },
      /**
       * #getter
       * Main-thread-computed per-instance colors. Recomputes whenever
       * colorBy, featureData, or instanceData descriptors change — this is
       * the gpuProps half of the rpcProps/gpuProps split. colorBy changes
       * flow through here without touching the RPC.
       */
      get computedColors() {
        const { instanceData, featureData } = self
        const { opacityByIdentity } = this.view
        if (!instanceData || !featureData) {
          return undefined
        }
        return computeSyntenyColors({
          instanceData,
          featureData,
          colorBy: this.effectiveColorBy,
          opacityByIdentity,
        })
      },
      /**
       * #getter
       * The view-level colorBy resolved for this specific level. 'reference' is
       * a stacked-view mode that colors every level by the shared anchor
       * assembly's chromosome names; each level maps it to 'query' or 'target'
       * depending on which of its two assemblies is the anchor, so the coloring
       * stays consistent across levels. Every other mode passes through.
       */
      get effectiveColorBy(): SyntenyColorBy {
        const colorBy = coerceColorBy(this.view.colorBy)
        if (colorBy === 'reference') {
          const { anchorAssemblyName: anchor, views } = this.view
          // this level draws between views[level] (query) and views[level+1]
          // (target); color by whichever side is the anchor so every level
          // keys on the same reference assembly's chromosome names
          const queryAsm = views[this.level]?.assemblyNames[0]
          const targetAsm = views[this.level + 1]?.assemblyNames[0]
          return targetAsm === anchor && queryAsm !== anchor
            ? 'target'
            : 'query'
        }
        return colorBy
      },
      /**
       * #getter
       * Instance data with main-thread-computed colors substituted in. The
       * view's upload autorun reads this, so any colorBy change re-fires
       * upload without an RPC round-trip.
       */
      get renderInstanceData() {
        const { instanceData } = self
        const colors = this.computedColors
        if (!instanceData || !colors) {
          return undefined
        }
        return { ...instanceData, colors }
      },
      get tooltipText() {
        const { hoveredFeatureIdx, instanceData } = self
        if (hoveredFeatureIdx < 0) {
          return ''
        }
        const feat = this.getFeature(hoveredFeatureIdx)
        if (!feat) {
          return ''
        }
        const cigarOp = instanceData
          ? getCigarOpAtInstance(instanceData, hoveredFeatureIdx)
          : undefined
        return getTooltip(feat, cigarOp)
      },
      /**
       * #getter
       * The two adjacent genome views this level draws between, or undefined
       * until both are initialized with regions. A level draws between an
       * adjacent pair, so both render and fetch depend only on those two views,
       * not the whole stack. Single source of truth for that gate.
       */
      get connectedViews() {
        const { views } = this.view
        const v0 = views[this.level]
        const v1 = views[this.level + 1]
        return this.view.initialized &&
          v0?.initialized &&
          v1?.initialized &&
          v0.displayedRegions.length > 0 &&
          v1.displayedRegions.length > 0
          ? { v0, v1 }
          : undefined
      },
      /**
       * #getter
       * Stable key over the log2 zoom bucket of both connected views. The
       * fetch autorun tracks this (a computed compares its string output)
       * instead of raw bpPerPx, so it only refetches when zoom crosses a
       * half-decade rather than on every settled zoom within a bucket.
       */
      get bpPerPxBucketKey() {
        const connected = this.connectedViews
        return connected
          ? `${bucketBpPerPx(connected.v0.bpPerPx)}_${bucketBpPerPx(connected.v1.bpPerPx)}`
          : undefined
      },
      /**
       * #getter
       * Stable key over the *snapped* fetch window of both connected views. The
       * fetch autorun tracks this so a scroll/zoom that moves the snapped window
       * refetches, while a sub-buffer pan (identical snapped window) does not —
       * a MobX computed only notifies when its string output changes. Mirrors
       * the window syntenyFetchRegions hands the worker.
       */
      get fetchRegionsKey() {
        const connected = this.connectedViews
        return connected
          ? [connected.v0, connected.v1]
              .map(v =>
                syntenyFetchRegions({
                  visibleRegions: v.visibleRegions,
                  displayedRegions: v.displayedRegions,
                  width: v.width,
                  bpPerPx: v.bpPerPx,
                })
                  .map(r => `${r.refName}:${r.start}-${r.end}`)
                  .join(','),
              )
              .join('_')
          : undefined
      },
      /**
       * #getter
       * Per-track render params consumed by the view's aggregator. The view
       * substitutes yTop before handing this to the backend.
       */
      get renderParams() {
        const connected = this.connectedViews
        if (self.isMinimized || !connected) {
          return undefined
        }
        const view = this.view
        const { v0, v1 } = connected
        const { hoveredFeatureIdx, clickedFeatureIdx, instanceData } = self
        // Instance index -> 1-based featureId (0 = "no hit"), the id the
        // shaders/canvas compare against to highlight every instance of a
        // feature. Matches the `instanceFeatureIdx[i] + 1` mapping in
        // interleaveInstances and the pick engine.
        const toFeatureId = (idx: number) =>
          idx >= 0 && instanceData
            ? instanceData.instanceFeatureIdx[idx]! + 1
            : 0
        return {
          yTop: 0,
          height: this.height,
          alpha: view.alpha,
          fadeThinAlignments: view.fadeThinAlignments,
          minAlignmentLength: view.minAlignmentLength,
          hoveredFeatureId: toFeatureId(hoveredFeatureIdx),
          clickedFeatureId: toFeatureId(clickedFeatureIdx),
          offsetPx0: v0.offsetPx,
          offsetPx1: v1.offsetPx,
          bpPerPx0: v0.bpPerPx,
          bpPerPx1: v1.bpPerPx,
          drawCurves: view.drawCurves,
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self as typeof self & { afterAttach(): void })
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
}

export type LinearSyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearSyntenyDisplayModel = Instance<LinearSyntenyDisplayStateModel>

export default stateModelFactory

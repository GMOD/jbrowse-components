import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView } from '@jbrowse/core/util'
import { getParent, types } from '@jbrowse/mobx-state-tree'
import { applyAlpha, colorSchemes, getQueryColor } from '@jbrowse/synteny-core'

import { syntenyDisplayKey } from './syntenyDisplayKey.ts'
import { computeSyntenyColors } from '../LinearSyntenyRPC/syntenyColors.ts'
import { getTooltip } from './components/util.ts'

import type { ClickCoord } from './components/util.ts'
import type { SyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ColorScheme, SyntenyColorBy } from '@jbrowse/synteny-core'

export interface SyntenyFeatureData {
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  identities: Float32Array
  // PAF mapping-quality (column 12), -1 where missing. Float32 because the
  // sentinel is -1 and we want to avoid an extra "valid" bitmap.
  mappingQuals: Float32Array
  // Adapter-computed weighted-mean per query/target pair, normalized to
  // [0,1]. -1 where missing. See PAFAdapter/util.ts:getWeightedMeans.
  meanScores: Float32Array
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

export function getFeatureAtIndex(
  data: SyntenyFeatureData,
  i: number,
): FeatPos {
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
 * extends
 * - [BaseDisplay](../basedisplay)
 *
 * Pure-data model. The containing LinearSyntenyView owns the shared GPU
 * backend, the upload autorun (which watches every display's `instanceData`
 * and keys it by `displayKey`), and the render autorun. This display only
 * carries per-track state and the `renderParams` the view reads out.
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
      statusMessage: undefined as string | undefined,
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
      ) {
        self.featureData = featureData
        self.instanceData = instanceData
      },
      setStatusMessage(msg?: string) {
        self.statusMessage = msg
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
      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
      /**
       * #getter
       */
      get numFeats() {
        return self.featureData?.featureIds.length ?? 0
      },
      /**
       * #getter
       */
      get ready() {
        return this.numFeats > 0
      },
      /**
       * #getter
       * Fetch in-flight. Excludes error so error UI and loading UI never
       * show simultaneously.
       */
      get loading() {
        return !this.ready && !self.error
      },
      /**
       * #getter
       */
      get colorSchemeConfig() {
        const key = (getContainingView(self) as LinearSyntenyViewModel).colorBy
        return key in colorSchemes
          ? colorSchemes[key as ColorScheme]
          : colorSchemes.default
      },
      /**
       * #getter
       */
      get effectiveAlpha() {
        return (getContainingView(self) as LinearSyntenyViewModel)
          .effectiveAlpha
      },
      /**
       * #getter
       */
      get colorMapWithAlpha() {
        const alpha = this.effectiveAlpha
        const activeColorMap = this.colorSchemeConfig.cigarColors
        return {
          I: applyAlpha(activeColorMap.I, alpha),
          N: applyAlpha(activeColorMap.N, alpha),
          D: applyAlpha(activeColorMap.D, alpha),
          X: applyAlpha(activeColorMap.X, alpha),
          M: applyAlpha(activeColorMap.M, alpha),
          '=': applyAlpha(activeColorMap['='], alpha),
        }
      },
      /**
       * #getter
       */
      get posColorWithAlpha() {
        return applyAlpha('red', this.effectiveAlpha)
      },
      /**
       * #getter
       */
      get negColorWithAlpha() {
        return applyAlpha('blue', this.effectiveAlpha)
      },
      /**
       * #getter
       */
      get queryColorWithAlphaMap() {
        const alpha = this.effectiveAlpha
        const cache = new Map<string, string>()
        return (queryName: string) => {
          if (!cache.has(queryName)) {
            const color = getQueryColor(queryName)
            cache.set(queryName, applyAlpha(color, alpha))
          }
          return cache.get(queryName)!
        }
      },
      getFeature(index: number) {
        if (!self.featureData) {
          return undefined
        }
        const featureIdx = self.instanceData?.instanceFeatureIdx[index] ?? index
        return getFeatureAtIndex(self.featureData, featureIdx)
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
        const view = getContainingView(self) as LinearSyntenyViewModel
        const { colorBy, opacityByIdentity } = view
        if (!instanceData || !featureData) {
          return undefined
        }
        return computeSyntenyColors({
          instanceData,
          featureData,
          colorBy: colorBy as SyntenyColorBy,
          opacityByIdentity,
        })
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
        const { hoveredFeatureIdx, featureData } = self
        if (hoveredFeatureIdx < 0 || !featureData) {
          return ''
        }
        const featureIdx =
          self.instanceData?.instanceFeatureIdx[hoveredFeatureIdx] ??
          hoveredFeatureIdx
        if (featureIdx >= featureData.featureIds.length) {
          return ''
        }
        return getTooltip(getFeatureAtIndex(featureData, featureIdx))
      },
      /**
       * #getter
       * Per-track render params consumed by the view's aggregator. The view
       * substitutes yTop before handing this to the backend.
       */
      get renderParams() {
        if (self.isMinimized) {
          return undefined
        }
        const view = getContainingView(self) as LinearSyntenyViewModel
        if (!view.initialized) {
          return undefined
        }
        if (
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
        ) {
          return undefined
        }
        const level = this.level
        if (level + 1 >= view.views.length) {
          return undefined
        }
        const v0 = view.views[level]!
        const v1 = view.views[level + 1]!
        const { hoveredFeatureIdx, clickedFeatureIdx } = self
        return {
          yTop: 0,
          height: this.height,
          alpha: this.effectiveAlpha,
          minAlignmentLength: view.minAlignmentLength,
          hoveredFeatureId:
            hoveredFeatureIdx >= 0 && self.instanceData
              ? self.instanceData.instanceFeatureIdx[hoveredFeatureIdx]! + 1
              : 0,
          clickedFeatureId:
            clickedFeatureIdx >= 0 && self.instanceData
              ? self.instanceData.instanceFeatureIdx[clickedFeatureIdx]! + 1
              : 0,
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

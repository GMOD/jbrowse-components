import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView } from '@jbrowse/core/util'
import { getParent, types } from '@jbrowse/mobx-state-tree'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { getTooltip } from './components/util.ts'
import { applyAlpha, colorSchemes, getQueryColor } from './drawSyntenyUtils.ts'
import { syntenyDisplayKey } from './syntenyDisplayKey.ts'

import type { ClickCoord } from './components/util.ts'
import type { ColorScheme } from './drawSyntenyUtils.ts'
import type { SyntenyTrackRenderParams } from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Duck-typed view to avoid circular imports. Display only reads LGV-ish
// fields off the containing view.
interface SyntenyViewDuck {
  initialized: boolean
  views: {
    initialized: boolean
    displayedRegions: unknown[]
    offsetPx: number
    bpPerPx: number
  }[]
}

export interface SyntenyFeatureData {
  p11_offsetPx: Float64Array
  p12_offsetPx: Float64Array
  p21_offsetPx: Float64Array
  p22_offsetPx: Float64Array
  strands: Int8Array
  starts: Float64Array
  ends: Float64Array
  identities: Float64Array
  padTop: Float64Array
  padBottom: Float64Array
  featureIds: string[]
  names: string[]
  refNames: string[]
  assemblyNames: string[]
  cigars: string[]
  mates: {
    start: number
    end: number
    refName: string
    name: string
    assemblyName: string
  }[]
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
    name: string
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
    mate: data.mates[i]!,
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
        /**
         * #property
         */
        colorBy: types.optional(types.string, 'default'),
        /**
         * #property
         */
        alpha: types.optional(types.number, 0.2),
        /**
         * #property
         */
        minAlignmentLength: types.optional(types.number, 0),
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
      instanceData: undefined as SyntenyInstanceData | undefined,
      hoveredFeatureIdx: -1,
      clickedFeatureIdx: -1,
      contextMenuAnchor: undefined as ClickCoord | undefined,
      statusMessage: undefined as string | undefined,
    }))
    .actions(self => ({
      setFeatureData(arg: SyntenyFeatureData | undefined) {
        self.featureData = arg
      },
      setInstanceData(data: SyntenyInstanceData | undefined) {
        self.instanceData = data
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
      setAlpha(value: number) {
        self.alpha = value
      },
      setMinAlignmentLength(value: number) {
        self.minAlignmentLength = value
      },
      setColorBy(value: string) {
        self.colorBy = value
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get parentHelper() {
        return getParent<{
          height: number
          effectiveHeight?: number
          level: number
          collapsed?: boolean
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
        const parent = this.parentHelper
        return parent.effectiveHeight ?? parent.height
      },
      get isLevelCollapsed() {
        return this.parentHelper.collapsed ?? false
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
      get parsedCigars() {
        return self.featureData?.cigars.map(s => (s ? parseCigar2(s) : []))
      },
      /**
       * #getter
       */
      get ready() {
        return this.numFeats > 0
      },
      /**
       * #getter
       */
      get colorSchemeConfig() {
        const key = self.colorBy
        return key in colorSchemes
          ? colorSchemes[key as ColorScheme]
          : colorSchemes.default
      },
      /**
       * #getter
       */
      get colorMapWithAlpha() {
        const { alpha } = self
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
        return applyAlpha('red', self.alpha)
      },
      /**
       * #getter
       */
      get negColorWithAlpha() {
        return applyAlpha('blue', self.alpha)
      },
      /**
       * #getter
       */
      get queryColorWithAlphaMap() {
        const { alpha } = self
        const cache = new Map<string, string>()
        return (queryName: string) => {
          if (!cache.has(queryName)) {
            const color = getQueryColor(queryName)
            cache.set(queryName, applyAlpha(color, alpha))
          }
          return cache.get(queryName)!
        }
      },
      /**
       * #getter
       */
      get queryTotalLengths() {
        const { featureData } = self
        if (self.minAlignmentLength <= 0 || !featureData) {
          return undefined
        }
        const lengths = new Map<string, number>()
        for (let i = 0; i < featureData.featureIds.length; i++) {
          const queryName = featureData.names[i] || featureData.featureIds[i]!
          const alignmentLength = Math.abs(
            featureData.ends[i]! - featureData.starts[i]!,
          )
          const currentTotal = lengths.get(queryName) || 0
          lengths.set(queryName, currentTotal + alignmentLength)
        }
        return lengths
      },
      getFeature(index: number) {
        if (!self.featureData) {
          return undefined
        }
        return getFeatureAtIndex(self.featureData, index)
      },
      get tooltipText() {
        const { hoveredFeatureIdx, featureData } = self
        if (
          hoveredFeatureIdx < 0 ||
          !featureData ||
          hoveredFeatureIdx >= featureData.featureIds.length
        ) {
          return ''
        }
        return getTooltip(getFeatureAtIndex(featureData, hoveredFeatureIdx))
      },
      /**
       * #getter
       * Per-track render params consumed by the view's aggregator. The view
       * substitutes yTop before handing this to the backend.
       */
      get renderParams(): SyntenyTrackRenderParams | undefined {
        if (self.isMinimized || this.isLevelCollapsed) {
          return undefined
        }
        const view = getContainingView(self) as unknown as SyntenyViewDuck
        if (
          !view.initialized ||
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
          alpha: self.alpha,
          minAlignmentLength: self.minAlignmentLength,
          hoveredFeatureId: hoveredFeatureIdx >= 0 ? hoveredFeatureIdx + 1 : 0,
          clickedFeatureId: clickedFeatureIdx >= 0 ? clickedFeatureIdx + 1 : 0,
          offset0: v0.offsetPx,
          offset1: v1.offsetPx,
          bpPerPx0: v0.bpPerPx,
          bpPerPx1: v1.bpPerPx,
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

import type React from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  ConfigOverrideMixin,
  GlobalDataDisplayMixin,
  StaleViewportRescaleMixin,
  TrackHeightMixin,
  computeRenderTransform,
  getDisplayStr,
  migrateOldSettingSnapshots,
} from '@jbrowse/plugin-linear-genome-view'

import { generateLDColorRamp } from './components/ldColorRamp.ts'
import { PRECOMPUTED_LD_ADAPTERS } from '../RenderLDDataRPC/types.ts'
import AddFiltersDialog from '../shared/components/AddFiltersDialog.tsx'
import LDFilterDialog from '../shared/components/LDFilterDialog.tsx'

import type { LDDisplayConfigModel } from './SharedLDConfigSchema.ts'
import type { LDDataResult, LDFlatbushItem } from '../RenderLDDataRPC/types.ts'
import type { FilterStats, LDMetric, LDSnp } from '../VariantRPC/getLDMatrix.ts'
import type { LDRenderingBackend } from './components/ldRenderingBackendTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

function upperBoundFloat32(arr: Float32Array, val: number) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid]! <= val) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * #stateModel SharedLDModel
 * #category display
 * Shared state model for LD displays
 */
export default function sharedModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'SharedLDModel',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalDataDisplayMixin(),
      StaleViewportRescaleMixin(),
      ConfigOverrideMixin<LDDisplayConfigModel>([
        'lineZoneHeight',
        'minorAlleleFrequencyFilter',
        'lengthCutoffFilter',
        'ldMetric',
        'showLegend',
        'showLDTriangle',
        'showRecombination',
        'recombinationZoneHeight',
        'fitToHeight',
        'hweFilterThreshold',
        'callRateFilter',
        'showVerticalGuides',
        'showLabels',
        'tickHeight',
        'useGenomicPositions',
        'signedLD',
        'jexlFilters',
      ]),
      types.model({
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }
      return migrateOldSettingSnapshots(snap)
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcData: null as LDDataResult | null,
    }))
    .actions(self => ({
      setRpcData(data: LDDataResult | null) {
        self.rpcData = data
      },
      setLineZoneHeight(n: number) {
        self.setOverride('lineZoneHeight', Math.max(0, n))
      },
      setMafFilter(arg: number) {
        self.setOverride('minorAlleleFrequencyFilter', arg)
      },
      setLengthCutoffFilter(arg: number) {
        self.setOverride('lengthCutoffFilter', arg)
      },
      setLDMetric(metric: LDMetric) {
        self.setOverride('ldMetric', metric)
      },
      setShowLegend(show: boolean) {
        self.setOverride('showLegend', show)
      },
      setShowLDTriangle(show: boolean) {
        self.setOverride('showLDTriangle', show)
      },
      setShowRecombination(show: boolean) {
        self.setOverride('showRecombination', show)
      },
      setRecombinationZoneHeight(n: number) {
        self.setOverride('recombinationZoneHeight', Math.max(20, n))
      },
      setFitToHeight(value: boolean) {
        self.setOverride('fitToHeight', value)
      },
      setHweFilter(threshold: number) {
        self.setOverride('hweFilterThreshold', threshold)
      },
      setCallRateFilter(threshold: number) {
        self.setOverride('callRateFilter', threshold)
      },
      setShowVerticalGuides(show: boolean) {
        self.setOverride('showVerticalGuides', show)
      },
      setShowLabels(show: boolean) {
        self.setOverride('showLabels', show)
      },
      setTickHeight(height: number) {
        self.setOverride('tickHeight', Math.max(0, height))
      },
      setUseGenomicPositions(value: boolean) {
        self.setOverride('useGenomicPositions', value)
      },
      setSignedLD(value: boolean) {
        self.setOverride('signedLD', value)
      },
      setJexlFilters(filters: string[] | undefined) {
        self.setOverride('jexlFilters', filters)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get prefersOffset() {
        return true
      },
      get minorAlleleFrequencyFilter() {
        return self.getConfWithOverride('minorAlleleFrequencyFilter')
      },
      get lengthCutoffFilter() {
        return self.getConfWithOverride('lengthCutoffFilter')
      },
      get lineZoneHeight() {
        return self.getConfWithOverride('lineZoneHeight')
      },
      get ldMetric() {
        return self.getConfWithOverride('ldMetric')
      },
      get showLegend() {
        return self.getConfWithOverride('showLegend')
      },
      get showLDTriangle() {
        return self.getConfWithOverride('showLDTriangle')
      },
      get showRecombination() {
        return self.getConfWithOverride('showRecombination')
      },
      get recombinationZoneHeight() {
        return self.getConfWithOverride('recombinationZoneHeight')
      },
      get fitToHeight() {
        return self.getConfWithOverride('fitToHeight')
      },
      get hweFilterThreshold() {
        return self.getConfWithOverride('hweFilterThreshold')
      },
      get callRateFilter() {
        return self.getConfWithOverride('callRateFilter')
      },
      get showVerticalGuides() {
        return self.getConfWithOverride('showVerticalGuides')
      },
      get showLabels() {
        return self.getConfWithOverride('showLabels')
      },
      get tickHeight() {
        return self.getConfWithOverride('tickHeight')
      },
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST getter named after config slot
      get useGenomicPositions() {
        return self.getConfWithOverride('useGenomicPositions')
      },
      get signedLD() {
        return self.getConfWithOverride('signedLD')
      },
      get jexlFilters(): string[] {
        return self.getConfWithOverride('jexlFilters')
      },
      /**
       * #getter
       * Returns true if this display uses pre-computed LD data (PLINK, ldmat)
       * rather than computing LD from VCF genotypes
       */
      get snps(): LDSnp[] {
        return self.rpcData?.snps ?? []
      },
      get cellWidth() {
        return self.rpcData?.uniformW ?? 0
      },
      get filterStats(): FilterStats | undefined {
        return self.rpcData?.filterStats
      },
      get recombination() {
        return self.rpcData?.recombination
      },
      get isPrecomputedLD() {
        return (PRECOMPUTED_LD_ADAPTERS as readonly string[]).includes(
          self.adapterConfig?.type,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Pixel height of the SVG zone above the canvas (variant labels +
       * lines, or recombination scale). The hit-test subtracts this from
       * mouseY before reversing the render transform.
       */
      get effectiveLineZoneHeight() {
        if (self.useGenomicPositions) {
          return self.showRecombination ? self.recombinationZoneHeight : 0
        }
        return self.lineZoneHeight
      },
      /**
       * #getter
       * Effective height for the LD canvas (total height minus the zone the
       * recombination overlay / variant lines occupy above the matrix).
       */
      get ldCanvasHeight() {
        return Math.max(50, self.height - this.effectiveLineZoneHeight)
      },
      /**
       * #getter
       * Per-frame yScalar squash factor. When fitToHeight is on, squashes
       * the natural (canvasWidth/2) triangle into ldCanvasHeight. Lives on
       * the main thread so resize doesn't trigger a worker re-fetch.
       */
      get yScalar() {
        if (!self.fitToHeight) {
          return 1
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        const canvasWidth = view.dynamicBlocks.totalWidthPxWithoutBorders
        const triangleHeight = canvasWidth / 2
        return triangleHeight > 0 ? this.ldCanvasHeight / triangleHeight : 1
      },

      // Literal RPC payload for RenderLDData. Adding a field here
      // automatically flows into both the RPC call (via the fetch autorun
      // in afterAttach.ts) and into mobx's dependency tracking — the
      // fetch autorun calls `self.rpcProps()` once, so any change to any
      // field refires it. No hand-enumerated fields at the top of the
      // autorun.
      rpcProps() {
        return {
          ldMetric: self.ldMetric,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          lengthCutoffFilter: self.lengthCutoffFilter,
          hweFilterThreshold: self.hweFilterThreshold,
          callRateFilter: self.callRateFilter,
          jexlFilters: self.jexlFilters,
          signedLD: self.signedLD,
          useGenomicPositions: self.useGenomicPositions,
        }
      },
      /**
       * #getter
       * Forward transform { scale, viewOffsetX } shared by GPU render,
       * mouse hit-test, and the matrix→genomic-position SVG lines. See
       * `computeRenderTransform` for the math.
       */
      get renderTransform() {
        const view = getContainingView(self) as LinearGenomeViewModel
        return computeRenderTransform({
          lastDrawnOffsetPx: self.lastDrawnOffsetPx,
          lastDrawnBpPerPx: self.lastDrawnBpPerPx,
          viewOffsetPx: view.offsetPx,
          viewBpPerPx: view.bpPerPx,
        })
      },
      /**
       * #getter
       * Per-frame render state for the GPU backend. Read by the upload/render
       * autorun — every change to any tracked observable (view.bpPerPx,
       * view.offsetPx, model.fitToHeight, rpcData contents, …) re-fires it.
       */
      get renderState() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const data = self.rpcData
        if (!data) {
          return undefined
        }
        const { scale, viewOffsetX } = this.renderTransform
        const canvasWidth = Math.round(
          view.dynamicBlocks.totalWidthPxWithoutBorders,
        )
        return {
          yScalar: this.yScalar,
          canvasWidth,
          canvasHeight: self.fitToHeight
            ? this.ldCanvasHeight
            : canvasWidth / 2,
          signedLD: data.signedLD,
          viewScale: scale,
          viewOffsetX,
          uniformW: data.uniformW,
        }
      },

      /**
       * #method
       * Inverse of `renderTransform` for the LD matrix: takes mouse coords
       * (canvas-relative) and returns the LD cell under the cursor, or
       * undefined. Mirrors plugins/hic's `hitTest` so both contact maps
       * keep the forward and inverse transforms paired on the model.
       */
      hitTest(mouseX: number, mouseY: number): LDFlatbushItem | undefined {
        const data = self.rpcData
        if (!data) {
          return undefined
        }
        if (mouseY < this.effectiveLineZoneHeight) {
          return undefined
        }
        const { scale, viewOffsetX } = this.renderTransform
        const dataX = (mouseX - viewOffsetX) / scale
        const dataY = (mouseY - this.effectiveLineZoneHeight) / scale
        // Reverse the rendering's `scale(1, yScalar) · rotate(-π/4)` then
        // pick the cell. yScalar squashes Y, so divide it out before
        // un-rotating.
        const scaledY = dataY / this.yScalar
        const x = (dataX - scaledY) / Math.SQRT2
        const y = (dataX + scaledY) / Math.SQRT2
        const { boundaries, ldValues } = data
        const n = boundaries.length - 1
        let hitI = -1
        let hitJ = -1
        if (self.useGenomicPositions) {
          hitJ = upperBoundFloat32(boundaries, x) - 1
          hitI = upperBoundFloat32(boundaries, y) - 1
        } else {
          const w = self.cellWidth
          if (w > 0) {
            hitJ = Math.floor(x / w)
            hitI = Math.floor(y / w)
          }
        }
        if (hitI > hitJ && hitI > 0 && hitJ >= 0 && hitI < n) {
          const ldIdx = (hitI * (hitI - 1)) / 2 + hitJ
          return {
            i: hitI,
            j: hitJ,
            ldValue: ldValues[ldIdx]!,
            snp1: self.snps[hitI]!,
            snp2: self.snps[hitJ]!,
          }
        }
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Starts the upload/render autorun. Data + color ramp both derive from
       * the same rpcData object, so a single identity-diffed slot handles
       * both uploads.
       */
      startRenderingBackend(backend: LDRenderingBackend) {
        self.attachRenderingBackend<LDRenderingBackend>(backend, {
          upload: b => {
            const d = self.rpcData
            if (!d) {
              return
            }
            b.uploadData({
              ldValues: d.ldValues,
              boundaries: d.boundaries,
              numCells: d.numCells,
              positions: d.positions,
              cellSizes: d.cellSizes,
            })
            b.uploadColorRamp(generateLDColorRamp(d.metric, d.signedLD))
          },
          render: b => {
            const state = self.renderState
            if (!state) {
              return false
            }
            const d = self.rpcData
            b.render(
              d
                ? {
                    ldValues: d.ldValues,
                    boundaries: d.boundaries,
                    numCells: d.numCells,
                    positions: d.positions,
                    cellSizes: d.cellSizes,
                  }
                : null,
              state,
            )
            return true
          },
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      filterMenuItems() {
        // Filter settings only available for VCF-computed LD, not pre-computed
        if (self.isPrecomputedLD) {
          return []
        }
        return [
          {
            label: 'LD-specific filters...',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                LDFilterDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          {
            label: 'General JEXL filters...',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                AddFiltersDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
        ]
      },
      /**
       * #method
       */
      legendItems(): LegendItem[] {
        const metric = self.ldMetric === 'dprime' ? "D'" : 'R²'
        const range = self.signedLD ? '-1 to 1' : '0 to 1'
        return [{ label: `${metric}: ${range}` }]
      },
      /**
       * #method
       */
      svgLegendWidth(): number {
        return self.showLegend ? 140 : 0
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'LD metric',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'R² (squared correlation)',
                  type: 'radio',
                  checked: self.ldMetric === 'r2',
                  onClick: () => {
                    self.setLDMetric('r2')
                  },
                },
                {
                  label: "D' (normalized D)",
                  type: 'radio',
                  checked: self.ldMetric === 'dprime',
                  onClick: () => {
                    self.setLDMetric('dprime')
                  },
                },
                // Signed LD modifies the chosen metric (R instead of R²,
                // signed D'), so it belongs with the metric choice rather than
                // the visibility toggles. VCF-computed LD only.
                ...(self.isPrecomputedLD
                  ? []
                  : [
                      {
                        label: 'Show signed LD values (-1 to 1)',
                        helpText:
                          "When enabled, shows R (correlation) instead of R², and preserves the sign of D'. Positive values indicate alleles tend to co-occur (coupling), negative values indicate alleles tend to be on different haplotypes (repulsion).",
                        type: 'checkbox',
                        checked: self.signedLD,
                        onClick: () => {
                          self.setSignedLD(!self.signedLD)
                        },
                      },
                    ]),
              ],
            },
            {
              label: 'Show...',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Show LD triangle',
                  type: 'checkbox',
                  checked: self.showLDTriangle,
                  onClick: () => {
                    self.setShowLDTriangle(!self.showLDTriangle)
                  },
                },
                {
                  label: 'Show recombination track',
                  helpText:
                    'Displays 1-r² between neighboring SNPs only (not all pairwise comparisons). Peaks indicate haplotype block boundaries where historical recombination has broken down LD between adjacent variants.',
                  type: 'checkbox',
                  checked: self.showRecombination,
                  onClick: () => {
                    self.setShowRecombination(!self.showRecombination)
                  },
                },
                {
                  label: 'Show legend',
                  type: 'checkbox',
                  checked: self.showLegend,
                  onClick: () => {
                    self.setShowLegend(!self.showLegend)
                  },
                },
                {
                  label: 'Show variant labels',
                  type: 'checkbox',
                  checked: self.showLabels,
                  onClick: () => {
                    self.setShowLabels(!self.showLabels)
                  },
                },
                {
                  label: 'Show vertical guides on hover',
                  type: 'checkbox',
                  checked: self.showVerticalGuides,
                  onClick: () => {
                    self.setShowVerticalGuides(!self.showVerticalGuides)
                  },
                },
                // Layout toggles live alongside the visibility toggles in
                // this submenu, matching the Hi-C triangular display's
                // "Show..." grouping (plugins/hic trackMenuItems.ts) so the
                // two contact-map displays stay consistent.
                {
                  label: 'Fit to display height',
                  helpText:
                    'Vertically squash the triangle to fill the display height instead of drawing it at its natural half-width height.',
                  type: 'checkbox',
                  checked: self.fitToHeight,
                  onClick: () => {
                    self.setFitToHeight(!self.fitToHeight)
                  },
                },
                {
                  label: 'Show cells with genome proportions',
                  helpText:
                    'By default each cell is equal width (one column per variant). Enable to size cells proportional to the genomic distance between variants.',
                  type: 'checkbox',
                  checked: self.useGenomicPositions,
                  onClick: () => {
                    self.setUseGenomicPositions(!self.useGenomicPositions)
                  },
                },
              ],
            },
            // Filter menu only available for VCF-computed LD, not pre-computed
            ...(self.isPrecomputedLD
              ? []
              : [
                  {
                    label: 'Filter by...',
                    type: 'subMenu',
                    subMenu: self.filterMenuItems(),
                  },
                ]),
          ]
        },

        /**
         * #method
         */
        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as SharedLDModel, opts)
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Re-fetches LD matrix for the current viewport. Both the autorun
       * (in `afterAttach`) and `reload()` invoke this directly.
       */
      async performLDFetch() {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        const regions = view.dynamicBlocks.contentBlocks
        if (!self.showLDTriangle || self.regionTooLarge || !regions.length) {
          return
        }
        const { bpPerPx, visibleBp } = view
        const { adapterConfig } = self
        await self.runFetch(async ctx => {
          const { rpcManager } = getSession(self)
          const sessionId = getRpcSessionId(self)
          const stats = await rpcManager.call(
            sessionId,
            'CoreGetFeatureDensityStats',
            { regions: [...regions], adapterConfig },
          )
          if (ctx.isStale()) {
            return
          }
          self.setFeatureDensityStats(stats)
          if (visibleBp >= AUTO_FORCE_LOAD_BP) {
            const fetchSizeLimit =
              stats.fetchSizeLimit ?? getConf(self, 'fetchSizeLimit')
            const limit = self.userByteSizeLimit ?? fetchSizeLimit
            if (stats.bytes && stats.bytes > limit) {
              self.setRegionTooLarge(
                true,
                `Requested too much data (${getDisplayStr(stats.bytes)})`,
              )
              return
            }
          }
          self.setRegionTooLarge(false)

          const result = await rpcManager.call(
            sessionId,
            'RenderLDData',
            {
              adapterConfig,
              regions: [...regions],
              bpPerPx,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
            },
            {
              statusCallback: self.makeStatusCallback(),
            },
          )
          if (ctx.isStale()) {
            return
          }
          self.setRpcData(result)
          self.setLastDrawnViewport(view.offsetPx, view.bpPerPx)
        })
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self)
          } catch (e) {
            console.error(e)
            getSession(self).notifyError(`${e}`, e)
          }
        })()
      },
    }))
}

export type SharedLDStateModel = ReturnType<typeof sharedModelFactory>
export type SharedLDModel = Instance<SharedLDStateModel>

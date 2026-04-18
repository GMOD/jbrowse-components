import type React from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  migrateOldSettingSnapshots,
} from '@jbrowse/plugin-linear-genome-view'

import { generateLDColorRamp } from './components/LDRenderer.ts'
import AddFiltersDialog from '../shared/components/AddFiltersDialog.tsx'
import LDFilterDialog from '../shared/components/LDFilterDialog.tsx'

import type { LDDataResult } from '../RenderLDDataRPC/types.ts'
import type { FilterStats, LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
import type { LDBackend } from './components/ldBackendTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel SharedLDModel
 * Shared state model for LD displays
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 */
export default function sharedModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'SharedLDModel',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      ConfigOverrideMixin(),
      types.model({
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }
      return migrateLDSettings(snap)
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcData: null as LDDataResult | null,
      /**
       * #volatile
       */
      statusMessage: undefined as string | undefined,
      /**
       * #volatile
       */
      lastDrawnOffsetPx: undefined as number | undefined,
      /**
       * #volatile
       */
      lastDrawnBpPerPx: undefined as number | undefined,
    }))
    .actions(self => ({
      setRpcData(data: LDDataResult | null) {
        self.rpcData = data
      },
      /**
       * #action
       */
      setStatusMessage(msg?: string) {
        self.statusMessage = msg
      },
      /**
       * #action
       */
      setLastDrawnOffsetPx(px: number) {
        self.lastDrawnOffsetPx = px
      },
      /**
       * #action
       */
      setLastDrawnBpPerPx(bpPerPx: number) {
        self.lastDrawnBpPerPx = bpPerPx
      },
      setLineZoneHeight(n: number) {
        self.setOverride('lineZoneHeight', Math.max(0, n))
      },
      reload() {
        self.error = undefined
      },
      setMafFilter(arg: number) {
        self.setOverride('minorAlleleFrequencyFilter', arg)
      },
      setLengthCutoffFilter(arg: number) {
        self.setOverride('lengthCutoffFilter', arg)
      },
      setLDMetric(metric: string) {
        self.setOverride('ldMetric', metric)
      },
      setColorScheme(scheme: string | undefined) {
        self.setOverride('colorScheme', scheme)
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
      get loading() {
        return self.isLoading
      },
      get blockType() {
        return 'dynamicBlocks'
      },
      /**
       * #getter
       */
      get prefersOffset() {
        return true
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'LDRenderer'
      },
      get drawn() {
        return !!self.rpcData
      },
      get fullyDrawn() {
        return !!self.rpcData
      },
      get minorAlleleFrequencyFilter() {
        return self.getConfWithOverride<number>('minorAlleleFrequencyFilter')
      },
      get lengthCutoffFilter() {
        return self.getConfWithOverride<number>('lengthCutoffFilter')
      },
      get lineZoneHeight() {
        return self.getConfWithOverride<number>('lineZoneHeight')
      },
      get ldMetric() {
        return self.getConfWithOverride<string>('ldMetric')
      },
      get colorScheme() {
        return self.getConfWithOverride<string>('colorScheme') || undefined
      },
      get showLegend() {
        return self.getConfWithOverride<boolean>('showLegend')
      },
      get showLDTriangle() {
        return self.getConfWithOverride<boolean>('showLDTriangle')
      },
      get showRecombination() {
        return self.getConfWithOverride<boolean>('showRecombination')
      },
      get recombinationZoneHeight() {
        return self.getConfWithOverride<number>('recombinationZoneHeight')
      },
      get fitToHeight() {
        return self.getConfWithOverride<boolean>('fitToHeight')
      },
      get hweFilterThreshold() {
        return self.getConfWithOverride<number>('hweFilterThreshold')
      },
      get callRateFilter() {
        return self.getConfWithOverride<number>('callRateFilter')
      },
      get showVerticalGuides() {
        return self.getConfWithOverride<boolean>('showVerticalGuides')
      },
      get showLabels() {
        return self.getConfWithOverride<boolean>('showLabels')
      },
      get tickHeight() {
        return self.getConfWithOverride<number>('tickHeight')
      },
      get useGenomicPositions() {
        return self.getConfWithOverride<boolean>('useGenomicPositions')
      },
      get signedLD() {
        return self.getConfWithOverride<boolean>('signedLD')
      },
      get jexlFilters() {
        return self.getConfWithOverride<string[]>('jexlFilters')
      },
      /**
       * #getter
       * Returns true if this display uses pre-computed LD data (PLINK, ldmat)
       * rather than computing LD from VCF genotypes
       */
      get snps(): LDMatrixResult['snps'] {
        return self.rpcData?.snps ?? []
      },
      get maxScore() {
        return self.rpcData?.maxScore ?? 1
      },
      get yScalar() {
        return self.rpcData?.yScalar ?? 1
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
        const adapterType = self.adapterConfig?.type as string | undefined
        return (
          adapterType === 'PlinkLDAdapter' ||
          adapterType === 'PlinkLDTabixAdapter' ||
          adapterType === 'LdmatAdapter'
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Effective height for the LD canvas (total height minus line zone)
       * Note: Recombination track is overlaid on the line zone, not in a separate zone
       */
      get ldCanvasHeight() {
        return Math.max(50, self.height - self.lineZoneHeight)
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
        const scale =
          self.lastDrawnBpPerPx !== undefined
            ? self.lastDrawnBpPerPx / view.bpPerPx
            : 1
        const offsetX =
          self.lastDrawnOffsetPx !== undefined
            ? self.lastDrawnOffsetPx * scale - view.offsetPx
            : 0
        const canvasWidth = Math.round(
          view.dynamicBlocks.totalWidthPxWithoutBorders,
        )
        return {
          yScalar: data.yScalar,
          canvasWidth,
          canvasHeight: self.fitToHeight
            ? this.ldCanvasHeight
            : canvasWidth / 2,
          signedLD: data.signedLD,
          viewScale: scale,
          viewOffsetX: offsetX,
          uniformW: data.uniformW,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Starts the upload/render autorun. Data + color ramp both derive from
       * the same rpcData object, so a single identity-diffed slot handles
       * both uploads.
       */
      startGpuBackendLifecycle(backend: LDBackend) {
        self.startSingleDataGpuLifecycle<
          LDBackend,
          NonNullable<typeof self.renderState>
        >({
          backend,
          uploadSlots: [
            {
              readData: () => self.rpcData,
              commitUpload: (b, data) => {
                const d = data as LDDataResult
                b.uploadData({
                  ldValues: d.ldValues,
                  boundaries: d.boundaries,
                  numCells: d.numCells,
                  positions: d.positions,
                  cellSizes: d.cellSizes,
                })
                b.uploadColorRamp(generateLDColorRamp(d.metric, d.signedLD))
              },
            },
          ],
          getRenderState: () => self.renderState,
          renderWithState: (b, state) => {
            b.render(state)
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
      renderProps() {
        return { notReady: true }
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
                  label: 'LD triangle adjusted to display height',
                  type: 'checkbox',
                  checked: self.fitToHeight,
                  onClick: () => {
                    self.setFitToHeight(!self.fitToHeight)
                  },
                },
                {
                  label: 'Vertical guides on hover',
                  type: 'checkbox',
                  checked: self.showVerticalGuides,
                  onClick: () => {
                    self.setShowVerticalGuides(!self.showVerticalGuides)
                  },
                },
                {
                  label: 'Variant labels',
                  type: 'checkbox',
                  checked: self.showLabels,
                  onClick: () => {
                    self.setShowLabels(!self.showLabels)
                  },
                },
                {
                  label: 'Use genomic positions for cell sizes',
                  type: 'checkbox',
                  checked: self.useGenomicPositions,
                  onClick: () => {
                    self.setUseGenomicPositions(!self.useGenomicPositions)
                  },
                },
                // Signed LD only available for VCF-computed LD, not pre-computed
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
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self as SharedLDModel)
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

function migrateLDSettings(snap: Record<string, unknown>) {
  return migrateOldSettingSnapshots(snap)
}

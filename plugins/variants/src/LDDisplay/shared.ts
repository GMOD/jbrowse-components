import type React from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  NonBlockCanvasDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import LDFilterDialog from '../shared/components/LDFilterDialog.tsx'

import type { LDFlatbushItem } from '../LDRenderer/types.ts'
import type { FilterStats, LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel SharedLDModel
 * Shared state model for LD displays
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [NonBlockCanvasDisplayMixin](../nonblockcanvasdisplaymixin)
 */
export default function sharedModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'SharedLDModel',
      BaseDisplay,
      TrackHeightMixin(),
      NonBlockCanvasDisplayMixin(),
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * When undefined, falls back to config value
         */
        minorAlleleFrequencyFilterSetting: types.maybe(types.number),
        /**
         * #property
         * When undefined, falls back to config value
         */
        lengthCutoffFilterSetting: types.maybe(types.number),
        /**
         * #property
         * When undefined, falls back to config value
         * Height of the zone for connecting lines at the top
         */
        lineZoneHeightSetting: types.maybe(types.number),
        /**
         * #property
         * When undefined, falls back to config value
         * LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D)
         */
        ldMetricSetting: types.maybe(types.string),
        /**
         * #property
         * When undefined, falls back to config value
         */
        colorSchemeSetting: types.maybe(types.string),
        /**
         * #property
         * When undefined, falls back to config value
         */
        showLegendSetting: types.maybe(types.boolean),
        /**
         * #property
         * When undefined, falls back to config value
         * Whether to show the LD triangle heatmap
         */
        showLDTriangleSetting: types.maybe(types.boolean),
        /**
         * #property
         * When undefined, falls back to config value
         * Whether to show the recombination rate track
         */
        showRecombinationSetting: types.maybe(types.boolean),
        /**
         * #property
         * When undefined, falls back to config value
         * Height of the recombination track zone at the top
         */
        recombinationZoneHeightSetting: types.maybe(types.number),
        /**
         * #property
         * When undefined, falls back to config value
         * When true, squash the LD triangle to fit the display height
         */
        fitToHeightSetting: types.maybe(types.boolean),
        /**
         * #property
         * When undefined, falls back to config value
         * HWE filter p-value threshold (variants with HWE p < this are excluded)
         * Set to 0 to disable HWE filtering
         */
        hweFilterThresholdSetting: types.maybe(types.number),
        /**
         * #property
         * When undefined, falls back to config value
         * Whether to show vertical guides at the connected genome positions on hover
         */
        showVerticalGuidesSetting: types.maybe(types.boolean),
        /**
         * #property
         * When undefined, falls back to config value
         * Whether to show variant labels above the tick marks
         */
        showLabelsSetting: types.maybe(types.boolean),
        /**
         * #property
         * When undefined, falls back to config value
         * Height of the vertical tick marks at the genomic position
         */
        tickHeightSetting: types.maybe(types.number),
        /**
         * #property
         * When undefined, falls back to config value
         * When true, draw cells sized according to genomic distance between SNPs
         * rather than uniform squares
         */
        useGenomicPositionsSetting: types.maybe(types.boolean),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      flatbush: undefined as ArrayBufferLike | undefined,
      /**
       * #volatile
       */
      flatbushItems: [] as LDFlatbushItem[],
      /**
       * #volatile
       */
      snps: [] as LDMatrixResult['snps'],
      /**
       * #volatile
       */
      maxScore: 1,
      /**
       * #volatile
       */
      yScalar: 1,
      /**
       * #volatile
       * Width of each cell in the LD matrix (in unrotated coordinates)
       */
      cellWidth: 0,
      /**
       * #volatile
       */
      error: undefined as Error | undefined,
      /**
       * #volatile
       * Stats about filtered variants
       */
      filterStats: undefined as FilterStats | undefined,
      /**
       * #volatile
       * Recombination rate estimates between adjacent SNPs
       */
      recombination: undefined as
        | { values: number[]; positions: number[] }
        | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFlatbushData(
        flatbush: ArrayBufferLike | undefined,
        items: LDFlatbushItem[],
        snps: LDMatrixResult['snps'],
        maxScore: number,
        yScalar: number,
        cellWidth: number,
      ) {
        self.flatbush = flatbush
        self.flatbushItems = items
        self.snps = snps
        self.maxScore = maxScore
        self.yScalar = yScalar
        self.cellWidth = cellWidth
      },
      /**
       * #action
       */
      setLineZoneHeight(n: number) {
        self.lineZoneHeightSetting = Math.max(0, n)
      },
      /**
       * #action
       */
      setError(error: unknown) {
        self.error = error as Error | undefined
      },
      /**
       * #action
       */
      reload() {
        self.error = undefined
      },
      /**
       * #action
       */
      setMafFilter(arg: number) {
        self.minorAlleleFrequencyFilterSetting = arg
      },
      /**
       * #action
       */
      setLengthCutoffFilter(arg: number) {
        self.lengthCutoffFilterSetting = arg
      },
      /**
       * #action
       */
      setLDMetric(metric: string) {
        self.ldMetricSetting = metric
      },
      /**
       * #action
       */
      setColorScheme(scheme: string | undefined) {
        self.colorSchemeSetting = scheme
      },
      /**
       * #action
       */
      setShowLegend(show: boolean) {
        self.showLegendSetting = show
      },
      /**
       * #action
       */
      setShowLDTriangle(show: boolean) {
        self.showLDTriangleSetting = show
      },
      /**
       * #action
       */
      setShowRecombination(show: boolean) {
        self.showRecombinationSetting = show
      },
      /**
       * #action
       */
      setRecombinationZoneHeight(n: number) {
        self.recombinationZoneHeightSetting = Math.max(20, n)
      },
      /**
       * #action
       */
      setFitToHeight(value: boolean) {
        self.fitToHeightSetting = value
      },
      /**
       * #action
       */
      setHweFilter(threshold: number) {
        self.hweFilterThresholdSetting = threshold
      },
      /**
       * #action
       */
      setFilterStats(stats: typeof self.filterStats) {
        self.filterStats = stats
      },
      /**
       * #action
       */
      setRecombination(data: typeof self.recombination) {
        self.recombination = data
      },
      /**
       * #action
       */
      setShowVerticalGuides(show: boolean) {
        self.showVerticalGuidesSetting = show
      },
      /**
       * #action
       */
      setShowLabels(show: boolean) {
        self.showLabelsSetting = show
      },
      /**
       * #action
       */
      setTickHeight(height: number) {
        self.tickHeightSetting = Math.max(0, height)
      },
      /**
       * #action
       */
      setUseGenomicPositions(value: boolean) {
        self.useGenomicPositionsSetting = value
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
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
      /**
       * #getter
       */
      get rendererConfig() {
        return getConf(self, 'renderer')
      },
      /**
       * #getter
       */
      get regionTooLarge() {
        return false
      },
      /**
       * #getter
       * Returns the effective minor allele frequency filter, falling back to config
       */
      get minorAlleleFrequencyFilter() {
        return (
          self.minorAlleleFrequencyFilterSetting ??
          getConf(self, 'minorAlleleFrequencyFilter')
        )
      },
      /**
       * #getter
       * Returns the effective length cutoff filter, falling back to config
       */
      get lengthCutoffFilter() {
        return (
          self.lengthCutoffFilterSetting ?? getConf(self, 'lengthCutoffFilter')
        )
      },
      /**
       * #getter
       * Returns the effective line zone height, falling back to config
       */
      get lineZoneHeight() {
        return self.lineZoneHeightSetting ?? getConf(self, 'lineZoneHeight')
      },
      /**
       * #getter
       * Returns the effective LD metric, falling back to config
       */
      get ldMetric() {
        return self.ldMetricSetting ?? getConf(self, 'ldMetric')
      },
      /**
       * #getter
       * Returns the effective color scheme, falling back to config
       */
      get colorScheme() {
        const setting = self.colorSchemeSetting
        if (setting !== undefined) {
          return setting || undefined
        }
        const conf = getConf(self, 'colorScheme')
        return conf || undefined
      },
      /**
       * #getter
       * Returns the effective show legend setting, falling back to config
       */
      get showLegend() {
        return self.showLegendSetting ?? getConf(self, 'showLegend')
      },
      /**
       * #getter
       * Returns the effective show LD triangle setting, falling back to config
       */
      get showLDTriangle() {
        return self.showLDTriangleSetting ?? getConf(self, 'showLDTriangle')
      },
      /**
       * #getter
       * Returns the effective show recombination setting, falling back to config
       */
      get showRecombination() {
        return (
          self.showRecombinationSetting ?? getConf(self, 'showRecombination')
        )
      },
      /**
       * #getter
       * Returns the effective recombination zone height, falling back to config
       */
      get recombinationZoneHeight() {
        return (
          self.recombinationZoneHeightSetting ??
          getConf(self, 'recombinationZoneHeight')
        )
      },
      /**
       * #getter
       * Returns the effective fit to height setting, falling back to config
       */
      get fitToHeight() {
        return self.fitToHeightSetting ?? getConf(self, 'fitToHeight')
      },
      /**
       * #getter
       * Returns the effective HWE filter threshold, falling back to config
       */
      get hweFilterThreshold() {
        return (
          self.hweFilterThresholdSetting ?? getConf(self, 'hweFilterThreshold')
        )
      },
      /**
       * #getter
       * Returns the effective show vertical guides setting, falling back to config
       */
      get showVerticalGuides() {
        return (
          self.showVerticalGuidesSetting ?? getConf(self, 'showVerticalGuides')
        )
      },
      /**
       * #getter
       * Returns the effective show labels setting, falling back to config
       */
      get showLabels() {
        return self.showLabelsSetting ?? getConf(self, 'showLabels')
      },
      /**
       * #getter
       * Returns the effective tick height, falling back to config
       */
      get tickHeight() {
        return self.tickHeightSetting ?? getConf(self, 'tickHeight')
      },
      /**
       * #getter
       * Returns the effective use genomic positions setting, falling back to config
       */
      get useGenomicPositions() {
        return (
          self.useGenomicPositionsSetting ??
          getConf(self, 'useGenomicPositions')
        )
      },
      /**
       * #method
       */
      regionCannotBeRendered() {
        return null
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
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
            config: self.rendererConfig,
            // Only pass displayHeight when fitToHeight is true
            // This avoids tracking height changes when using natural triangle size
            // ldCanvasHeight already accounts for lineZoneHeight and recombinationZoneHeight
            ...(self.fitToHeight ? { displayHeight: self.ldCanvasHeight } : {}),
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            lengthCutoffFilter: self.lengthCutoffFilter,
            hweFilterThreshold: self.hweFilterThreshold,
            ldMetric: self.ldMetric,
            colorScheme: self.colorScheme,
            fitToHeight: self.fitToHeight,
            useGenomicPositions: self.useGenomicPositions,
          }
        },
      }
    })
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
              ],
            },
            {
              label: 'Filter settings...',
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
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        minorAlleleFrequencyFilterSetting,
        lengthCutoffFilterSetting,
        lineZoneHeightSetting,
        ldMetricSetting,
        colorSchemeSetting,
        showLegendSetting,
        showLDTriangleSetting,
        showRecombinationSetting,
        recombinationZoneHeightSetting,
        fitToHeightSetting,
        hweFilterThresholdSetting,
        showVerticalGuidesSetting,
        showLabelsSetting,
        tickHeightSetting,
        useGenomicPositionsSetting,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        // Only save settings that differ from config defaults
        ...(minorAlleleFrequencyFilterSetting !== undefined &&
        minorAlleleFrequencyFilterSetting !== 0.1
          ? { minorAlleleFrequencyFilterSetting }
          : {}),
        ...(lengthCutoffFilterSetting !== undefined &&
        lengthCutoffFilterSetting !== Number.MAX_SAFE_INTEGER
          ? { lengthCutoffFilterSetting }
          : {}),
        ...(lineZoneHeightSetting !== undefined && lineZoneHeightSetting !== 100
          ? { lineZoneHeightSetting }
          : {}),
        ...(ldMetricSetting !== undefined && ldMetricSetting !== 'r2'
          ? { ldMetricSetting }
          : {}),
        ...(colorSchemeSetting !== undefined && colorSchemeSetting !== ''
          ? { colorSchemeSetting }
          : {}),
        ...(showLegendSetting !== undefined && showLegendSetting
          ? { showLegendSetting }
          : {}),
        ...(showLDTriangleSetting !== undefined && !showLDTriangleSetting
          ? { showLDTriangleSetting }
          : {}),
        ...(showRecombinationSetting !== undefined && showRecombinationSetting
          ? { showRecombinationSetting }
          : {}),
        ...(recombinationZoneHeightSetting !== undefined &&
        recombinationZoneHeightSetting !== 50
          ? { recombinationZoneHeightSetting }
          : {}),
        ...(fitToHeightSetting !== undefined && fitToHeightSetting
          ? { fitToHeightSetting }
          : {}),
        ...(hweFilterThresholdSetting !== undefined &&
        hweFilterThresholdSetting !== 0.001
          ? { hweFilterThresholdSetting }
          : {}),
        ...(showVerticalGuidesSetting !== undefined &&
        !showVerticalGuidesSetting
          ? { showVerticalGuidesSetting }
          : {}),
        ...(showLabelsSetting !== undefined && showLabelsSetting
          ? { showLabelsSetting }
          : {}),
        ...(tickHeightSetting !== undefined && tickHeightSetting !== 6
          ? { tickHeightSetting }
          : {}),
        ...(useGenomicPositionsSetting !== undefined &&
        useGenomicPositionsSetting
          ? { useGenomicPositionsSetting }
          : {}),
      } as typeof snap
    })
}

export type SharedLDStateModel = ReturnType<typeof sharedModelFactory>
export type SharedLDModel = Instance<SharedLDStateModel>

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
         */
        minorAlleleFrequencyFilter: types.optional(types.number, 0.1),
        /**
         * #property
         */
        lengthCutoffFilter: types.optional(
          types.number,
          Number.MAX_SAFE_INTEGER,
        ),
        /**
         * #property
         * Height of the zone for connecting lines at the top
         */
        lineZoneHeight: types.optional(types.number, 100),
        /**
         * #property
         * LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D)
         */
        ldMetric: types.optional(types.string, 'r2'),
        /**
         * #property
         */
        colorScheme: types.maybe(types.string),
        /**
         * #property
         */
        showLegend: types.optional(types.boolean, false),
        /**
         * #property
         * Whether to show the LD triangle heatmap
         */
        showLDTriangle: types.optional(types.boolean, true),
        /**
         * #property
         * Whether to show the recombination rate track
         */
        showRecombination: types.optional(types.boolean, false),
        /**
         * #property
         * Height of the recombination track zone at the top
         */
        recombinationZoneHeight: types.optional(types.number, 50),
        /**
         * #property
         * When true, squash the LD triangle to fit the display height
         */
        fitToHeight: types.optional(types.boolean, false),
        /**
         * #property
         * HWE filter p-value threshold (variants with HWE p < this are excluded)
         * Set to 0 to disable HWE filtering
         */
        hweFilterThreshold: types.optional(types.number, 0.001),
        /**
         * #property
         * Whether to show vertical guides at the connected genome positions on hover
         */
        showVerticalGuides: types.optional(types.boolean, true),
        /**
         * #property
         * Whether to show variant labels above the tick marks
         */
        showLabels: types.optional(types.boolean, false),
        /**
         * #property
         * Height of the vertical tick marks at the genomic position
         */
        tickHeight: types.optional(types.number, 6),
        /**
         * #property
         * When true, draw cells sized according to genomic distance between SNPs
         * rather than uniform squares
         */
        useGenomicPositions: types.optional(types.boolean, false),
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
        self.lineZoneHeight = Math.max(0, n)
        return self.lineZoneHeight
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
        self.minorAlleleFrequencyFilter = arg
      },
      /**
       * #action
       */
      setLengthCutoffFilter(arg: number) {
        self.lengthCutoffFilter = arg
      },
      /**
       * #action
       */
      setLDMetric(metric: string) {
        self.ldMetric = metric
      },
      /**
       * #action
       */
      setColorScheme(scheme: string | undefined) {
        self.colorScheme = scheme
      },
      /**
       * #action
       */
      setShowLegend(show: boolean) {
        self.showLegend = show
      },
      /**
       * #action
       */
      setShowLDTriangle(show: boolean) {
        self.showLDTriangle = show
      },
      /**
       * #action
       */
      setShowRecombination(show: boolean) {
        self.showRecombination = show
      },
      /**
       * #action
       */
      setRecombinationZoneHeight(n: number) {
        self.recombinationZoneHeight = Math.max(20, n)
        return self.recombinationZoneHeight
      },
      /**
       * #action
       */
      setFitToHeight(value: boolean) {
        self.fitToHeight = value
      },
      /**
       * #action
       */
      setHweFilter(threshold: number) {
        self.hweFilterThreshold = threshold
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
        self.showVerticalGuides = show
      },
      /**
       * #action
       */
      setShowLabels(show: boolean) {
        self.showLabels = show
      },
      /**
       * #action
       */
      setTickHeight(height: number) {
        self.tickHeight = Math.max(0, height)
      },
      /**
       * #action
       */
      setUseGenomicPositions(value: boolean) {
        self.useGenomicPositions = value
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
       * Effective height for the LD canvas (total height minus line zone)
       * Note: Recombination track is overlaid on the line zone, not in a separate zone
       */
      get ldCanvasHeight() {
        return Math.max(50, self.height - self.lineZoneHeight)
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
       * #method
       */
      regionCannotBeRendered() {
        return null
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
        minorAlleleFrequencyFilter,
        lengthCutoffFilter,
        hweFilterThreshold,
        ldMetric,
        colorScheme,
        showLegend,
        showLDTriangle,
        showRecombination,
        recombinationZoneHeight,
        fitToHeight,
        showVerticalGuides,
        showLabels,
        tickHeight,
        useGenomicPositions,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(minorAlleleFrequencyFilter !== 0.1
          ? { minorAlleleFrequencyFilter }
          : {}),
        ...(lengthCutoffFilter !== Number.MAX_SAFE_INTEGER
          ? { lengthCutoffFilter }
          : {}),
        ...(hweFilterThreshold !== 0.001 ? { hweFilterThreshold } : {}),
        ...(ldMetric !== 'r2' ? { ldMetric } : {}),
        ...(colorScheme ? { colorScheme } : {}),
        ...(showLegend ? { showLegend } : {}),
        ...(!showLDTriangle ? { showLDTriangle } : {}),
        ...(showRecombination ? { showRecombination } : {}),
        ...(recombinationZoneHeight !== 50 ? { recombinationZoneHeight } : {}),
        ...(fitToHeight ? { fitToHeight } : {}),
        ...(!showVerticalGuides ? { showVerticalGuides } : {}),
        ...(showLabels ? { showLabels } : {}),
        ...(tickHeight !== 6 ? { tickHeight } : {}),
        ...(useGenomicPositions ? { useGenomicPositions } : {}),
      } as typeof snap
    })
}

export type SharedLDStateModel = ReturnType<typeof sharedModelFactory>
export type SharedLDModel = Instance<SharedLDStateModel>

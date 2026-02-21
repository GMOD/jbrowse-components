import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { cast, types } from '@jbrowse/mobx-state-tree'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import AddFiltersDialog from '../shared/components/AddFiltersDialog.tsx'
import LDFilterDialog from '../shared/components/LDFilterDialog.tsx'

import type { LDFlatbushItem } from '../LDRenderer/types.ts'
import type { WebGLLDDataResult } from '../RenderWebGLLDDataRPC/types.ts'
import type { FilterStats, LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
import type React from 'react'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel SharedLDModel
 * Shared state model for LD displays
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 */
export default function sharedModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'SharedLDModel',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
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
         * Call rate filter threshold (0-1). Variants with fewer than this
         * proportion of non-missing genotypes are excluded.
         */
        callRateFilterSetting: types.maybe(types.number),
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
        /**
         * #property
         * When undefined, falls back to config value
         * When true, show signed LD values (-1 to 1) instead of absolute values
         */
        signedLDSetting: types.maybe(types.boolean),
        /**
         * #property
         * When undefined, falls back to config value
         * JEXL filter expressions to apply to variants
         */
        jexlFiltersSetting: types.maybe(types.array(types.string)),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcData: null as WebGLLDDataResult | null,
      /**
       * #volatile
       */
      loading: false,
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
      /**
       * #volatile
       */
      renderingStopToken: undefined as string | undefined,
      /**
       * #volatile
       */
      flatbush: undefined as ArrayBuffer | undefined,
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
      setRpcData(data: WebGLLDDataResult | null) {
        self.rpcData = data
      },
      /**
       * #action
       */
      setLoading(loading: boolean) {
        self.loading = loading
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
      /**
       * #action
       */
      setRenderingStopToken(token?: string) {
        self.renderingStopToken = token
      },
      /**
       * #action
       */
      setFlatbushData(
        flatbush: ArrayBuffer | undefined,
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
      setCallRateFilter(threshold: number) {
        self.callRateFilterSetting = threshold
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
      /**
       * #action
       */
      setSignedLD(value: boolean) {
        self.signedLDSetting = value
      },
      /**
       * #action
       */
      setJexlFilters(filters: string[] | undefined) {
        self.jexlFiltersSetting = cast(filters)
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
      get drawn() {
        return !!self.rpcData
      },
      get fullyDrawn() {
        return !!self.rpcData
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
        return self.colorSchemeSetting || getConf(self, 'colorScheme') || undefined
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
       * Returns the effective call rate filter threshold, falling back to config
       */
      get callRateFilter() {
        return self.callRateFilterSetting ?? getConf(self, 'callRateFilter')
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
       * #getter
       * Returns the effective signed LD setting, falling back to config
       */
      get signedLD() {
        return self.signedLDSetting ?? getConf(self, 'signedLD')
      },
      /**
       * #getter
       * Returns the effective jexl filters, falling back to config
       */
      get jexlFilters() {
        return self.jexlFiltersSetting ?? getConf(self, 'jexlFilters')
      },
      /**
       * #getter
       * Returns true if this display uses pre-computed LD data (PLINK, ldmat)
       * rather than computing LD from VCF genotypes
       */
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
    .actions(self => {
      const superAfterAttach = self.afterAttach
      return {
        afterAttach() {
          superAfterAttach()
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
      }
    })
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
        callRateFilterSetting,
        showVerticalGuidesSetting,
        showLabelsSetting,
        tickHeightSetting,
        useGenomicPositionsSetting,
        signedLDSetting,
        jexlFiltersSetting,
        ...rest
      } = snap as Omit<typeof snap, symbol>

      const defaults: Record<string, unknown> = {
        minorAlleleFrequencyFilterSetting: 0.1,
        lengthCutoffFilterSetting: Number.MAX_SAFE_INTEGER,
        lineZoneHeightSetting: 100,
        ldMetricSetting: 'r2',
        colorSchemeSetting: '',
        showLegendSetting: false,
        showLDTriangleSetting: true,
        showRecombinationSetting: false,
        recombinationZoneHeightSetting: 50,
        fitToHeightSetting: false,
        hweFilterThresholdSetting: 0,
        callRateFilterSetting: 0,
        showVerticalGuidesSetting: true,
        showLabelsSetting: false,
        tickHeightSetting: 6,
        useGenomicPositionsSetting: false,
        signedLDSetting: false,
      }
      const settings = {
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
        callRateFilterSetting,
        showVerticalGuidesSetting,
        showLabelsSetting,
        tickHeightSetting,
        useGenomicPositionsSetting,
        signedLDSetting,
      }
      const nonDefault = Object.fromEntries(
        Object.entries(settings).filter(
          ([k, v]) => v !== undefined && v !== defaults[k],
        ),
      )
      return {
        ...rest,
        ...nonDefault,
        ...(jexlFiltersSetting?.length ? { jexlFiltersSetting } : {}),
      } as typeof snap
    })
}

export type SharedLDStateModel = ReturnType<typeof sharedModelFactory>
export type SharedLDModel = Instance<SharedLDStateModel>

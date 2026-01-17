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
 * #stateModel LDDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [NonBlockCanvasDisplayMixin](../nonblockcanvasdisplaymixin)
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LDDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      NonBlockCanvasDisplayMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LDDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        minorAlleleFrequencyFilter: types.optional(types.number, 0.01),
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
        lineZoneHeight: types.optional(types.number, 20),
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
        showLegend: types.optional(types.boolean, true),
        /**
         * #property
         * HWE filter p-value threshold (variants with HWE p < this are excluded)
         * Set to 0 to disable HWE filtering
         */
        hweFilterThreshold: types.optional(types.number, 0.001),
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
       */
      error: undefined as Error | undefined,
      /**
       * #volatile
       * Stats about filtered variants
       */
      filterStats: undefined as FilterStats | undefined,
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
      ) {
        self.flatbush = flatbush
        self.flatbushItems = items
        self.snps = snps
        self.maxScore = maxScore
        self.yScalar = yScalar
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
      setError(error: Error | unknown | undefined) {
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
      setHweFilter(threshold: number) {
        self.hweFilterThreshold = threshold
      },
      /**
       * #action
       */
      setFilterStats(stats: typeof self.filterStats) {
        self.filterStats = stats
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
            displayHeight: self.height,
            lineZoneHeight: self.lineZoneHeight,
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            lengthCutoffFilter: self.lengthCutoffFilter,
            hweFilterThreshold: self.hweFilterThreshold,
            ldMetric: self.ldMetric,
            colorScheme: self.colorScheme,
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
                  label: 'Show legend',
                  type: 'checkbox',
                  checked: self.showLegend,
                  onClick: () => {
                    self.setShowLegend(!self.showLegend)
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
          return renderSvg(self as LDDisplayModel, opts)
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self as LDDisplayModel)
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
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(minorAlleleFrequencyFilter !== 0.01
          ? { minorAlleleFrequencyFilter }
          : {}),
        ...(lengthCutoffFilter !== Number.MAX_SAFE_INTEGER
          ? { lengthCutoffFilter }
          : {}),
        ...(hweFilterThreshold !== 0.001 ? { hweFilterThreshold } : {}),
        ...(ldMetric !== 'r2' ? { ldMetric } : {}),
        ...(colorScheme ? { colorScheme } : {}),
        ...(!showLegend ? { showLegend } : {}),
      } as typeof snap
    })
}

export type LDDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LDDisplayModel = Instance<LDDisplayStateModel>

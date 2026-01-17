import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { linearBareDisplayStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import type { LDFlatbushItem } from '../LDRenderer/types.ts'
import type { LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LDDisplay
 * extends
 * - [LinearBareDisplay](../linearbaredisplay)
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LDDisplay',
      linearBareDisplayStateModelFactory(configSchema),
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
         */
        lineZoneHeight: types.optional(types.number, 30),
        /**
         * #property
         * LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D)
         */
        ldMetric: types.optional(
          types.enumeration(['r2', 'dprime'] as const),
          'r2',
        ),
        /**
         * #property
         */
        colorScheme: types.maybe(types.string),
        /**
         * #property
         */
        showLegend: types.optional(types.boolean, true),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      renderingStopToken: undefined as StopToken | undefined,
      /**
       * #volatile
       */
      renderingImageData: undefined as ImageBitmap | undefined,
      /**
       * #volatile
       */
      lastDrawnOffsetPx: 0,
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
      maxScore: 1,
      /**
       * #volatile
       */
      yScalar: 1,
      /**
       * #volatile
       */
      loading: false,
      /**
       * #volatile
       */
      error: undefined as Error | undefined,
      /**
       * #volatile
       */
      ref: null as HTMLCanvasElement | null,
      /**
       * #volatile
       */
      statusMessage: '',
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
      },
      /**
       * #action
       */
      setRenderingStopToken(token: StopToken | undefined) {
        self.renderingStopToken = token
      },
      /**
       * #action
       */
      setRenderingImageData(data: ImageBitmap | undefined) {
        self.renderingImageData = data
      },
      /**
       * #action
       */
      setLastDrawnOffsetPx(offset: number) {
        self.lastDrawnOffsetPx = offset
      },
      /**
       * #action
       */
      setFlatbushData(
        flatbush: ArrayBufferLike | undefined,
        items: LDFlatbushItem[],
        maxScore: number,
        yScalar: number,
      ) {
        self.flatbush = flatbush
        self.flatbushItems = items
        self.maxScore = maxScore
        self.yScalar = yScalar
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
      setError(error: Error | unknown | undefined) {
        self.error = error as Error | undefined
      },
      /**
       * #action
       */
      setStatusMessage(msg: string) {
        self.statusMessage = msg
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
      setLineZoneHeight(n: number) {
        self.lineZoneHeight = Math.max(10, Math.min(100, n))
      },
      /**
       * #action
       */
      setLDMetric(metric: LDMetric) {
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
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            lengthCutoffFilter: self.lengthCutoffFilter,
            lineZoneHeight: self.lineZoneHeight,
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
              label: 'Show legend',
              type: 'checkbox',
              checked: self.showLegend,
              onClick: () => {
                self.setShowLegend(!self.showLegend)
              },
            },
            {
              label: 'Set MAF filter...',
              onClick: () => {
                const maf = prompt(
                  'Enter minimum minor allele frequency (0-0.5):',
                  String(self.minorAlleleFrequencyFilter),
                )
                if (maf !== null) {
                  const val = Number.parseFloat(maf)
                  if (!Number.isNaN(val) && val >= 0 && val <= 0.5) {
                    self.setMafFilter(val)
                  }
                }
              },
            },
          ]
        },
      }
    })
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
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        minorAlleleFrequencyFilter,
        lengthCutoffFilter,
        lineZoneHeight,
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
        ...(lineZoneHeight !== 30 ? { lineZoneHeight } : {}),
        ...(ldMetric !== 'r2' ? { ldMetric } : {}),
        ...(colorScheme ? { colorScheme } : {}),
        ...(!showLegend ? { showLegend } : {}),
      } as typeof snap
    })
}

export type LDDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LDDisplayModel = Instance<LDDisplayStateModel>

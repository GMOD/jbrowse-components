import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { linearBareDisplayStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import type { LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
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
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      ldDataStopToken: undefined as StopToken | undefined,
      /**
       * #volatile
       */
      ldData: undefined as LDMatrixResult | undefined,
      /**
       * #volatile
       */
      error: undefined as Error | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLDData(data: LDMatrixResult) {
        self.ldData = data
        self.error = undefined
      },
      /**
       * #action
       */
      setError(error: Error) {
        self.error = error
      },
      /**
       * #action
       */
      setLDDataLoading(token: StopToken) {
        if (self.ldDataStopToken) {
          stopStopToken(self.ldDataStopToken)
        }
        self.ldDataStopToken = token
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
      get snps() {
        return self.ldData?.snps ?? []
      },
      /**
       * #getter
       */
      get ldValues() {
        return self.ldData?.ldValues ?? new Float32Array(0)
      },
      /**
       * #getter
       */
      get numSnps() {
        return this.snps.length
      },
      /**
       * #method
       * Get R² value between SNP i and SNP j (i > j)
       */
      getLD(i: number, j: number): number {
        if (i === j) {
          return 1
        }
        // Ensure i > j for lower triangular access
        if (i < j) {
          ;[i, j] = [j, i]
        }
        // Lower triangular index: sum of 0...(i-1) + j
        const idx = (i * (i - 1)) / 2 + j
        return this.ldValues[idx] ?? 0
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
            notReady: !self.ldData,
            ldData: self.ldData,
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            lengthCutoffFilter: self.lengthCutoffFilter,
            lineZoneHeight: self.lineZoneHeight,
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
            const { setupLDAutorun } = await import('./setupLDAutorun.ts')
            setupLDAutorun(self)
          } catch (e) {
            if (isAlive(self)) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
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
      } as typeof snap
    })
}

export type LDDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LDDisplayModel = Instance<LDDisplayStateModel>

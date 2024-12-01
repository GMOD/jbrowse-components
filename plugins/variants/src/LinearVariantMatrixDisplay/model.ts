// jbrowse
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { set1 } from '@jbrowse/core/ui/colors'
import { getSession } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { linearBasicDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'
import deepEqual from 'fast-deep-equal'
import { isAlive, types } from 'mobx-state-tree'

// locals
import { randomColor } from '../util'

import type { Source } from '../util'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from 'mobx-state-tree'
import { lazy } from 'react'

const MAFFilterDialog = lazy(() => import('./components/MAFFilterDialog'))

/**
 * #stateModel LinearVariantMatrixDisplay
 * extends
 * - [LinearBasicDisplay](../linearbasicdisplay)
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      linearBasicDisplayModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearVariantMatrixDisplay'),

        /**
         * #property
         */
        layout: types.optional(types.frozen<Source[]>(), []),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        mafFilter: types.optional(types.number, 0.1),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      sourcesLoadingStopToken: undefined as string | undefined,
      /**
       * #volatile
       */
      featureUnderMouseVolatile: undefined as Feature | undefined,
      /**
       * #volatile
       */
      sourcesVolatile: undefined as Source[] | undefined,
    }))
    .views(() => ({
      /**
       * #getter
       */
      get blockType() {
        return 'dynamicBlocks'
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSourcesLoading(str: string) {
        if (self.sourcesLoadingStopToken) {
          stopStopToken(self.sourcesLoadingStopToken)
        }
        self.sourcesLoadingStopToken = str
      },

      /**
       * #action
       */
      setSources(sources: Source[]) {
        if (!deepEqual(sources, self.sourcesVolatile)) {
          self.sourcesVolatile = sources
        }
      },
      /**
       * #action
       */
      setMafFilter(arg: number) {
        self.mafFilter = arg
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self
      return {
        get preSources() {
          return self.layout.length ? self.layout : self.sourcesVolatile
        },
        /**
         * #getter
         */
        get sources() {
          const sources = Object.fromEntries(
            self.sourcesVolatile?.map(s => [s.name, s]) || [],
          )
          return this.preSources
            ?.map(s => ({
              ...sources[s.name],
              ...s,
            }))
            .map((s, i) => ({
              ...s,
              color: s.color || set1[i] || randomColor(),
            }))
        },
        /**
         * #method
         */
        adapterProps() {
          const superProps = superRenderProps()
          return {
            ...superProps,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            config: self.rendererConfig,
          }
        },
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Set minimum allele frequency (MAF)',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  MAFFilterDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      renderProps() {
        const superProps = self.adapterProps()
        return {
          ...superProps,
          notReady: superProps.notReady || !self.sources,
          mafFilter: self.mafFilter,
          height: self.height,
          sources: self.sources,
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { getMultiVariantSourcesAutorun } = await import(
              '../getMultiVariantSourcesAutorun'
            )
            getMultiVariantSourcesAutorun(self)
          } catch (e) {
            if (isAlive(self)) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
          }
        })()
      },
    }))
}

export type LinearVariantMatrixDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantMatrixDisplayModel =
  Instance<LinearVariantMatrixDisplayStateModel>

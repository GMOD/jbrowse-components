import { lazy } from 'react'

// jbrowse imports
import { getConf } from '@jbrowse/core/configuration'
import { set1 } from '@jbrowse/core/ui/colors'
import { getEnv, getSession } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import deepEqual from 'fast-deep-equal'
import { isAlive, types } from 'mobx-state-tree'

// locals
import SharedVariantMixin from '../shared/SharedVariantMixin'
import { randomColor } from '../util'

import type { Source } from '../util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { AnyReactComponentType, Feature } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

// lazies
const Tooltip = lazy(() => import('../shared/Tooltip'))
const SetColorDialog = lazy(() => import('../shared/SetColorDialog'))
const HierarchicalClusterDialog = lazy(
  () => import('../shared/HierarchicalClusterDialog'),
)

// using a map because it preserves order
const rendererTypes = new Map([['multivariant', 'MultiVariantRenderer']])

/**
 * #stateModel MultiLinearVariantDisplay
 * extends
 * - [SharedVariantMixin](../sharedvariantmixin)
 */
export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearVariantDisplay',
      SharedVariantMixin(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('MultiLinearVariantDisplay'),

        /**
         * #property
         */
        layout: types.optional(types.frozen<Source[]>(), []),
        /**
         * #property
         * used only if autoHeight is false
         */
        rowHeightSetting: types.optional(types.number, 10),

        /**
         * #property
         * adjust to height of track/display
         */
        autoHeight: false,
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
      setLayout(layout: Source[]) {
        self.layout = layout
      },
      /**
       * #action
       */
      clearLayout() {
        self.layout = []
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
      setFeatureUnderMouse(f?: Feature) {
        self.featureUnderMouseVolatile = f
      },
      /**
       * #action
       */
      setRowHeight(arg: number) {
        self.rowHeightSetting = arg
      },
      /**
       * #action
       */
      setAutoHeight(arg: boolean) {
        self.autoHeight = arg
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
      },
      /**
       * #getter
       */
      get TooltipComponent() {
        return Tooltip as AnyReactComponentType
      },

      /**
       * #getter
       */
      get rendererTypeName() {
        return rendererTypes.get(self.rendererTypeNameSimple)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get sources() {
        const sources = Object.fromEntries(
          self.sourcesVolatile?.map(s => [s.name, s]) || [],
        )
        const iter = self.layout.length ? self.layout : self.sourcesVolatile
        return iter
          ?.map(s => ({
            ...sources[s.name],
            ...s,
          }))
          .map((s, i) => ({
            ...s,
            color: s.color || set1[i] || randomColor(),
          }))
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get rowHeight() {
        const { autoHeight, sources, rowHeightSetting, height } = self
        return autoHeight ? height / (sources?.length || 1) : rowHeightSetting
      },

      /**
       * #getter
       */
      get rendererConfig() {
        return self.rendererType.configSchema.create(
          {
            ...getConf(self, ['renderers', self.rendererTypeName]),
          },
          getEnv(self),
        )
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #getter
         */
        get totalHeight() {
          return self.rowHeight * (self.sources?.length || 1)
        },
        /**
         * #method
         */
        adapterProps() {
          const superProps = superRenderProps()
          return {
            ...superProps,
            displayModel: self,
            config: self.rendererConfig,
            filters: self.filters,
            rpcDriverName: self.rpcDriverName,
            sources: self.sources,
          }
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
          displayModel: self,
          rpcDriverName: self.rpcDriverName,
          height: self.height,
          totalHeight: self.totalHeight,
          rowHeight: self.rowHeight,
          scrollTop: self.scrollTop,
          onMouseMove: (_: unknown, f: Feature) => {
            self.setFeatureUnderMouse(f)
          },
          onMouseLeave: () => {
            self.setFeatureUnderMouse(undefined)
          },
        }
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
              label: 'Adjust to height of display?',
              type: 'checkbox',
              checked: self.autoHeight,
              onClick: () => {
                self.setAutoHeight(!self.autoHeight)
              },
            },
            {
              label: 'Cluster by genotype',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  HierarchicalClusterDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              label: 'Edit colors/arrangement...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetColorDialog,
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
    .actions(self => {
      const { renderSvg: superRenderSvg } = self
      return {
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

        /**
         * #action
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg')
          return renderSvg(self, opts, superRenderSvg)
        },
      }
    })
}

export type MultiLinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearVariantDisplayModel =
  Instance<MultiLinearVariantDisplayStateModel>

export default stateModelFactory

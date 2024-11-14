import { lazy } from 'react'
import {
  AnyConfigurationSchemaType,
  getConf,
} from '@jbrowse/core/configuration'
import {
  AnyReactComponentType,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { axisPropsFromTickScale } from 'react-d3-axis-mod'
import {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// locals
import { getScale, YSCALEBAR_LABEL_OFFSET } from '../util'
import SharedWiggleMixin from '../shared/SharedWiggleMixin'

// lazies
const Tooltip = lazy(() => import('./components/Tooltip'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
  ['line', 'LinePlotRenderer'],
])

/**
 * #stateModel LinearWiggleDisplay
 * extends
 * - [SharedWiggleMixin](../sharedwigglemixin)
 */
function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearWiggleDisplay',
      SharedWiggleMixin(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearWiggleDisplay'),
      }),
    )

    .views(self => ({
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
        const name = self.rendererTypeNameSimple
        const rendererType = rendererTypes.get(name)
        if (!rendererType) {
          throw new Error(`unknown renderer ${name}`)
        }
        return rendererType
      },
      /**
       * #getter
       * unused currently
       */
      get quantitativeStatsUpToDate() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const statsRegions = JSON.stringify(view.dynamicBlocks)
        return (
          self.stats?.currStatsBpPerPx === view.bpPerPx ||
          self.stats?.currStatsRegions === statsRegions
        )
      },
    }))

    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        adapterProps() {
          const superProps = superRenderProps()
          const { filters, resolution, scaleOpts } = self
          return {
            ...superProps,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            config: self.rendererConfig,
            displayCrossHatches: self.displayCrossHatchesSetting,
            scaleOpts,
            resolution,
            filters,
          }
        },

        /**
         * #getter
         */
        get ticks() {
          const { scaleType, domain, height } = self
          const minimalTicks = getConf(self, 'minimalTicks')
          const inverted = getConf(self, 'inverted')
          if (domain) {
            const ticks = axisPropsFromTickScale(
              getScale({
                scaleType,
                domain,
                range: [
                  height - YSCALEBAR_LABEL_OFFSET,
                  YSCALEBAR_LABEL_OFFSET,
                ],
                inverted,
              }),
              4,
            )
            return height < 100 || minimalTicks
              ? { ...ticks, values: domain }
              : ticks
          } else {
            return undefined
          }
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      renderProps() {
        const { ticks, height } = self
        const superProps = self.adapterProps()
        return {
          ...self.adapterProps(),
          notReady: superProps.notReady || !self.quantitativeStatsUpToDate,
          height,
          ticks,
        }
      },

      /**
       * #getter
       */
      get needsScalebar() {
        return (
          self.rendererTypeName === 'XYPlotRenderer' ||
          self.rendererTypeName === 'LinePlotRenderer'
        )
      },
      /**
       * #getter
       */
      get fillSetting() {
        if (self.filled) {
          return 0
        } else if (self.minSize === 1) {
          return 1
        } else {
          return 2
        }
      },
      /**
       * #getter
       */
      get quantitativeStatsReady() {
        const view = getContainingView(self) as LinearGenomeViewModel
        return (
          view.initialized &&
          self.featureDensityStatsReady &&
          !self.regionTooLarge &&
          !self.error
        )
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      const hasRenderings = getConf(self, 'defaultRendering')
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Score',
              subMenu: self.scoreTrackMenuItems(),
            },

            ...(self.canHaveFill
              ? [
                  {
                    label: 'Fill mode',
                    subMenu: ['filled', 'no fill', 'no fill w/ emphasis'].map(
                      (elt, idx) => ({
                        label: elt,
                        type: 'radio',
                        checked: self.fillSetting === idx,
                        onClick: () => {
                          self.setFill(idx)
                        },
                      }),
                    ),
                  },
                ]
              : []),

            ...(self.needsScalebar
              ? [
                  {
                    type: 'checkbox',
                    label: 'Draw cross hatches',
                    checked: self.displayCrossHatchesSetting,
                    onClick: () => {
                      self.toggleCrossHatches()
                    },
                  },
                ]
              : []),

            ...(hasRenderings
              ? [
                  {
                    label: 'Renderer type',
                    subMenu: ['xyplot', 'density', 'line'].map(key => ({
                      label: key,
                      type: 'radio',
                      checked: self.rendererTypeNameSimple === key,
                      onClick: () => {
                        self.setRendererType(key)
                      },
                    })),
                  },
                ]
              : []),

            {
              label: 'Set color',
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
            const { getQuantitativeStatsAutorun } = await import(
              '../getQuantitativeStatsAutorun'
            )
            getQuantitativeStatsAutorun(self)
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

export type WiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WiggleDisplayModel = Instance<WiggleDisplayStateModel>

export default stateModelFactory

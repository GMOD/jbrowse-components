import React, { lazy } from 'react'
import {
  AnyConfigurationSchemaType,
  getConf,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { axisPropsFromTickScale } from 'react-d3-axis-mod'
import { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

// locals
import { getScale, YSCALEBAR_LABEL_OFFSET } from '../../util'

import Tooltip from '../components/Tooltip'
import SharedWiggleMixin from '../../shared/modelShared'

// lazies
const SetColorDialog = lazy(() => import('../components/SetColorDialog'))

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
        return Tooltip as React.FC
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
    }))

    .views(self => ({
      /**
       * #getter
       */
      get ticks() {
        const { scaleType, domain, height } = self
        const minimalTicks = getConf(self, 'minimalTicks')
        const inverted = getConf(self, 'inverted')
        const range = [height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET]
        if (!domain) {
          return undefined
        }
        const scale = getScale({
          domain,
          inverted,
          range,
          scaleType,
        })
        const ticks = axisPropsFromTickScale(scale, 4)
        return height < 100 || minimalTicks
          ? { ...ticks, values: domain }
          : ticks
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #getter
         */
        get fillSetting() {
          if (self.filled) {
            return 0
          } else if (!self.filled && self.minSize === 1) {
            return 1
          } else {
            return 2
          }
        },

        /**
         * #getter
         */
        get needsScalebar() {
          const { rendererTypeName: type } = self
          return type === 'XYPlotRenderer' || type === 'LinePlotRenderer'
        },

        /**
         * #method
         */
        renderProps() {
          const superProps = superRenderProps()
          const { filters, ticks, height, resolution, scaleOpts } = self
          return {
            ...superProps,
            config: self.rendererConfig,
            displayCrossHatches: self.displayCrossHatchesSetting,
            displayModel: self,
            filters,
            height,
            notReady: superProps.notReady || !self.stats,
            resolution,
            rpcDriverName: self.rpcDriverName,
            scaleOpts,
            ticks,
          }
        },
      }
    })
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
                        checked: self.fillSetting === idx,
                        label: elt,
                        onClick: () => self.setFill(idx),
                        type: 'radio',
                      }),
                    ),
                  },
                ]
              : []),

            ...(self.needsScalebar
              ? [
                  {
                    checked: self.displayCrossHatchesSetting,
                    label: 'Draw cross hatches',
                    onClick: () => self.toggleCrossHatches(),
                    type: 'checkbox',
                  },
                ]
              : []),

            ...(hasRenderings
              ? [
                  {
                    label: 'Renderer type',
                    subMenu: ['xyplot', 'density', 'line'].map(key => ({
                      checked: self.rendererTypeNameSimple === key,
                      label: key,
                      onClick: () => self.setRendererType(key),
                      type: 'radio',
                    })),
                  },
                ]
              : []),

            {
              label: 'Set color',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetColorDialog,
                  { handleClose, model: self },
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
            const { quantitativeStatsAutorun } = await import('../../util')
            quantitativeStatsAutorun(self)
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

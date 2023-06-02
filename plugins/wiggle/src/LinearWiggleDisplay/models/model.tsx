import React, { lazy } from 'react'
import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

import { axisPropsFromTickScale } from 'react-d3-axis-mod'
import {
  getNiceDomain,
  getScale,
  quantitativeStatsAutorun,
  YSCALEBAR_LABEL_OFFSET,
} from '../../util'

import Tooltip from '../components/Tooltip'
import SharedWiggleMixin from '../../shared/modelShared'

const SetMinMaxDlg = lazy(() => import('../../shared/SetMinMaxDialog'))
const SetColorDlg = lazy(() => import('../components/SetColorDialog'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
  ['line', 'LinePlotRenderer'],
])

/**
 * #stateModel LinearWiggleDisplay
 * Extends `BaseLinearDisplay`
 */
function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearWiggleDisplay',
      BaseLinearDisplay,
      SharedWiggleMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearWiggleDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        const name = this.rendererTypeNameSimple
        const rendererType = rendererTypes.get(name)
        if (!rendererType) {
          throw new Error(`unknown renderer ${name}`)
        }
        return rendererType
      },
      /**
       * #getter
       */
      get TooltipComponent() {
        return Tooltip as React.FC
      },
      /**
       * #getter
       */
      get rendererConfig() {
        const {
          color,
          displayCrossHatches,
          fill,
          minSize,
          negColor,
          posColor,
          summaryScoreMode,
          scaleType,
          rendererTypeName,
        } = self
        const configBlob = getConf(self, ['renderers', rendererTypeName]) || {}
        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            ...(scaleType ? { scaleType } : {}),
            ...(fill !== undefined ? { filled: fill } : {}),
            ...(displayCrossHatches !== undefined
              ? { displayCrossHatches }
              : {}),
            ...(summaryScoreMode !== undefined ? { summaryScoreMode } : {}),
            ...(color !== undefined ? { color } : {}),
            ...(negColor !== undefined ? { negColor } : {}),
            ...(posColor !== undefined ? { posColor } : {}),
            ...(minSize !== undefined ? { minSize } : {}),
          },
          getEnv(self),
        )
      },
    }))
    .views(self => {
      let oldDomain: [number, number] = [0, 0]
      return {
        /**
         * #getter
         */
        get filled() {
          return readConfObject(self.rendererConfig, 'filled')
        },
        /**
         * #getter
         */
        get summaryScoreModeSetting() {
          return readConfObject(self.rendererConfig, 'summaryScoreMode')
        },
        /**
         * #getter
         */
        get domain() {
          const { stats, scaleType, minScore, maxScore } = self
          if (!stats) {
            return undefined
          }

          const ret = getNiceDomain({
            domain: [stats.scoreMin, stats.scoreMax],
            bounds: [minScore, maxScore],
            scaleType,
          })

          // avoid weird scalebar if log value and empty region displayed
          if (scaleType === 'log' && ret[1] === Number.MIN_VALUE) {
            return [0, Number.MIN_VALUE]
          }

          // avoid returning a new object if it matches the old value
          if (JSON.stringify(oldDomain) !== JSON.stringify(ret)) {
            oldDomain = ret
          }

          return oldDomain
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
        get scaleOpts() {
          return {
            domain: this.domain,
            stats: self.stats,
            autoscaleType: this.autoscaleType,
            scaleType: self.scaleType,
            inverted: getConf(self, 'inverted'),
          }
        },

        /**
         * #getter
         */
        get canHaveFill() {
          return self.rendererTypeName === 'XYPlotRenderer'
        },

        /**
         * #getter
         */
        get autoscaleType() {
          return self.autoscale ?? getConf(self, 'autoscale')
        },

        /**
         * #getter
         */
        get displayCrossHatchesSetting() {
          return (
            self.displayCrossHatches ??
            readConfObject(self.rendererConfig, 'displayCrossHatches')
          )
        },
      }
    })
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
          scaleType,
          domain,
          range,
          inverted,
        })
        const ticks = axisPropsFromTickScale(scale, 4)
        return height < 100 || minimalTicks
          ? { ...ticks, values: domain }
          : ticks
      },

      /**
       * #getter
       */
      get adapterCapabilities() {
        const type = self.adapterTypeName
        return pluginManager.getAdapterType(type).adapterCapabilities
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          const superProps = superRenderProps()
          const { filters, ticks, height, resolution, scaleOpts } = self
          return {
            ...superProps,
            notReady: superProps.notReady || !self.stats,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            config: self.rendererConfig,
            displayCrossHatches: self.displayCrossHatchesSetting,
            scaleOpts,
            resolution,
            height,
            ticks,
            filters,
          }
        },
        /**
         * #getter
         */
        get hasResolution() {
          return self.adapterCapabilities.includes('hasResolution')
        },

        /**
         * #getter
         */
        get hasGlobalStats() {
          return self.adapterCapabilities.includes('hasGlobalStats')
        },

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
              label: 'score',
              subMenu: [
                ...(self.hasResolution
                  ? [
                      {
                        label: 'Resolution',
                        subMenu: [
                          {
                            label: 'Finer resolution',
                            onClick: () =>
                              self.setResolution(self.resolution * 5),
                          },
                          {
                            label: 'Coarser resolution',
                            onClick: () =>
                              self.setResolution(self.resolution / 5),
                          },
                        ],
                      },
                      {
                        label: 'Summary score mode',
                        subMenu: ['min', 'max', 'avg', 'whiskers'].map(elt => ({
                          label: elt,
                          type: 'radio',
                          checked: self.summaryScoreModeSetting === elt,
                          onClick: () => self.setSummaryScoreMode(elt),
                        })),
                      },
                    ]
                  : []),
                {
                  label:
                    self.scaleType === 'log'
                      ? 'Set linear scale'
                      : 'Set log scale',
                  onClick: () => self.toggleLogScale(),
                },
                {
                  label: 'Autoscale type',
                  subMenu: [
                    ['local', 'Local'],
                    ...(self.hasGlobalStats
                      ? [
                          ['global', 'Global'],
                          ['globalsd', 'Global ± 3σ'],
                        ]
                      : []),
                    ['localsd', 'Local ± 3σ'],
                  ].map(([val, label]) => ({
                    label,
                    type: 'radio',
                    checked: self.autoscaleType === val,
                    onClick: () => self.setAutoscale(val),
                  })),
                },
                {
                  label: 'Set min/max score',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      SetMinMaxDlg,
                      { model: self, handleClose },
                    ])
                  },
                },
              ],
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
                        onClick: () => self.setFill(idx),
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
                    onClick: () => self.toggleCrossHatches(),
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
                      onClick: () => self.setRendererType(key),
                    })),
                  },
                ]
              : []),

            {
              label: 'Set color',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetColorDlg,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },
      }
    })
    .actions(self => {
      const { reload: superReload, renderSvg: superRenderSvg } = self

      type ExportSvgOpts = Parameters<typeof superRenderSvg>[0]

      return {
        /**
         * #action
         * re-runs stats and refresh whole display on reload
         */
        async reload() {
          self.setError()
          superReload()
        },

        afterAttach() {
          quantitativeStatsAutorun(self)
        },
        /**
         * #action
         */
        async renderSvg(opts: ExportSvgOpts) {
          const { renderSvg } = await import('./renderSvg')
          return renderSvg(self, opts, superRenderSvg)
        },
      }
    })
}

export type WiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WiggleDisplayModel = Instance<WiggleDisplayStateModel>

export default stateModelFactory

import React, { lazy } from 'react'
import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  getEnv,
  getSession,
  getContainingView,
  isSelectionContainer,
  Feature,
} from '@jbrowse/core/util'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'
import { isAlive, types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

import { axisPropsFromTickScale } from 'react-d3-axis-mod'
import {
  getNiceDomain,
  getScale,
  getStats,
  statsAutorun,
  YSCALEBAR_LABEL_OFFSET,
} from '../../util'

import Tooltip from '../components/Tooltip'
import YScaleBar from '../../shared/YScaleBar'

const SetMinMaxDlg = lazy(() => import('../../shared/SetMinMaxDialog'))
const SetColorDlg = lazy(() => import('../components/SetColorDialog'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
  ['line', 'LinePlotRenderer'],
])

type LGV = LinearGenomeViewModel

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
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearWiggleDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        selectedRendering: types.optional(types.string, ''),
        /**
         * #property
         */
        resolution: types.optional(types.number, 1),
        /**
         * #property
         */
        fill: types.maybe(types.boolean),
        /**
         * #property
         */
        minSize: types.maybe(types.number),
        /**
         * #property
         */
        color: types.maybe(types.string),
        /**
         * #property
         */
        posColor: types.maybe(types.string),
        /**
         * #property
         */
        negColor: types.maybe(types.string),
        /**
         * #property
         */
        summaryScoreMode: types.maybe(types.string),
        /**
         * #property
         */
        rendererTypeNameState: types.maybe(types.string),
        /**
         * #property
         */
        scale: types.maybe(types.string),
        /**
         * #property
         */
        autoscale: types.maybe(types.string),
        /**
         * #property
         */
        displayCrossHatches: types.maybe(types.boolean),
        /**
         * #property
         */
        constraints: types.optional(
          types.model({
            max: types.maybe(types.number),
            min: types.maybe(types.number),
          }),
          {},
        ),
      }),
    )
    .volatile(() => ({
      message: undefined as undefined | string,
      stats: undefined as { scoreMin: number; scoreMax: number } | undefined,
      statsFetchInProgress: undefined as undefined | AbortController,
    }))
    .actions(self => ({
      /**
       * #action
       */
      updateStats(stats: { scoreMin: number; scoreMax: number }) {
        const { scoreMin, scoreMax } = stats
        const EPSILON = 0.000001
        if (!self.stats) {
          self.stats = { scoreMin, scoreMax }
        } else if (
          Math.abs(self.stats.scoreMax - scoreMax) > EPSILON ||
          Math.abs(self.stats.scoreMin - scoreMin) > EPSILON
        ) {
          self.stats = { scoreMin, scoreMax }
        }
      },
      /**
       * #action
       */
      setColor(color?: string) {
        self.color = color
      },
      /**
       * #action
       */
      setPosColor(color?: string) {
        self.posColor = color
      },
      /**
       * #action
       */
      setNegColor(color?: string) {
        self.negColor = color
      },

      /**
       * #action
       */
      setLoading(aborter: AbortController) {
        const { statsFetchInProgress: statsFetch } = self
        if (statsFetch !== undefined && !statsFetch.signal.aborted) {
          statsFetch.abort()
        }
        self.statsFetchInProgress = aborter
      },

      /**
       * #action
       * this overrides the BaseLinearDisplayModel to avoid popping up a
       * feature detail display, but still sets the feature selection on the
       * model so listeners can detect a click
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },

      /**
       * #action
       */
      setResolution(res: number) {
        self.resolution = res
      },

      /**
       * #action
       */
      setFill(fill: number) {
        if (fill === 0) {
          self.fill = true
          self.minSize = 0
        } else if (fill === 1) {
          self.fill = false
          self.minSize = 1
        } else if (fill === 2) {
          self.fill = false
          self.minSize = 2
        }
      },

      /**
       * #action
       */
      toggleLogScale() {
        self.scale = self.scale === 'log' ? 'linear' : 'log'
      },

      /**
       * #action
       */
      setScaleType(scale?: string) {
        self.scale = scale
      },

      /**
       * #action
       */
      setSummaryScoreMode(val: string) {
        self.summaryScoreMode = val
      },

      /**
       * #action
       */
      setAutoscale(val: string) {
        self.autoscale = val
      },

      /**
       * #action
       */
      setMaxScore(val?: number) {
        self.constraints.max = val
      },

      /**
       * #action
       */
      setRendererType(val: string) {
        self.rendererTypeNameState = val
      },

      /**
       * #action
       */
      setMinScore(val?: number) {
        self.constraints.min = val
      },

      /**
       * #action
       */
      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
      },

      /**
       * #action
       */
      setCrossHatches(cross: boolean) {
        self.displayCrossHatches = cross
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get TooltipComponent() {
        return Tooltip as unknown as React.FC
      },

      /**
       * #getter
       */
      get adapterTypeName() {
        return self.adapterConfig.type
      },

      /**
       * #getter
       */
      get rendererTypeNameSimple() {
        return self.rendererTypeNameState || getConf(self, 'defaultRendering')
      },

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
       * subclasses can define these, as snpcoverage track does
       */
      get filters() {
        return undefined
      },

      /**
       * #getter
       */
      get scaleType() {
        return self.scale || getConf(self, 'scaleType')
      },

      /**
       * #getter
       */
      get maxScore() {
        return self.constraints.max ?? getConf(self, 'maxScore')
      },

      /**
       * #getter
       */
      get minScore() {
        return self.constraints.min ?? getConf(self, 'minScore')
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const configBlob =
          getConf(self, ['renderers', self.rendererTypeName]) || {}

        const {
          color,
          displayCrossHatches,
          fill,
          minSize,
          negColor,
          posColor,
          summaryScoreMode,
          scaleType,
        } = self

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
          const { fill, rendererConfig: conf } = self
          return fill ?? readConfObject(conf, 'filled')
        },
        /**
         * #getter
         */
        get summaryScoreModeSetting() {
          const { summaryScoreMode, rendererConfig: conf } = self
          return summaryScoreMode ?? readConfObject(conf, 'summaryScoreMode')
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
          const { displayCrossHatches: hatches, rendererConfig: conf } = self
          return hatches ?? readConfObject(conf, 'displayCrossHatches')
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
            ...(self.hasResolution
              ? [
                  {
                    label: 'Resolution',
                    subMenu: [
                      {
                        label: 'Finer resolution',
                        onClick: () => self.setResolution(self.resolution * 5),
                      },
                      {
                        label: 'Coarser resolution',
                        onClick: () => self.setResolution(self.resolution / 5),
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
            {
              label:
                self.scaleType === 'log' ? 'Set linear scale' : 'Set log scale',
              onClick: () => self.toggleLogScale(),
            },

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
          const aborter = new AbortController()
          self.setLoading(aborter)
          try {
            const stats = await getStats(self, {
              signal: aborter.signal,
              ...self.renderProps(),
            })
            if (isAlive(self)) {
              self.updateStats(stats)
              superReload()
            }
          } catch (e) {
            self.setError(e)
          }
        },
        afterAttach() {
          statsAutorun(self)
        },
        /**
         * #action
         */
        async renderSvg(opts: ExportSvgOpts) {
          await when(() => !!self.stats && !!self.regionCannotBeRenderedText)
          const { needsScalebar, stats } = self
          const { offsetPx } = getContainingView(self) as LGV
          return (
            <>
              <g id="snpcov">{await superRenderSvg(opts)}</g>
              {needsScalebar && stats ? (
                <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
                  <YScaleBar
                    model={self as WiggleDisplayModel}
                    orientation="left"
                  />
                </g>
              ) : null}
            </>
          )
        },
      }
    })
}

export type WiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WiggleDisplayModel = Instance<WiggleDisplayStateModel>

export default stateModelFactory

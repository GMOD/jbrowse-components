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
} from '@jbrowse/core/util'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'
import { isAlive, types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

import { Feature } from '@jbrowse/core/util/simpleFeature'
import { axisPropsFromTickScale } from 'react-d3-axis-mod'
import {
  getNiceDomain,
  getScale,
  getStats,
  statsAutorun,
  YSCALEBAR_LABEL_OFFSET,
} from '../../util'

import Tooltip from '../components/Tooltip'
import { YScaleBar } from '../components/WiggleDisplayComponent'

const SetMinMaxDlg = lazy(() => import('../components/SetMinMaxDialog'))
const SetColorDlg = lazy(() => import('../components/SetColorDialog'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
  ['line', 'LinePlotRenderer'],
])

type LGV = LinearGenomeViewModel

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) =>
  types
    .compose(
      'LinearWiggleDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        selectedRendering: types.optional(types.string, ''),
        resolution: types.optional(types.number, 1),
        fill: types.maybe(types.boolean),
        minSize: types.maybe(types.number),
        color: types.maybe(types.string),
        posColor: types.maybe(types.string),
        negColor: types.maybe(types.string),
        summaryScoreMode: types.maybe(types.string),
        rendererTypeNameState: types.maybe(types.string),
        scale: types.maybe(types.string),
        autoscale: types.maybe(types.string),
        displayCrossHatches: types.maybe(types.boolean),
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
      statsReady: false,
      message: undefined as undefined | string,
      stats: { scoreMin: 0, scoreMax: 50 },
      statsFetchInProgress: undefined as undefined | AbortController,
    }))
    .actions(self => ({
      updateStats(stats: { scoreMin: number; scoreMax: number }) {
        const { scoreMin, scoreMax } = stats
        const EPSILON = 0.000001
        if (
          Math.abs(self.stats.scoreMax - scoreMax) > EPSILON ||
          Math.abs(self.stats.scoreMin - scoreMin) > EPSILON
        ) {
          self.stats = { scoreMin, scoreMax }
          self.statsReady = true
        }
      },
      setColor(color?: string) {
        self.color = color
      },
      setPosColor(color?: string) {
        self.posColor = color
      },
      setNegColor(color?: string) {
        self.negColor = color
      },

      setLoading(aborter: AbortController) {
        const { statsFetchInProgress: statsFetch } = self
        if (statsFetch !== undefined && !statsFetch.signal.aborted) {
          statsFetch.abort()
        }
        self.statsFetchInProgress = aborter
      },

      // this overrides the BaseLinearDisplayModel to avoid popping up a
      // feature detail display, but still sets the feature selection on the
      // model so listeners can detect a click
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },
      setResolution(res: number) {
        self.resolution = res
      },

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

      toggleLogScale() {
        if (self.scale !== 'log') {
          self.scale = 'log'
        } else {
          self.scale = 'linear'
        }
      },

      setScaleType(scale?: string) {
        self.scale = scale
      },

      setSummaryScoreMode(val: string) {
        self.summaryScoreMode = val
      },

      setAutoscale(val: string) {
        self.autoscale = val
      },

      setMaxScore(val?: number) {
        self.constraints.max = val
      },

      setRendererType(val: string) {
        self.rendererTypeNameState = val
      },

      setMinScore(val?: number) {
        self.constraints.min = val
      },

      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
      },

      setCrossHatches(cross: boolean) {
        self.displayCrossHatches = cross
      },
    }))
    .views(self => ({
      get TooltipComponent() {
        return Tooltip as unknown as React.FC
      },

      get adapterTypeName() {
        return self.adapterConfig.type
      },

      get rendererTypeNameSimple() {
        return self.rendererTypeNameState || getConf(self, 'defaultRendering')
      },

      get rendererTypeName() {
        const name = this.rendererTypeNameSimple
        const rendererType = rendererTypes.get(name)
        if (!rendererType) {
          throw new Error(`unknown renderer ${name}`)
        }
        return rendererType
      },

      // subclasses can define these, as snpcoverage track does
      get filters() {
        return undefined
      },

      get scaleType() {
        return self.scale || getConf(self, 'scaleType')
      },

      get maxScore() {
        return self.constraints.max ?? getConf(self, 'maxScore')
      },

      get minScore() {
        return self.constraints.min ?? getConf(self, 'minScore')
      },
    }))
    .views(self => ({
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
        get filled() {
          const { fill, rendererConfig: conf } = self
          return fill ?? readConfObject(conf, 'filled')
        },
        get summaryScoreModeSetting() {
          const { summaryScoreMode, rendererConfig: conf } = self
          return summaryScoreMode ?? readConfObject(conf, 'summaryScoreMode')
        },
        get domain() {
          const { stats, scaleType, minScore, maxScore } = self

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

        get needsScalebar() {
          return (
            self.rendererTypeName === 'XYPlotRenderer' ||
            self.rendererTypeName === 'LinePlotRenderer'
          )
        },
        get scaleOpts() {
          return {
            domain: this.domain,
            stats: self.stats,
            autoscaleType: this.autoscaleType,
            scaleType: self.scaleType,
            inverted: getConf(self, 'inverted'),
          }
        },

        get canHaveFill() {
          return self.rendererTypeName === 'XYPlotRenderer'
        },

        get autoscaleType() {
          return self.autoscale ?? getConf(self, 'autoscale')
        },

        get displayCrossHatchesSetting() {
          const { displayCrossHatches: hatches, rendererConfig: conf } = self
          return hatches ?? readConfObject(conf, 'displayCrossHatches')
        },
      }
    })
    .views(self => ({
      get ticks() {
        const { scaleType, domain, height } = self
        const minimalTicks = getConf(self, 'minimalTicks')
        const inverted = getConf(self, 'inverted')
        const range = [height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET]
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

      get adapterCapabilities() {
        return pluginManager.getAdapterType(self.adapterTypeName)
          .adapterCapabilities
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        renderProps() {
          const superProps = superRenderProps()
          const { filters, ticks, height, resolution, scaleOpts } = self
          return {
            ...superProps,
            notReady: superProps.notReady || !self.statsReady,
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
        get hasResolution() {
          return self.adapterCapabilities.includes('hasResolution')
        },

        get hasGlobalStats() {
          return self.adapterCapabilities.includes('hasGlobalStats')
        },

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
        // re-runs stats and refresh whole display on reload
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
        async renderSvg(opts: ExportSvgOpts) {
          await when(() => self.statsReady && !!self.regionCannotBeRenderedText)
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

export type WiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WiggleDisplayModel = Instance<WiggleDisplayStateModel>

export default stateModelFactory

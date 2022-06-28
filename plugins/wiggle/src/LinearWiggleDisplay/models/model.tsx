import React, { lazy } from 'react'
import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  isAbortException,
  getSession,
  getContainingView,
  isSelectionContainer,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun, when } from 'mobx'
import { addDisposer, isAlive, types, getEnv, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

import { FeatureStats } from '@jbrowse/core/util/stats'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { axisPropsFromTickScale } from 'react-d3-axis-mod'
import { getNiceDomain, getScale } from '../../util'

import Tooltip from '../components/Tooltip'
import { YScaleBar } from '../components/WiggleDisplayComponent'

const SetMinMaxDlg = lazy(() => import('../components/SetMinMaxDialog'))
const SetColorDlg = lazy(() => import('../components/SetColorDialog'))

// fudge factor for making all labels on the YScalebar visible
export const YSCALEBAR_LABEL_OFFSET = 5

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
      updateStats({
        scoreMin,
        scoreMax,
      }: {
        scoreMin: number
        scoreMax: number
      }) {
        if (
          self.stats.scoreMin !== scoreMin ||
          self.stats.scoreMax !== scoreMax
        ) {
          self.stats = { scoreMin, scoreMax }
        }
        self.statsReady = true
      },
      setColor(color: string) {
        self.color = color
      },
      setPosColor(color: string) {
        self.posColor = color
      },
      setNegColor(color: string) {
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

      setFill(fill: boolean) {
        self.fill = fill
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

      get rendererTypeName() {
        const viewName =
          self.rendererTypeNameState || getConf(self, 'defaultRendering')
        const rendererType = rendererTypes.get(viewName)
        if (!rendererType) {
          throw new Error(`unknown alignments view name ${viewName}`)
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
        const { max } = self.constraints
        return max ?? getConf(self, 'maxScore')
      },

      get minScore() {
        const { min } = self.constraints
        return min ?? getConf(self, 'minScore')
      },
    }))
    .views(self => ({
      get rendererConfig() {
        const configBlob =
          getConf(self, ['renderers', self.rendererTypeName]) || {}

        const {
          color,
          posColor,
          negColor,
          summaryScoreMode,
          scaleType,
          displayCrossHatches,
          fill,
        } = self

        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            ...(scaleType ? { scaleType } : {}),
            ...(fill ? { filled: fill } : {}),
            ...(displayCrossHatches ? { displayCrossHatches } : {}),
            ...(summaryScoreMode ? { summaryScoreMode } : {}),
            ...(color ? { color } : {}),
            ...(negColor ? { negColor } : {}),
            ...(posColor ? { posColor } : {}),
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
        const range = [height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET]
        const scale = getScale({
          scaleType,
          domain,
          range,
          inverted: getConf(self, 'inverted'),
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

        get adapterCapabilities() {
          return pluginManager.getAdapterType(self.adapterTypeName)
            .adapterCapabilities
        },

        get hasResolution() {
          return this.adapterCapabilities.includes('hasResolution')
        },

        get hasGlobalStats() {
          return this.adapterCapabilities.includes('hasGlobalStats')
        },
      }
    })
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      console.log(getConf(self, 'renderers'))
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
                    subMenu: ['min', 'max', 'avg', 'whiskers'].map(elt => {
                      return {
                        label: elt,
                        onClick: () => self.setSummaryScoreMode(elt),
                      }
                    }),
                  },
                ]
              : []),
            ...(self.canHaveFill
              ? [
                  {
                    label: self.filled
                      ? 'Turn off histogram fill'
                      : 'Turn on histogram fill',
                    onClick: () => self.setFill(!self.filled),
                  },
                ]
              : []),
            {
              label:
                self.scaleType === 'log' ? 'Set linear scale' : 'Set log scale',
              onClick: () => self.toggleLogScale(),
            },
            {
              type: 'checkbox',
              label: 'Draw cross hatches',
              checked: self.displayCrossHatchesSetting,
              onClick: () => self.toggleCrossHatches(),
            },
            {
              label: 'Renderer type',
              subMenu: ['xyplot', 'density', 'line'].map(key => ({
                label: key,
                onClick: () => self.setRendererType(key),
              })),
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

      async function getStats(opts: {
        headers?: Record<string, string>
        signal?: AbortSignal
        filters?: string[]
      }): Promise<FeatureStats> {
        const { rpcManager } = getSession(self)
        const nd = getConf(self, 'numStdDev') || 3
        const { adapterConfig, autoscaleType } = self
        const sessionId = getRpcSessionId(self)
        const params = {
          sessionId,
          adapterConfig,
          statusCallback: (message: string) => {
            if (isAlive(self)) {
              self.setMessage(message)
            }
          },
          ...opts,
        }

        if (autoscaleType === 'global' || autoscaleType === 'globalsd') {
          const results: FeatureStats = (await rpcManager.call(
            sessionId,
            'WiggleGetGlobalStats',
            params,
          )) as FeatureStats
          const { scoreMin, scoreMean, scoreStdDev } = results
          // globalsd uses heuristic to avoid unnecessary scoreMin<0
          // if the scoreMin is never less than 0
          // helps with most coverage bigwigs just being >0
          return autoscaleType === 'globalsd'
            ? {
                ...results,
                scoreMin: scoreMin >= 0 ? 0 : scoreMean - nd * scoreStdDev,
                scoreMax: scoreMean + nd * scoreStdDev,
              }
            : results
        }
        if (autoscaleType === 'local' || autoscaleType === 'localsd') {
          const { dynamicBlocks, bpPerPx } = getContainingView(self) as LGV
          const results = (await rpcManager.call(
            sessionId,
            'WiggleGetMultiRegionStats',
            {
              ...params,
              regions: dynamicBlocks.contentBlocks.map(region => {
                const { start, end } = region
                return {
                  ...JSON.parse(JSON.stringify(region)),
                  start: Math.floor(start),
                  end: Math.ceil(end),
                }
              }),
              bpPerPx,
            },
          )) as FeatureStats
          const { scoreMin, scoreMean, scoreStdDev } = results

          // localsd uses heuristic to avoid unnecessary scoreMin<0 if the
          // scoreMin is never less than 0 helps with most coverage bigwigs
          // just being >0
          return autoscaleType === 'localsd'
            ? {
                ...results,
                scoreMin: scoreMin >= 0 ? 0 : scoreMean - nd * scoreStdDev,
                scoreMax: scoreMean + nd * scoreStdDev,
              }
            : results
        }
        if (autoscaleType === 'zscale') {
          return rpcManager.call(
            sessionId,
            'WiggleGetGlobalStats',
            params,
          ) as Promise<FeatureStats>
        }
        throw new Error(`invalid autoscaleType '${autoscaleType}'`)
      }
      return {
        // re-runs stats and refresh whole display on reload
        async reload() {
          self.setError()
          const aborter = new AbortController()
          let stats
          try {
            stats = await getStats({
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
          addDisposer(
            self,
            autorun(
              async () => {
                try {
                  const aborter = new AbortController()
                  const view = getContainingView(self) as LGV
                  self.setLoading(aborter)

                  if (!view.initialized) {
                    return
                  }

                  if (!self.estimatedStatsReady) {
                    return
                  }
                  if (self.regionTooLarge) {
                    return
                  }

                  const wiggleStats = await getStats({
                    signal: aborter.signal,
                    ...self.renderProps(),
                  })

                  if (isAlive(self)) {
                    self.updateStats(wiggleStats)
                  }
                } catch (e) {
                  if (!isAbortException(e) && isAlive(self)) {
                    console.error(e)
                    self.setError(e)
                  }
                }
              },
              { delay: 1000 },
            ),
          )
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

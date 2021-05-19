import React, { lazy } from 'react'
import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  isAbortException,
  getSession,
  getContainingView,
  isSelectionContainer,
} from '@jbrowse/core/util'
import {
  getParentRenderProps,
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun, observable, when } from 'mobx'
import { addDisposer, isAlive, types, getEnv, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { FeatureStats } from '@jbrowse/core/util/stats'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { axisPropsFromTickScale } from 'react-d3-axis'
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

function logb(x: number, y: number) {
  return Math.log(y) / Math.log(x)
}
function round(v: number, b = 1.5) {
  return (v >= 0 ? 1 : -1) * Math.pow(b, 1 + Math.floor(logb(b, Math.abs(v))))
}

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
      ready: false,
      message: undefined as undefined | string,
      stats: observable({ scoreMin: 0, scoreMax: 50 }),
      statsFetchInProgress: undefined as undefined | AbortController,
    }))
    .actions(self => ({
      updateStats(stats: { scoreMin: number; scoreMax: number }) {
        self.stats.scoreMin = stats.scoreMin
        self.stats.scoreMax = stats.scoreMax
        self.ready = true
      },
      setColor(color: string) {
        self.color = color
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
      get TooltipComponent(): React.FC {
        return (Tooltip as unknown) as React.FC
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
      get filled() {
        return typeof self.fill !== 'undefined'
          ? self.fill
          : readConfObject(this.rendererConfig, 'filled')
      },

      get maxScore() {
        const { max } = self.constraints
        return max !== undefined ? max : getConf(self, 'maxScore')
      },

      get minScore() {
        const { min } = self.constraints
        return min !== undefined ? min : getConf(self, 'minScore')
      },

      get rendererConfig() {
        const configBlob =
          getConf(self, ['renderers', this.rendererTypeName]) || {}

        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            filled: self.fill,
            scaleType: this.scaleType,
            displayCrossHatches: self.displayCrossHatches,
            summaryScoreMode: self.summaryScoreMode,
            color: self.color,
          },
          getEnv(self),
        )
      },
    }))
    .views(self => {
      let oldDomain: [number, number] = [0, 0]
      return {
        get summaryScoreModeSetting() {
          return (
            self.summaryScoreMode ||
            readConfObject(self.rendererConfig, 'summaryScoreMode')
          )
        },
        get domain() {
          const { stats, scaleType, minScore, maxScore } = self

          const ret = getNiceDomain({
            domain: [stats.scoreMin, stats.scoreMax],
            bounds: [minScore, maxScore],
            scaleType,
          })
          const headroom = getConf(self, 'headroom') || 0

          // avoid weird scalebar if log value and empty region displayed
          if (scaleType === 'log' && ret[1] === Number.MIN_VALUE) {
            return [0, Number.MIN_VALUE]
          }

          // heuristic to just give some extra headroom on bigwig scores if no
          // maxScore/minScore specified (they have MAX_VALUE/MIN_VALUE if so)
          if (maxScore === Number.MAX_VALUE && ret[1] > 1.0) {
            ret[1] = round(ret[1] + headroom)
          }
          if (minScore === Number.MIN_VALUE && ret[0] < -1.0) {
            ret[0] = round(ret[0] - headroom)
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
          return self.autoscale || getConf(self, 'autoscale')
        },

        get displayCrossHatchesSetting() {
          return (
            self.displayCrossHatches ||
            readConfObject(self.rendererConfig, 'displayCrossHatches')
          )
        },
      }
    })
    .views(self => {
      const { trackMenuItems } = self
      return {
        get ticks() {
          const { scaleType, domain, height } = self
          const range = [
            height - YSCALEBAR_LABEL_OFFSET,
            YSCALEBAR_LABEL_OFFSET,
          ]
          const scale = getScale({
            scaleType,
            domain,
            range,
            inverted: getConf(self, 'inverted'),
          })
          const ticks = height < 50 ? 2 : 4
          return axisPropsFromTickScale(scale, ticks)
        },
        get renderProps() {
          return {
            ...self.composedRenderProps,
            ...getParentRenderProps(self),
            notReady: !self.ready,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            config: self.rendererConfig,
            scaleOpts: self.scaleOpts,
            resolution: self.resolution,
            height: self.height,
            ticks: this.ticks,
            displayCrossHatches: self.displayCrossHatches,
            filters: self.filters,
          }
        },

        get adapterCapabilities() {
          const { adapterCapabilities } = pluginManager.getAdapterType(
            self.adapterTypeName,
          )
          return adapterCapabilities
        },

        get hasResolution() {
          return this.adapterCapabilities.includes('hasResolution')
        },

        get hasGlobalStats() {
          return this.adapterCapabilities.includes('hasGlobalStats')
        },

        get composedTrackMenuItems() {
          return [
            ...(this.hasResolution
              ? [
                  {
                    label: 'Resolution',
                    subMenu: [
                      {
                        label: 'Finer resolution',
                        onClick: () => {
                          self.setResolution(self.resolution * 5)
                        },
                      },
                      {
                        label: 'Coarser resolution',
                        onClick: () => {
                          self.setResolution(self.resolution / 5)
                        },
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
                    onClick: () => {
                      self.setFill(!self.filled)
                    },
                  },
                ]
              : []),
            {
              label:
                self.scaleType === 'log' ? 'Set linear scale' : 'Set log scale',
              onClick: () => {
                self.toggleLogScale()
              },
            },
            {
              type: 'checkbox',
              label: 'Draw cross hatches',
              checked: self.displayCrossHatchesSetting,
              onClick: () => {
                self.toggleCrossHatches()
              },
            },

            ...(Object.keys(getConf(self, 'renderers') || {}).length > 1
              ? [
                  {
                    label: 'Renderer type',
                    subMenu: [...rendererTypes.keys()].map(key => ({
                      label: key,
                      onClick: () => self.setRendererType(key),
                    })),
                  },
                ]
              : []),
            {
              label: 'Autoscale type',
              subMenu: [
                ['local', 'Local'],
                ...(this.hasGlobalStats
                  ? [
                      ['global', 'Global'],
                      ['globalsd', 'Global ± 3σ'],
                    ]
                  : []),
                ['localsd', 'Local ± 3σ'],
              ].map(([val, label]) => {
                return {
                  label,
                  onClick() {
                    self.setAutoscale(val)
                  },
                }
              }),
            },
            {
              label: 'Set min/max score',
              onClick: () => {
                getSession(self).setDialogComponent(SetMinMaxDlg, {
                  model: self,
                })
              },
            },
            {
              label: 'Set color',
              onClick: () => {
                getSession(self).setDialogComponent(SetColorDlg, {
                  model: self,
                })
              },
            },
          ]
        },

        get trackMenuItems() {
          return [...trackMenuItems, ...this.composedTrackMenuItems]
        },
      }
    })
    .actions(self => {
      const superReload = self.reload
      const superRenderSvg = self.renderSvg

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
              assemblyName: getTrackAssemblyNames(self.parentTrack)[0],
              regions: JSON.parse(
                JSON.stringify(
                  dynamicBlocks.contentBlocks.map(region => {
                    const { start, end } = region
                    return {
                      ...region,
                      start: Math.floor(start),
                      end: Math.ceil(end),
                    }
                  }),
                ),
              ),
              bpPerPx,
            },
          )) as FeatureStats
          const { scoreMin, scoreMean, scoreStdDev } = results

          // localsd uses heuristic to avoid unnecessary scoreMin<0
          // if the scoreMin is never less than 0
          // helps with most coverage bigwigs just being >0
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
          const stats = await getStats({
            signal: aborter.signal,
            filters: self.filters,
          })
          if (isAlive(self)) {
            self.updateStats(stats)
            superReload()
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

                  if (view.bpPerPx > self.maxViewBpPerPx) {
                    return
                  }

                  const stats = await getStats({
                    signal: aborter.signal,
                    filters: self.filters,
                  })

                  if (isAlive(self)) {
                    self.updateStats(stats)
                  }
                } catch (e) {
                  if (!isAbortException(e) && isAlive(self)) {
                    self.setError(e)
                  }
                }
              },
              { delay: 1000 },
            ),
          )
        },
        async renderSvg(opts: ExportSvgOpts) {
          await when(() => self.ready && !!self.regionCannotBeRenderedText)
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

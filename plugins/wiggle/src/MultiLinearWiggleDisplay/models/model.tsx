import React, { lazy } from 'react'
import { addDisposer, isAlive, types, Instance } from 'mobx-state-tree'
import { autorun, when } from 'mobx'
import { axisPropsFromTickScale } from 'react-d3-axis-mod'
import deepEqual from 'fast-deep-equal'

// jbrowse imports
import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  getSession,
  getEnv,
  getContainingView,
  isSelectionContainer,
  Feature,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { set1 as colors } from '@jbrowse/core/ui/colors'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// locals
import {
  getNiceDomain,
  getScale,
  getStats,
  statsAutorun,
  YSCALEBAR_LABEL_OFFSET,
} from '../../util'

import Tooltip from '../components/Tooltip'
import { StatBars } from '../components/WiggleDisplayComponent'

const randomColor = () =>
  '#000000'.replace(/0/g, () => (~~(Math.random() * 16)).toString(16))

// lazt components
const SetMinMaxDlg = lazy(() => import('../components/SetMinMaxDialog'))
const SetColorDlg = lazy(() => import('../components/SetColorDialog'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'MultiXYPlotRenderer'],
  ['multirowxy', 'MultiRowXYPlotRenderer'],
  ['multirowdensity', 'MultiDensityRenderer'],
  ['multiline', 'MultiLineRenderer'],
  ['multirowline', 'MultiRowLineRenderer'],
])

type LGV = LinearGenomeViewModel

interface Source {
  name: string
  color?: string
  group?: string
}

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) =>
  types
    .compose(
      'MultiLinearWiggleDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('MultiLinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        selectedRendering: types.optional(types.string, ''),
        resolution: types.optional(types.number, 1),
        fill: types.maybe(types.boolean),
        minSize: types.maybe(types.number),
        height: 200,
        color: types.maybe(types.string),
        posColor: types.maybe(types.string),
        negColor: types.maybe(types.string),
        summaryScoreMode: types.maybe(types.string),
        rendererTypeNameState: types.maybe(types.string),
        scale: types.maybe(types.string),
        autoscale: types.maybe(types.string),
        displayCrossHatches: types.maybe(types.boolean),
        layout: types.optional(types.frozen<Source[]>(), []),
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
      statsRegion: undefined as string | undefined,
      statsFetchInProgress: undefined as undefined | AbortController,
      featureUnderMouseVolatile: undefined as Feature | undefined,
      sourcesVolatile: undefined as Source[] | undefined,
    }))
    .actions(self => ({
      setLayout(layout: Source[]) {
        self.layout = layout
      },
      clearLayout() {
        self.layout = []
      },
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
      setSources(sources: Source[]) {
        if (!deepEqual(sources, self.sourcesVolatile)) {
          self.sourcesVolatile = sources
        }
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

      setFeatureUnderMouse(f?: Feature) {
        self.featureUnderMouseVolatile = f
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
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
      },
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
        return self.scale ?? (getConf(self, 'scaleType') as string)
      },

      get maxScore() {
        return self.constraints.max ?? (getConf(self, 'maxScore') as number)
      },

      get minScore() {
        return self.constraints.min ?? (getConf(self, 'minScore') as number)
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
    .views(self => ({
      // everything except density gets a numerical scalebar
      get needsScalebar() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer' ||
          self.rendererTypeName === 'MultiLineRenderer' ||
          self.rendererTypeName === 'MultiRowLineRenderer'
        )
      },

      get needsFullHeightScalebar() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiLineRenderer'
        )
      },

      get isMultiRow() {
        return (
          self.rendererTypeName === 'MultiRowXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowLineRenderer' ||
          self.rendererTypeName === 'MultiDensityRenderer'
        )
      },

      // can be used to give it a "color scale" like a R heatmap, not
      // implemented like this yet but flag can be used for this
      get needsCustomLegend() {
        return self.rendererTypeName === 'MultiDensityRenderer'
      },

      get canHaveFill() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer'
        )
      },

      // the multirowxy and multiline don't need to use colors on the legend
      // boxes since their track is drawn with the color. sort of a stylistic choice
      get renderColorBoxes() {
        return !(
          self.rendererTypeName === 'MultiRowLineRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer'
        )
      },

      // positions multi-row below the tracklabel even if using overlap
      // tracklabels for everything else
      get prefersOffset() {
        return this.isMultiRow
      },

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
            color:
              s.color ||
              (!this.isMultiRow ? colors[i] || randomColor() : 'blue'),
          }))
      },
    }))

    .views(self => {
      let oldDomain: [number, number] = [0, 0]
      return {
        get filled(): boolean {
          const { fill, rendererConfig } = self
          return fill ?? readConfObject(rendererConfig, 'filled')
        },
        get summaryScoreModeSetting(): string {
          const { summaryScoreMode: scoreMode, rendererConfig } = self
          return scoreMode ?? readConfObject(rendererConfig, 'summaryScoreMode')
        },
        get domain() {
          const { stats, scaleType, minScore, maxScore } = self
          const { scoreMin, scoreMax } = stats

          const ret = getNiceDomain({
            domain: [scoreMin, scoreMax],
            bounds: [minScore, maxScore],
            scaleType,
          })

          // avoid weird scalebar if log value and empty region displayed
          if (scaleType === 'log' && ret[1] === Number.MIN_VALUE) {
            return [0, Number.MIN_VALUE]
          }

          // avoid returning a new object if it matches the old value
          if (!deepEqual(oldDomain, ret)) {
            oldDomain = ret
          }

          return oldDomain
        },

        get scaleOpts() {
          const { scaleType, stats } = self
          return {
            autoscaleType: this.autoscaleType,
            domain: this.domain,
            stats,
            scaleType,
            inverted: getConf(self, 'inverted'),
          }
        },

        get autoscaleType() {
          return self.autoscale ?? (getConf(self, 'autoscale') as string)
        },

        get displayCrossHatchesSetting() {
          const { displayCrossHatches, rendererConfig } = self
          return (
            displayCrossHatches ??
            (readConfObject(rendererConfig, 'displayCrossHatches') as boolean)
          )
        },
        get rowHeight() {
          const { sources, height, isMultiRow } = self
          return isMultiRow ? height / (sources?.length || 1) : height
        },

        get rowHeightTooSmallForScalebar() {
          return this.rowHeight < 70
        },

        get useMinimalTicks() {
          return (
            getConf(self, 'minimalTicks') || this.rowHeightTooSmallForScalebar
          )
        },
      }
    })
    .views(self => ({
      get ticks() {
        const { scaleType, domain, isMultiRow, rowHeight, useMinimalTicks } =
          self

        const offset = isMultiRow ? 0 : YSCALEBAR_LABEL_OFFSET
        const ticks = axisPropsFromTickScale(
          getScale({
            scaleType,
            domain,
            range: [rowHeight - offset, offset],
            inverted: getConf(self, 'inverted') as boolean,
          }),
          4,
        )
        return useMinimalTicks ? { ...ticks, values: domain } : ticks
      },

      get colors() {
        return [
          'red',
          'blue',
          'green',
          'orange',
          'purple',
          'cyan',
          'pink',
          'darkblue',
          'darkred',
          'pink',
        ]
      },

      get adapterCapabilities() {
        const { adapterTypeName } = self
        return pluginManager.getAdapterType(adapterTypeName).adapterCapabilities
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        renderProps() {
          const superProps = superRenderProps()
          const {
            displayCrossHatches,
            filters,
            height,
            resolution,
            rpcDriverName,
            scaleOpts,
            sources,
            statsReady,
            ticks,
            rendererConfig: config,
          } = self
          return {
            ...superProps,
            notReady: superProps.notReady || !sources || !statsReady,
            displayModel: self,
            config,
            displayCrossHatches,
            filters,
            height,
            resolution,
            rpcDriverName,
            scaleOpts,
            sources,
            ticks,
            onMouseMove: (_: unknown, f: Feature) =>
              self.setFeatureUnderMouse(f),
            onMouseLeave: () => self.setFeatureUnderMouse(undefined),
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
                    subMenu: [
                      'xyplot',
                      'multirowxy',
                      'multirowdensity',
                      'multiline',
                      'multirowline',
                    ].map(key => ({
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
              ].map(([val, label]) => {
                return {
                  label,
                  type: 'radio',
                  checked: self.autoscaleType === val,
                  onClick: () => self.setAutoscale(val),
                }
              }),
            },
            {
              label: 'Set min/max score...',
              onClick: () => {
                const session = getSession(self)
                session.queueDialog(handleClose => [
                  SetMinMaxDlg,
                  { model: self, handleClose },
                ])
              },
            },
            {
              label: 'Edit colors/arrangement...',
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
          let stats
          try {
            self.setLoading(aborter)
            stats = await getStats(self, {
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
          addDisposer(
            self,
            autorun(async () => {
              const { rpcManager } = getSession(self)
              const { adapterConfig } = self
              const sessionId = getRpcSessionId(self)
              const sources = (await rpcManager.call(
                sessionId,
                'MultiWiggleGetSources',
                {
                  sessionId,
                  adapterConfig,
                },
              )) as Source[]
              if (isAlive(self)) {
                self.setSources(sources)
              }
            }),
          )
        },
        async renderSvg(opts: ExportSvgOpts) {
          await when(() => self.statsReady && !!self.regionCannotBeRenderedText)
          const { offsetPx } = getContainingView(self) as LGV
          return (
            <>
              <g id="snpcov">{await superRenderSvg(opts)}</g>
              <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
                <StatBars model={self} orientation="left" exportSVG />
              </g>
            </>
          )
        },
      }
    })

export type WiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WiggleDisplayModel = Instance<WiggleDisplayStateModel>

export default stateModelFactory

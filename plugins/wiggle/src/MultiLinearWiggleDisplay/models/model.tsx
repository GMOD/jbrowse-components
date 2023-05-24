import React, { lazy } from 'react'
import { addDisposer, isAlive, types, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
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
  isSelectionContainer,
  Feature,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { set1 as colors } from '@jbrowse/core/ui/colors'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  BaseLinearDisplay,
  ExportSvgDisplayOptions,
} from '@jbrowse/plugin-linear-genome-view'

// locals
import {
  getNiceDomain,
  getScale,
  quantitativeStatsAutorun,
  YSCALEBAR_LABEL_OFFSET,
} from '../../util'

import Tooltip from '../components/Tooltip'

const randomColor = () =>
  '#000000'.replace(/0/g, () => (~~(Math.random() * 16)).toString(16))

// lazy components
const SetMinMaxDlg = lazy(() => import('../../shared/SetMinMaxDialog'))
const SetColorDlg = lazy(() => import('../components/SetColorDialog'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'MultiXYPlotRenderer'],
  ['multirowxy', 'MultiRowXYPlotRenderer'],
  ['multirowdensity', 'MultiDensityRenderer'],
  ['multiline', 'MultiLineRenderer'],
  ['multirowline', 'MultiRowLineRenderer'],
])

interface Source {
  name: string
  color?: string
  group?: string
}

/**
 * #stateModel
 * MultiLinearWiggleDisplay
 */
export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearWiggleDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('MultiLinearWiggleDisplay'),
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
        layout: types.optional(types.frozen<Source[]>(), []),
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
      statsRegion: undefined as string | undefined,
      statsFetchInProgress: undefined as undefined | AbortController,
      featureUnderMouseVolatile: undefined as Feature | undefined,
      sourcesVolatile: undefined as Source[] | undefined,
    }))
    .actions(self => ({
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
      updateQuantitativeStats(stats: { scoreMin: number; scoreMax: number }) {
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
      setSources(sources: Source[]) {
        if (!deepEqual(sources, self.sourcesVolatile)) {
          self.sourcesVolatile = sources
        }
      },
      /**
       * #action
       */
      setColor(color: string) {
        self.color = color
      },
      /**
       * #action
       */
      setPosColor(color: string) {
        self.posColor = color
      },
      /**
       * #action
       */
      setNegColor(color: string) {
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
      setFeatureUnderMouse(f?: Feature) {
        self.featureUnderMouseVolatile = f
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

      setAutoscale(val: string) {
        self.autoscale = val
      },

      setMaxScore(val?: number) {
        self.constraints.max = val
      },

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
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
      },
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
        return self.scale ?? (getConf(self, 'scaleType') as string)
      },
      /**
       * #getter
       */
      get maxScore() {
        return self.constraints.max ?? (getConf(self, 'maxScore') as number)
      },
      /**
       * #getter
       */
      get minScore() {
        return self.constraints.min ?? (getConf(self, 'minScore') as number)
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
    .views(self => ({
      /**
       * #getter
       */
      get needsScalebar() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer' ||
          self.rendererTypeName === 'MultiLineRenderer' ||
          self.rendererTypeName === 'MultiRowLineRenderer'
        )
      },
      /**
       * #getter
       */
      get needsFullHeightScalebar() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiLineRenderer'
        )
      },
      /**
       * #getter
       */
      get isMultiRow() {
        return (
          self.rendererTypeName === 'MultiRowXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowLineRenderer' ||
          self.rendererTypeName === 'MultiDensityRenderer'
        )
      },
      /**
       * #getter
       * can be used to give it a "color scale" like a R heatmap, not
       * implemented like this yet but flag can be used for this
       */
      get needsCustomLegend() {
        return self.rendererTypeName === 'MultiDensityRenderer'
      },

      get canHaveFill() {
        return (
          self.rendererTypeName === 'MultiXYPlotRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer'
        )
      },
      /**
       * #getter
       * the multirowxy and multiline don't need to use colors on the legend
       * boxes since their track is drawn with the color. sort of a stylistic
       * choice
       */
      get renderColorBoxes() {
        return !(
          self.rendererTypeName === 'MultiRowLineRenderer' ||
          self.rendererTypeName === 'MultiRowXYPlotRenderer'
        )
      },
      /**
       * #getter
       * positions multi-row below the tracklabel even if using overlap
       * tracklabels for everything else
       */
      get prefersOffset() {
        return this.isMultiRow
      },
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
            color:
              s.color ||
              (!this.isMultiRow ? colors[i] || randomColor() : 'blue'),
          }))
      },
      /**
       * #getter
       */
      get filled(): boolean {
        const { fill, rendererConfig } = self
        return fill ?? readConfObject(rendererConfig, 'filled')
      },
      /**
       * #getter
       */
      get summaryScoreModeSetting(): string {
        const { summaryScoreMode: scoreMode, rendererConfig } = self
        return scoreMode ?? readConfObject(rendererConfig, 'summaryScoreMode')
      },
    }))

    .views(self => {
      let oldDomain: [number, number] = [0, 0]
      return {
        /**
         * #getter
         */
        get domain() {
          const { stats, scaleType, minScore, maxScore } = self
          if (!stats) {
            return undefined
          }
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
        /**
         * #getter
         */
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
        /**
         * #getter
         */
        get autoscaleType() {
          return self.autoscale ?? (getConf(self, 'autoscale') as string)
        },
        /**
         * #getter
         */
        get displayCrossHatchesSetting() {
          const { displayCrossHatches, rendererConfig } = self
          return (
            displayCrossHatches ??
            (readConfObject(rendererConfig, 'displayCrossHatches') as boolean)
          )
        },
        /**
         * #getter
         */
        get rowHeight() {
          const { sources, height, isMultiRow } = self
          return isMultiRow ? height / (sources?.length || 1) : height
        },
        /**
         * #getter
         */
        get rowHeightTooSmallForScalebar() {
          return this.rowHeight < 70
        },

        /**
         * #getter
         */
        get useMinimalTicks() {
          return (
            getConf(self, 'minimalTicks') || this.rowHeightTooSmallForScalebar
          )
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       */
      get ticks() {
        const { scaleType, domain, isMultiRow, rowHeight, useMinimalTicks } =
          self

        if (!domain) {
          return undefined
        }

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

      /**
       * #getter
       */
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

      /**
       * #getter
       */
      get adapterCapabilities() {
        const { adapterTypeName } = self
        return pluginManager.getAdapterType(adapterTypeName).adapterCapabilities
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
          const {
            displayCrossHatches,
            filters,
            height,
            resolution,
            rpcDriverName,
            scaleOpts,
            stats,
            sources,
            ticks,
            rendererConfig: config,
          } = self
          return {
            ...superProps,
            notReady: superProps.notReady || !sources || !stats,
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
      return {
        /**
         * #action
         */
        async reload() {
          self.setError()
          superReload()
        },

        afterAttach() {
          quantitativeStatsAutorun(self)
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

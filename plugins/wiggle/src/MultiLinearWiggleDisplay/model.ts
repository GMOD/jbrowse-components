import { lazy } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { set1 as colors } from '@jbrowse/core/ui/colors'
import { getSession, getContainingView } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import deepEqual from 'fast-deep-equal'
import { isAlive, types } from 'mobx-state-tree'
import { axisPropsFromTickScale } from 'react-d3-axis-mod'

// jbrowse imports
import SharedWiggleMixin from '../shared/SharedWiggleMixin'
import { getScale, YSCALEBAR_LABEL_OFFSET } from '../util'
import type { Source } from '../util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature, AnyReactComponentType } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// locals
import type { Instance } from 'mobx-state-tree'

const randomColor = () =>
  '#000000'.replaceAll('0', () => (~~(Math.random() * 16)).toString(16))

// lazies
const Tooltip = lazy(() => import('./components/Tooltip'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'MultiXYPlotRenderer'],
  ['multirowxy', 'MultiRowXYPlotRenderer'],
  ['multirowdensity', 'MultiDensityRenderer'],
  ['multiline', 'MultiLineRenderer'],
  ['multirowline', 'MultiRowLineRenderer'],
])

/**
 * #stateModel MultiLinearWiggleDisplay
 * extends
 * - [SharedWiggleMixin](../sharedwigglemixin)
 */
export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearWiggleDisplay',
      SharedWiggleMixin(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('MultiLinearWiggleDisplay'),

        /**
         * #property
         */
        layout: types.optional(types.frozen<Source[]>(), []),
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

      /**
       * #getter
       */
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

    .views(self => ({
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
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
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
            resolution: self.resolution,
            rpcDriverName: self.rpcDriverName,
            sources: self.sources,
          }
        },
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
         * unused currently
         */
        get quantitativeStatsRelevantToCurrentZoom() {
          const view = getContainingView(self) as LinearGenomeViewModel
          return self.stats?.currStatsBpPerPx === view.bpPerPx
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
          notReady: superProps.notReady || !self.sources || !self.stats,
          displayModel: self,
          rpcDriverName: self.rpcDriverName,
          displayCrossHatches: self.displayCrossHatches,
          height: self.height,
          ticks: self.ticks,
          stats: self.stats,
          scaleOpts: self.scaleOpts,
          onMouseMove: (_: unknown, f: Feature) => {
            self.setFeatureUnderMouse(f)
          },
          onMouseLeave: () => {
            self.setFeatureUnderMouse(undefined)
          },
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
        } else if (self.minSize === 1) {
          return 1
        } else {
          return 2
        }
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
                      onClick: () => {
                        self.setRendererType(key)
                      },
                    })),
                  },
                ]
              : []),

            {
              label: 'Edit colors/arrangement...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetColorDialog,
                  { model: self, handleClose },
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
              const [
                { getMultiWiggleSourcesAutorun },
                { getQuantitativeStatsAutorun },
              ] = await Promise.all([
                import('../getMultiWiggleSourcesAutorun'),
                import('../getQuantitativeStatsAutorun'),
              ])
              getQuantitativeStatsAutorun(self)
              getMultiWiggleSourcesAutorun(self)
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

export type WiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WiggleDisplayModel = Instance<WiggleDisplayStateModel>

export default stateModelFactory

import React, { lazy } from 'react'
import { addDisposer, isAlive, types, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { axisPropsFromTickScale } from 'react-d3-axis-mod'
import deepEqual from 'fast-deep-equal'

// jbrowse imports
import {
  AnyConfigurationSchemaType,
  getConf,
} from '@jbrowse/core/configuration'
import { getSession, Feature } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { set1 as colors } from '@jbrowse/core/ui/colors'
import PluginManager from '@jbrowse/core/PluginManager'
import { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

// locals
import { getScale, YSCALEBAR_LABEL_OFFSET } from '../../util'

import Tooltip from '../components/Tooltip'
import SharedWiggleMixin from '../../shared/modelShared'

const randomColor = () =>
  '#000000'.replaceAll('0', () => (~~(Math.random() * 16)).toString(16))

// lazies
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
        return Tooltip as unknown as React.FC
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
      const { renderSvg: superRenderSvg } = self
      return {
        afterAttach() {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            const { quantitativeStatsAutorun } = await import('../../util')
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

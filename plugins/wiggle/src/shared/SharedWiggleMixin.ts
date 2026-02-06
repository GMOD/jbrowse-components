import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getEnv, getSession, isSelectionContainer } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'

import { getNiceDomain } from '../util.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// lazies
const SetMinMaxDialog = lazy(() => import('./SetMinMaxDialog.tsx'))

/**
 * #stateModel SharedWiggleMixin
 */
export default function SharedWiggleMixin(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      BaseLinearDisplay,
      types.model({
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
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      message: undefined as undefined | string,
      /**
       * #volatile
       * statsRegion is a serialized snapshot of view.dynamicBlocks at the time
       * stats were fetched. since stats are fetched asynchronously, the view
       * may have panned by the time they return. renderProps compares this to
       * the current dynamicBlocks to detect stale stats and show a loading
       * state until fresh stats arrive
       */
      stats: undefined as
        | {
            currStatsBpPerPx: number
            scoreMin: number
            scoreMax: number
            scoreMeanMin?: number
            scoreMeanMax?: number
            statsRegion?: string
          }
        | undefined,
      /**
       * #volatile
       */
      statsFetchInProgress: undefined as undefined | StopToken,
    }))
    .actions(self => ({
      /**
       * #action
       */
      updateQuantitativeStats(
        stats: {
          currStatsBpPerPx: number
          scoreMin: number
          scoreMax: number
          scoreMeanMin?: number
          scoreMeanMax?: number
        },
        statsRegion?: string,
      ) {
        const {
          currStatsBpPerPx,
          scoreMin,
          scoreMax,
          scoreMeanMin,
          scoreMeanMax,
        } = stats
        const EPSILON = 0.000001
        if (
          !self.stats ||
          Math.abs(self.stats.scoreMax - scoreMax) > EPSILON ||
          Math.abs(self.stats.scoreMin - scoreMin) > EPSILON ||
          self.stats.statsRegion !== statsRegion
        ) {
          self.stats = {
            currStatsBpPerPx,
            scoreMin,
            scoreMax,
            scoreMeanMin,
            scoreMeanMax,
            statsRegion,
          }
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
      setStatsLoading(arg?: StopToken) {
        if (self.statsFetchInProgress) {
          stopStopToken(self.statsFetchInProgress)
        }
        self.statsFetchInProgress = arg
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
      get adapterTypeName() {
        return self.adapterConfig.type
      },

      /**
       * #getter
       */
      get rendererTypeNameSimple() {
        return (
          self.rendererTypeNameState ??
          (getConf(self, 'defaultRendering') as string)
        )
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
      get adapterCapabilities() {
        const type = self.adapterTypeName
        const { pluginManager } = getEnv(self)
        return pluginManager.getAdapterType(type)!.adapterCapabilities
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
        // @ts-ignore
        const conf = self.configuration.renderers?.[rendererTypeName]
        return {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          scaleType: scaleType ?? readConfObject(conf, 'scaleType'),
          filled: fill ?? readConfObject(conf, 'filled'),
          displayCrossHatches:
            displayCrossHatches ?? readConfObject(conf, 'displayCrossHatches'),
          summaryScoreMode:
            summaryScoreMode ?? readConfObject(conf, 'summaryScoreMode'),
          color: color ?? readConfObject(conf, 'color'),
          negColor: negColor ?? readConfObject(conf, 'negColor'),
          posColor: posColor ?? readConfObject(conf, 'posColor'),
          minSize: minSize ?? readConfObject(conf, 'minSize'),
        }
      },

      /**
       * #getter
       */
      get autoscaleType() {
        return self.autoscale ?? (getConf(self, 'autoscale') as string)
      },
    }))
    .views(self => {
      let oldDomain: [number, number] = [0, 0]
      return {
        /**
         * #getter
         */
        get domain() {
          const { stats, scaleType, minScore, maxScore, rendererConfig } = self
          if (!stats) {
            return undefined
          }

          const { summaryScoreMode } = rendererConfig
          const useMeanStats =
            summaryScoreMode === 'mean' || summaryScoreMode === 'avg'
          const domainMin = useMeanStats
            ? (stats.scoreMeanMin ?? stats.scoreMin)
            : stats.scoreMin
          const domainMax = useMeanStats
            ? (stats.scoreMeanMax ?? stats.scoreMax)
            : stats.scoreMax

          const ret = getNiceDomain({
            domain: [domainMin, domainMax],
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
      }
    })
    .views(self => ({
      /**
       * #getter
       */
      get filled() {
        return self.rendererConfig.filled
      },
      /**
       * #getter
       */
      get summaryScoreModeSetting() {
        return self.rendererConfig.summaryScoreMode
      },

      /**
       * #getter
       */
      get scaleOpts() {
        return {
          domain: self.domain,
          stats: self.stats,
          autoscaleType: self.autoscaleType,
          scaleType: self.scaleType,
          inverted: getConf(self, 'inverted') as boolean,
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
      get displayCrossHatchesSetting() {
        return self.rendererConfig.displayCrossHatches
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
    }))
    .views(self => ({
      /**
       * #method
       */
      scoreTrackMenuItems() {
        return [
          ...(self.hasResolution
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
                  subMenu: ['min', 'max', 'avg', 'whiskers'].map(elt => ({
                    label: elt,
                    type: 'radio',
                    checked: self.summaryScoreModeSetting === elt,
                    onClick: () => {
                      self.setSummaryScoreMode(elt)
                    },
                  })),
                },
              ]
            : []),
          {
            label: 'Scale type',
            subMenu: [
              {
                label: 'Linear scale',
                type: 'radio',
                checked: self.scaleType === 'linear',
                onClick: () => {
                  self.setScaleType('linear')
                },
              },
              {
                label: 'Log scale',
                type: 'radio',
                checked: self.scaleType === 'log',
                onClick: () => {
                  self.setScaleType('log')
                },
              },
            ],
          },
          {
            label: 'Autoscale type',
            subMenu: [
              ['local', 'Local'],
              ...(self.hasGlobalStats
                ? ([
                    ['global', 'Global'],
                    ['globalsd', 'Global ± 3σ'],
                  ] as const)
                : []),
              ['localsd', 'Local ± 3σ'],
            ].map(([val, label]) => ({
              label,
              type: 'radio',
              checked: self.autoscaleType === val,
              onClick: () => {
                self.setAutoscale(val)
              },
            })),
          },
          {
            label: 'Set min/max score',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SetMinMaxDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
        ]
      },
    }))
    .actions(self => {
      const { reload: superReload } = self
      return {
        /**
         * #action
         */
        async reload() {
          self.setError()
          superReload()
        },
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        selectedRendering,
        resolution,
        fill,
        minSize,
        color,
        posColor,
        negColor,
        summaryScoreMode,
        rendererTypeNameState,
        scale,
        autoscale,
        displayCrossHatches,
        constraints,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(selectedRendering ? { selectedRendering } : {}),
        ...(resolution !== 1 ? { resolution } : {}),
        ...(fill !== undefined ? { fill } : {}),
        ...(minSize !== undefined ? { minSize } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(posColor !== undefined ? { posColor } : {}),
        ...(negColor !== undefined ? { negColor } : {}),
        ...(summaryScoreMode !== undefined ? { summaryScoreMode } : {}),
        ...(rendererTypeNameState !== undefined
          ? { rendererTypeNameState }
          : {}),
        ...(scale !== undefined ? { scale } : {}),
        ...(autoscale !== undefined ? { autoscale } : {}),
        ...(displayCrossHatches !== undefined ? { displayCrossHatches } : {}),
        ...(constraints.min !== undefined || constraints.max !== undefined
          ? { constraints }
          : {}),
      } as typeof snap
    })
}

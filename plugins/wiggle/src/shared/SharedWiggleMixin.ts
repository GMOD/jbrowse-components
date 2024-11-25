import { lazy } from 'react'
import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getEnv, getSession, isSelectionContainer } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

// locals
import { getNiceDomain } from '../util'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

// lazies
const SetMinMaxDialog = lazy(() => import('./SetMinMaxDialog'))

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
       */
      stats: undefined as
        | { currStatsBpPerPx: number; scoreMin: number; scoreMax: number }
        | undefined,
      /**
       * #volatile
       */
      statsFetchInProgress: undefined as undefined | string,
    }))
    .actions(self => ({
      /**
       * #action
       */
      updateQuantitativeStats(stats: {
        currStatsBpPerPx: number
        scoreMin: number
        scoreMax: number
      }) {
        const { currStatsBpPerPx, scoreMin, scoreMax } = stats
        const EPSILON = 0.000001
        if (
          !self.stats ||
          Math.abs(self.stats.scoreMax - scoreMax) > EPSILON ||
          Math.abs(self.stats.scoreMin - scoreMin) > EPSILON
        ) {
          self.stats = {
            currStatsBpPerPx,
            scoreMin,
            scoreMax,
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
      setStatsLoading(arg?: string) {
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
        return self.rendererTypeNameState ?? getConf(self, 'defaultRendering')
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
        return self.scale ?? getConf(self, 'scaleType')
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

      /**
       * #getter
       */
      get autoscaleType() {
        return self.autoscale ?? getConf(self, 'autoscale')
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
      }
    })
    .views(self => ({
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
        const { summaryScoreMode: mode, rendererConfig } = self
        return mode ?? readConfObject(rendererConfig, 'summaryScoreMode')
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
      get displayCrossHatchesSetting(): boolean {
        const { displayCrossHatches: hatches, rendererConfig } = self
        return hatches ?? readConfObject(rendererConfig, 'displayCrossHatches')
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
            label:
              self.scaleType === 'log' ? 'Set linear scale' : 'Set log scale',
            onClick: () => {
              self.toggleLogScale()
            },
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
                { model: self, handleClose },
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
}

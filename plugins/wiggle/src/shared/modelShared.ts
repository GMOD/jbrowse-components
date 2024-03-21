import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  Feature,
  getEnv,
  getSession,
  isSelectionContainer,
} from '@jbrowse/core/util'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

// locals
import { getNiceDomain } from '../util'
import { lazy } from 'react'

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
        autoscale: types.maybe(types.string),

        /**
         * #property
         */
        color: types.maybe(types.string),

        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

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
        displayCrossHatches: types.maybe(types.boolean),

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
        negColor: types.maybe(types.string),

        /**
         * #property
         */
        posColor: types.maybe(types.string),

        /**
         * #property
         */
        rendererTypeNameState: types.maybe(types.string),

        /**
         * #property
         */
        resolution: types.optional(types.number, 1),

        /**
         * #property
         */
        scale: types.maybe(types.string),

        /**
         * #property
         */
        selectedRendering: types.optional(types.string, ''),

        /**
         * #property
         */
        summaryScoreMode: types.maybe(types.string),
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
      setAutoscale(val: string) {
        self.autoscale = val
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
      setCrossHatches(cross: boolean) {
        self.displayCrossHatches = cross
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
      setLoading(aborter: AbortController) {
        const { statsFetchInProgress: statsFetch } = self
        if (statsFetch !== undefined && !statsFetch.signal.aborted) {
          statsFetch.abort()
        }
        self.statsFetchInProgress = aborter
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
      setMinScore(val?: number) {
        self.constraints.min = val
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
      setPosColor(color?: string) {
        self.posColor = color
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
      setResolution(res: number) {
        self.resolution = res
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
      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
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
      updateQuantitativeStats(stats: { scoreMin: number; scoreMax: number }) {
        const { scoreMin, scoreMax } = stats
        const EPSILON = 0.000001
        if (!self.stats) {
          self.stats = { scoreMax, scoreMin }
        } else if (
          Math.abs(self.stats.scoreMax - scoreMax) > EPSILON ||
          Math.abs(self.stats.scoreMin - scoreMin) > EPSILON
        ) {
          self.stats = { scoreMax, scoreMin }
        }
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
       * subclasses can define these, as snpcoverage track does
       */
      get filters() {
        return undefined
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

      /**
       * #getter
       */
      get rendererTypeNameSimple() {
        return self.rendererTypeNameState ?? getConf(self, 'defaultRendering')
      },

      /**
       * #getter
       */
      get scaleType() {
        return self.scale ?? getConf(self, 'scaleType')
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get adapterCapabilities() {
        const type = self.adapterTypeName
        const { pluginManager } = getEnv(self)
        return pluginManager.getAdapterType(type).adapterCapabilities
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
            bounds: [minScore, maxScore],
            domain: [stats.scoreMin, stats.scoreMax],
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
      get filled(): boolean {
        const { fill, rendererConfig } = self
        return fill ?? readConfObject(rendererConfig, 'filled')
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
      get hasResolution() {
        return self.adapterCapabilities.includes('hasResolution')
      },

      /**
       * #getter
       */
      get scaleOpts() {
        return {
          autoscaleType: self.autoscaleType,
          domain: self.domain,
          inverted: getConf(self, 'inverted'),
          scaleType: self.scaleType,
          stats: self.stats,
        }
      },

      /**
       * #getter
       */
      get summaryScoreModeSetting(): string {
        const { summaryScoreMode: mode, rendererConfig } = self
        return mode ?? readConfObject(rendererConfig, 'summaryScoreMode')
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
                    checked: self.summaryScoreModeSetting === elt,
                    label: elt,
                    onClick: () => self.setSummaryScoreMode(elt),
                    type: 'radio',
                  })),
                },
              ]
            : []),
          {
            label:
              self.scaleType === 'log' ? 'Set linear scale' : 'Set log scale',
            onClick: () => self.toggleLogScale(),
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
              checked: self.autoscaleType === val,
              label,
              onClick: () => self.setAutoscale(val),
              type: 'radio',
            })),
          },
          {
            label: 'Set min/max score',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SetMinMaxDialog,
                { handleClose, model: self },
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

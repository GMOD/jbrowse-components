import { getConf } from '@jbrowse/core/configuration'
import { Feature, getSession, isSelectionContainer } from '@jbrowse/core/util'
import { types } from 'mobx-state-tree'

/**
 * #stateModel SharedWiggleModel
 */
export default function SharedWiggleMixin() {
  return types
    .model({
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
    })
    .volatile(() => ({
      message: undefined as undefined | string,
      stats: undefined as { scoreMin: number; scoreMax: number } | undefined,
      statsFetchInProgress: undefined as undefined | AbortController,
    }))
    .actions(self => ({
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
}

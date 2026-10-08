import { types } from '@jbrowse/mobx-state-tree'

import { ScoreScaleMixin } from './ScoreScaleMixin.ts'

import type { scalesSchema } from './valueScaleConfigSchema.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'

// Exactly the slots read here: `getConf` answers a slot a composer never
// declared with a silent `undefined`, which a wider host type would hide.
export interface WiggleScoreConfigHost {
  configuration: ConfigModelForFields<{
    scales: ReturnType<typeof scalesSchema>
  }>
}

/**
 * #stateModel WiggleScoreConfigMixin
 * #category display
 *
 * The score-plot config every display with a score axis shares: the axis
 * and its guides (`ScoreScaleMixin`). A display plotting one configured
 * field composes `ScoreFieldConfigMixin`,
 * which adds the `y` slot.
 */
export function WiggleScoreConfigMixin() {
  return types
    .compose('WiggleScoreConfigMixin', ScoreScaleMixin(), types.model({}))
    .views(() => ({
      /**
       * #getter
       * Whether score maps to color instead of height; a display overrides it.
       */
      get isDensityMode(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * A density row maps score to color and has no axis to start at 0, so
       * its domain spans the values whatever `scales.y.zero` says.
       */
      get axisReachesZero(): boolean {
        return self.scaleZero && !self.isDensityMode
      },
    }))
}

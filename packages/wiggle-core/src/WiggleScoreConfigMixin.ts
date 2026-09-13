import { getConf, setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ScoreScaleMixin } from './ScoreScaleMixin.ts'

import type { scoreAxisConfigSchemaFields } from './scoreAxisConfigSchemaFields.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The one slot this mixin reads that no shared field table holds: its
 * composers agree on the type and give it their own default and `advanced`
 * flag. A runtime value so `RestatedMixinSlots.test.ts` can check the
 * restatement against every real declaration.
 */
export const wiggleScoreConfigExtraSlots = {
  scatterPointSize: { type: 'number', defaultValue: 2 },
} as const

/**
 * Exactly the slots this mixin reads. `LinearMarkDisplay` composes it and
 * declares none of wiggle's slots, and `getConf` on an undeclared slot answers
 * `undefined` silently, so a wider host would be a wrong value no layer
 * reports.
 */
export interface WiggleScoreConfigHost {
  configuration: ConfigModelForFields<
    typeof scoreAxisConfigSchemaFields & typeof wiggleScoreConfigExtraSlots
  >
}

const confNode = (self: object) => self as WiggleScoreConfigHost

/**
 * #stateModel WiggleScoreConfigMixin
 * #category display
 *
 * The score-plot config every display with a score axis shares: the axis
 * (`ScoreScaleMixin`), the cross-hatch toggle and the scatter point size.
 * `LinearMarkDisplay` composes it as is; a display plotting one configured
 * feature field composes `ScoreFieldConfigMixin`, which adds `scoreField`.
 *
 * Config only: the strict-`bpPerPx` fetch rule and wiggle's palette,
 * rendering-type, summary-mode and resolution config are `WiggleCommonMixin`'s.
 */
export function WiggleScoreConfigMixin() {
  return types
    .compose('WiggleScoreConfigMixin', ScoreScaleMixin(), types.model({}))
    .views(self => ({
      /**
       * #getter
       */
      get scatterPointSize(): number {
        return getConf(confNode(self), 'scatterPointSize')
      },
      /**
       * #getter
       * The configured cross-hatch setting, which the menu toggles. A slot
       * rather than a display prop because MST drops a snapshot key the schema
       * never declares, so a prop cannot be set from a config. Read
       * `showCrossHatches` for what draws.
       */
      get displayCrossHatches(): boolean {
        return getConf(confNode(self), 'displayCrossHatches')
      },
      /**
       * #getter
       * Whether score maps to color instead of height. A display overrides
       * this from its own rendering-type table; the base is false.
       */
      get isDensityMode(): boolean {
        return false
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      toggleCrossHatches() {
        setConf(
          confNode(self),
          'displayCrossHatches',
          !self.displayCrossHatches,
        )
      },
      /**
       * #action
       */
      setScatterPointSize(val?: number) {
        setConf(confNode(self), 'scatterPointSize', val)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the score-axis cross hatches draw. Density spends color, not
       * height, on the score, so it has no axis to rule — and its track menu
       * drops the toggle, which would strand hatches enabled in another plot
       * type. Every consumer reads this, never `displayCrossHatches`.
       */
      get showCrossHatches() {
        return self.displayCrossHatches && !self.isDensityMode
      },
    }))
}

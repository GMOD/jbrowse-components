import { getConf, setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ScoreScaleMixin } from './ScoreScaleMixin.ts'

import type { scalesSchema } from './valueScaleConfigSchema.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { DisplayEntry } from '@jbrowse/core/pluggableElementTypes'

// A v4 entry spelt the point diameter `scatterPointSize`, which is `size` now.
export function liftScatterPointSize(entry: DisplayEntry): DisplayEntry {
  const { scatterPointSize, ...rest } = entry
  return scatterPointSize === undefined
    ? entry
    : { size: scatterPointSize, ...rest }
}

/** The slots its composers each declare, with their own defaults. */
export const wiggleScoreConfigExtraSlots = {
  size: { type: 'number', defaultValue: 2 },
  displayCrossHatches: { type: 'boolean', defaultValue: false },
} as const

// Exactly the slots read here: `getConf` answers a slot a composer never
// declared with a silent `undefined`, which a wider host type would hide.
export interface WiggleScoreConfigHost {
  configuration: ConfigModelForFields<
    {
      scales: ReturnType<typeof scalesSchema>
    } & typeof wiggleScoreConfigExtraSlots
  >
}

const confNode = (self: object) => self as WiggleScoreConfigHost

/**
 * #stateModel WiggleScoreConfigMixin
 * #category display
 *
 * The score-plot config every display with a score axis shares: the axis
 * (`ScoreScaleMixin`), the cross-hatch toggle and the scatter point size. A
 * display plotting one configured field composes `ScoreFieldConfigMixin`,
 * which adds `scoreField`.
 */
export function WiggleScoreConfigMixin() {
  return types
    .compose('WiggleScoreConfigMixin', ScoreScaleMixin(), types.model({}))
    .views(self => ({
      /**
       * #getter
       */
      get size(): number {
        return getConf(confNode(self), 'size')
      },
      /**
       * #getter
       * The configured cross-hatch setting the menu toggles; `showCrossHatches`
       * is what draws.
       */
      get displayCrossHatches(): boolean {
        return getConf(confNode(self), 'displayCrossHatches')
      },
      /**
       * #getter
       * Whether score maps to color instead of height; a display overrides it.
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
      setSize(val?: number) {
        setConf(confNode(self), 'size', val)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the score-axis cross hatches draw: never in density mode, which
       * has no height axis to rule and no toggle in its menu.
       */
      get showCrossHatches() {
        return self.displayCrossHatches && !self.isDensityMode
      },
    }))
}

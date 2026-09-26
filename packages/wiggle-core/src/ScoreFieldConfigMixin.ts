import { getConf } from '@jbrowse/core/configuration'

import { WiggleScoreConfigMixin } from './WiggleScoreConfigMixin.ts'

import type { ScoreFieldConfigModel } from './scoreFieldConfigSchemaFields.ts'

export interface ScoreFieldConfigHost {
  configuration: ScoreFieldConfigModel
}

const confNode = (self: object) => self as ScoreFieldConfigHost

/**
 * #stateModel ScoreFieldConfigMixin
 * #category display
 *
 * `WiggleScoreConfigMixin` plus `scoreField`, for a display that plots one
 * configured feature field and so declares `scoreFieldConfigSchemaFields`:
 * the wiggle display. `LinearMarkDisplay` names a field per mark and composes
 * the base instead.
 */
export function ScoreFieldConfigMixin() {
  return WiggleScoreConfigMixin().views(self => ({
    /**
     * #getter
     * The feature field the worker plots on the score axis, `score` by
     * default. A fetch input: every composing display carries it in its
     * `rpcProps()`, since the field is read where the features are.
     */
    get scoreField(): string {
      return getConf(confNode(self), 'scoreField')
    },
  }))
}

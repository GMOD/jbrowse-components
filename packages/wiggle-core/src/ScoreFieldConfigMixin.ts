import { getConf } from '@jbrowse/core/configuration'

import { WiggleScoreConfigMixin } from './WiggleScoreConfigMixin.ts'

import type { YFieldConfigModel } from './yFieldConfigSchemaFields.ts'

export interface ScoreFieldConfigHost {
  configuration: YFieldConfigModel
}

const confNode = (self: object) => self as ScoreFieldConfigHost

/**
 * #stateModel ScoreFieldConfigMixin
 * #category display
 *
 * `WiggleScoreConfigMixin` plus the `y` slot, for a display that plots one
 * configured feature field and so declares `yFieldConfigSchemaFields`:
 * the wiggle display. `LinearMarkDisplay` names a field per mark and composes
 * the base instead.
 */
export function ScoreFieldConfigMixin() {
  return WiggleScoreConfigMixin().views(self => ({
    /**
     * #getter
     * The feature field the worker plots on the value axis, the `y` slot,
     * `score` by default. A fetch input: every composing display carries it in
     * its `rpcProps()`, since the field is read where the features are.
     */
    get scoreField(): string {
      return getConf(confNode(self), 'y')
    },
  }))
}
